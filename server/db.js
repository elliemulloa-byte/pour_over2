import initSqlJs from 'sql.js';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'pour_over.db');

let SQL = null;
let _db = null;

function rowsToObjects(columns, values) {
  if (!values || values.length === 0) return [];
  return values.map((row) => {
    const obj = {};
    columns.forEach((col, i) => (obj[col] = row[i]));
    return obj;
  });
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS shops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    lat REAL,
    lng REAL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS drinks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id INTEGER NOT NULL,
    drink_type TEXT NOT NULL,
    display_name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (shop_id) REFERENCES shops(id)
  );

  CREATE TABLE IF NOT EXISTS drink_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    drink_id INTEGER NOT NULL,
    user_id INTEGER,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (drink_id) REFERENCES drinks(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS place_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    place_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS place_drinks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    place_id TEXT NOT NULL,
    drink_type TEXT NOT NULL,
    display_name TEXT NOT NULL,
    is_seasonal INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS place_drink_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    place_drink_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (place_drink_id) REFERENCES place_drinks(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_drinks_drink_type ON drinks(drink_type);
  CREATE INDEX IF NOT EXISTS idx_place_drinks_place ON place_drinks(place_id);
  CREATE INDEX IF NOT EXISTS idx_place_drink_reviews_drink ON place_drink_reviews(place_drink_id);
  CREATE INDEX IF NOT EXISTS idx_drinks_shop ON drinks(shop_id);
  CREATE INDEX IF NOT EXISTS idx_reviews_drink ON drink_reviews(drink_id);
  CREATE INDEX IF NOT EXISTS idx_place_reviews_place ON place_reviews(place_id);
`;

export async function initDb() {
  if (_db) return _db;
  SQL = await initSqlJs();
  if (existsSync(dbPath)) {
    try {
      const buf = readFileSync(dbPath);
      _db = new SQL.Database(buf);
    } catch {
      _db = new SQL.Database();
    }
  } else {
    _db = new SQL.Database();
  }
  _db.exec(SCHEMA);
  // Migration: add user_id to drink_reviews if missing (existing DBs)
  try {
    _db.exec('ALTER TABLE drink_reviews ADD COLUMN user_id INTEGER');
  } catch (_) {
    // Column already exists
  }
  try {
    _db.exec('ALTER TABLE shops ADD COLUMN city TEXT');
  } catch (_) {
    // Column already exists
  }
  try {
    _db.exec('CREATE INDEX IF NOT EXISTS idx_reviews_user ON drink_reviews(user_id)');
  } catch (_) {
    // Index already exists
  }
  // search_count for future relevance / most-searched sorting
  try {
    _db.exec('ALTER TABLE drinks ADD COLUMN search_count INTEGER DEFAULT 0');
  } catch (_) {
    // Column already exists
  }
  try {
    _db.exec(`CREATE TABLE IF NOT EXISTS place_drinks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      place_id TEXT NOT NULL,
      drink_type TEXT NOT NULL,
      display_name TEXT NOT NULL,
      is_seasonal INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`);
    _db.exec(`CREATE TABLE IF NOT EXISTS place_drink_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      place_drink_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (place_drink_id) REFERENCES place_drinks(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);
    _db.exec('CREATE INDEX IF NOT EXISTS idx_place_drinks_place ON place_drinks(place_id)');
    _db.exec('CREATE INDEX IF NOT EXISTS idx_place_drink_reviews_drink ON place_drink_reviews(place_drink_id)');
  } catch (_) { /* already exists */ }
  return _db;
}

function getDb() {
  if (!_db) throw new Error('Database not initialized. Call initDb() first.');
  return _db;
}

const db = {
  exec(sql) {
    getDb().exec(sql);
  },
  prepare(sql) {
    return {
      run(...params) {
        const db = getDb();
        const stmt = db.prepare(sql);
        stmt.bind(params);
        stmt.step();
        const rowid = db.exec('SELECT last_insert_rowid() as id')[0]?.values?.[0]?.[0];
        stmt.free();
        return { lastInsertRowid: rowid };
      },
      all(...params) {
        const db = getDb();
        const stmt = db.prepare(sql);
        stmt.bind(params);
        const rows = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        stmt.free();
        return rows;
      },
    };
  },
};

export { db };
