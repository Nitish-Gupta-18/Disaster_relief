import db from '@/lib/db';
import { sendAssignmentNotification } from '@/lib/mailer';

function parseJsonArray(value) {
  try { return JSON.parse(value || '[]'); } catch { return []; }
}

function getAssignments(requestId) {
  const volunteers = db.prepare(`
    SELECT v.id, v.name, v.phone, v.skills, v.location_name, v.is_available, rv.assigned_at
    FROM request_volunteers rv JOIN volunteers v ON v.id = rv.volunteer_id
    WHERE rv.request_id = ? ORDER BY rv.assigned_at DESC
  `).all(requestId).map((r) => ({ ...r, is_available: Boolean(r.is_available), skills: parseJsonArray(r.skills) }));

  const resources = db.prepare(`
    SELECT i.id AS inventory_id, i.item_name, i.category, i.unit, ra.quantity, ra.assigned_at
    FROM resource_assignments ra JOIN inventory i ON i.id = ra.inventory_id
    WHERE ra.request_id = ? ORDER BY ra.assigned_at DESC
  `).all(requestId);

  return { assigned_volunteers: volunteers, assigned_resources: resources };
}

function mapRequest(row) { return { ...row, ...getAssignments(row.id) }; }
function getRequestById(id) { const row = db.prepare('SELECT * FROM requests WHERE id = ?').get(id); return row ? mapRequest(row) : null; }

export async function POST(request, { params }) {
  try {
    const requestId = Number((await params).id);
    const { volunteerId } = await request.json();

    if (!Number.isInteger(requestId) || !Number.isInteger(Number(volunteerId))) {
      return Response.json({ error: 'Valid request id and volunteerId are required' }, { status: 400 });
    }

    const result = db.transaction(() => {
      const req = db.prepare('SELECT * FROM requests WHERE id = ?').get(requestId);
      if (!req) throw Object.assign(new Error('Request not found'), { status: 404 });
      const vol = db.prepare('SELECT * FROM volunteers WHERE id = ?').get(Number(volunteerId));
      if (!vol) throw Object.assign(new Error('Volunteer not found'), { status: 404 });

      const ts = new Date().toISOString();
      db.prepare('INSERT OR IGNORE INTO request_volunteers (request_id, volunteer_id, assigned_at) VALUES (?, ?, ?)').run(requestId, Number(volunteerId), ts);

      if (req.status === 'pending') {
        db.prepare('UPDATE requests SET status = ?, updated_at = ? WHERE id = ?').run('assigned', ts, requestId);
      } else {
        db.prepare('UPDATE requests SET updated_at = ? WHERE id = ?').run(ts, requestId);
      }
      db.prepare('UPDATE volunteers SET is_available = 0 WHERE id = ?').run(Number(volunteerId));

      // Send assignment notification email if volunteer has an email
      if (vol.email) {
        sendAssignmentNotification(
          { name: vol.name, email: vol.email },
          { id: req.id, location: req.location, type: req.type, urgency: req.urgency, description: req.description }
        ).catch((err) => console.error('[assign-volunteer] Failed to send assignment email:', err.message));
      }

      return getRequestById(requestId);
    })();

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}
