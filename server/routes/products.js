const express = require('express');
const db = require('../db');

const router = express.Router();

// Public: list products with current prices. Prices always come from the
// server/database — the browser never gets to decide what things cost.
router.get('/products', (req, res) => {
  const products = db.prepare('SELECT id, name, variety, price FROM products ORDER BY rowid').all();
  res.json({ products });
});

module.exports = router;
