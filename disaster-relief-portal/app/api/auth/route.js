import db from '@/lib/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const SESSION_DURATION_DAYS = 7;

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function sanitizeUser(user) {
  const { password_hash, ...safe } = user;
  return { ...safe, is_active: Boolean(safe.is_active) };
}

// POST /api/auth/signup — register a new user
export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'login';

    const body = await request.json();
    const { email, password, name, role } = body;

    if (action === 'signup') {
      // ── SIGNUP ──
      if (!email || !password || !name) {
        return Response.json({ error: 'Email, password, and name are required' }, { status: 400 });
      }
      if (password.length < 6) {
        return Response.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return Response.json({ error: 'Invalid email format' }, { status: 400 });
      }

      const allowedRoles = new Set(['admin', 'volunteer', 'user']);
      const userRole = (role && allowedRoles.has(role)) ? role : 'volunteer';

      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
      if (existing) {
        return Response.json({ error: 'An account with this email already exists' }, { status: 409 });
      }

      const passwordHash = bcrypt.hashSync(password, 10);
      const ts = new Date().toISOString();
      const result = db.prepare(
        'INSERT INTO users (email, name, password_hash, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)'
      ).run(email.trim().toLowerCase(), name.trim(), passwordHash, userRole, ts, ts);

      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);

      // Auto-create session
      const token = generateToken();
      const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();
      db.prepare('INSERT INTO sessions (user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?)').run(user.id, token, expiresAt, ts);

      return Response.json({ user: sanitizeUser(user), token }, { status: 201 });
    }

    // ── LOGIN (default action) ──
    if (!email || !password) {
      return Response.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email.trim().toLowerCase());
    if (!user) {
      return Response.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      return Response.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Create session
    const token = generateToken();
    const ts = new Date().toISOString();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO sessions (user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?)').run(user.id, token, expiresAt, ts);

    return Response.json({ user: sanitizeUser(user), token });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}
