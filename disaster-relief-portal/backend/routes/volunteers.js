const express = require('express');
const db = require('../db');
const { sendVolunteerConfirmation, sendProfileUpdateEmail } = require('../mailer');

const router = express.Router();

const allowedSkills = new Set(['medical', 'rescue', 'logistics', 'transport']);

function parseSkills(value) {
  try {
    return JSON.parse(value || '[]');
  } catch {
    return [];
  }
}

function mapVolunteer(row, extra = {}) {
  return {
    ...row,
    is_available: Boolean(row.is_available),
    skills: parseSkills(row.skills),
    ...extra
  };
}

function validateSkills(skills) {
  if (!Array.isArray(skills) || skills.length === 0) {
    const error = new Error('At least one skill is required');
    error.status = 400;
    throw error;
  }

  const uniqueSkills = Array.from(new Set(skills));
  const invalid = uniqueSkills.find((skill) => !allowedSkills.has(skill));
  if (invalid) {
    const error = new Error(`Invalid skill: ${invalid}`);
    error.status = 400;
    throw error;
  }

  return uniqueSkills;
}

function distanceKm(aLat, aLng, bLat, bLng) {
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

router.post('/', (req, res, next) => {
  try {
    const { name, phone, email, latitude, longitude, location_name, is_available = true } = req.body;
    const skills = validateSkills(req.body.skills);

    if (!name || !phone || !location_name || !Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
      return res.status(400).json({ error: 'name, phone, location_name, latitude and longitude are required' });
    }

    // Basic email validation if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const timestamp = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO volunteers (name, phone, email, skills, latitude, longitude, location_name, is_available, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name.trim(),
      phone.trim(),
      email ? email.trim() : null,
      JSON.stringify(skills),
      Number(latitude),
      Number(longitude),
      location_name.trim(),
      is_available ? 1 : 0,
      timestamp
    );

    const created = db.prepare('SELECT * FROM volunteers WHERE id = ?').get(result.lastInsertRowid);

    // Send confirmation email if email was provided
    if (email) {
      sendVolunteerConfirmation({ name: created.name, email: created.email }).catch((err) =>
        console.error('[volunteers] Failed to send confirmation email:', err.message)
      );
    }

    res.status(201).json(mapVolunteer(created));
  } catch (error) {
    next(error);
  }
});

router.get('/nearby', (req, res, next) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radius = Number(req.query.radius || 20);

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radius) || radius <= 0) {
      return res.status(400).json({ error: 'lat, lng and a positive radius are required' });
    }

    const volunteers = db.prepare('SELECT * FROM volunteers').all()
      .map((row) => {
        const distance = distanceKm(lat, lng, row.latitude, row.longitude);
        return mapVolunteer(row, { distance_km: Number(distance.toFixed(1)) });
      })
      .filter((volunteer) => volunteer.distance_km <= radius)
      .sort((a, b) => a.distance_km - b.distance_km);

    res.json(volunteers);
  } catch (error) {
    next(error);
  }
});

router.get('/', (req, res, next) => {
  try {
    const { skill, availability } = req.query;
    const rows = db.prepare('SELECT * FROM volunteers ORDER BY is_available DESC, name ASC').all();
    let volunteers = rows.map(mapVolunteer);

    if (skill) {
      if (!allowedSkills.has(skill)) {
        return res.status(400).json({ error: 'Invalid skill filter' });
      }
      volunteers = volunteers.filter((volunteer) => volunteer.skills.includes(skill));
    }

    if (availability === 'available') {
      volunteers = volunteers.filter((volunteer) => volunteer.is_available);
    } else if (availability === 'busy') {
      volunteers = volunteers.filter((volunteer) => !volunteer.is_available);
    }

    res.json(volunteers);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM volunteers WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Volunteer not found' });
    }

    const email = req.body.email !== undefined ? req.body.email : existing.email;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const updates = {
      name: req.body.name ?? existing.name,
      phone: req.body.phone ?? existing.phone,
      email: email ? email.trim() : null,
      skills: req.body.skills ? JSON.stringify(validateSkills(req.body.skills)) : existing.skills,
      latitude: req.body.latitude !== undefined ? Number(req.body.latitude) : existing.latitude,
      longitude: req.body.longitude !== undefined ? Number(req.body.longitude) : existing.longitude,
      location_name: req.body.location_name ?? existing.location_name,
      is_available: req.body.is_available !== undefined ? (req.body.is_available ? 1 : 0) : existing.is_available
    };

    if (!Number.isFinite(updates.latitude) || !Number.isFinite(updates.longitude)) {
      return res.status(400).json({ error: 'latitude and longitude must be valid numbers' });
    }

    db.prepare(`
      UPDATE volunteers
      SET name = @name,
          phone = @phone,
          email = @email,
          skills = @skills,
          latitude = @latitude,
          longitude = @longitude,
          location_name = @location_name,
          is_available = @is_available
      WHERE id = @id
    `).run({ ...updates, id });

    const updated = db.prepare('SELECT * FROM volunteers WHERE id = ?').get(id);

    // Send confirmation if email was just added/updated and volunteer is available
    if (updates.email && updates.is_available && (!existing.email || existing.email !== updates.email)) {
      sendVolunteerConfirmation({ name: updated.name, email: updated.email }).catch((err) =>
        console.error('[volunteers] Failed to send confirmation email:', err.message)
      );
    }

    // Send profile update notification if email exists and something changed
    if (updated.email) {
      const changedFields = [];
      for (const key of ['name', 'phone', 'email', 'skills', 'location_name', 'is_available']) {
        const oldVal = typeof existing[key] === 'string' ? existing[key] : String(existing[key] ?? '');
        const newVal = typeof updates[key] === 'string' ? updates[key] : String(updates[key] ?? '');
        if (oldVal !== newVal) changedFields.push(key);
      }
      if (changedFields.length > 0) {
        sendProfileUpdateEmail({ name: updated.name, email: updated.email }, changedFields).catch((err) =>
          console.error('[volunteers] Profile update email failed:', err.message)
        );
      }
    }

    res.json(mapVolunteer(updated));
  } catch (error) {
    next(error);
  }
});

// POST /api/volunteers/:id/send-confirmation — resend confirmation email
router.post('/:id/send-confirmation', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const volunteer = db.prepare('SELECT * FROM volunteers WHERE id = ?').get(id);
    if (!volunteer) {
      return res.status(404).json({ error: 'Volunteer not found' });
    }
    if (!volunteer.email) {
      return res.status(400).json({ error: 'Volunteer has no email address' });
    }

    sendVolunteerConfirmation({ name: volunteer.name, email: volunteer.email })
      .then(() => res.json({ message: 'Confirmation email sent', email: volunteer.email }))
      .catch((err) => {
        console.error('[volunteers] Failed to send confirmation:', err.message);
        res.status(500).json({ error: 'Failed to send confirmation email' });
      });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', (req, res, next) => {
  try {
    const result = db.prepare('DELETE FROM volunteers WHERE id = ?').run(Number(req.params.id));
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Volunteer not found' });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
