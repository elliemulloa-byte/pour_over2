/**
 * OpenStreetMap Overpass API - real coffee shops, no API key
 * https://wiki.openstreetmap.org/wiki/Overpass_API
 */

export async function fetchCoffeeShopsFromOSM(lat, lng, radiusM = 5000) {
  if (lat == null || lng == null) return [];
  try {
    const query = `
      [out:json][timeout:10];
      (
        node["amenity"="cafe"](around:${radiusM},${lat},${lng});
        node["amenity"="coffee_shop"](around:${radiusM},${lat},${lng});
      );
      out center;
    `;
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });
    if (!res.ok) return [];
    const data = await res.json();
    const R = 6371;
    const items = (data.elements || []).map((n) => {
      const lat2 = n.lat ?? n.center?.lat;
      const lng2 = n.lon ?? n.center?.lon ?? n.center?.lng;
      let distanceKm = null;
      if (lat2 != null && lng2 != null) {
        const dLat = ((lat2 - lat) * Math.PI) / 180;
        const dLng = ((lng2 - lng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((lat * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        distanceKm = Math.round(R * c * 10) / 10;
      }
      const distanceMiles = distanceKm != null ? Math.round(distanceKm * 0.621371 * 10) / 10 : null;
      const addr = n.tags?.['addr:street']
        ? [n.tags['addr:housenumber'], n.tags['addr:street'], n.tags['addr:city']].filter(Boolean).join(', ')
        : n.tags?.['addr:full'] || '';
      return {
        placeId: `osm-${n.id}`,
        shopName: n.tags?.name || 'Coffee Shop',
        address: addr || n.tags?.['addr:street'] || '',
        lat: lat2,
        lng: lng2,
        avgRating: null,
        reviewCount: 0,
        source: 'osm',
        distanceKm,
        distanceMiles,
      };
    });
    return items.filter((p) => p.shopName).slice(0, 25);
  } catch {
    return [];
  }
}

const OVERPASS_URLS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

export async function fetchOsmPlaceById(nodeId) {
  if (!nodeId) return null;
  const id = String(nodeId).replace(/^osm-/, '').trim();
  if (!/^\d+$/.test(id)) return null;
  const query = `[out:json][timeout:8];node(${id});out body;`;
  for (const baseUrl of OVERPASS_URLS) {
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!res.ok) continue;
      const data = await res.json();
      const n = data.elements?.[0];
      if (!n || n.type !== 'node') continue;
      const addr = n.tags?.['addr:street']
        ? [n.tags['addr:housenumber'], n.tags['addr:street'], n.tags['addr:city']].filter(Boolean).join(', ')
        : n.tags?.['addr:full'] || n.tags?.['addr:street'] || '';
      return {
        placeId: `osm-${n.id}`,
        name: n.tags?.name || 'Coffee Shop',
        address: addr,
        lat: n.lat,
        lng: n.lon,
        source: 'osm',
        photos: [],
        reviews: [],
      };
    } catch {
      continue;
    }
  }
  return null;
}
