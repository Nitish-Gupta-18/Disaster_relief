import db from '@/lib/db';

const statuses = new Set(['pending', 'completed', 'refunded']);

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const donation = db.prepare('SELECT * FROM financial_donations WHERE id = ?').get(Number(id));
    if (!donation) return Response.json({ error: 'Financial donation not found' }, { status: 404 });
    return Response.json(donation);
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const existing = db.prepare('SELECT * FROM financial_donations WHERE id = ?').get(Number(id));
    if (!existing) return Response.json({ error: 'Financial donation not found' }, { status: 404 });

    const body = await request.json();
    const updates = {
      donor_name: body.donor_name ?? existing.donor_name,
      donor_email: body.donor_email !== undefined ? body.donor_email : existing.donor_email,
      donor_phone: body.donor_phone !== undefined ? body.donor_phone : existing.donor_phone,
      amount: body.amount !== undefined ? Number(body.amount) : existing.amount,
      currency: body.currency ?? existing.currency,
      payment_method: body.payment_method !== undefined ? body.payment_method : existing.payment_method,
      transaction_id: body.transaction_id !== undefined ? body.transaction_id : existing.transaction_id,
      purpose: body.purpose !== undefined ? body.purpose : existing.purpose,
      status: body.status ?? existing.status,
      notes: body.notes !== undefined ? body.notes : existing.notes,
      updated_at: new Date().toISOString()
    };

    if (!Number.isFinite(updates.amount) || updates.amount <= 0) {
      return Response.json({ error: 'amount must be a positive number' }, { status: 400 });
    }
    if (!statuses.has(updates.status)) {
      return Response.json({ error: 'status must be one of: pending, completed, refunded' }, { status: 400 });
    }

    db.prepare(`
      UPDATE financial_donations
      SET donor_name = @donor_name, donor_email = @donor_email, donor_phone = @donor_phone,
          amount = @amount, currency = @currency, payment_method = @payment_method,
          transaction_id = @transaction_id, purpose = @purpose, status = @status, notes = @notes, updated_at = @updated_at
      WHERE id = @id
    `).run({ ...updates, id: Number(id) });

    const updated = db.prepare('SELECT * FROM financial_donations WHERE id = ?').get(Number(id));
    return Response.json(updated);
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const result = db.prepare('DELETE FROM financial_donations WHERE id = ?').run(Number(id));
    if (result.changes === 0) return Response.json({ error: 'Financial donation not found' }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}
