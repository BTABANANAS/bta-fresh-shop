const express = require('express');
const db = require('../db');
const { login, logout, requireAdmin } = require('../auth');

const router = express.Router();

router.post('/admin/login', login);
router.post('/admin/logout', logout);

router.get('/admin/session', (req, res) => {
  res.json({ loggedIn: !!(req.session && req.session.isAdmin) });
});

router.get('/admin/orders', requireAdmin, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE status != \'pending\' ORDER BY created_at DESC').all();
  const out = orders.map((o) => ({
    orderRef: o.order_ref,
    status: o.status,
    createdAt: o.created_at,
    customerName: o.customer_name,
    customerEmail: o.customer_email,
    address: JSON.parse(o.address_json || '{}'),
    items: JSON.parse(o.items_json || '[]'),
    totalCartons: o.total_cartons,
    totalValue: o.total_value,
  }));
  res.json({ orders: out });
});

router.get('/admin/prices', requireAdmin, (req, res) => {
  const products = db.prepare('SELECT id, name, variety, price FROM products ORDER BY rowid').all();
  res.json({ products });
});

router.post('/admin/prices', requireAdmin, (req, res) => {
  const { prices } = req.body || {};
  if (!prices || typeof prices !== 'object') {
    return res.status(400).json({ error: 'Invalid payload.' });
  }
  const update = db.prepare('UPDATE products SET price = ? WHERE id = ?');
  const updateMany = db.transaction((entries) => {
    for (const [id, price] of entries) {
      const num = Number(price);
      if (Number.isFinite(num) && num >= 0) update.run(num, id);
    }
  });
  updateMany(Object.entries(prices));
  res.json({ ok: true });
});

module.exports = router;
