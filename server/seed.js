import { initDb, db } from './db.js';

export async function seedIfEmpty() {
  await initDb();
  const rows = db.prepare('SELECT 1 FROM shops LIMIT 1').all();
  if (rows.length > 0) return;
  runSeed();
}

function runSeed() {
  db.exec('DELETE FROM drink_reviews; DELETE FROM drinks; DELETE FROM shops;');

  const shops = [
  { name: 'Merit Coffee', address: '1200 S Lamar Blvd, Austin, TX', lat: 30.2522, lng: -97.7645 },
  { name: 'Flat Track Coffee', address: '1619 E Cesar Chavez St, Austin, TX', lat: 30.2551, lng: -97.7266 },
  { name: 'Fleet Coffee', address: '2424 E Cesar Chavez St, Austin, TX', lat: 30.2542, lng: -97.7155 },
  { name: 'Figure 8 Coffee', address: '1111 E 11th St, Austin, TX', lat: 30.2689, lng: -97.7289 },
  { name: 'Radio Coffee & Beer', address: '4204 Manchaca Rd, Austin, TX', lat: 30.2234, lng: -97.7991 },
  { name: 'Medici Roasting', address: '1101 W 34th St, Austin, TX', lat: 30.3021, lng: -97.7489 },
  { name: 'Houndstooth Coffee', address: '401 Congress Ave, Austin, TX', lat: 30.2676, lng: -97.7434 },
  { name: 'Cuvée Coffee Bar', address: '2000 E 6th St, Austin, TX', lat: 30.2612, lng: -97.7178 },
  ];

  const insertShop = db.prepare('INSERT INTO shops (name, address, lat, lng) VALUES (?, ?, ?, ?)');
  shops.forEach((s) => insertShop.run(s.name, s.address, s.lat, s.lng));

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
  { type: 'peppermint mocha', display: 'Peppermint Mocha' },
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
  null,
  null,
  null,
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

const run = async () => {
  await initDb();
  runSeed();
};

run();
