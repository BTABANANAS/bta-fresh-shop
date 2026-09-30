const express = require('express');
const Stripe = require('stripe');
const db = require('../db');

const router = express.Router();

const MAX_CARTONS_PER_PALLET = 66;
const MAX_ITEM_QTY = MAX_CARTONS_PER_PALLET; // guard against absurd quantities

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set in .env');
  return new Stripe(key);
}

// POST /api/checkout
// body: { items: [{ id, qty }] }
// Creates a Stripe Checkout Session using SERVER-SIDE prices (never trusts
// prices sent by the browser) and returns the URL to redirect the customer to.
router.post('/checkout', async (req, res) => {
  try {
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty.' });
    }

    const products = db.prepare('SELECT id, name, price FROM products').all();
    const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

    const line_items = [];
    const cleanItems = [];
    for (const raw of items) {
      const product = productMap[raw.id];
      const qty = Math.floor(Number(raw.qty));
      if (!product || !Number.isFinite(qty) || qty <= 0 || qty > MAX_ITEM_QTY) {
        return res.status(400).json({ error: `Invalid cart item: ${raw && raw.id}` });
      }
      cleanItems.push({ id: product.id, name: product.name, qty, price: product.price });
      line_items.push({
        quantity: qty,
        price_data: {
          currency: 'aud',
          unit_amount: Math.round(product.price * 100),
          product_data: { name: `${product.name} (carton)` },
        },
      });
    }

    const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      success_url: `${siteUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/cancel.html`,
      shipping_address_collection: { allowed_countries: ['AU'] },
      phone_number_collection: { enabled: true },
      customer_creation: 'always',
      metadata: {
        cart: JSON.stringify(cleanItems),
      },
    });

    // Record a pending order row now so the admin dashboard can see it even
    // before the webhook confirms payment.
    const totalCartons = cleanItems.reduce((s, i) => s + i.qty, 0);
    const totalValue = cleanItems.reduce((s, i) => s + i.qty * i.price, 0);
    db.prepare(`
      INSERT INTO orders (stripe_session_id, status, items_json, total_cartons, total_value, created_at)
      VALUES (?, 'pending', ?, ?, ?, ?)
    `).run(session.id, JSON.stringify(cleanItems), totalCartons, totalValue, Date.now());

    res.json({ url: session.url });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: 'Could not start checkout. Please try again.' });
  }
});

// GET /api/order-status?session_id=...
// Used by success.html to show order confirmation details after Stripe redirects back.
router.get('/order-status', (req, res) => {
  const { session_id } = req.query;
  if (!session_id) return res.status(400).json({ error: 'Missing session_id' });

  const order = db.prepare('SELECT order_ref, status, total_cartons, total_value, items_json FROM orders WHERE stripe_session_id = ?').get(session_id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  res.json({
    orderRef: order.order_ref,
    status: order.status,
    totalCartons: order.total_cartons,
    totalValue: order.total_value,
    items: JSON.parse(order.items_json || '[]'),
  });
});

module.exports = router;
