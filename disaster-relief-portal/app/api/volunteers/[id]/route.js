import db from '@/lib/db';
import { sendVolunteerConfirmation, sendProfileUpdateEmail } from '@/lib/mailer';

const allowedSkills = new Set(['medical', 'rescue', 'logistics', 'transport']);

function parseSkills(value) {
  try { return JSON.parse(value || '[]'); } catch { return []; }
}

function mapVolunteer(row, extra = {}) {
  return { ...row, is_available: Boolean(row.is_available), skills: parseSkills(row.skills), ...extra };
}

function validateSkills(skills) {
  if (!Array.isArray(skills) || skills.length === 0) throw Object.assign(new Error('At least one skill is required'), { status: 400 });
  const unique = [...new Set(skills)];
  const invalid = unique.find((s) => !allowedSkills.has(s));
  if (invalid) throw Object.assign(new Error(`Invalid skill: ${invalid}`), { status: 400 });
  return unique;
}

export async function PATCH(request, { params }) {
  try {
    const id = Number((await params).id);
    const existing = db.prepare('SELECT * FROM volunteers WHERE id = ?').get(id);
    if (!existing) return Response.json({ error: 'Volunteer not found' }, { status: 404 });

    const body = await request.json();

    const email = body.email !== undefined ? body.email : existing.email;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const updates = {
      name: body.name ?? existing.name,
      phone: body.phone ?? existing.phone,
      email: email ? email.trim() : null,
      skills: body.skills ? JSON.stringify(validateSkills(body.skills)) : existing.skills,
      latitude: body.latitude !== undefined ? Number(body.latitude) : existing.latitude,
      longitude: body.longitude !== undefined ? Number(body.longitude) : existing.longitude,
      location_name: body.location_name ?? existing.location_name,
      is_available: body.is_available !== undefined ? (body.is_available ? 1 : 0) : existing.is_available
    };

    if (!Number.isFinite(updates.latitude) || !Number.isFinite(updates.longitude)) {
      return Response.json({ error: 'latitude and longitude must be valid numbers' }, { status: 400 });
    }

    db.prepare(`UPDATE volunteers SET name = @name, phone = @phone, email = @email, skills = @skills, latitude = @latitude, longitude = @longitude, location_name = @location_name, is_available = @is_available WHERE id = @id`).run({ ...updates, id });

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

    return Response.json(mapVolunteer(updated));
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const id = Number((await params).id);
    const result = db.prepare('DELETE FROM volunteers WHERE id = ?').run(id);
    if (result.changes === 0) return Response.json({ error: 'Volunteer not found' }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}
