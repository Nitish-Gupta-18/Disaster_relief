import db from '@/lib/db';

/**
 * Extracts and validates the user session from the Authorization header.
 * Returns the user object if authenticated, or null for unauthenticated.
 * Throws an error with status 401/403 if requireAuth/requireAdmin is set and fails.
 */
export function getAuthUser(request, { requireAuth = false, requireAdmin = false } = {}) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    if (requireAuth || requireAdmin) {
      throw Object.assign(new Error('Authentication required'), { status: 401 });
    }
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    if (requireAuth || requireAdmin) {
      throw Object.assign(new Error('Authentication required'), { status: 401 });
    }
    return null;
  }

  const session = db.prepare(
    "SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')"
  ).get(token);

  if (!session) {
    if (requireAuth || requireAdmin) {
      throw Object.assign(new Error('Session expired or invalid'), { status: 401 });
    }
    return null;
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ? AND is_active = 1').get(session.user_id);
  if (!user) {
    if (requireAuth || requireAdmin) {
      throw Object.assign(new Error('User not found'), { status: 401 });
    }
    return null;
  }

  if (requireAdmin && user.role !== 'admin') {
    throw Object.assign(new Error('Admin access required'), { status: 403 });
  }

  const { password_hash, ...safeUser } = user;
  return { ...safeUser, is_active: Boolean(safeUser.is_active) };
}
