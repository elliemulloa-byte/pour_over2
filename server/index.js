import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDb, db } from './db.js';
import { seedIfEmpty } from './seed.js';
import { authRoutes, requireAuth } from './auth.js';
import { fetchPlacesFromGoogle, fetchPlaceDetails } from './places.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

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
  try {
    const rows = db
      .prepare(
        `SELECT d.display_name
         FROM drinks d
         LEFT JOIN drink_reviews r ON r.drink_id = d.id
         GROUP BY d.display_name
         ORDER BY COALESCE(SUM(d.search_count), 0) DESC, COUNT(r.id) DESC, d.display_name
         LIMIT 24`
      )
      .all();
    res.json({ suggestions: rows.map((r) => r.display_name) });
  } catch (_) {
    const rows = db.prepare(`SELECT display_name FROM drinks GROUP BY display_name ORDER BY display_name LIMIT 24`).all();
    res.json({ suggestions: rows.map((r) => r.display_name) });
  }
});

// Shop search (Yelp-style: search by shop name + location)
app.get('/api/shops/search', (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  const lat = req.query.lat ? parseFloat(req.query.lat) : null;
  const lng = req.query.lng ? parseFloat(req.query.lng) : null;

  if (!q || q.length < 2) {
    return res.json({ shops: [] });
  }

  const rows = db
    .prepare(
      `SELECT s.id, s.name, s.address, s.city, s.lat, s.lng
       FROM shops s
       WHERE LOWER(s.name) LIKE ? OR (s.city IS NOT NULL AND LOWER(s.city) LIKE ?)`
    )
    .all(`%${q}%`, `%${q}%`);

  const stats = db.prepare(`
    SELECT d.shop_id, COUNT(DISTINCT d.id) AS drink_count,
           COUNT(r.id) AS review_count, AVG(r.rating) AS avg_rating
    FROM drinks d
    LEFT JOIN drink_reviews r ON r.drink_id = d.id
    WHERE d.shop_id IN (${rows.map((r) => '?').join(',')})
    GROUP BY d.shop_id
  `).all(...rows.map((r) => r.id));
  const statsByShop = Object.fromEntries(stats.map((s) => [s.shop_id, s]));

  const results = rows.map((r) => {
    const st = statsByShop[r.id] || { drink_count: 0, review_count: 0, avg_rating: null };
    let distanceKm = null;
    if (lat != null && lng != null && r.lat != null && r.lng != null) {
      distanceKm = haversineKm(lat, lng, r.lat, r.lng);
    }
    return {
      shopId: r.id,
      shopName: r.name,
      address: r.address,
      city: r.city,
      lat: r.lat,
      lng: r.lng,
      reviewCount: st.review_count,
      avgRating: st.avg_rating != null ? Math.round(Number(st.avg_rating) * 10) / 10 : null,
      drinkCount: st.drink_count,
      distanceKm: distanceKm != null ? Math.round(distanceKm * 10) / 10 : null,
    };
  });

  if (lat != null && lng != null) {
    results.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
  }

  res.json({ shops: results });
});

// Shop detail (Yelp-style: shop info + drinks with ratings + reviews)
app.get('/api/shops/:shopId', (req, res) => {
  const shopId = parseInt(req.params.shopId, 10);
  if (!Number.isInteger(shopId) || shopId < 1) {
    return res.status(400).json({ error: 'Invalid shop id' });
  }
  const shop = db.prepare('SELECT id, name, address, city, lat, lng FROM shops WHERE id = ?').all(shopId)[0];
  if (!shop) return res.status(404).json({ error: 'Shop not found' });

  const drinks = db.prepare(`
    SELECT d.id AS drink_id, d.drink_type, d.display_name,
           COUNT(r.id) AS review_count, AVG(r.rating) AS avg_rating
    FROM drinks d
    LEFT JOIN drink_reviews r ON r.drink_id = d.id
    WHERE d.shop_id = ?
    GROUP BY d.id
  `).all(shopId);

  const allReviews = db.prepare(`
    SELECT r.id, r.rating, r.comment, r.created_at, d.display_name AS drink_name
    FROM drink_reviews r
    JOIN drinks d ON d.id = r.drink_id
    WHERE d.shop_id = ?
    ORDER BY r.created_at DESC
    LIMIT 50
  `).all(shopId);

  const overall = drinks.length > 0
    ? drinks.reduce((sum, d) => sum + (d.avg_rating || 0) * (d.review_count || 0), 0) /
      Math.max(1, drinks.reduce((sum, d) => sum + (d.review_count || 0), 0))
    : null;

  res.json({
    shop: {
      id: shop.id,
      name: shop.name,
      address: shop.address,
      city: shop.city,
      lat: shop.lat,
      lng: shop.lng,
      avgRating: overall != null ? Math.round(overall * 10) / 10 : null,
      reviewCount: allReviews.length,
    },
    drinks: drinks.map((d) => ({
      drinkId: d.drink_id,
      displayName: d.display_name,
      drinkType: d.drink_type,
      avgRating: d.avg_rating != null ? Math.round(Number(d.avg_rating) * 10) / 10 : null,
      reviewCount: d.review_count,
    })),
    reviews: allReviews,
  });
});

