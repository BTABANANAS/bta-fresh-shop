require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cookieSession = require('cookie-session');
const rateLimit = require('express-rate-limit');

const webhookRouter = require('./routes/webhook');
const productsRouter = require('./routes/products');
const checkoutRouter = require('./routes/checkout');
const adminRouter = require('./routes/admin');

const app = express();
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false, // keep simple for the demo front-end; tighten if you add a CSP
}));

// The Stripe webhook route applies its own express.raw() middleware
// internally (see routes/webhook.js) so it must be mounted BEFORE the
// global JSON body parser below, and must NOT have raw() applied here at
// the /api prefix level (that would swallow the body for every other route).
app.use('/api', webhookRouter);

app.use(express.json());

if (!process.env.SESSION_SECRET) {
  console.warn('WARNING: SESSION_SECRET is not set in .env — using an insecure default. Set it before going live.');
}
app.use(cookieSession({
  name: 'bta_admin_session',
  keys: [process.env.SESSION_SECRET || 'dev-only-insecure-secret'],
  maxAge: 12 * 60 * 60 * 1000, // 12 hours
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  httpOnly: true,
}));

// Basic brute-force protection on the admin login endpoint.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again later.' },
});
app.use('/api/admin/login', loginLimiter);

app.use('/api', productsRouter);
app.use('/api', checkoutRouter);
app.use('/api', adminRouter);

app.use(express.static(path.join(__dirname, '..', 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`BTA Fresh server running on http://localhost:${PORT}`);
});
