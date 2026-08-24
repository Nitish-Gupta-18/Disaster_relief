import db from '@/lib/db';

const categories = new Set(['food', 'medicine', 'equipment', 'shelter', 'clothing', 'other']);
const statuses = new Set(['pending', 'received', 'distributed']);

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

function deductFromInventory(item_name, quantity, location_name) {
  const existing = db.prepare('SELECT * FROM inventory WHERE item_name = ? AND location_name = ?').get(item_name.trim(), (location_name || 'Unknown').trim());
  if (existing) {
    const newQty = Math.max(0, existing.quantity - quantity);
    const ts = new Date().toISOString();
    db.prepare('UPDATE inventory SET quantity = ?, updated_at = ? WHERE id = ?').run(newQty, ts, existing.id);
  }
}

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const donation = db.prepare('SELECT * FROM donations WHERE id = ?').get(Number(id));
    if (!donation) return Response.json({ error: 'Donation not found' }, { status: 404 });
    return Response.json(donation);
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const existing = db.prepare('SELECT * FROM donations WHERE id = ?').get(Number(id));
    if (!existing) return Response.json({ error: 'Donation not found' }, { status: 404 });

    const body = await request.json();
    const updates = {
      donor_name: body.donor_name ?? existing.donor_name,
      donor_email: body.donor_email !== undefined ? body.donor_email : existing.donor_email,
      donor_phone: body.donor_phone !== undefined ? body.donor_phone : existing.donor_phone,
      item_name: body.item_name ?? existing.item_name,
      category: body.category ?? existing.category,
      quantity: body.quantity !== undefined ? Number(body.quantity) : existing.quantity,
      unit: body.unit ?? existing.unit,
      drop_location: body.drop_location !== undefined ? body.drop_location : existing.drop_location,
      status: body.status ?? existing.status,
      notes: body.notes !== undefined ? body.notes : existing.notes,
      updated_at: new Date().toISOString()
    };

    if (updates.category && !categories.has(updates.category)) {
      return Response.json({ error: 'category must be one of: food, medicine, equipment, shelter, clothing, other' }, { status: 400 });
    }
    if (!Number.isInteger(updates.quantity) || updates.quantity <= 0) {
      return Response.json({ error: 'quantity must be a positive integer' }, { status: 400 });
    }
    if (!statuses.has(updates.status)) {
      return Response.json({ error: 'status must be one of: pending, received, distributed' }, { status: 400 });
    }

    // Handle status transitions for inventory sync
    const oldStatus = existing.status;
    const newStatus = updates.status;

    if (oldStatus !== 'received' && newStatus === 'received') {
      // Newly received: add to inventory
      syncToInventory(updates.item_name, updates.category, updates.quantity, updates.unit, updates.drop_location || 'Unknown');
    } else if (oldStatus === 'received' && newStatus === 'distributed') {
      // Was received, now distributed: remove from inventory
      deductFromInventory(existing.item_name, existing.quantity, existing.drop_location || 'Unknown');
    } else if (oldStatus === 'distributed' && newStatus === 'received') {
      // Undo distribution: add back to inventory
      syncToInventory(updates.item_name, updates.category, updates.quantity, updates.unit, updates.drop_location || 'Unknown');
    }

    db.prepare(`
      UPDATE donations
      SET donor_name = @donor_name, donor_email = @donor_email, donor_phone = @donor_phone,
          item_name = @item_name, category = @category, quantity = @quantity, unit = @unit,
          drop_location = @drop_location, status = @status, notes = @notes, updated_at = @updated_at
      WHERE id = @id
    `).run({ ...updates, id: Number(id) });

    const updated = db.prepare('SELECT * FROM donations WHERE id = ?').get(Number(id));
    return Response.json(updated);
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const result = db.prepare('DELETE FROM donations WHERE id = ?').run(Number(id));
    if (result.changes === 0) return Response.json({ error: 'Donation not found' }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}
