const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');

const router = express.Router();
const SESSION_DURATION_DAYS = 7;

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, ...safe } = user;
  return { ...safe, is_active: Boolean(safe.is_active) };
}

// POST /api/auth/signup
router.post('/signup', (req, res, next) => {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const allowedRoles = new Set(['admin', 'volunteer', 'user']);
    const userRole = (role && allowedRoles.has(role)) ? role : 'volunteer';

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const ts = new Date().toISOString();
    const result = db.prepare(
      'INSERT INTO users (email, name, password_hash, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)'
    ).run(email.trim().toLowerCase(), name.trim(), passwordHash, userRole, ts, ts);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);

    const token = generateToken();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO sessions (user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?)').run(user.id, token, expiresAt, ts);

    res.status(201).json({ user: sanitizeUser(user), token });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login
router.post('/login', (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email.trim().toLowerCase());
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken();
    const ts = new Date().toISOString();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO sessions (user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?)').run(user.id, token, expiresAt, ts);

    res.json({ user: sanitizeUser(user), token });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me
router.get('/me', (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.json({ user: null });
    }

    const token = authHeader.slice(7).trim();
    const session = db.prepare(
      "SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')"
    ).get(token);

    if (!session) {
      return res.json({ user: null });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ? AND is_active = 1').get(session.user_id);
    return res.json({ user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/auth/logout
router.delete('/logout', (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

function parseJsonArray(value) {
  try { return JSON.parse(value || '[]'); } catch { return []; }
}

// GET /api/auth/quick-login?type=volunteers — list available volunteers
router.get('/quick-login', (req, res, next) => {
  try {
    const listType = req.query.type || 'volunteers';
    if (listType === 'volunteers') {
      const volunteers = db.prepare(
        'SELECT id, name, phone, skills, location_name, is_available FROM volunteers ORDER BY name ASC'
      ).all().map((v) => ({
        ...v,
        is_available: Boolean(v.is_available),
        skills: parseJsonArray(v.skills)
      }));
      return res.json({ volunteers });
    }
    res.status(400).json({ error: 'Invalid list type' });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/quick-login — volunteer/requester login without password
router.post('/quick-login', (req, res, next) => {
  try {
    const { type } = req.body;

    if (type === 'volunteer') {
      const volunteerId = Number(req.body.volunteer_id);
      if (!Number.isInteger(volunteerId) || volunteerId <= 0) {
        return res.status(400).json({ error: 'Valid volunteer_id is required' });
      }

      const volunteer = db.prepare('SELECT * FROM volunteers WHERE id = ?').get(volunteerId);
      if (!volunteer) return res.status(404).json({ error: 'Volunteer not found' });

      const email = `v${volunteer.id}@volunteer.local`;
      let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      const ts = new Date().toISOString();

      if (!user) {
        const placeholderHash = crypto.randomBytes(32).toString('hex');
        const result = db.prepare(
          'INSERT INTO users (email, name, password_hash, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)'
        ).run(email, volunteer.name.trim(), placeholderHash, 'volunteer', ts, ts);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
      } else if (!user.is_active) {
        db.prepare('UPDATE users SET is_active = 1, updated_at = ? WHERE id = ?').run(ts, user.id);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
      }

      const token = generateToken();
      const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();
      db.prepare('INSERT INTO sessions (user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?)').run(user.id, token, expiresAt, ts);

      return res.json({
        user: sanitizeUser(user),
        token,
        volunteer_profile: {
          ...volunteer,
          is_available: Boolean(volunteer.is_available),
          skills: parseJsonArray(volunteer.skills)
        }
      });
    }

    if (type === 'requester') {
      const { name, phone } = req.body;
      if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });

      const safeId = (phone || crypto.randomBytes(4).toString('hex')).replace(/\D/g, '').slice(0, 8);
      const email = `req-${safeId}@requester.local`;
      let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      const ts = new Date().toISOString();

      if (!user) {
        const placeholderHash = crypto.randomBytes(32).toString('hex');
        const result = db.prepare(
          'INSERT INTO users (email, name, password_hash, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)'
        ).run(email, name.trim(), placeholderHash, 'user', ts, ts);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
      } else if (!user.is_active) {
        db.prepare('UPDATE users SET is_active = 1, updated_at = ? WHERE id = ?').run(ts, user.id);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
      }

      const token = generateToken();
      const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();
      db.prepare('INSERT INTO sessions (user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?)').run(user.id, token, expiresAt, ts);

      return res.json({ user: sanitizeUser(user), token });
    }

    res.status(400).json({ error: 'Invalid type. Use "volunteer" or "requester"' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
