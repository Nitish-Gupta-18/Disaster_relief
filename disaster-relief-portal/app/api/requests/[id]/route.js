import db from '@/lib/db';
import { sendRequestStatusEmail } from '@/lib/mailer';

const statuses = new Set(['pending', 'assigned', 'in_progress', 'completed']);

function requireEnum(value, validValues, fieldName) {
  if (!validValues.has(value)) {
    throw new Error(`${fieldName} must be one of: ${[...validValues].join(', ')}`);
  }
}

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

function mapRequest(row) {
  return { ...row, ...getAssignments(row.id) };
}

function getRequestById(id) {
  const row = db.prepare('SELECT * FROM requests WHERE id = ?').get(id);
  return row ? mapRequest(row) : null;
}

export async function DELETE(request, { params }) {
  try {
    const id = Number((await params).id);
    const result = db.prepare('DELETE FROM requests WHERE id = ?').run(id);
    if (result.changes === 0) {
      return Response.json({ error: 'Request not found' }, { status: 404 });
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}

export async function PATCH(request, { params: paramsPromise }) {
  try {
    const id = Number((await paramsPromise).id);
    const { status } = await request.json();
    requireEnum(status, statuses, 'status');

    const result = db.prepare('UPDATE requests SET status = ?, updated_at = ? WHERE id = ?').run(status, new Date().toISOString(), id);
    if (result.changes === 0) {
      return Response.json({ error: 'Request not found' }, { status: 404 });
    }

    // Notify all assigned volunteers about the status change
    const updatedRequest = db.prepare('SELECT * FROM requests WHERE id = ?').get(id);
    const assignedVolunteers = db.prepare(`
      SELECT v.id, v.name, v.email FROM volunteers v
      JOIN assignments a ON a.volunteer_id = v.id
      WHERE a.request_id = ? AND a.status NOT IN ('completed', 'rejected')
    `).all(id);
    for (const v of assignedVolunteers) {
      if (v.email) {
        sendRequestStatusEmail(
          { name: v.name, email: v.email },
          { id: updatedRequest.id, location: updatedRequest.location, type: updatedRequest.type, urgency: updatedRequest.urgency },
          status
        ).catch((err) => console.error('[requests] Status email failed:', err.message));
      }
    }

    return Response.json(getRequestById(id));
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}
