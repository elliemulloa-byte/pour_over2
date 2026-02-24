import 'dotenv/config';
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
import { fetchPlacesFromFoursquare, fetchFoursquarePlaceDetails } from './foursquare.js';
import { fetchCoffeeShopsFromOSM, fetchOsmPlaceById } from './overpass.js';
import { isCommentInappropriate } from './contentFilter.js';

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

const KM_TO_MILES = 0.621371;

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

function kmToMiles(km) {
  return km != null ? Math.round(km * KM_TO_MILES * 10) / 10 : null;
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
      distanceMiles: kmToMiles(distanceKm),
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
      distanceMiles: kmToMiles(distanceKm),
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

  const drinkList = drinks.map((d) => ({
    drinkId: d.drink_id,
    displayName: d.display_name,
    drinkType: d.drink_type,
    avgRating: d.avg_rating != null ? Math.round(Number(d.avg_rating) * 10) / 10 : null,
    reviewCount: d.review_count,
    isSeasonal: /\b(peppermint|pumpkin|gingerbread|eggnog|holiday)\b/i.test(d.display_name || ''),
  }));
  const sortedDrinks = sortDrinks(drinkList, (x) => x.displayName || x.drinkType);

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
    drinks: sortedDrinks,
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

// Fallback location from IP when GPS is restricted (e.g. HTTP, or browser blocks geolocation)
app.get('/api/location/ip', async (req, res) => {
  try {
    let ip = (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || '')
      .toString().split(',')[0].trim();
    // IPv6 localhost
    if (ip === '::1' || ip === '::ffff:127.0.0.1') ip = '127.0.0.1';
    // Private IPs: ip-api won't geolocate; use empty to get server's public IP
    const isPrivate = /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1)/.test(ip);
    const query = isPrivate ? '' : `/${ip}`;
    const url = `http://ip-api.com/json${query}?fields=lat,lon,status`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (data?.status === 'success' && data?.lat != null && data?.lon != null) {
      return res.json({ lat: data.lat, lng: data.lon });
    }
  } catch (_) { /* ignore */ }
  res.status(503).json({ error: 'Could not determine location' });
});

// Popular drinks first, then specialty/seasonal (Yelp-style)
const POPULAR_DRINK_ORDER = ['latte', 'cappuccino', 'espresso', 'americano', 'cold brew', 'mocha', 'flat white', 'cortado', 'drip coffee', 'oat milk latte', 'chai latte', 'matcha latte', 'macchiato', 'nitro cold brew', 'pour over'];

function sortDrinks(drinks, getName) {
  const byName = (n) => (n || '').toLowerCase();
  return [...drinks].sort((a, b) => {
    const idxA = POPULAR_DRINK_ORDER.indexOf(byName(getName(a)));
    const idxB = POPULAR_DRINK_ORDER.indexOf(byName(getName(b)));
    if (idxA >= 0 && idxB >= 0) return idxA - idxB;
    if (idxA >= 0) return -1;
    if (idxB >= 0) return 1;
    return (getName(a) || '').localeCompare(getName(b) || '');
  });
}

// Place Details - Google or OSM (osm-12345)
app.get('/api/places/:placeId', async (req, res) => {
  const placeId = (req.params.placeId || '').trim();
  if (!placeId) return res.status(400).json({ error: 'Place ID required' });
  let place;
  if (placeId.startsWith('osm-')) {
    place = await fetchOsmPlaceById(placeId);
  } else if (placeId.startsWith('fsq-')) {
    place = await fetchFoursquarePlaceDetails(placeId);
  } else {
    place = await fetchPlaceDetails(placeId);
  }
  if (!place) return res.status(404).json({ error: 'Place not found' });
  let userReviews = [];
  let placeDrinks = [];
  try {
    userReviews = db.prepare(`
      SELECT r.id, r.rating, r.comment, r.photo, r.created_at, u.display_name AS author
      FROM place_reviews r JOIN users u ON u.id = r.user_id
      WHERE r.place_id = ? ORDER BY r.created_at DESC LIMIT 50
    `).all(placeId);
    const drinkRows = db.prepare('SELECT id, drink_type, display_name, is_seasonal FROM place_drinks WHERE place_id = ?').all(placeId);
    if (drinkRows.length > 0) {
      const ids = drinkRows.map((d) => d.id);
      const stats = db.prepare(`
        SELECT place_drink_id, COUNT(*) AS review_count, AVG(rating) AS avg_rating
        FROM place_drink_reviews WHERE place_drink_id IN (${ids.map(() => '?').join(',')})
        GROUP BY place_drink_id
      `).all(...ids);
      const byId = Object.fromEntries(stats.map((s) => [s.place_drink_id, s]));
      const drinkReviewRows = db.prepare(`
        SELECT place_drink_id, rating, comment, descriptors, photo, created_at, 
               (SELECT display_name FROM users WHERE id = place_drink_reviews.user_id) AS author
        FROM place_drink_reviews
        WHERE place_drink_id IN (${ids.map(() => '?').join(',')})
        ORDER BY created_at DESC
      `).all(...ids);
      const reviewsByDrink = {};
      for (const row of drinkReviewRows) {
        if (!reviewsByDrink[row.place_drink_id]) reviewsByDrink[row.place_drink_id] = [];
        reviewsByDrink[row.place_drink_id].push({
          rating: row.rating,
          comment: row.comment,
          descriptors: row.descriptors ? (() => { try { return JSON.parse(row.descriptors); } catch { return []; } })() : [],
          photo: row.photo || null,
          author: row.author || 'User',
        });
      }
      placeDrinks = sortDrinks(drinkRows.map((d) => ({
        id: d.id,
        drinkType: d.drink_type,
        displayName: d.display_name,
        isSeasonal: !!d.is_seasonal,
        avgRating: byId[d.id]?.avg_rating != null ? Math.round(Number(byId[d.id].avg_rating) * 10) / 10 : null,
        reviewCount: byId[d.id]?.review_count || 0,
        reviews: reviewsByDrink[d.id] || [],
      })), (x) => x.displayName || x.drinkType);
    }
  } catch (_) { /* tables may not exist */ }
  if ((place.source === 'osm' || place.source === 'foursquare') && place.avgRating == null) {
    const n = userReviews.length;
    if (n > 0) {
      const sum = userReviews.reduce((a, r) => a + (r.rating || 0), 0);
      place.avgRating = Math.round((sum / n) * 10) / 10;
      place.reviewCount = n;
    }
  }
  res.json({ place: { ...place, userReviews, placeDrinks } });
});

