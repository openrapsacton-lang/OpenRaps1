const express = require('express');
const {
  listItems,
  fetchItemById,
  createItem,
  updateItem,
  updateItemQuantity,
  updateItemStatus,
  deleteItem,
  listItemEvents
} = require('../services/itemsService');
const { db } = require('../db');
const { VALID_STATUSES } = require('../utils/constants');
const { normalizeText, validateItemPayload } = require('../utils/validation');

const router = express.Router();

function nameExists(name, ignoreId = null) {
  const normalized = normalizeText(name).toLowerCase();
  if (!normalized) return false;

  const row = ignoreId
    ? db.prepare('SELECT id FROM items WHERE LOWER(name) = ? AND id != ?').get(normalized, ignoreId)
    : db.prepare('SELECT id FROM items WHERE LOWER(name) = ?').get(normalized);

  return Boolean(row);
}

router.get('/', (req, res) => {
  const items = listItems({
    search: req.query.search,
    category: req.query.category,
    status: req.query.status,
    sort: req.query.sort,
    order: req.query.order
  });
  res.json(items);
});

router.get('/:id', (req, res) => {
  const item = fetchItemById(req.params.id);
  if (!item) {
    return res.status(404).json({ error: 'Item not found.' });
  }
  res.json(item);
});

router.post('/', (req, res) => {
  const payload = {
    name: normalizeText(req.body.name),
    category: req.body.category,
    quantity: Number(req.body.quantity ?? 0),
    unit: normalizeText(req.body.unit || 'bottle'),
    status: req.body.status,
    par_level: Number(req.body.par_level ?? 0),
    wine_type: typeof req.body.wine_type === 'string' ? req.body.wine_type.trim() : '',
    notes: typeof req.body.notes === 'string' ? req.body.notes.trim() : ''
  };

  const errors = validateItemPayload(payload);
  if (errors.length) {
    return res.status(400).json({ error: 'Validation failed.', details: errors });
  }

  if (nameExists(payload.name)) {
    return res.status(409).json({ error: 'An item with this name already exists.' });
  }

  const item = createItem(payload);
  res.status(201).json(item);
});

router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid item id.' });
  }

  const payload = {
    name: normalizeText(req.body.name),
    category: req.body.category,
    quantity: Number(req.body.quantity ?? 0),
    unit: normalizeText(req.body.unit || 'bottle'),
    status: req.body.status,
    par_level: Number(req.body.par_level ?? 0),
    wine_type: typeof req.body.wine_type === 'string' ? req.body.wine_type.trim() : '',
    notes: typeof req.body.notes === 'string' ? req.body.notes.trim() : ''
  };

  const errors = validateItemPayload(payload);
  if (errors.length) {
    return res.status(400).json({ error: 'Validation failed.', details: errors });
  }

  if (nameExists(payload.name, id)) {
    return res.status(409).json({ error: 'An item with this name already exists.' });
  }

  const item = updateItem(id, payload);
  if (!item) {
    return res.status(404).json({ error: 'Item not found.' });
  }

  res.json(item);
});

router.patch('/:id/quantity', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid item id.' });
  }

  const hasDelta = Object.hasOwn(req.body, 'delta');
  const hasQuantity = Object.hasOwn(req.body, 'quantity');

  if (!hasDelta && !hasQuantity) {
    return res.status(400).json({ error: 'Provide either delta or quantity.' });
  }

  const item = fetchItemById(id);
  if (!item) {
    return res.status(404).json({ error: 'Item not found.' });
  }

  let nextQuantity;
  if (hasQuantity) {
    nextQuantity = Number(req.body.quantity);
  } else {
    const delta = Number(req.body.delta);
    if (!Number.isFinite(delta)) {
      return res.status(400).json({ error: 'delta must be a number.' });
    }
    nextQuantity = item.quantity + delta;
  }

  if (!Number.isFinite(nextQuantity) || nextQuantity < 0) {
    return res.status(400).json({ error: 'quantity cannot be less than 0.' });
  }

  const updated = updateItemQuantity(id, {
    delta: hasDelta ? Number(req.body.delta) : undefined,
    quantity: hasQuantity ? Number(req.body.quantity) : undefined
  });

  res.json(updated);
});

router.patch('/:id/status', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid item id.' });
  }

  const status = req.body.status;
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}.` });
  }

  const updated = updateItemStatus(id, status);
  if (!updated) {
    return res.status(404).json({ error: 'Item not found.' });
  }

  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid item id.' });
  }

  const deleted = deleteItem(id);
  if (!deleted) {
    return res.status(404).json({ error: 'Item not found.' });
  }

  res.status(204).send();
});

router.get('/:id/events', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid item id.' });
  }

  const item = fetchItemById(id);
  if (!item) {
    return res.status(404).json({ error: 'Item not found.' });
  }

  const events = listItemEvents(id);
  res.json(events);
});

module.exports = router;
