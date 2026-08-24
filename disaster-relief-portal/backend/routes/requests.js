const express = require('express');
const db = require('../db');
const { sendAssignmentNotification, sendRequestStatusEmail } = require('../mailer');

const router = express.Router();

const types = new Set(['food', 'water', 'medicine', 'shelter']);
const urgencies = new Set(['low', 'medium', 'high', 'critical']);
const statuses = new Set(['pending', 'assigned', 'in_progress', 'completed']);

function parseJsonArray(value) {
  try {
    return JSON.parse(value || '[]');
  } catch {
    return [];
  }
}

function getAssignments(requestId) {
  const volunteers = db.prepare(`
    SELECT v.id, v.name, v.phone, v.skills, v.location_name, v.is_available, rv.assigned_at
    FROM request_volunteers rv
    JOIN volunteers v ON v.id = rv.volunteer_id
    WHERE rv.request_id = ?
    ORDER BY rv.assigned_at DESC
  `).all(requestId).map((row) => ({
    ...row,
    is_available: Boolean(row.is_available),
    skills: parseJsonArray(row.skills)
  }));

  const resources = db.prepare(`
    SELECT i.id AS inventory_id, i.item_name, i.category, i.unit, ra.quantity, ra.assigned_at
    FROM resource_assignments ra
    JOIN inventory i ON i.id = ra.inventory_id
    WHERE ra.request_id = ?
    ORDER BY ra.assigned_at DESC
  `).all(requestId);

  return { assigned_volunteers: volunteers, assigned_resources: resources };
}

function mapRequest(row) {
  return {
    ...row,
    ...getAssignments(row.id)
  };
}

function getRequestById(id) {
  const row = db.prepare('SELECT * FROM requests WHERE id = ?').get(id);
  return row ? mapRequest(row) : null;
}

function requireEnum(value, validValues, fieldName) {
  if (!validValues.has(value)) {
    const options = Array.from(validValues).join(', ');
    const error = new Error(`${fieldName} must be one of: ${options}`);
    error.status = 400;
    throw error;
  }
}

