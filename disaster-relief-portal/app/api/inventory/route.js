import db from '@/lib/db';

const categories = new Set(['food', 'medicine', 'equipment', 'shelter', 'clothing', 'other']);

function validateCategory(cat) {
  if (!categories.has(cat)) throw Object.assign(new Error('category must be one of: food, medicine, equipment, shelter, clothing, other'), { status: 400 });
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const clauses = [];
    const params = {};

    if (category) { validateCategory(category); clauses.push('category = @category'); params.category = category; }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const rows = db.prepare(`SELECT * FROM inventory ${where} ORDER BY category ASC, item_name ASC`).all(params);
    return Response.json(rows);
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}

export async function POST(request) {
  try {
    const { item_name, category, quantity, unit, location_name, latitude, longitude } = await request.json();
    const qty = Number(quantity);

    if (!item_name || !unit || !location_name || !Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
      return Response.json({ error: 'item_name, unit, location_name, latitude and longitude are required' }, { status: 400 });
    }
    validateCategory(category);
    if (!Number.isInteger(qty) || qty < 0) return Response.json({ error: 'quantity must be a non-negative integer' }, { status: 400 });

    const ts = new Date().toISOString();
    const result = db.prepare('INSERT INTO inventory (item_name, category, quantity, unit, location_name, latitude, longitude, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(item_name.trim(), category, qty, unit.trim(), location_name.trim(), Number(latitude), Number(longitude), ts);

    const created = db.prepare('SELECT * FROM inventory WHERE id = ?').get(result.lastInsertRowid);
    return Response.json(created, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}
