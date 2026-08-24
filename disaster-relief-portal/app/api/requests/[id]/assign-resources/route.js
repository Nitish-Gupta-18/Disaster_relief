import db from '@/lib/db';

function parseJsonArray(value) {
  try { return JSON.parse(value || '[]'); } catch { return []; }
}

function getAssignments(requestId) {
  const volunteers = db.prepare(`
    SELECT v.id, v.name, v.phone, v.skills, v.location_name, v.is_available, rv.assigned_at
    FROM request_volunteers rv JOIN volunteers v ON v.id = rv.volunteer_id
    WHERE rv.request_id = ? ORDER BY rv.assigned_at DESC
  `).all(requestId).map((r) => ({ ...r, is_available: Boolean(r.is_available), skills: parseJsonArray(r.skills) }));

  const resources = db.prepare(`
    SELECT i.id AS inventory_id, i.item_name, i.category, i.unit, ra.quantity, ra.assigned_at
    FROM resource_assignments ra JOIN inventory i ON i.id = ra.inventory_id
    WHERE ra.request_id = ? ORDER BY ra.assigned_at DESC
  `).all(requestId);

  return { assigned_volunteers: volunteers, assigned_resources: resources };
}

function mapRequest(row) { return { ...row, ...getAssignments(row.id) }; }
function getRequestById(id) { const row = db.prepare('SELECT * FROM requests WHERE id = ?').get(id); return row ? mapRequest(row) : null; }

export async function POST(request, { params }) {
  try {
    const requestId = Number((await params).id);
    const { inventoryId, quantity } = await request.json();
    const qty = Number(quantity);

    if (!Number.isInteger(requestId) || !Number.isInteger(Number(inventoryId)) || !Number.isInteger(qty) || qty <= 0) {
      return Response.json({ error: 'Valid request id, inventoryId and positive quantity are required' }, { status: 400 });
    }

    const result = db.transaction(() => {
      const req = db.prepare('SELECT * FROM requests WHERE id = ?').get(requestId);
      if (!req) throw Object.assign(new Error('Request not found'), { status: 404 });

      const item = db.prepare('SELECT * FROM inventory WHERE id = ?').get(Number(inventoryId));
      if (!item) throw Object.assign(new Error('Inventory item not found'), { status: 404 });
      if (item.quantity < qty) throw Object.assign(new Error(`Only ${item.quantity} ${item.unit} available for ${item.item_name}`), { status: 409 });

      const ts = new Date().toISOString();
      db.prepare('UPDATE inventory SET quantity = quantity - ?, updated_at = ? WHERE id = ?').run(qty, ts, Number(inventoryId));
      db.prepare('INSERT INTO resource_assignments (request_id, inventory_id, quantity, assigned_at) VALUES (?, ?, ?, ?)').run(requestId, Number(inventoryId), qty, ts);

      if (req.status === 'pending') {
        db.prepare('UPDATE requests SET status = ?, updated_at = ? WHERE id = ?').run('assigned', ts, requestId);
      } else {
        db.prepare('UPDATE requests SET updated_at = ? WHERE id = ?').run(ts, requestId);
      }
      return getRequestById(requestId);
    })();

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}
