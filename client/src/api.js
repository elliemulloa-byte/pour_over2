const API = '/api';

export async function searchDrinks(query, lat, lng) {
  const params = new URLSearchParams({ q: query });
  if (lat != null && lng != null) {
    params.set('lat', lat);
    params.set('lng', lng);
  }
  const res = await fetch(`${API}/drinks/search?${params}`);
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}

export async function suggestDrinks(query) {
  if (!query.trim()) return { suggestions: [] };
  const params = new URLSearchParams({ q: query });
  const res = await fetch(`${API}/drinks/suggest?${params}`);
  if (!res.ok) return { suggestions: [] };
  return res.json();
}
