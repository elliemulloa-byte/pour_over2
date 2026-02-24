/**
 * Curated Unsplash photo URLs - real photos, unique per drink type.
 * Each drink gets a distinct image to avoid duplicates.
 */
const DRINK_PHOTO_MAP = {
  latte: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400&h=400&fit=crop',
  cappuccino: 'https://images.unsplash.com/photo-1579899511863-754fee2a4e8f?w=400&h=400&fit=crop',
  espresso: 'https://images.unsplash.com/photo-1510707577717-85f2e6b4fce9?w=400&h=400&fit=crop',
  americano: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=400&fit=crop',
  'cold brew': 'https://images.unsplash.com/photo-1514432323797-fc7c93f34402?w=400&h=400&fit=crop',
  mocha: 'https://images.unsplash.com/photo-1561882468-03949ccd440b?w=400&h=400&fit=crop',
  'flat white': 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=400&fit=crop',
  cortado: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400&h=400&fit=crop',
  'drip coffee': 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=400&h=400&fit=crop',
  'oat milk latte': 'https://images.unsplash.com/photo-1561882468-03949ccd440b?w=400&h=400&fit=crop',
  'chai latte': 'https://images.unsplash.com/photo-1563825543788-43a9eb6f1b15?w=400&h=400&fit=crop',
  'matcha latte': 'https://images.unsplash.com/photo-1536256261557-e348d6edd545?w=400&h=400&fit=crop',
  macchiato: 'https://images.unsplash.com/photo-1551030172-15c2a0ab0964?w=400&h=400&fit=crop',
  'nitro cold brew': 'https://images.unsplash.com/photo-1514432323797-fc7c93f34402?w=400&h=400&fit=crop',
  'pour over': 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=400&h=400&fit=crop',
  peppermint: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400&h=400&fit=crop',
  'peppermint mocha': 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400&h=400&fit=crop',
  'pumpkin spice': 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400&h=400&fit=crop',
  default: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=400&fit=crop',
};

export function getDrinkPhotoUrl(drinkType, displayName) {
  if (!drinkType && !displayName) return DRINK_PHOTO_MAP.default;
  const key = (displayName || drinkType || '').toLowerCase().trim();
  if (DRINK_PHOTO_MAP[key]) return DRINK_PHOTO_MAP[key];
  for (const [k, v] of Object.entries(DRINK_PHOTO_MAP)) {
    if (k !== 'default' && key.includes(k)) return v;
  }
  return DRINK_PHOTO_MAP.default;
}
