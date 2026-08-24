import db from '@/lib/db';

const categories = new Set(['food', 'medicine', 'equipment', 'shelter', 'clothing', 'other']);
const statuses = new Set(['pending', 'received', 'distributed']);

function validateCategory(cat) {
  if (!categories.has(cat)) throw Object.assign(new Error('category must be one of: food, medicine, equipment, shelter, clothing, other'), { status: 400 });
}

function syncToInventory(item_name, category, quantity, unit, location_name) {
  const existing = db.prepare('SELECT * FROM inventory WHERE item_name = ? AND location_name = ?').get(item_name.trim(), (location_name || 'Unknown').trim());
  const ts = new Date().toISOString();
  const lat = 26.1445;
  const lng = 91.7362;

  if (existing) {
    db.prepare('UPDATE inventory SET quantity = quantity + ?, updated_at = ? WHERE id = ?').run(quantity, ts, existing.id);
  } else {
    db.prepare('INSERT INTO inventory (item_name, category, quantity, unit, location_name, latitude, longitude, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      item_name.trim(), category, quantity, unit.trim(), (location_name || 'Unknown').trim(), lat, lng, ts
    );
  }
}

function deductFromInventory(item_name, category, quantity, location_name) {
  const existing = db.prepare('SELECT * FROM inventory WHERE item_name = ? AND location_name = ?').get(item_name.trim(), (location_name || 'Unknown').trim());
  if (existing) {
    const newQty = Math.max(0, existing.quantity - quantity);
    const ts = new Date().toISOString();
    db.prepare('UPDATE inventory SET quantity = ?, updated_at = ? WHERE id = ?').run(newQty, ts, existing.id);
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const clauses = [];
    const params = {};

    if (status) {
      if (!statuses.has(status)) return Response.json({ error: 'status must be one of: pending, received, distributed' }, { status: 400 });
      clauses.push('status = @status');
      params.status = status;
    }
    if (category) {
      validateCategory(category);
      clauses.push('category = @category');
      params.category = category;
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = db.prepare(`SELECT * FROM donations ${where} ORDER BY created_at DESC`).all(params);
    return Response.json(rows);
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}

export async function POST(request) {
  try {
    const { donor_name, donor_email, donor_phone, item_name, category, quantity, unit, drop_location, status, notes } = await request.json();
    const qty = Number(quantity);

    if (!donor_name || !item_name || !unit) {
      return Response.json({ error: 'donor_name, item_name, and unit are required' }, { status: 400 });
    }
    validateCategory(category);
    if (!Number.isInteger(qty) || qty <= 0) return Response.json({ error: 'quantity must be a positive integer' }, { status: 400 });

    const donationStatus = status || 'pending';
    if (!statuses.has(donationStatus)) return Response.json({ error: 'status must be one of: pending, received, distributed' }, { status: 400 });

    const ts = new Date().toISOString();
    const result = db.prepare('INSERT INTO donations (donor_name, donor_email, donor_phone, item_name, category, quantity, unit, drop_location, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      donor_name.trim(), donor_email?.trim() || null, donor_phone?.trim() || null,
      item_name.trim(), category, qty, unit.trim(),
      drop_location?.trim() || null, donationStatus, notes?.trim() || null,
      ts, ts
    );

    if (donationStatus === 'received') {
      syncToInventory(item_name, category, qty, unit, drop_location || 'Unknown');
    }

    const created = db.prepare('SELECT * FROM donations WHERE id = ?').get(result.lastInsertRowid);
    return Response.json(created, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}
