const express = require('express');
const db = require('../db');

const router = express.Router();

function ensureBuckets(rows, keys) {
  const counts = Object.fromEntries(keys.map((key) => [key, 0]));
  rows.forEach((row) => {
    counts[row.name] = row.value;
  });
  return Object.entries(counts).map(([name, value]) => ({ name, value }));
}

router.get('/', (req, res, next) => {
  try {
    const openRequests = db.prepare("SELECT COUNT(*) AS count FROM requests WHERE status != 'completed'").get().count;
    const availableVolunteers = db.prepare('SELECT COUNT(*) AS count FROM volunteers WHERE is_available = 1').get().count;
    const lowStockItems = db.prepare('SELECT COUNT(*) AS count FROM inventory WHERE quantity < 10').get().count;
    const completedToday = db.prepare(`
      SELECT COUNT(*) AS count
      FROM requests
      WHERE status = 'completed' AND date(updated_at) = date('now')
    `).get().count;

    const byStatus = ensureBuckets(
      db.prepare('SELECT status AS name, COUNT(*) AS value FROM requests GROUP BY status').all(),
      ['pending', 'assigned', 'in_progress', 'completed']
    );
    const byType = ensureBuckets(
      db.prepare('SELECT type AS name, COUNT(*) AS value FROM requests GROUP BY type').all(),
      ['food', 'water', 'medicine', 'shelter']
    );

    const recentRequests = db.prepare(`
      SELECT id, location, type, urgency, status, created_at
      FROM requests
      ORDER BY datetime(created_at) DESC
      LIMIT 5
    `).all();

    const average = db.prepare(`
      SELECT AVG((julianday(updated_at) - julianday(created_at)) * 24.0) AS hours
      FROM requests
      WHERE status = 'completed'
    `).get();

    const areaImpact = db.prepare(`
      SELECT location AS area,
             COUNT(*) AS request_count,
             SUM(family_size) AS people_impacted,
             SUM(CASE WHEN status != 'completed' THEN 1 ELSE 0 END) AS open_count
      FROM requests
      GROUP BY location
      ORDER BY request_count DESC, people_impacted DESC
      LIMIT 8
    `).all();

    res.json({
      kpis: {
        openRequests,
        availableVolunteers,
        lowStockItems,
        completedToday
      },
      byStatus,
      byType,
      recentRequests,
      averageResponseHours: average.hours ? Number(average.hours.toFixed(1)) : 0,
      areaImpact
    });
  } catch (error) {
    next(error);
  }
});

router.get('/camps', (req, res, next) => {
  try {
    const rows = db.prepare('SELECT * FROM relief_camps ORDER BY created_at DESC').all();
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.post('/camps', (req, res, next) => {
  try {
    const { name, location_name, latitude, longitude, capacity = 0 } = req.body;
    const parsedCapacity = Number(capacity);

    if (!name || !location_name || !Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
      return res.status(400).json({ error: 'name, location_name, latitude and longitude are required' });
    }
    if (!Number.isInteger(parsedCapacity) || parsedCapacity < 0) {
      return res.status(400).json({ error: 'capacity must be a non-negative integer' });
    }

    const result = db.prepare(`
      INSERT INTO relief_camps (name, location_name, latitude, longitude, capacity, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name.trim(), location_name.trim(), Number(latitude), Number(longitude), parsedCapacity, new Date().toISOString());

    const created = db.prepare('SELECT * FROM relief_camps WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
