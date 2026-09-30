const bcrypt = require('bcryptjs');

function login(req, res) {
  const { password } = req.body || {};
  const hash = process.env.ADMIN_PASSWORD_HASH;

  if (!hash) {
    return res.status(500).json({ error: 'Admin login is not configured. Set ADMIN_PASSWORD_HASH in .env.' });
  }
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Password required.' });
  }

  const ok = bcrypt.compareSync(password, hash);
  if (!ok) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  req.session.isAdmin = true;
  res.json({ ok: true });
}

function logout(req, res) {
  req.session = null;
  res.json({ ok: true });
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  res.status(401).json({ error: 'Not logged in.' });
}

module.exports = { login, logout, requireAdmin };