app.post('/api/places/:placeId/drinks', requireAuth, (req, res) => {
  const placeId = (req.params.placeId || '').trim();
  const { drinkType, displayName, isSeasonal } = req.body || {};
  if (!placeId) return res.status(400).json({ error: 'Place ID required' });
  const name = (typeof displayName === 'string' ? displayName.trim() : '') || (typeof drinkType === 'string' ? drinkType.trim() : '') || null;
  if (!name || name.length < 2) return res.status(400).json({ error: 'Drink name required (min 2 chars)' });
  const display = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  const type = name.toLowerCase().replace(/\s+/g, ' ');
  try {
    const existing = db.prepare('SELECT id FROM place_drinks WHERE place_id = ? AND (LOWER(drink_type) = ? OR LOWER(display_name) = ?)').all(placeId, type, display);
    if (existing.length > 0) return res.status(409).json({ error: 'Drink already exists at this place' });
    const seasonal = /\b(peppermint|pumpkin|gingerbread|eggnog|holiday)\b/i.test(display) ? 1 : 0;
    const { lastInsertRowid } = db.prepare('INSERT INTO place_drinks (place_id, drink_type, display_name, is_seasonal) VALUES (?, ?, ?, ?)').run(placeId, type, display, seasonal);
    const row = db.prepare('SELECT id, place_id, drink_type, display_name, is_seasonal FROM place_drinks WHERE id = ?').all(lastInsertRowid)[0];
    res.status(201).json({ drink: row });
  } catch (e) {
    if (e.message?.includes('no such table')) return res.status(503).json({ error: 'Restart the server.' });
    throw e;
  }
});

const REVIEW_DESCRIPTORS = ['bitter', 'sweet', 'smooth', 'strong', 'creamy', 'bold', 'mild', 'roasty'];

app.post('/api/places/:placeId/drinks/:drinkId/reviews', requireAuth, (req, res) => {
  const placeId = (req.params.placeId || '').trim();
  const drinkId = parseInt(req.params.drinkId, 10);
  const { rating, comment, descriptors } = req.body || {};
  if (!placeId || !Number.isInteger(drinkId) || drinkId < 1) return res.status(400).json({ error: 'Invalid request' });
  const r = typeof rating === 'number' ? Math.round(rating) : parseInt(rating, 10);
  if (!Number.isInteger(r) || r < 1 || r > 5) return res.status(400).json({ error: 'Rating must be 1–5' });
  let commentText = typeof comment === 'string' ? comment.trim() || null : null;
  if (commentText && isCommentInappropriate(commentText)) {
    return res.status(400).json({ error: 'Comment contains inappropriate language. Please keep it friendly.' });
  }
  const descList = Array.isArray(descriptors) ? descriptors.filter((d) => REVIEW_DESCRIPTORS.includes(String(d).toLowerCase())) : [];
  const descJson = descList.length > 0 ? JSON.stringify(descList) : null;
  const photoData = typeof req.body?.photo === 'string' && req.body.photo.startsWith('data:image/') && req.body.photo.length < 500000 ? req.body.photo : null;
  try {
    const drink = db.prepare('SELECT id FROM place_drinks WHERE id = ? AND place_id = ?').all(drinkId, placeId)[0];
    if (!drink) return res.status(404).json({ error: 'Drink not found' });
    db.prepare('INSERT INTO place_drink_reviews (place_drink_id, user_id, rating, comment, descriptors, photo) VALUES (?, ?, ?, ?, ?, ?)')
      .run(drinkId, req.session.userId, r, commentText, descJson, photoData);
    res.status(201).json({ ok: true });
  } catch (e) {
    if (e.message?.includes('no such table')) return res.status(503).json({ error: 'Restart the server.' });
    throw e;
  }
});

