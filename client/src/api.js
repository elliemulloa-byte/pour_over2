const API = '/api';

// Common drink typos -> correct spelling for autocorrect
const DRINK_TYPO_MAP = {
  'cappucino': 'cappuccino', 'capuccino': 'cappuccino',
  'espresso': 'espresso', 'expresso': 'espresso',
  'pure espresso': 'espresso', 'pure epsresso': 'espresso', 'pure expresso': 'espresso',
  'latte': 'latte', 'latté': 'latte', 'lattes': 'latte',
  'americano': 'americano', 'americanos': 'americano',
  'mocha': 'mocha', 'mochas': 'mocha',
  'macciato': 'macchiato', 'macchiato': 'macchiato',
  'coldbrew': 'cold brew', 'cold-brew': 'cold brew',
  'pour over': 'pour over', 'pourover': 'pour over',
  'flatwhite': 'flat white', 'flat-white': 'flat white',
};

export function correctDrinkTypo(query) {
  const q = query.trim().toLowerCase();
  return DRINK_TYPO_MAP[q] || query.trim();
}

export async function geocodeAddress(address) {
  if (!address || !address.trim()) return null;
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address.trim())}&limit=1`,
    {
      headers: {
        'Accept-Language': 'en',
        'User-Agent': 'BeanVerdict/1.0 (coffee search app)',
      },
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (!data || !data[0]) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

export async function searchDrinks(query, lat, lng) {
  const params = new URLSearchParams({ q: query });
  if (lat != null && lng != null) {
    params.set('lat', lat);
    params.set('lng', lng);
  }
  const res = await fetch(`${API}/drinks/search?${params}`, { credentials: 'include', mode: 'cors' });
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}

// Unified search: returns both shops and drinks (Yelp-style)
export async function searchUnified(query, lat, lng) {
  const params = new URLSearchParams({ q: query });
  if (lat != null && lng != null) {
    params.set('lat', lat);
    params.set('lng', lng);
  }
  const res = await fetch(`${API}/search?${params}`, { credentials: 'include', mode: 'cors' });
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}

export async function searchShops(query, lat, lng) {
  const params = new URLSearchParams({ q: query });
  if (lat != null && lng != null) {
    params.set('lat', lat);
    params.set('lng', lng);
  }
  const res = await fetch(`${API}/shops/search?${params}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}

export async function getPlace(placeId) {
  const res = await fetch(`${API}/places/${encodeURIComponent(placeId)}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Place not found');
  return res.json();
}

export async function addPlaceDrink(placeId, displayName, isSeasonal) {
  const res = await fetch(`${API}/places/${encodeURIComponent(placeId)}/drinks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName, isSeasonal }),
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to add drink');
  return data;
}

export async function addPlaceDrinkReview(placeId, drinkId, rating, comment, descriptors, photo) {
  const res = await fetch(`${API}/places/${encodeURIComponent(placeId)}/drinks/${drinkId}/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating, comment: comment || undefined, descriptors: descriptors || [], photo: photo || undefined }),
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to add review');
  return data;
}

export async function addPlaceReview(placeId, rating, comment, photo) {
  const res = await fetch(`${API}/places/${encodeURIComponent(placeId)}/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating, comment: comment || undefined, photo: photo || undefined }),
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to add review');
  return data;
}

export async function getShop(shopId) {
  const res = await fetch(`${API}/shops/${shopId}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Shop not found');
  return res.json();
}

export async function addDrinkToShop(shopId, drinkType, displayName) {
  const res = await fetch(`${API}/shops/${shopId}/drinks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ drinkType: drinkType || displayName, displayName: displayName || drinkType }),
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to add drink');
  return data;
}

export async function suggestDrinks(query) {
  if (!query.trim()) return { suggestions: [] };
  const params = new URLSearchParams({ q: query });
  const res = await fetch(`${API}/drinks/suggest?${params}`, { credentials: 'include' });
  if (!res.ok) return { suggestions: [] };
  return res.json();
}

export async function getPopularDrinks() {
  const res = await fetch(`${API}/drinks/popular`, { credentials: 'include' });
  if (!res.ok) return { suggestions: [] };
  return res.json();
}

export async function getMe() {
  const res = await fetch(`${API}/auth/me`, { credentials: 'include' });
  if (!res.ok) return { user: null };
  const data = await res.json();
  return data;
}

export async function login(email, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  return data;
}

export async function signup(email, password, displayName) {
  const res = await fetch(`${API}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName: displayName || undefined }),
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Signup failed');
  return data;
}

export async function logout() {
  await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' });
}

export async function updateAvatar(avatar) {
  const res = await fetch(`${API}/auth/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ avatar }),
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update avatar');
  return data;
}

export async function getMyReviews() {
  const res = await fetch(`${API}/users/me/reviews`, { credentials: 'include' });
  if (!res.ok) return { reviews: [] };
  const data = await res.json();
  return data;
}

export async function addReview(drinkId, rating, comment) {
  const res = await fetch(`${API}/drinks/${drinkId}/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating, comment: comment || undefined }),
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to add review');
  return data;
}
