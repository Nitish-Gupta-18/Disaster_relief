const express = require('express');
const db = require('../db');
const { sendAssignmentNotification, sendAssignmentStatusEmail, sendUnassignedEmail } = require('../mailer');

const router = express.Router();

const statuses = new Set(['assigned', 'accepted', 'in_progress', 'completed', 'rejected']);
const priorities = new Set(['low', 'medium', 'high', 'critical']);

const requestSkillMap = {
  food: ['logistics', 'transport'],
  water: ['logistics', 'rescue'],
  medicine: ['medical'],
  shelter: ['rescue', 'logistics', 'transport']
};

function parseJsonArray(value) {
  try { return JSON.parse(value || '[]'); } catch { return []; }
}

function distanceKm(aLat, aLng, bLat, bLng) {
  const toRad = (v) => (v * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
    const options = Array.from(validValues).join(', ');
    const error = new Error(`${fieldName} must be one of: ${options}`);
    error.status = 400;
    throw error;
  }
}

// GET /api/admin/assignments — list all assignments
router.get('/assignments', (req, res, next) => {
  try {
    const { status, priority, volunteerId, requestId } = req.query;
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

    res.json(rows.map(mapAssignment));
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/assignments — create new assignment
router.post('/assignments', (req, res, next) => {
  try {
    const { request_id, volunteer_id, priority = 'medium', admin_notes = '', due_date = null, assigned_by = 'admin' } = req.body;
    const reqId = Number(request_id);
    const volId = Number(volunteer_id);

    if (!Number.isInteger(reqId) || !Number.isInteger(volId)) {
      return res.status(400).json({ error: 'Valid request_id and volunteer_id are required' });
    }
    if (priority && !priorities.has(priority)) {
      return res.status(400).json({ error: `priority must be one of: ${[...priorities].join(', ')}` });
    }

    const result = db.transaction(() => {
      const req = db.prepare('SELECT * FROM requests WHERE id = ?').get(reqId);
      if (!req) {
        const error = new Error('Request not found');
        error.status = 404;
        throw error;
      }
      const vol = db.prepare('SELECT * FROM volunteers WHERE id = ?').get(volId);
      if (!vol) {
        const error = new Error('Volunteer not found');
        error.status = 404;
        throw error;
      }

      const existing = db.prepare(
        "SELECT * FROM assignments WHERE request_id = ? AND volunteer_id = ? AND status NOT IN ('completed', 'rejected')"
      ).get(reqId, volId);
      if (existing) {
        const error = new Error('Volunteer already has an active assignment for this request');
        error.status = 409;
        throw error;
      }

      const ts = new Date().toISOString();
      const insertResult = db.prepare(`
        INSERT INTO assignments (request_id, volunteer_id, status, priority, admin_notes, due_date, assigned_by, created_at, updated_at)
        VALUES (?, ?, 'assigned', ?, ?, ?, ?, ?, ?)
      `).run(reqId, volId, priority, admin_notes.trim(), due_date, assigned_by.trim(), ts, ts);

      if (req.status === 'pending') {
        db.prepare('UPDATE requests SET status = ?, updated_at = ? WHERE id = ?').run('assigned', ts, reqId);
      } else {
        db.prepare('UPDATE requests SET updated_at = ? WHERE id = ?').run(ts, reqId);
      }

      db.prepare('UPDATE volunteers SET is_available = 0 WHERE id = ?').run(volId);
      db.prepare('INSERT OR IGNORE INTO request_volunteers (request_id, volunteer_id, assigned_at) VALUES (?, ?, ?)').run(reqId, volId, ts);

      // Send assignment notification email
      if (vol.email) {
        sendAssignmentNotification(
          { name: vol.name, email: vol.email },
          { id: req.id, location: req.location, type: req.type, urgency: req.urgency, description: req.description }
        ).catch((err) => console.error('[admin] Assignment email failed:', err.message));
      }

      return db.prepare('SELECT * FROM assignments WHERE id = ?').get(insertResult.lastInsertRowid);
    })();

    res.status(201).json(mapAssignment(result));
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/assignments/:id — update assignment
router.patch('/assignments/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM assignments WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const { status, priority, admin_notes, volunteer_notes, due_date } = req.body;

    if (status && !statuses.has(status)) {
      return res.status(400).json({ error: `status must be one of: ${[...statuses].join(', ')}` });
    }
    if (priority && !priorities.has(priority)) {
      return res.status(400).json({ error: `priority must be one of: ${[...priorities].join(', ')}` });
    }

    const result = db.transaction(() => {
      const updates = {};
      const setClauses = [];

      if (status !== undefined) { setClauses.push('status = @status'); updates.status = status; }
      if (priority !== undefined) { setClauses.push('priority = @priority'); updates.priority = priority; }
      if (admin_notes !== undefined) { setClauses.push('admin_notes = @admin_notes'); updates.admin_notes = admin_notes.trim(); }
      if (volunteer_notes !== undefined) { setClauses.push('volunteer_notes = @volunteer_notes'); updates.volunteer_notes = volunteer_notes.trim(); }
      if (due_date !== undefined) { setClauses.push('due_date = @due_date'); updates.due_date = due_date; }

      if (setClauses.length === 0) {
        const error = new Error('No valid fields to update');
        error.status = 400;
        throw error;
      }

      const ts = new Date().toISOString();
      setClauses.push('updated_at = @updated_at');
      updates.updated_at = ts;
      updates.id = id;

      db.prepare(`UPDATE assignments SET ${setClauses.join(', ')} WHERE id = @id`).run(updates);

      if (status === 'completed' || status === 'rejected') {
        const activeCount = db.prepare(
          "SELECT COUNT(*) AS count FROM assignments WHERE volunteer_id = ? AND status NOT IN ('completed', 'rejected') AND id != ?"
        ).get(existing.volunteer_id, id).count;
        if (activeCount === 0) {
          db.prepare('UPDATE volunteers SET is_available = 1 WHERE id = ?').run(existing.volunteer_id);
        }
      }

      if (status === 'completed') {
        const pendingCount = db.prepare(
          "SELECT COUNT(*) AS count FROM assignments WHERE request_id = ? AND status NOT IN ('completed', 'rejected') AND id != ?"
        ).get(existing.request_id, id).count;
        if (pendingCount === 0) {
          db.prepare('UPDATE requests SET status = ?, updated_at = ? WHERE id = ?').run('completed', ts, existing.request_id);
        }
      } else if (status === 'in_progress') {
        db.prepare('UPDATE requests SET status = ?, updated_at = ? WHERE id = ? AND status != ?').run('in_progress', ts, existing.request_id, 'completed');
      }

      return db.prepare('SELECT * FROM assignments WHERE id = ?').get(id);
    })();

    // Send email if assignment status changed and volunteer has email
    if (status && status !== existing.status) {
      const vol = db.prepare('SELECT * FROM volunteers WHERE id = ?').get(existing.volunteer_id);
      const req = db.prepare('SELECT * FROM requests WHERE id = ?').get(existing.request_id);
      if (vol && vol.email && req) {
        sendAssignmentStatusEmail(
          { name: vol.name, email: vol.email },
          { id: req.id, location: req.location, type: req.type, urgency: req.urgency },
          status, existing.status
        ).catch((err) => console.error('[admin] Status email failed:', err.message));
      }
    }

    res.json(mapAssignment(result));
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/assignments/:id — remove assignment
router.delete('/assignments/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM assignments WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    db.transaction(() => {
      db.prepare('DELETE FROM assignments WHERE id = ?').run(id);
      db.prepare('DELETE FROM request_volunteers WHERE request_id = ? AND volunteer_id = ?').run(existing.request_id, existing.volunteer_id);

      const activeCount = db.prepare(
        "SELECT COUNT(*) AS count FROM assignments WHERE volunteer_id = ? AND status NOT IN ('completed', 'rejected')"
      ).get(existing.volunteer_id).count;
      if (activeCount === 0) {
        db.prepare('UPDATE volunteers SET is_available = 1 WHERE id = ?').run(existing.volunteer_id);
      }

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
      ).catch((err) => console.error('[admin] Unassigned email failed:', err.message));
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/suggestions?requestId=1 — smart volunteer matching
router.get('/suggestions', (req, res, next) => {
  try {
    const requestId = Number(req.query.requestId);
    if (!Number.isInteger(requestId) || requestId <= 0) {
      return res.status(400).json({ error: 'Valid requestId query parameter is required' });
    }

    const req = db.prepare('SELECT * FROM requests WHERE id = ?').get(requestId);
    if (!req) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const volunteers = db.prepare('SELECT * FROM volunteers WHERE is_available = 1').all();
    const assignedIds = new Set(
      db.prepare(
        "SELECT volunteer_id FROM assignments WHERE request_id = ? AND status NOT IN ('completed', 'rejected')"
      ).all(requestId).map((r) => r.volunteer_id)
    );

    const preferredSkills = requestSkillMap[req.type] || ['logistics'];

    const scored = volunteers
      .filter((v) => !assignedIds.has(v.id))
      .map((v) => {
        const skills = parseJsonArray(v.skills);
        let score = 0;
        const reasons = [];

        const matchedSkills = skills.filter((s) => preferredSkills.includes(s));
        score += matchedSkills.length * 30;
        if (matchedSkills.length > 0) {
          reasons.push(`Has relevant skills: ${matchedSkills.join(', ')}`);
        }

        score += skills.length * 5;

        const dist = distanceKm(req.latitude, req.longitude, v.latitude, v.longitude);
        const proximityScore = Math.max(0, 40 - dist * 0.4);
        score += Math.round(proximityScore);
        if (dist < 30) reasons.push(`Nearby: ${dist.toFixed(0)} km away`);
        else reasons.push(`${dist.toFixed(0)} km away`);

        return {
          volunteer: { ...v, is_available: Boolean(v.is_available), skills },
          score,
          distance_km: Number(dist.toFixed(1)),
          reasons
        };
      })
      .sort((a, b) => b.score - a.score);

    res.json({
      request: req,
      preferred_skills: preferredSkills,
      suggestions: scored,
      total_available: volunteers.length,
      already_assigned: assignedIds.size
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
