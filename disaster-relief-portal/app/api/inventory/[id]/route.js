import db from '@/lib/db';

const categories = new Set(['food', 'medicine', 'equipment', 'shelter']);

function validateCategory(cat) {
  if (!categories.has(cat)) throw Object.assign(new Error('category must be one of: food, medicine, equipment, shelter'), { status: 400 });
}

export async function PATCH(request, { params }) {
  try {
    const id = Number((await params).id);
    const existing = db.prepare('SELECT * FROM inventory WHERE id = ?').get(id);
    if (!existing) return Response.json({ error: 'Inventory item not found' }, { status: 404 });

    const body = await request.json();
    const updates = {
      item_name: body.item_name ?? existing.item_name,
      category: body.category ?? existing.category,
      quantity: body.quantity !== undefined ? Number(body.quantity) : existing.quantity,
      unit: body.unit ?? existing.unit,
      location_name: body.location_name ?? existing.location_name,
      latitude: body.latitude !== undefined ? Number(body.latitude) : existing.latitude,
      longitude: body.longitude !== undefined ? Number(body.longitude) : existing.longitude,
      updated_at: new Date().toISOString()
    };

    validateCategory(updates.category);
    if (!Number.isInteger(updates.quantity) || updates.quantity < 0) return Response.json({ error: 'quantity must be a non-negative integer' }, { status: 400 });
    if (!Number.isFinite(updates.latitude) || !Number.isFinite(updates.longitude)) return Response.json({ error: 'latitude and longitude must be valid numbers' }, { status: 400 });

    db.prepare('UPDATE inventory SET item_name = @item_name, category = @category, quantity = @quantity, unit = @unit, location_name = @location_name, latitude = @latitude, longitude = @longitude, updated_at = @updated_at WHERE id = @id').run({ ...updates, id });

    const updated = db.prepare('SELECT * FROM inventory WHERE id = ?').get(id);
    return Response.json(updated);
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const id = Number((await params).id);
    const result = db.prepare('DELETE FROM inventory WHERE id = ?').run(id);
    if (result.changes === 0) return Response.json({ error: 'Inventory item not found' }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}
