import db from '@/lib/db';

const types = new Set(['food', 'water', 'medicine', 'shelter']);
const urgencies = new Set(['low', 'medium', 'high', 'critical']);
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
  `).all(requestId).map((row) => ({ ...row, is_available: Boolean(row.is_available), skills: parseJsonArray(row.skills) }));

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

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const urgency = searchParams.get('urgency');
    const clauses = [];
    const params = {};

    if (status) { requireEnum(status, statuses, 'status'); clauses.push('status = @status'); params.status = status; }
    if (type) { requireEnum(type, types, 'type'); clauses.push('type = @type'); params.type = type; }
    if (urgency) { requireEnum(urgency, urgencies, 'urgency'); clauses.push('urgency = @urgency'); params.urgency = urgency; }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = db.prepare(`
      SELECT * FROM requests ${where}
      ORDER BY CASE urgency WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, datetime(created_at) DESC
    `).all(params);

    return Response.json(rows.map(mapRequest));
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}

export async function POST(request) {
  try {
    const { location, latitude, longitude, type, urgency, family_size, description = '' } = await request.json();
    const familySize = Number(family_size);

    if (!location || !Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
      return Response.json({ error: 'location, latitude and longitude are required' }, { status: 400 });
    }
    requireEnum(type, types, 'type');
    requireEnum(urgency, urgencies, 'urgency');
    if (!Number.isInteger(familySize) || familySize <= 0) {
      return Response.json({ error: 'family_size must be a positive integer' }, { status: 400 });
    }

    const timestamp = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO requests (location, latitude, longitude, type, urgency, family_size, description, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(location.trim(), Number(latitude), Number(longitude), type, urgency, familySize, description.trim(), timestamp, timestamp);

    return Response.json(getRequestById(result.lastInsertRowid), { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}
