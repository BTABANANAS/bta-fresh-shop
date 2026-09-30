const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// DB_PATH lets this point at a mounted persistent volume in production
// (e.g. Railway/Render), so order data survives restarts and redeploys.
// Defaults to a local file for running on your own computer.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'bta.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    variety TEXT,
    price REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_ref TEXT UNIQUE,
    stripe_session_id TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending',
    customer_name TEXT,
    customer_email TEXT,
    address_json TEXT,
    items_json TEXT,
    total_cartons INTEGER,
    total_value REAL,
    created_at INTEGER
  );
`);

// Seed default products if the table is empty.
const DEFAULT_PRODUCTS = [
  { id: 'cavendish', name: 'Cavendish', variety: 'Classic yellow · per carton', price: 4.5 },
  { id: 'ladyfinger', name: 'Lady Finger', variety: 'Miniature · per carton', price: 6.0 },
  { id: 'havana', name: 'Havana', variety: 'Cuban heirloom · per carton', price: 6.5 },
];

const countRow = db.prepare('SELECT COUNT(*) AS n FROM products').get();
if (countRow.n === 0) {
  const insert = db.prepare('INSERT INTO products (id, name, variety, price) VALUES (@id, @name, @variety, @price)');
  const insertMany = db.transaction((products) => {
    for (const p of products) insert.run(p);
  });
  insertMany(DEFAULT_PRODUCTS);
}

module.exports = db;