router.post('/', (req, res, next) => {
  try {
    const { location, latitude, longitude, type, urgency, family_size, description = '' } = req.body;
    const familySize = Number(family_size);

    if (!location || !Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
      return res.status(400).json({ error: 'location, latitude and longitude are required' });
    }
    requireEnum(type, types, 'type');
    requireEnum(urgency, urgencies, 'urgency');
    if (!Number.isInteger(familySize) || familySize <= 0) {
      return res.status(400).json({ error: 'family_size must be a positive integer' });
    }

    const timestamp = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO requests (
        location, latitude, longitude, type, urgency, family_size, description, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(
      location.trim(),
      Number(latitude),
      Number(longitude),
      type,
      urgency,
      familySize,
      description.trim(),
      timestamp,
      timestamp
    );

    res.status(201).json(getRequestById(result.lastInsertRowid));
  } catch (error) {
    next(error);
  }
});

router.get('/', (req, res, next) => {
  try {
    const { status, type, urgency } = req.query;
    const clauses = [];
    const params = {};

    if (status) {
      requireEnum(status, statuses, 'status');
      clauses.push('status = @status');
      params.status = status;
    }
    if (type) {
      requireEnum(type, types, 'type');
      clauses.push('type = @type');
      params.type = type;
    }
    if (urgency) {
      requireEnum(urgency, urgencies, 'urgency');
      clauses.push('urgency = @urgency');
      params.urgency = urgency;
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = db.prepare(`
      SELECT *
      FROM requests
      ${where}
      ORDER BY
        CASE urgency
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          ELSE 4
        END,
        datetime(created_at) DESC
    `).all(params);

    res.json(rows.map(mapRequest));
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/status', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    requireEnum(status, statuses, 'status');

    const result = db.prepare(`
      UPDATE requests
      SET status = ?, updated_at = ?
      WHERE id = ?
    `).run(status, new Date().toISOString(), id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Request not found' });
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

    res.json(getRequestById(id));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/assign-volunteer', (req, res, next) => {
  try {
    const requestId = Number(req.params.id);
    const volunteerId = Number(req.body.volunteerId);

    if (!Number.isInteger(requestId) || !Number.isInteger(volunteerId)) {
      return res.status(400).json({ error: 'Valid request id and volunteerId are required' });
    }

    const assign = db.transaction(() => {
      const request = db.prepare('SELECT * FROM requests WHERE id = ?').get(requestId);
      if (!request) {
        const error = new Error('Request not found');
        error.status = 404;
        throw error;
      }

      const volunteer = db.prepare('SELECT * FROM volunteers WHERE id = ?').get(volunteerId);
      if (!volunteer) {
        const error = new Error('Volunteer not found');
        error.status = 404;
        throw error;
      }

      const timestamp = new Date().toISOString();
      db.prepare(`
        INSERT OR IGNORE INTO request_volunteers (request_id, volunteer_id, assigned_at)
        VALUES (?, ?, ?)
      `).run(requestId, volunteerId, timestamp);

      if (request.status === 'pending') {
        db.prepare('UPDATE requests SET status = ?, updated_at = ? WHERE id = ?').run('assigned', timestamp, requestId);
      } else {
        db.prepare('UPDATE requests SET updated_at = ? WHERE id = ?').run(timestamp, requestId);
      }

      db.prepare('UPDATE volunteers SET is_available = 0 WHERE id = ?').run(volunteerId);

      // Send assignment notification email if volunteer has an email
      if (volunteer.email) {
        sendAssignmentNotification(
          { name: volunteer.name, email: volunteer.email },
          { id: request.id, location: request.location, type: request.type, urgency: request.urgency, description: request.description }
        ).catch((err) => console.error('[requests] Failed to send assignment email:', err.message));
      }

      return getRequestById(requestId);
    });

    res.json(assign());
  } catch (error) {
    next(error);
  }
});

router.post('/:id/assign-resources', (req, res, next) => {
  try {
    const requestId = Number(req.params.id);
    const inventoryId = Number(req.body.inventoryId);
    const quantity = Number(req.body.quantity);

    if (!Number.isInteger(requestId) || !Number.isInteger(inventoryId) || !Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ error: 'Valid request id, inventoryId and positive quantity are required' });
    }

    const assignResources = db.transaction(() => {
      const request = db.prepare('SELECT * FROM requests WHERE id = ?').get(requestId);
      if (!request) {
        const error = new Error('Request not found');
        error.status = 404;
        throw error;
      }

      const item = db.prepare('SELECT * FROM inventory WHERE id = ?').get(inventoryId);
      if (!item) {
        const error = new Error('Inventory item not found');
        error.status = 404;
        throw error;
      }
      if (item.quantity < quantity) {
        const error = new Error(`Only ${item.quantity} ${item.unit} available for ${item.item_name}`);
        error.status = 409;
        throw error;
      }

      const timestamp = new Date().toISOString();
      db.prepare('UPDATE inventory SET quantity = quantity - ?, updated_at = ? WHERE id = ?').run(quantity, timestamp, inventoryId);
      db.prepare(`
        INSERT INTO resource_assignments (request_id, inventory_id, quantity, assigned_at)
        VALUES (?, ?, ?, ?)
      `).run(requestId, inventoryId, quantity, timestamp);

      if (request.status === 'pending') {
        db.prepare('UPDATE requests SET status = ?, updated_at = ? WHERE id = ?').run('assigned', timestamp, requestId);
      } else {
        db.prepare('UPDATE requests SET updated_at = ? WHERE id = ?').run(timestamp, requestId);
      }

      return getRequestById(requestId);
    });

    res.json(assignResources());
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', (req, res, next) => {
  try {
    const result = db.prepare('DELETE FROM requests WHERE id = ?').run(Number(req.params.id));
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
