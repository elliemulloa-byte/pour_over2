/**
 * Foursquare Places API – no credit card required, $200/month free.
 * Set FOURSQUARE_API_KEY in your environment.
 * Get a key at: https://foursquare.com/developers/signup
 */

const API_KEY = process.env.FOURSQUARE_API_KEY;

function authHeaders() {
  return {
    'Authorization': API_KEY,
    'Accept': 'application/json',
  };
}

// Foursquare category 13032 = Coffee Shop (ensures actual coffee places)
const COFFEE_CATEGORY = '13032';

export async function fetchPlacesFromFoursquare(query, lat, lng) {
  if (!API_KEY || !lat || !lng) return [];
  try {
    const q = query.trim().toLowerCase();
    const isDrink = /\b(latte|mocha|cappuccino|espresso|americano|cold brew|pour over|chai|matcha|drip|nitro|oat)\b/.test(q);
    const searchQuery = isDrink ? `${query.trim()} coffee` : `${query.trim()} coffee`;
    const params = new URLSearchParams({
      query: searchQuery,
      ll: `${lat},${lng}`,
      radius: '8000',
      limit: '30',
      categories: COFFEE_CATEGORY,
    });
    const res = await fetch(`https://api.foursquare.com/v3/places/search?${params}`, {
      headers: authHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const results = (data.results || []).map((p) => ({
      placeId: `fsq-${p.fsq_id}`,
      shopName: p.name,
      address: p.location?.formatted_address || [p.location?.address, p.location?.locality, p.location?.region].filter(Boolean).join(', '),
      lat: p.geocodes?.main?.latitude ?? p.geocodes?.roof?.latitude,
      lng: p.geocodes?.main?.longitude ?? p.geocodes?.roof?.longitude,
      avgRating: p.rating != null ? Math.round(Number(p.rating) * 10) / 10 : null,
      reviewCount: p.stats?.total_ratings ?? p.stats?.total_photos ?? 0,
      source: 'foursquare',
      distanceKm: null,
      distanceMiles: null,
    }));
    return results;
  } catch {
    return [];
  }
}

export async function fetchFoursquarePlaceDetails(fsqId) {
  if (!API_KEY || !fsqId) return null;
  const id = String(fsqId).replace(/^fsq-/, '');
  if (!id) return null;
  try {
    const fields = 'name,geocodes,location,rating,stats,photos,website,hours,tel,price,categories,tips';
    const res = await fetch(`https://api.foursquare.com/v3/places/${encodeURIComponent(id)}?fields=${encodeURIComponent(fields)}`, {
      headers: authHeaders(),
    });
    if (!res.ok) return null;
    const p = await res.json();
    const addr = p.location?.formatted_address || [p.location?.address, p.location?.locality, p.location?.region].filter(Boolean).join(', ');
    const photos = (p.photos || []).slice(0, 12).map((ph) => {
      const prefix = ph.prefix || '';
      const suffix = ph.suffix || '';
      return prefix && suffix ? `${prefix}800x600${suffix}` : null;
    }).filter(Boolean);
    const tips = (p.tips || []).slice(0, 5).map((t) => ({
      author: t.user?.first_name || 'User',
      rating: null,
      text: t.text,
      time: null,
    }));
    const priceLevel = p.price != null ? '$'.repeat(Math.min(4, Math.max(1, Number(p.price)))) : null;
    const hours = (p.hours?.display || p.hours?.open || []).map((h) => typeof h === 'string' ? h : `${h.day || ''}: ${h.renderedTime || ''}`);
    return {
      placeId: `fsq-${p.fsq_id}`,
      name: p.name,
      address: addr || '',
      lat: p.geocodes?.main?.latitude ?? p.geocodes?.roof?.latitude,
      lng: p.geocodes?.main?.longitude ?? p.geocodes?.roof?.longitude,
      avgRating: p.rating != null ? Math.round(Number(p.rating) * 10) / 10 : null,
      reviewCount: p.stats?.total_ratings ?? p.stats?.total_photos ?? 0,
      photos,
      reviews: tips,
      priceLevel,
      openingHours: Array.isArray(hours) ? hours : (hours ? [hours] : []),
      website: p.website || null,
    };
  } catch {
    return null;
  }
}
