const express = require('express');
const Stripe = require('stripe');
const db = require('../db');

const router = express.Router();

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

function makeOrderRef() {
  return 'BTA-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

// Stripe requires the RAW request body (not JSON-parsed) to verify the
// signature. express.raw() is applied ONLY to this route (not the whole
// /api prefix) so it doesn't swallow the body for every other /api/* route.
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const stripe = getStripe();
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const session = event.data.object;

    try {
      const full = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ['customer_details'],
      });

      const shipping = full.shipping_details || full.customer_details || {};
      const address = shipping.address || {};
      const orderRef = makeOrderRef();

      db.prepare(`
        UPDATE orders SET
          status = 'paid',
          order_ref = ?,
          customer_name = ?,
          customer_email = ?,
          address_json = ?
        WHERE stripe_session_id = ?
      `).run(
        orderRef,
        shipping.name || full.customer_details?.name || '',
        full.customer_details?.email || '',
        JSON.stringify({
          line1: address.line1 || '',
          line2: address.line2 || '',
          city: address.city || '',
          state: address.state || '',
          postal_code: address.postal_code || '',
          country: address.country || '',
        }),
        session.id
      );
    } catch (err) {
      console.error('Failed to record paid order:', err);
      // Still return 200 so Stripe doesn't keep retrying forever; the payment
      // itself succeeded. Investigate via Stripe dashboard + server logs.
    }
  }

  if (event.type === 'checkout.session.expired') {
    db.prepare(`UPDATE orders SET status = 'expired' WHERE stripe_session_id = ?`).run(event.data.object.id);
  }

  res.json({ received: true });
});

module.exports = router;
