import db from '@/lib/db';

export async function GET() {
  try {
    const rows = db.prepare('SELECT * FROM relief_camps ORDER BY created_at DESC').all();
    return Response.json(rows);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { name, location_name, latitude, longitude, capacity = 0 } = await request.json();
    const cap = Number(capacity);

    if (!name || !location_name || !Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
      return Response.json({ error: 'name, location_name, latitude and longitude are required' }, { status: 400 });
    }
    if (!Number.isInteger(cap) || cap < 0) {
      return Response.json({ error: 'capacity must be a non-negative integer' }, { status: 400 });
    }

    const result = db.prepare('INSERT INTO relief_camps (name, location_name, latitude, longitude, capacity, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(name.trim(), location_name.trim(), Number(latitude), Number(longitude), cap, new Date().toISOString());

    const created = db.prepare('SELECT * FROM relief_camps WHERE id = ?').get(result.lastInsertRowid);
    return Response.json(created, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}