app.post('/api/places/:placeId/reviews', requireAuth, (req, res) => {
  const placeId = (req.params.placeId || '').trim();
  const { rating, comment } = req.body || {};
  if (!placeId) return res.status(400).json({ error: 'Place ID required' });
  const r = typeof rating === 'number' ? Math.round(rating) : parseInt(rating, 10);
  if (!Number.isInteger(r) || r < 1 || r > 5) {
    return res.status(400).json({ error: 'Rating must be 1–5' });
  }
  let commentText = typeof comment === 'string' ? comment.trim() || null : null;
  if (commentText && isCommentInappropriate(commentText)) {
    return res.status(400).json({ error: 'Comment contains inappropriate language. Please keep it friendly.' });
  }
  const photoData = typeof req.body?.photo === 'string' && req.body.photo.startsWith('data:image/') && req.body.photo.length < 500000 ? req.body.photo : null;
  try {
    const { lastInsertRowid } = db.prepare(
      'INSERT INTO place_reviews (place_id, user_id, rating, comment, photo) VALUES (?, ?, ?, ?, ?)'
    ).run(placeId, req.session.userId, r, commentText, photoData);
    const row = db.prepare('SELECT id, place_id, rating, comment, photo, created_at FROM place_reviews WHERE id = ?')
      .all(lastInsertRowid)[0];
    res.status(201).json({ review: row });
  } catch (e) {
    if (e.message?.includes('no such table')) {
      return res.status(503).json({ error: 'Reviews not available yet. Restart the server.' });
    }
    throw e;
  }
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
        distanceMiles: kmToMiles(distanceKm), source: 'local',
      };
    });
  }

  // Search drinks (before IP fallback so we can check if we have any results)
  const drinkRows = db.prepare(`
    SELECT d.id AS drink_id, d.drink_type, d.display_name, s.id AS shop_id, s.name AS shop_name, s.address AS shop_address, s.lat AS shop_lat, s.lng AS shop_lng
    FROM drinks d JOIN shops s ON s.id = d.shop_id
    WHERE LOWER(d.drink_type) LIKE ? OR LOWER(d.display_name) LIKE ?
  `).all(`%${q}%`, `%${q}%`);

  // Get coords for Google Places: use provided lat/lng, or try IP fallback
  let latForGoogle = lat;
  let lngForGoogle = lng;
  if ((latForGoogle == null || lngForGoogle == null) && !shopRows.length && !drinkRows.length) {
    try {
      const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.headers['x-real-ip'] || req.socket?.remoteAddress || '';
      const isPrivate = /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1|::ffff:127)/.test(ip.toString());
      const resp = await fetch(`http://ip-api.com/json${isPrivate ? '' : '/' + ip}?fields=lat,lon,status`);
      const ipData = await resp.json();
      if (ipData?.status === 'success' && ipData?.lat != null && ipData?.lon != null) {
        latForGoogle = ipData.lat;
        lngForGoogle = ipData.lon;
      }
    } catch (_) { /* ignore */ }
  }
  // Fetch real coffee shops: Foursquare (no CC) or Google + OpenStreetMap (always)
  if (latForGoogle != null && lngForGoogle != null) {
    const foursquarePromise = fetchPlacesFromFoursquare(q, latForGoogle, lngForGoogle);
    const googlePromise = fetchPlacesFromGoogle(q, latForGoogle, lngForGoogle);
    const osmPromise = fetchCoffeeShopsFromOSM(latForGoogle, lngForGoogle, 8000);
    const [foursquarePlaces, googlePlaces, osmPlaces] = await Promise.all([foursquarePromise, googlePromise, osmPromise]);
    const apiPlaces = foursquarePlaces.length > 0 ? foursquarePlaces : googlePlaces;
    for (const p of apiPlaces) {
      if (p.lat != null && p.lng != null) {
        const km = Math.round(haversineKm(latForGoogle, lngForGoogle, p.lat, p.lng) * 10) / 10;
        p.distanceKm = km;
        p.distanceMiles = kmToMiles(km);
      }
    }
    const osmWithCoords = osmPlaces.filter((p) => p.shopName);
    shops = [...shops, ...apiPlaces, ...osmWithCoords];
    const seen = new Set();
    shops = shops.filter((s) => {
      const key = `${s.shopName}|${s.address || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    shops.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
  } else if (shops.length > 0) {
    shops.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
  }

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
        distanceMiles: kmToMiles(distanceKm),
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
  if (commentText && isCommentInappropriate(commentText)) {
    return res.status(400).json({ error: 'Comment contains inappropriate language. Please keep it friendly.' });
  }
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
}).catch((e) => {
  console.error('Failed to start:', e);
  process.exit(1);
});