// Add drink to shop (user-contributed)
app.post('/api/shops/:shopId/drinks', requireAuth, (req, res) => {
  const shopId = parseInt(req.params.shopId, 10);
  const { drinkType, displayName } = req.body || {};
  if (!Number.isInteger(shopId) || shopId < 1) {
    return res.status(400).json({ error: 'Invalid shop id' });
  }
  const shop = db.prepare('SELECT id FROM shops WHERE id = ?').all(shopId)[0];
  if (!shop) return res.status(404).json({ error: 'Shop not found' });
  const type = (typeof drinkType === 'string' ? drinkType.trim() : '') || (typeof displayName === 'string' ? displayName.trim() : null);
  if (!type || type.length < 2) {
    return res.status(400).json({ error: 'Drink name required (min 2 chars)' });
  }
  const display = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
  const existing = db.prepare('SELECT id FROM drinks WHERE shop_id = ? AND (LOWER(drink_type) = ? OR LOWER(display_name) = ?)').all(shopId, type.toLowerCase(), display.toLowerCase());
  if (existing.length > 0) {
    return res.status(409).json({ error: 'Drink already exists at this shop' });
  }
  const { lastInsertRowid } = db.prepare('INSERT INTO drinks (shop_id, drink_type, display_name) VALUES (?, ?, ?)').run(shopId, type.toLowerCase(), display);
  const row = db.prepare('SELECT id, shop_id, drink_type, display_name, created_at FROM drinks WHERE id = ?').all(lastInsertRowid)[0];
  res.status(201).json({ drink: row });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// Google Place Details (photos, interior, menu) - requires GOOGLE_PLACES_API_KEY
app.get('/api/places/:placeId', async (req, res) => {
  const placeId = req.params.placeId;
  if (!placeId || typeof placeId !== 'string') {
    return res.status(400).json({ error: 'Place ID required' });
  }
  const place = await fetchPlaceDetails(placeId.trim());
  if (!place) return res.status(404).json({ error: 'Place not found' });
  res.json({ place });
});

// Unified search: returns both shops and drinks (Yelp-style)
// When GOOGLE_PLACES_API_KEY is set, includes real coffee shops from Google, sorted by proximity
app.get('/api/search', async (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  const lat = req.query.lat ? parseFloat(req.query.lat) : null;
  const lng = req.query.lng ? parseFloat(req.query.lng) : null;

  if (!q || q.length < 2) {
    return res.json({ shops: [], drinks: [], suggestions: [] });
  }

  // Search shops by name (local DB)
  const shopRows = db.prepare(`
    SELECT s.id, s.name, s.address, s.city, s.lat, s.lng
    FROM shops s WHERE LOWER(s.name) LIKE ?
  `).all(`%${q}%`);

  const shopIds = shopRows.map((r) => r.id);
  let shops = [];
  if (shopRows.length > 0) {
    const shopStats = db.prepare(`
      SELECT d.shop_id, COUNT(r.id) AS review_count, AVG(r.rating) AS avg_rating
      FROM drinks d LEFT JOIN drink_reviews r ON r.drink_id = d.id
      WHERE d.shop_id IN (${shopIds.map(() => '?').join(',')}) GROUP BY d.shop_id
    `).all(...shopIds);
    const statsByShop = Object.fromEntries(shopStats.map((s) => [s.shop_id, s]));
    shops = shopRows.map((r) => {
      const st = statsByShop[r.id] || { review_count: 0, avg_rating: null };
      let distanceKm = null;
      if (lat != null && lng != null && r.lat != null && r.lng != null) {
        distanceKm = haversineKm(lat, lng, r.lat, r.lng);
      }
      return {
        shopId: r.id, shopName: r.name, address: r.address, city: r.city,
        avgRating: st.avg_rating != null ? Math.round(Number(st.avg_rating) * 10) / 10 : null,
        reviewCount: st.review_count, distanceKm: distanceKm != null ? Math.round(distanceKm * 10) / 10 : null,
        source: 'local',
      };
    });
  }

  // Fetch real coffee shops from Google Places when API key and location provided
  if (lat != null && lng != null) {
    const googlePlaces = await fetchPlacesFromGoogle(q, lat, lng);
    for (const p of googlePlaces) {
      if (p.lat != null && p.lng != null) {
        p.distanceKm = Math.round(haversineKm(lat, lng, p.lat, p.lng) * 10) / 10;
      }
    }
    shops = [...shops, ...googlePlaces];
    shops.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
  } else if (shops.length > 0) {
    shops.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
  }

  // Search drinks
  const drinkRows = db.prepare(`
    SELECT d.id AS drink_id, d.drink_type, d.display_name, s.id AS shop_id, s.name AS shop_name, s.address AS shop_address, s.lat AS shop_lat, s.lng AS shop_lng
    FROM drinks d JOIN shops s ON s.id = d.shop_id
    WHERE LOWER(d.drink_type) LIKE ? OR LOWER(d.display_name) LIKE ?
  `).all(`%${q}%`, `%${q}%`);

  const drinkIds = [...new Set(drinkRows.map((r) => r.drink_id))];
  let drinks = [];
  if (drinkIds.length > 0) {
    try {
      db.prepare(`UPDATE drinks SET search_count = COALESCE(search_count, 0) + 1 WHERE id IN (${drinkIds.slice(0, 50).map(() => '?').join(',')})`).run(...drinkIds.slice(0, 50));
    } catch (_) { /* search_count column may not exist in old DBs */ }
    const drinkStats = db.prepare(`
      SELECT drink_id, COUNT(*) AS review_count, AVG(rating) AS avg_rating
      FROM drink_reviews WHERE drink_id IN (${drinkIds.map(() => '?').join(',')}) GROUP BY drink_id
    `).all(...drinkIds);
    const statsByDrink = Object.fromEntries(drinkStats.map((s) => [s.drink_id, s]));
    drinks = drinkRows.map((d) => {
      const st = statsByDrink[d.drink_id] || { review_count: 0, avg_rating: null };
      let distanceKm = null;
      if (lat != null && lng != null && d.shop_lat != null && d.shop_lng != null) {
        distanceKm = haversineKm(lat, lng, d.shop_lat, d.shop_lng);
      }
      return {
        drinkId: d.drink_id, drinkType: d.drink_type, displayName: d.display_name,
        shopId: d.shop_id, shopName: d.shop_name, shopAddress: d.shop_address,
        avgRating: st.avg_rating != null ? Math.round(Number(st.avg_rating) * 10) / 10 : null,
        reviewCount: st.review_count, distanceKm: distanceKm != null ? Math.round(distanceKm * 10) / 10 : null,
      };
    });
    const relevance = (r) => {
      let s = 0;
      if (r.drinkType === q || r.displayName.toLowerCase() === q) s += 100;
      else if (r.drinkType.startsWith(q) || r.displayName.toLowerCase().startsWith(q)) s += 50;
      if (r.avgRating != null) s += r.avgRating * 10;
      s += Math.log1p(r.reviewCount) * 5;
      if (r.distanceKm != null) s -= r.distanceKm * 2;
      return s;
    };
    drinks.sort((a, b) => relevance(b) - relevance(a));
  }

  const suggestions = [...new Set([...shops.slice(0, 4).map((s) => s.shopName), ...drinks.slice(0, 6).map((d) => d.displayName)])];
  res.json({ shops, drinks, suggestions });
});

authRoutes(app);

app.get('/api/users/me/reviews', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const rows = db.prepare(`
    SELECT r.id AS review_id, r.rating, r.comment, r.created_at,
           d.id AS drink_id, d.display_name AS drink_name,
           s.id AS shop_id, s.name AS shop_name, s.address AS shop_address
    FROM drink_reviews r
    JOIN drinks d ON d.id = r.drink_id
    JOIN shops s ON s.id = d.shop_id
    WHERE r.user_id = ?
    ORDER BY r.created_at DESC
  `).all(userId);
  res.json({ reviews: rows });
});

app.post('/api/drinks/:drinkId/reviews', requireAuth, (req, res) => {
  const drinkId = parseInt(req.params.drinkId, 10);
  const { rating, comment } = req.body || {};
  if (!Number.isInteger(drinkId) || drinkId < 1) {
    return res.status(400).json({ error: 'Invalid drink id' });
  }
  const r = typeof rating === 'number' ? Math.round(rating) : parseInt(rating, 10);
  if (!Number.isInteger(r) || r < 1 || r > 5) {
    return res.status(400).json({ error: 'Rating must be 1–5' });
  }
  const drink = db.prepare('SELECT id FROM drinks WHERE id = ?').all(drinkId)[0];
  if (!drink) {
    return res.status(404).json({ error: 'Drink not found' });
  }
  const commentText = typeof comment === 'string' ? comment.trim() || null : null;
  const { lastInsertRowid } = db.prepare('INSERT INTO drink_reviews (drink_id, user_id, rating, comment) VALUES (?, ?, ?, ?)').run(drinkId, req.session.userId, r, commentText);
  const row = db.prepare('SELECT id, drink_id, rating, comment, created_at FROM drink_reviews WHERE id = ?').all(lastInsertRowid)[0];
  res.status(201).json({ review: row });
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
