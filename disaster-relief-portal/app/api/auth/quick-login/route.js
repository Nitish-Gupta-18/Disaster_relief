import db from '@/lib/db';
import crypto from 'crypto';

const SESSION_DURATION_DAYS = 7;

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function sanitizeUser(user) {
  const { password_hash, ...safe } = user;
  return { ...safe, is_active: Boolean(safe.is_active) };
}

function parseJsonArray(value) {
  try { return JSON.parse(value || '[]'); } catch { return []; }
}

// POST /api/auth/quick-login
// Allows volunteers and requesters to log in without email/password
// Volunteers: { type: 'volunteer', volunteer_id: 123 }
// Requesters: { type: 'requester', name: 'John Doe', phone: '9876543210' }
export async function POST(request) {
  try {
    const body = await request.json();
    const { type } = body;

    if (type === 'volunteer') {
      // ── Volunteer quick login ──
      const volunteerId = Number(body.volunteer_id);
      if (!Number.isInteger(volunteerId) || volunteerId <= 0) {
        return Response.json({ error: 'Valid volunteer_id is required' }, { status: 400 });
      }

      const volunteer = db.prepare('SELECT * FROM volunteers WHERE id = ?').get(volunteerId);
      if (!volunteer) {
        return Response.json({ error: 'Volunteer not found' }, { status: 404 });
      }

      // Find or create a user account linked to this volunteer
      const email = `v${volunteer.id}@volunteer.local`;
      let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

      const ts = new Date().toISOString();
      if (!user) {
        // Create a passwordless user for this volunteer
        const placeholderHash = crypto.randomBytes(32).toString('hex'); // random unusable hash
        const result = db.prepare(
          'INSERT INTO users (email, name, password_hash, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)'
        ).run(email, volunteer.name.trim(), placeholderHash, 'volunteer', ts, ts);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
      } else if (!user.is_active) {
        db.prepare('UPDATE users SET is_active = 1, updated_at = ? WHERE id = ?').run(ts, user.id);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
      }

      // Create session
      const token = generateToken();
      const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();
      db.prepare('INSERT INTO sessions (user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?)').run(user.id, token, expiresAt, ts);

      return Response.json({
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
      // ── Requester quick login ──
      const { name, phone } = body;
      if (!name || !name.trim()) {
        return Response.json({ error: 'Name is required' }, { status: 400 });
      }

      // Create a unique email from name + phone
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

      // Create session
      const token = generateToken();
      const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();
      db.prepare('INSERT INTO sessions (user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?)').run(user.id, token, expiresAt, ts);

      return Response.json({ user: sanitizeUser(user), token });
    }

    return Response.json({ error: 'Invalid type. Use "volunteer" or "requester"' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}

// GET /api/auth/quick-login?type=volunteers — list available volunteers for quick login
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const listType = searchParams.get('type') || 'volunteers';

    if (listType === 'volunteers') {
      const volunteers = db.prepare(
        'SELECT id, name, phone, skills, location_name, is_available FROM volunteers ORDER BY name ASC'
      ).all().map((v) => ({
        ...v,
        is_available: Boolean(v.is_available),
        skills: parseJsonArray(v.skills)
      }));
      return Response.json({ volunteers });
    }

    return Response.json({ error: 'Invalid list type' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
