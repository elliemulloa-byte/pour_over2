import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDb, db } from './db.js';
import { seedIfEmpty } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const distPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

app.get('/api/drinks/search', (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  const lat = req.query.lat ? parseFloat(req.query.lat) : null;
  const lng = req.query.lng ? parseFloat(req.query.lng) : null;

  if (!q || q.length < 2) {
    return res.json({ results: [], suggestions: [] });
  }

  const drinks = db
    .prepare(
      `
    SELECT
      d.id AS drink_id,
      d.drink_type,
      d.display_name,
      s.id AS shop_id,
      s.name AS shop_name,
      s.address AS shop_address,
      s.lat AS shop_lat,
      s.lng AS shop_lng
    FROM drinks d
    JOIN shops s ON s.id = d.shop_id
    WHERE LOWER(d.drink_type) LIKE ? OR LOWER(d.display_name) LIKE ?
  `
    )
    .all(`%${q}%`, `%${q}%`);

  const drinkIds = [...new Set(drinks.map((r) => r.drink_id))];
  if (drinkIds.length === 0) {
    return res.json({ results: [], suggestions: [] });
  }

  const placeholders = drinkIds.map(() => '?').join(',');
  const stats = db
    .prepare(
      `
    SELECT drink_id,
           COUNT(*) AS review_count,
           AVG(rating) AS avg_rating
    FROM drink_reviews
    WHERE drink_id IN (${placeholders})
    GROUP BY drink_id
  `
    )
    .all(...drinkIds);

  const statsByDrink = Object.fromEntries(stats.map((s) => [s.drink_id, s]));

  const results = drinks.map((d) => {
    const st = statsByDrink[d.drink_id] || { review_count: 0, avg_rating: null };
    let distanceKm = null;
    if (lat != null && lng != null && d.shop_lat != null && d.shop_lng != null) {
      distanceKm = haversineKm(lat, lng, d.shop_lat, d.shop_lng);
    }
    return {
      drinkId: d.drink_id,
      drinkType: d.drink_type,
      displayName: d.display_name,
      shopId: d.shop_id,
      shopName: d.shop_name,
      shopAddress: d.shop_address,
      reviewCount: st.review_count,
      avgRating: st.avg_rating != null ? Math.round(Number(st.avg_rating) * 10) / 10 : null,
      distanceKm: distanceKm != null ? Math.round(distanceKm * 10) / 10 : null,
    };
  });

  const relevance = (r) => {
    let score = 0;
    const exactMatch = r.drinkType === q || r.displayName.toLowerCase() === q;
    if (exactMatch) score += 100;
    else if (r.drinkType.startsWith(q) || r.displayName.toLowerCase().startsWith(q)) score += 50;
    if (r.avgRating != null) score += r.avgRating * 10;
    score += Math.log1p(r.reviewCount) * 5;
    if (r.distanceKm != null) score -= r.distanceKm * 2;
    return score;
  };

  results.sort((a, b) => relevance(b) - relevance(a));

  const suggestions = [
    ...new Set(
      results
        .slice(0, 20)
        .map((r) => r.displayName)
        .filter(Boolean)
    ),
  ].slice(0, 8);

  res.json({ results, suggestions });
});

app.get('/api/drinks/suggest', (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  if (q.length < 1) {
    return res.json({ suggestions: [] });
  }
  const rows = db
    .prepare(
      `SELECT DISTINCT display_name FROM drinks
       WHERE LOWER(drink_type) LIKE ? OR LOWER(display_name) LIKE ?
       LIMIT 10`
    )
    .all(`%${q}%`, `%${q}%`);
  res.json({ suggestions: rows.map((r) => r.display_name) });
});

app.get('/api/drinks/popular', (req, res) => {
  const rows = db
    .prepare(
      `SELECT d.display_name
       FROM drinks d
       LEFT JOIN drink_reviews r ON r.drink_id = d.id
       GROUP BY d.display_name
       ORDER BY COUNT(r.id) DESC, d.display_name
       LIMIT 24`
    )
    .all();
  res.json({ suggestions: rows.map((r) => r.display_name) });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

if (fs.existsSync(distPath)) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'), (err) => {
      if (err) res.status(404).json({ error: 'Not found' });
    });
  });
}

initDb().then(async () => {
  await seedIfEmpty();
  app.listen(PORT, () => {
    console.log(`Server at http://localhost:${PORT}`);
  });
});
