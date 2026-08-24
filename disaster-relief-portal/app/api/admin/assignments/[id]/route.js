import db from '@/lib/db';
import { getAuthUser } from '../../auth-utils';
import { sendAssignmentStatusEmail, sendUnassignedEmail } from '@/lib/mailer';

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

function getAssignmentById(id) {
  const row = db.prepare('SELECT * FROM assignments WHERE id = ?').get(id);
  return row ? mapAssignment(row) : null;
}

// PATCH /api/admin/assignments/[id] — update assignment status, notes, priority, etc.
export async function PATCH(request, { params: paramsPromise }) {
  try {
    getAuthUser(request, { requireAdmin: true });

    const id = Number((await paramsPromise).id);
    const existing = db.prepare('SELECT * FROM assignments WHERE id = ?').get(id);
    if (!existing) {
      return Response.json({ error: 'Assignment not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      status,
      priority,
      admin_notes,
      volunteer_notes,
      due_date
    } = body;

    if (status && !statuses.has(status)) {
      return Response.json({ error: `status must be one of: ${[...statuses].join(', ')}` }, { status: 400 });
    }
    if (priority && !priorities.has(priority)) {
      return Response.json({ error: `priority must be one of: ${[...priorities].join(', ')}` }, { status: 400 });
    }

    const result = db.transaction(() => {
      const updates = {};
      const setClauses = [];

      if (status !== undefined) {
        setClauses.push('status = @status');
        updates.status = status;
      }
      if (priority !== undefined) {
        setClauses.push('priority = @priority');
        updates.priority = priority;
      }
      if (admin_notes !== undefined) {
        setClauses.push('admin_notes = @admin_notes');
        updates.admin_notes = admin_notes.trim();
      }
      if (volunteer_notes !== undefined) {
        setClauses.push('volunteer_notes = @volunteer_notes');
        updates.volunteer_notes = volunteer_notes.trim();
      }
      if (due_date !== undefined) {
        setClauses.push('due_date = @due_date');
        updates.due_date = due_date;
      }

      if (setClauses.length === 0) {
        throw Object.assign(new Error('No valid fields to update'), { status: 400 });
      }

      const ts = new Date().toISOString();
      setClauses.push('updated_at = @updated_at');
      updates.updated_at = ts;
      updates.id = id;

      db.prepare(`UPDATE assignments SET ${setClauses.join(', ')} WHERE id = @id`).run(updates);

      // Sync volunteer availability based on assignment status
      if (status === 'completed' || status === 'rejected') {
        // Check if volunteer has any other active assignments
        const activeCount = db.prepare(
          "SELECT COUNT(*) AS count FROM assignments WHERE volunteer_id = ? AND status NOT IN ('completed', 'rejected') AND id != ?"
        ).get(existing.volunteer_id, id).count;
        if (activeCount === 0) {
          db.prepare('UPDATE volunteers SET is_available = 1 WHERE id = ?').run(existing.volunteer_id);
        }
      }

      // Sync request status
      if (status === 'completed') {
        // Check if all assignments for this request are completed
        const pendingCount = db.prepare(
          "SELECT COUNT(*) AS count FROM assignments WHERE request_id = ? AND status NOT IN ('completed', 'rejected') AND id != ?"
        ).get(existing.request_id, id).count;
        if (pendingCount === 0) {
          db.prepare('UPDATE requests SET status = ?, updated_at = ? WHERE id = ?').run('completed', ts, existing.request_id);
        }
      } else if (status === 'in_progress') {
        db.prepare('UPDATE requests SET status = ?, updated_at = ? WHERE id = ? AND status != ?').run('in_progress', ts, existing.request_id, 'completed');
      }

      const updated = db.prepare('SELECT * FROM assignments WHERE id = ?').get(id);

      // Send email if assignment status changed and volunteer has email
      if (status && status !== existing.status) {
        const vol = db.prepare('SELECT * FROM volunteers WHERE id = ?').get(existing.volunteer_id);
        const req = db.prepare('SELECT * FROM requests WHERE id = ?').get(existing.request_id);
        if (vol && vol.email && req) {
          sendAssignmentStatusEmail(
            { name: vol.name, email: vol.email },
            { id: req.id, location: req.location, type: req.type, urgency: req.urgency },
            status, existing.status
          ).catch((err) => console.error('[assignments] Email failed:', err.message));
        }
      }

      return updated;
    })();

    return Response.json(mapAssignment(result));
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}

// DELETE /api/admin/assignments/[id] — remove an assignment
export async function DELETE(request, { params: paramsPromise }) {
  try {
    getAuthUser(request, { requireAdmin: true });

    const id = Number((await paramsPromise).id);
    const existing = db.prepare('SELECT * FROM assignments WHERE id = ?').get(id);
    if (!existing) {
      return Response.json({ error: 'Assignment not found' }, { status: 404 });
    }

    db.transaction(() => {
      // Remove from assignments
      db.prepare('DELETE FROM assignments WHERE id = ?').run(id);

      // Remove from legacy junction table
      db.prepare('DELETE FROM request_volunteers WHERE request_id = ? AND volunteer_id = ?').run(existing.request_id, existing.volunteer_id);

      // Check if volunteer has any other active assignments
      const activeCount = db.prepare(
        "SELECT COUNT(*) AS count FROM assignments WHERE volunteer_id = ? AND status NOT IN ('completed', 'rejected')"
      ).get(existing.volunteer_id).count;
      if (activeCount === 0) {
        db.prepare('UPDATE volunteers SET is_available = 1 WHERE id = ?').run(existing.volunteer_id);
      }

      // Check if request has any remaining assignments
      const remainingAssignments = db.prepare(
        "SELECT COUNT(*) AS count FROM assignments WHERE request_id = ? AND status NOT IN ('completed', 'rejected')"
      ).get(existing.request_id).count;
      if (remainingAssignments === 0) {
        db.prepare("UPDATE requests SET status = 'pending', updated_at = ? WHERE id = ?").run(new Date().toISOString(), existing.request_id);
      }
    })();

    // Send unassigned email if volunteer has email
    const vol = db.prepare('SELECT * FROM volunteers WHERE id = ?').get(existing.volunteer_id);
    const req = db.prepare('SELECT * FROM requests WHERE id = ?').get(existing.request_id);
    if (vol && vol.email && req) {
      sendUnassignedEmail(
        { name: vol.name, email: vol.email },
        { id: req.id, location: req.location, type: req.type, urgency: req.urgency }
      ).catch((err) => console.error('[assignments] Unassigned email failed:', err.message));
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}
