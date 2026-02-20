import initSqlJs from 'sql.js';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'pour_over.db');

let SQL = null;
let _db = null;

function rowsToObjects(columns, values) {
  if (!values || values.length === 0) return [];
  return values.map((row) => {
    const obj = {};
    columns.forEach((col, i) => (obj[col] = row[i]));
    return obj;
  });
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS shops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    lat REAL,
    lng REAL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS drinks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id INTEGER NOT NULL,
    drink_type TEXT NOT NULL,
    display_name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (shop_id) REFERENCES shops(id)
  );

  CREATE TABLE IF NOT EXISTS drink_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    drink_id INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (drink_id) REFERENCES drinks(id)
  );

  CREATE INDEX IF NOT EXISTS idx_drinks_drink_type ON drinks(drink_type);
  CREATE INDEX IF NOT EXISTS idx_drinks_shop ON drinks(shop_id);
  CREATE INDEX IF NOT EXISTS idx_reviews_drink ON drink_reviews(drink_id);
`;

export async function initDb() {
  if (_db) return _db;
  SQL = await initSqlJs();
  if (existsSync(dbPath)) {
    try {
      const buf = readFileSync(dbPath);
      _db = new SQL.Database(buf);
    } catch {
      _db = new SQL.Database();
    }
  } else {
    _db = new SQL.Database();
  }
  _db.exec(SCHEMA);
  return _db;
}

function getDb() {
  if (!_db) throw new Error('Database not initialized. Call initDb() first.');
  return _db;
}

const db = {
  exec(sql) {
    getDb().exec(sql);
  },
  prepare(sql) {
    return {
      run(...params) {
        const db = getDb();
        const stmt = db.prepare(sql);
        stmt.bind(params);
        stmt.step();
        const rowid = db.exec('SELECT last_insert_rowid() as id')[0]?.values?.[0]?.[0];
        stmt.free();
        return { lastInsertRowid: rowid };
      },
      all(...params) {
        const db = getDb();
        const stmt = db.prepare(sql);
        stmt.bind(params);
        const rows = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        stmt.free();
        return rows;
      },
    };
  },
};

export { db };
