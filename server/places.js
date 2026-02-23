/**
 * Google Places API integration for real coffee shop data.
 * Set GOOGLE_PLACES_API_KEY in your environment to enable.
 * Get a key at: https://console.cloud.google.com/apis/credentials
 * Enable "Places API" and "Geocoding API" for your project.
 */

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;

export async function fetchPlacesFromGoogle(query, lat, lng) {
  if (!API_KEY || !lat || !lng) return [];
  try {
    const searchQuery = `${query} coffee shop`.trim();
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&location=${lat},${lng}&radius=50000&type=cafe&key=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') return [];
    const results = (data.results || []).slice(0, 20).map((p) => ({
      placeId: p.place_id,
      shopName: p.name,
      address: p.formatted_address,
      lat: p.geometry?.location?.lat,
      lng: p.geometry?.location?.lng,
      avgRating: p.rating != null ? Math.round(Number(p.rating) * 10) / 10 : null,
      reviewCount: p.user_ratings_total || 0,
      source: 'google',
      distanceKm: null,
    }));
    return results;
  } catch {
    return [];
  }
}

/**
 * Fetch Place Details from Google Places API (including photos: interior, menu, etc.)
 * Returns place info and photo URLs suitable for display like Google Maps.
 */
export async function fetchPlaceDetails(placeId) {
  if (!API_KEY || !placeId) return null;
  try {
    const fields = 'name,formatted_address,rating,user_ratings_total,geometry,photos';
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=${fields}&key=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== 'OK') return null;
    const p = data.result;
    const photos = (p.photos || []).slice(0, 12).map((photo) => {
      const ref = photo.photo_reference;
      return ref ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${encodeURIComponent(ref)}&key=${API_KEY}` : null;
    }).filter(Boolean);
    return {
      placeId,
      name: p.name,
      address: p.formatted_address || '',
      lat: p.geometry?.location?.lat,
      lng: p.geometry?.location?.lng,
      avgRating: p.rating != null ? Math.round(Number(p.rating) * 10) / 10 : null,
      reviewCount: p.user_ratings_total || 0,
      photos,
    };
  } catch {
    return null;
  }
}

export async function fetchNearbyCoffeeShops(lat, lng) {
  if (!API_KEY || !lat || !lng) return [];
  try {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=5000&type=cafe&key=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') return [];
    return (data.results || []).slice(0, 20).map((p) => ({
      placeId: p.place_id,
      shopName: p.name,
      address: p.vicinity,
      lat: p.geometry?.location?.lat,
      lng: p.geometry?.location?.lng,
      avgRating: p.rating != null ? Math.round(Number(p.rating) * 10) / 10 : null,
      reviewCount: p.user_ratings_total || 0,
      source: 'google',
      distanceKm: null,
    }));
  } catch {
    return [];
  }
}
