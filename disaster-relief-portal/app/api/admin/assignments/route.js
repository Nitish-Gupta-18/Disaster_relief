import db from '@/lib/db';
import { getAuthUser } from '../auth-utils';
import { sendAssignmentNotification } from '@/lib/mailer';

const statuses = new Set(['assigned', 'accepted', 'in_progress', 'completed', 'rejected']);
const priorities = new Set(['low', 'medium', 'high', 'critical']);

function parseJsonArray(value) {
  try { return JSON.parse(value || '[]'); } catch { return []; }
}

function mapAssignment(row) {
  const request = db.prepare('SELECT id, location, type, urgency, family_size, description, status AS request_status FROM requests WHERE id = ?').get(row.request_id);
  const volunteer = db.prepare('SELECT id, name, phone, skills, location_name, is_available FROM volunteers WHERE id = ?').get(row.volunteer_id);

  return {
    ...row,
    request: request || null,
    volunteer: volunteer
      ? { ...volunteer, is_available: Boolean(volunteer.is_available), skills: parseJsonArray(volunteer.skills) }
      : null
  };
}

function requireEnum(value, validValues, fieldName) {
  if (!validValues.has(value)) {
    throw new Error(`${fieldName} must be one of: ${[...validValues].join(', ')}`);
  }
}

// GET /api/admin/assignments — list all assignments with optional filters
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const volunteerId = searchParams.get('volunteerId');
    const requestId = searchParams.get('requestId');

    const clauses = [];
    const params = {};

    if (status) {
      requireEnum(status, statuses, 'status');
      clauses.push('a.status = @status');
      params.status = status;
    }
    if (priority) {
      requireEnum(priority, priorities, 'priority');
      clauses.push('a.priority = @priority');
      params.priority = priority;
    }
    if (volunteerId) {
      clauses.push('a.volunteer_id = @volunteerId');
      params.volunteerId = Number(volunteerId);
    }
    if (requestId) {
      clauses.push('a.request_id = @requestId');
      params.requestId = Number(requestId);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = db.prepare(`
      SELECT a.* FROM assignments a
      ${where}
      ORDER BY
        CASE a.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
        datetime(a.created_at) DESC
    `).all(params);

    return Response.json(rows.map(mapAssignment));
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}

// POST /api/admin/assignments — create a new admin assignment
export async function POST(request) {
  try {
    getAuthUser(request, { requireAdmin: true });

    const body = await request.json();
    const {
      request_id,
      volunteer_id,
      priority = 'medium',
      admin_notes = '',
      due_date = null,
      assigned_by = 'admin'
    } = body;

    const reqId = Number(request_id);
    const volId = Number(volunteer_id);

    if (!Number.isInteger(reqId) || !Number.isInteger(volId)) {
      return Response.json({ error: 'Valid request_id and volunteer_id are required' }, { status: 400 });
    }
    if (priority && !priorities.has(priority)) {
      return Response.json({ error: `priority must be one of: ${[...priorities].join(', ')}` }, { status: 400 });
    }

    const result = db.transaction(() => {
      const req = db.prepare('SELECT * FROM requests WHERE id = ?').get(reqId);
      if (!req) throw Object.assign(new Error('Request not found'), { status: 404 });

      const vol = db.prepare('SELECT * FROM volunteers WHERE id = ?').get(volId);
      if (!vol) throw Object.assign(new Error('Volunteer not found'), { status: 404 });

      // Check for existing active assignment
      const existing = db.prepare(
        "SELECT * FROM assignments WHERE request_id = ? AND volunteer_id = ? AND status NOT IN ('completed', 'rejected')"
      ).get(reqId, volId);
      if (existing) {
        throw Object.assign(new Error('Volunteer already has an active assignment for this request'), { status: 409 });
      }

      const ts = new Date().toISOString();
      const insertResult = db.prepare(`
        INSERT INTO assignments (request_id, volunteer_id, status, priority, admin_notes, due_date, assigned_by, created_at, updated_at)
        VALUES (?, ?, 'assigned', ?, ?, ?, ?, ?, ?)
      `).run(reqId, volId, priority, admin_notes.trim(), due_date, assigned_by.trim(), ts, ts);

      // Update request status if pending
      if (req.status === 'pending') {
        db.prepare('UPDATE requests SET status = ?, updated_at = ? WHERE id = ?').run('assigned', ts, reqId);
      } else {
        db.prepare('UPDATE requests SET updated_at = ? WHERE id = ?').run(ts, reqId);
      }

      // Mark volunteer as unavailable
      db.prepare('UPDATE volunteers SET is_available = 0 WHERE id = ?').run(volId);

      // Send assignment notification email if volunteer has an email
      if (vol.email) {
        sendAssignmentNotification(
          { name: vol.name, email: vol.email },
          { id: req.id, location: req.location, type: req.type, urgency: req.urgency, description: req.description }
        ).catch((err) => console.error('[admin/assignments] Failed to send assignment email:', err.message));
      }

      // Also insert into legacy junction table for backward compatibility
      db.prepare('INSERT OR IGNORE INTO request_volunteers (request_id, volunteer_id, assigned_at) VALUES (?, ?, ?)').run(reqId, volId, ts);

      return db.prepare('SELECT * FROM assignments WHERE id = ?').get(insertResult.lastInsertRowid);
    })();

    return Response.json(mapAssignment(result), { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}
