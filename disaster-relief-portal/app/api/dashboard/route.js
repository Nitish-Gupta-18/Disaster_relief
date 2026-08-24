import db from '@/lib/db';

function ensureBuckets(rows, keys) {
  const counts = Object.fromEntries(keys.map((k) => [k, 0]));
  rows.forEach((r) => { counts[r.name] = r.value; });
  return Object.entries(counts).map(([name, value]) => ({ name, value }));
}

export async function GET() {
  try {
    const openRequests = db.prepare("SELECT COUNT(*) AS count FROM requests WHERE status != 'completed'").get().count;
    const availableVolunteers = db.prepare('SELECT COUNT(*) AS count FROM volunteers WHERE is_available = 1').get().count;
    const lowStockItems = db.prepare('SELECT COUNT(*) AS count FROM inventory WHERE quantity < 10').get().count;
    const completedToday = db.prepare("SELECT COUNT(*) AS count FROM requests WHERE status = 'completed' AND date(updated_at) = date('now')").get().count;

    const byStatus = ensureBuckets(
      db.prepare('SELECT status AS name, COUNT(*) AS value FROM requests GROUP BY status').all(),
      ['pending', 'assigned', 'in_progress', 'completed']
    );
    const byType = ensureBuckets(
      db.prepare('SELECT type AS name, COUNT(*) AS value FROM requests GROUP BY type').all(),
      ['food', 'water', 'medicine', 'shelter']
    );

    const recentRequests = db.prepare('SELECT id, location, type, urgency, status, created_at FROM requests ORDER BY datetime(created_at) DESC LIMIT 5').all();

    const avg = db.prepare("SELECT AVG((julianday(updated_at) - julianday(created_at)) * 24.0) AS hours FROM requests WHERE status = 'completed'").get();

    const areaImpact = db.prepare(`
      SELECT location AS area, COUNT(*) AS request_count, SUM(family_size) AS people_impacted,
             SUM(CASE WHEN status != 'completed' THEN 1 ELSE 0 END) AS open_count
      FROM requests GROUP BY location ORDER BY request_count DESC, people_impacted DESC LIMIT 8
    `).all();

    // Donation stats
    const totalDonations = db.prepare('SELECT COUNT(*) AS count FROM donations').get().count;
    const pendingDonations = db.prepare("SELECT COUNT(*) AS count FROM donations WHERE status = 'pending'").get().count;
    const receivedDonations = db.prepare("SELECT COUNT(*) AS count FROM donations WHERE status = 'received'").get().count;
    const totalFinancialAmount = db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM financial_donations WHERE status = 'completed'").get().total;
    const totalFinancialDonors = db.prepare("SELECT COUNT(DISTINCT COALESCE(donor_email, donor_phone, donor_name)) AS count FROM financial_donations WHERE status = 'completed'").get().count;
    const recentDonations = db.prepare('SELECT id, donor_name, item_name, category, quantity, unit, status, created_at FROM donations ORDER BY created_at DESC LIMIT 5').all();
    const recentFinancialDonations = db.prepare('SELECT id, donor_name, amount, currency, payment_method, purpose, status, created_at FROM financial_donations ORDER BY created_at DESC LIMIT 5').all();

    const donationsByCategory = db.prepare('SELECT category AS name, COUNT(*) AS value FROM donations GROUP BY category').all();

    return Response.json({
      kpis: { openRequests, availableVolunteers, lowStockItems, completedToday },
      byStatus,
      byType,
      recentRequests,
      averageResponseHours: avg.hours ? Number(avg.hours.toFixed(1)) : 0,
      areaImpact,
      donations: {
        totalDonations,
        pendingDonations,
        receivedDonations,
        totalFinancialAmount,
        totalFinancialDonors,
        recentDonations,
        recentFinancialDonations,
        donationsByCategory
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
