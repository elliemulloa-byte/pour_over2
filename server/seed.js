import { initDb, db } from './db.js';

export async function seedIfEmpty() {
  await initDb();
  const rows = db.prepare('SELECT 1 FROM shops LIMIT 1').all();
  if (rows.length > 0) return;
  runSeed();
}

export function runSeed() {
  db.exec('DELETE FROM drink_reviews; DELETE FROM drinks; DELETE FROM shops;');

  const shops = [
    { name: 'Houndstooth Coffee', address: '401 Congress Ave, Austin, TX 78701', city: 'Austin', lat: 30.2676, lng: -97.7434 },
    { name: 'Houndstooth Coffee', address: '4200 N Lamar Blvd, Austin, TX 78756', city: 'Austin', lat: 30.3089, lng: -97.7345 },
    { name: 'Houndstooth Coffee', address: '5412 N Lamar Blvd, Austin, TX 78756', city: 'Austin', lat: 30.3256, lng: -97.7221 },
    { name: 'Merit Coffee', address: '1200 S Lamar Blvd, Austin, TX 78704', city: 'Austin', lat: 30.2522, lng: -97.7645 },
    { name: 'Flat Track Coffee', address: '1619 E Cesar Chavez St, Austin, TX 78702', city: 'Austin', lat: 30.2551, lng: -97.7266 },
    { name: 'Fleet Coffee', address: '2424 E Cesar Chavez St, Austin, TX 78702', city: 'Austin', lat: 30.2542, lng: -97.7155 },
    { name: 'Figure 8 Coffee', address: '1111 E 11th St, Austin, TX 78702', city: 'Austin', lat: 30.2689, lng: -97.7289 },
    { name: 'Radio Coffee & Beer', address: '4204 Manchaca Rd, Austin, TX 78704', city: 'Austin', lat: 30.2234, lng: -97.7991 },
    { name: 'Medici Roasting', address: '1101 W 34th St, Austin, TX 78705', city: 'Austin', lat: 30.3021, lng: -97.7489 },
    { name: 'Cuvée Coffee Bar', address: '2000 E 6th St, Austin, TX 78702', city: 'Austin', lat: 30.2612, lng: -97.7178 },
    { name: 'Greater Goods Coffee', address: '2501 E 5th St, Austin, TX 78702', city: 'Austin', lat: 30.2589, lng: -97.7145 },
    { name: 'Mozart\'s Coffee Roasters', address: '3825 Lake Austin Blvd, Austin, TX 78703', city: 'Austin', lat: 30.2956, lng: -97.7801 },
    { name: 'Jo\'s Coffee', address: '242 W 2nd St, Austin, TX 78701', city: 'Austin', lat: 30.2645, lng: -97.7456 },
    { name: 'Once Over Coffee Bar', address: '2009 S 1st St, Austin, TX 78704', city: 'Austin', lat: 30.2489, lng: -97.7556 },
    { name: 'Batch Craft Beer & Kolaches', address: '3220 Manor Rd, Austin, TX 78723', city: 'Austin', lat: 30.2923, lng: -97.6989 },
  ];

  const insertShop = db.prepare('INSERT INTO shops (name, address, city, lat, lng) VALUES (?, ?, ?, ?, ?)');
  shops.forEach((s) => insertShop.run(s.name, s.address, s.city, s.lat, s.lng));

  const drinkTypes = [
    { type: 'cappuccino', display: 'Cappuccino' },
    { type: 'pour over', display: 'Pour Over' },
    { type: 'flat white', display: 'Flat White' },
    { type: 'latte', display: 'Latte' },
    { type: 'espresso', display: 'Espresso' },
    { type: 'americano', display: 'Americano' },
    { type: 'cold brew', display: 'Cold Brew' },
    { type: 'cortado', display: 'Cortado' },
    { type: 'mocha', display: 'Mocha' },
    { type: 'oat milk latte', display: 'Oat Milk Latte' },
    { type: 'drip coffee', display: 'Drip Coffee' },
    { type: 'matcha latte', display: 'Matcha Latte' },
    { type: 'chai latte', display: 'Chai Latte' },
    { type: 'nitro cold brew', display: 'Nitro Cold Brew' },
    { type: 'affogato', display: 'Affogato' },
    { type: 'macchiato', display: 'Macchiato' },
    { type: 'v60', display: 'V60 Pour Over' },
    { type: 'chemex', display: 'Chemex' },
    { type: 'aeroPress', display: 'AeroPress' },
  ];

  const insertDrink = db.prepare('INSERT INTO drinks (shop_id, drink_type, display_name) VALUES (?, ?, ?)');
  const insertReview = db.prepare('INSERT INTO drink_reviews (drink_id, rating, comment) VALUES (?, ?, ?)');

  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const comments = [
    'Perfect balance.',
    'Best in town.',
    'Smooth and rich.',
    'Consistently great.',
    'Barista nailed it.',
    'Slightly bitter, still good.',
    'Amazing crema.',
    null, null, null,
  ];

  for (let shopId = 1; shopId <= shops.length; shopId++) {
    const count = rand(8, drinkTypes.length);
    const shuffled = [...drinkTypes].sort(() => Math.random() - 0.5);
    for (let i = 0; i < count; i++) {
      const { type, display } = shuffled[i];
      const r = insertDrink.run(shopId, type, display);
      const drinkId = r.lastInsertRowid;
      const numReviews = rand(2, 12);
      for (let j = 0; j < numReviews; j++) {
        insertReview.run(drinkId, rand(3, 5), comments[rand(0, comments.length - 1)]);
      }
    }
  }

  console.log('Seeded shops, drinks, and reviews.');
}

// Run seed when executed directly: node server/seed.js
const isMain = process.argv[1]?.includes('seed.js');
if (isMain) {
  initDb().then(() => {
    runSeed();
    process.exit(0);
  }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
