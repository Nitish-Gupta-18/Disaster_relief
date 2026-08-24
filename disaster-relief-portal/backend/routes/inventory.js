const express = require('express');
const db = require('../db');

const router = express.Router();

const categories = new Set(['food', 'medicine', 'equipment', 'shelter', 'clothing', 'other']);

function validateCategory(category) {
  if (!categories.has(category)) {
    const error = new Error('category must be one of: food, medicine, equipment, shelter, clothing, other');
    error.status = 400;
    throw error;
  }
}

router.get('/', (req, res, next) => {
  try {
    const { category } = req.query;
    const clauses = [];
    const params = {};

    if (category) {
      validateCategory(category);
      clauses.push('category = @category');
      params.category = category;
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = db.prepare(`
      SELECT *
      FROM inventory
      ${where}
      ORDER BY category ASC, item_name ASC
    `).all(params);

    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.post('/', (req, res, next) => {
  try {
    const { item_name, category, quantity, unit, location_name, latitude, longitude } = req.body;
    const parsedQuantity = Number(quantity);

    if (!item_name || !unit || !location_name || !Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
      return res.status(400).json({ error: 'item_name, unit, location_name, latitude and longitude are required' });
    }
    validateCategory(category);
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 0) {
      return res.status(400).json({ error: 'quantity must be a non-negative integer' });
    }

    const timestamp = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO inventory (item_name, category, quantity, unit, location_name, latitude, longitude, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      item_name.trim(),
      category,
      parsedQuantity,
      unit.trim(),
      location_name.trim(),
      Number(latitude),
      Number(longitude),
      timestamp
    );

    const created = db.prepare('SELECT * FROM inventory WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM inventory WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    const updates = {
      item_name: req.body.item_name ?? existing.item_name,
      category: req.body.category ?? existing.category,
      quantity: req.body.quantity !== undefined ? Number(req.body.quantity) : existing.quantity,
      unit: req.body.unit ?? existing.unit,
      location_name: req.body.location_name ?? existing.location_name,
      latitude: req.body.latitude !== undefined ? Number(req.body.latitude) : existing.latitude,
      longitude: req.body.longitude !== undefined ? Number(req.body.longitude) : existing.longitude,
      updated_at: new Date().toISOString()
    };

    validateCategory(updates.category);
    if (!Number.isInteger(updates.quantity) || updates.quantity < 0) {
      return res.status(400).json({ error: 'quantity must be a non-negative integer' });
    }
    if (!Number.isFinite(updates.latitude) || !Number.isFinite(updates.longitude)) {
      return res.status(400).json({ error: 'latitude and longitude must be valid numbers' });
    }

    db.prepare(`
      UPDATE inventory
      SET item_name = @item_name,
          category = @category,
          quantity = @quantity,
          unit = @unit,
          location_name = @location_name,
          latitude = @latitude,
          longitude = @longitude,
          updated_at = @updated_at
      WHERE id = @id
    `).run({ ...updates, id });

    const updated = db.prepare('SELECT * FROM inventory WHERE id = ?').get(id);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', (req, res, next) => {
  try {
    const result = db.prepare('DELETE FROM inventory WHERE id = ?').run(Number(req.params.id));
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
