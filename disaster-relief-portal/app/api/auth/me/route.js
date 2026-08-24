import db from '@/lib/db';

function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, ...safe } = user;
  return { ...safe, is_active: Boolean(safe.is_active) };
}

// GET /api/auth/me — get current user from Authorization header token
export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return Response.json({ user: null }, { status: 200 });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return Response.json({ user: null }, { status: 200 });
    }

    // Find valid session
    const session = db.prepare(
      "SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')"
    ).get(token);

    if (!session) {
      return Response.json({ user: null }, { status: 200 });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ? AND is_active = 1').get(session.user_id);
    if (!user) {
      return Response.json({ user: null }, { status: 200 });
    }

    return Response.json({ user: sanitizeUser(user) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/auth/me — logout (delete session)
export async function DELETE(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    }
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
