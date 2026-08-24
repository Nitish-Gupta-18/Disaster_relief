import db from '@/lib/db';

const statuses = new Set(['pending', 'completed', 'refunded']);
const paymentMethods = new Set(['upi', 'bank_transfer', 'card', 'cash']);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const clauses = [];
    const params = {};

    if (status) {
      if (!statuses.has(status)) return Response.json({ error: 'status must be one of: pending, completed, refunded' }, { status: 400 });
      clauses.push('status = @status');
      params.status = status;
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const donations = db.prepare(`SELECT * FROM financial_donations ${where} ORDER BY created_at DESC`).all(params);

    const totalAmount = donations.reduce((sum, d) => d.status === 'completed' ? sum + d.amount : sum, 0);
    const totalDonors = new Set(donations.filter(d => d.status === 'completed').map(d => d.donor_email || d.donor_phone || d.donor_name)).size;

    return Response.json({ totalAmount, totalDonors, donations });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}

export async function POST(request) {
  try {
    const { donor_name, donor_email, donor_phone, amount, currency, payment_method, transaction_id, purpose, status, notes } = await request.json();
    const amt = Number(amount);

    if (!donor_name) return Response.json({ error: 'donor_name is required' }, { status: 400 });
    if (!Number.isFinite(amt) || amt <= 0) return Response.json({ error: 'amount must be a positive number' }, { status: 400 });

    const donationStatus = status || 'pending';
    if (!statuses.has(donationStatus)) return Response.json({ error: 'status must be one of: pending, completed, refunded' }, { status: 400 });

    const ts = new Date().toISOString();
    const result = db.prepare('INSERT INTO financial_donations (donor_name, donor_email, donor_phone, amount, currency, payment_method, transaction_id, purpose, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      donor_name.trim(), donor_email?.trim() || null, donor_phone?.trim() || null,
      amt, (currency || 'INR').trim(), payment_method?.trim() || null,
      transaction_id?.trim() || null, purpose?.trim() || null,
      donationStatus, notes?.trim() || null, ts, ts
    );

    const created = db.prepare('SELECT * FROM financial_donations WHERE id = ?').get(result.lastInsertRowid);
    return Response.json(created, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}
