import db from '@/lib/db';
import { sendVolunteerConfirmation } from '@/lib/mailer';

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

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const skill = searchParams.get('skill');
    const availability = searchParams.get('availability');

    const rows = db.prepare('SELECT * FROM volunteers ORDER BY is_available DESC, name ASC').all();
    let volunteers = rows.map(mapVolunteer);

    if (skill) {
      if (!allowedSkills.has(skill)) return Response.json({ error: 'Invalid skill filter' }, { status: 400 });
      volunteers = volunteers.filter((v) => v.skills.includes(skill));
    }
    if (availability === 'available') volunteers = volunteers.filter((v) => v.is_available);
    else if (availability === 'busy') volunteers = volunteers.filter((v) => !v.is_available);

    return Response.json(volunteers);
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, phone, email, latitude, longitude, location_name, is_available = true } = body;
    const skills = validateSkills(body.skills);

    if (!name || !phone || !location_name || !Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
      return Response.json({ error: 'name, phone, location_name, latitude and longitude are required' }, { status: 400 });
    }

    // Basic email validation if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const timestamp = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO volunteers (name, phone, email, skills, latitude, longitude, location_name, is_available, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name.trim(), phone.trim(), email ? email.trim() : null, JSON.stringify(skills), Number(latitude), Number(longitude), location_name.trim(), is_available ? 1 : 0, timestamp);

    const created = db.prepare('SELECT * FROM volunteers WHERE id = ?').get(result.lastInsertRowid);

    // Send confirmation email if email was provided
    if (email) {
      sendVolunteerConfirmation({ name: created.name, email: created.email }).catch((err) =>
        console.error('[volunteers] Failed to send confirmation email:', err.message)
      );
    }

    return Response.json(mapVolunteer(created), { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}
