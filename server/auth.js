import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { db } from './db.js';

const SESSION_COOKIE = 'pour_over_sid';
const SESSION_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function createSession(userId) {
  const id = randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_AGE_MS).toISOString();
  db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(id, userId, expiresAt);
  return { id, expiresAt };
}

function getSession(sessionId) {
  if (!sessionId) return null;
  const row = db.prepare(
    'SELECT s.user_id, u.email, u.display_name, COALESCE(NULLIF(u.avatar, \'bean\'), \'cup\') AS avatar FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > datetime("now")'
  ).all(sessionId)[0];
  return row ? { userId: row.user_id, email: row.email, displayName: row.display_name, avatar: row.avatar || 'cup' } : null;
}

function destroySession(sessionId) {
  if (sessionId) db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

export function requireAuth(req, res, next) {
  const sessionId = req.cookies?.[SESSION_COOKIE];
  const session = getSession(sessionId);
  if (!session) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  req.session = session;
  next();
}

export function authRoutes(app) {
  app.post('/api/auth/signup', (req, res) => {
    const { email, password, displayName } = req.body || {};
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const emailTrim = email.trim().toLowerCase();
    if (emailTrim.length < 3 || password.length < 6) {
      return res.status(400).json({ error: 'Email and password must be at least 3 and 6 characters' });
    }
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').all(emailTrim);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const hash = hashPassword(password);
    const name = typeof displayName === 'string' ? displayName.trim() || null : null;
    db.prepare('INSERT INTO users (email, password_hash, display_name, avatar) VALUES (?, ?, ?, ?)').run(emailTrim, hash, name, 'cup');
    const userRow = db.prepare('SELECT id, email, display_name, COALESCE(NULLIF(avatar, \'bean\'), \'cup\') AS avatar, created_at FROM users WHERE id = last_insert_rowid()').all()[0];
    const { id } = createSession(userRow.id);
    res.cookie(SESSION_COOKIE, id, {
      httpOnly: true,
      maxAge: SESSION_AGE_MS,
      sameSite: 'lax',
      path: '/',
    });
    res.status(201).json({
      user: {
        id: userRow.id,
        email: userRow.email,
        displayName: userRow.display_name,
        avatar: userRow.avatar || 'cup',
        createdAt: userRow.created_at,
      },
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const emailTrim = email.trim().toLowerCase();
    const user = db.prepare('SELECT id, email, display_name, COALESCE(NULLIF(avatar, \'bean\'), \'cup\') AS avatar, password_hash FROM users WHERE email = ?').all(emailTrim)[0];
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const { id } = createSession(user.id);
    res.cookie(SESSION_COOKIE, id, {
      httpOnly: true,
      maxAge: SESSION_AGE_MS,
      sameSite: 'lax',
      path: '/',
    });
    res.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        avatar: user.avatar || 'cup',
      },
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    destroySession(req.cookies?.[SESSION_COOKIE]);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ ok: true });
  });

  app.get('/api/auth/me', (req, res) => {
    const sessionId = req.cookies?.[SESSION_COOKIE];
    const session = getSession(sessionId);
    if (!session) {
      return res.json({ user: null });
    }
    res.json({
      user: {
        id: session.userId,
        email: session.email,
        displayName: session.displayName,
        avatar: session.avatar || 'cup',
      },
    });
  });

  app.patch('/api/auth/me', requireAuth, (req, res) => {
    const { avatar } = req.body || {};
    const valid = ['cup', 'scroll'];
    const isCustom = typeof avatar === 'string' && avatar.startsWith('data:image/');
    if (!avatar || (!valid.includes(avatar) && !isCustom)) {
      return res.status(400).json({ error: 'Avatar must be cup, scroll, or a custom image data URL' });
    }
    const value = isCustom ? (avatar.length < 200000 ? avatar : null) : avatar;
    if (!value) return res.status(400).json({ error: 'Custom image too large (max ~200KB)' });
    try {
      db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(value, req.session.userId);
      res.json({ avatar: value });
    } catch (e) {
      res.status(500).json({ error: 'Failed to update avatar' });
    }
  });
}

export { SESSION_COOKIE, getSession, destroySession };
