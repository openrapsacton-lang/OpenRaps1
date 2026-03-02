const { db } = require('../db');

const ALLOWED_SORT_FIELDS = {
  name: 'name',
  category: 'category',
  status: 'status',
  updated_at: 'updated_at'
};

function logEvent(itemId, action, details) {
  db.prepare(`
    INSERT INTO events (item_id, action, details_json)
    VALUES (?, ?, ?)
  `).run(itemId, action, JSON.stringify(details || {}));
}

function fetchItemById(id) {
  return db.prepare('SELECT * FROM items WHERE id = ?').get(id);
}

function listItems({ search, category, status, sort = 'updated_at', order = 'desc', lowStock = false }) {
  const where = [];
  const params = [];

  if (search) {
    where.push('LOWER(name) LIKE ?');
    params.push(`%${search.toLowerCase()}%`);
  }

  if (category) {
    where.push('category = ?');
    params.push(category);
  }

  if (status) {
    where.push('status = ?');
    params.push(status);
  }

  if (lowStock) {
    where.push('(quantity <= par_level OR status = "LOW")');
  }

  const sortColumn = ALLOWED_SORT_FIELDS[sort] || 'updated_at';
  const sortOrder = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const query = `
    SELECT * FROM items
    ${whereSql}
    ORDER BY ${sortColumn} ${sortOrder}
  `;

  return db.prepare(query).all(...params);
}

function createItem(payload) {
  const stmt = db.prepare(`
    INSERT INTO items (name, category, quantity, unit, status, par_level, notes)
    VALUES (@name, @category, @quantity, @unit, @status, @par_level, @notes)
  `);

  const result = stmt.run(payload);
  const item = fetchItemById(result.lastInsertRowid);
  logEvent(item.id, 'CREATE_ITEM', { new: item });
  return item;
}

function updateItem(id, payload) {
  const existing = fetchItemById(id);
  if (!existing) return null;

  const updated = {
    ...existing,
    ...payload,
    updated_at: new Date().toISOString()
  };

  db.prepare(`
    UPDATE items
    SET name = @name,
        category = @category,
        quantity = @quantity,
        unit = @unit,
        status = @status,
        par_level = @par_level,
        notes = @notes,
        updated_at = @updated_at
    WHERE id = @id
  `).run({ ...updated, id });

  const item = fetchItemById(id);
  logEvent(id, 'UPDATE_ITEM', { before: existing, after: item });
  return item;
}

function updateItemQuantity(id, { delta, quantity }) {
  const existing = fetchItemById(id);
  if (!existing) return null;

  const nextQuantity = typeof quantity === 'number' ? quantity : existing.quantity + delta;

  db.prepare(`
    UPDATE items
    SET quantity = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(nextQuantity, id);

  const item = fetchItemById(id);
  logEvent(id, 'UPDATE_QUANTITY', {
    before: existing.quantity,
    after: item.quantity,
    mode: typeof quantity === 'number' ? 'absolute' : 'delta',
    delta: typeof delta === 'number' ? delta : null
  });
  return item;
}

function updateItemStatus(id, status) {
  const existing = fetchItemById(id);
  if (!existing) return null;

  db.prepare(`
    UPDATE items
    SET status = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(status, id);

  const item = fetchItemById(id);
  logEvent(id, 'UPDATE_STATUS', { before: existing.status, after: status });
  return item;
}

function deleteItem(id) {
  const existing = fetchItemById(id);
  if (!existing) return null;

  const txn = db.transaction(() => {
    logEvent(id, 'DELETE_ITEM', { deleted: existing });
    db.prepare('DELETE FROM items WHERE id = ?').run(id);
  });

  txn();
  return existing;
}

function listItemEvents(itemId) {
  return db.prepare(`
    SELECT * FROM events
    WHERE item_id = ?
    ORDER BY datetime(created_at) DESC, id DESC
    LIMIT 100
  `).all(itemId);
}

module.exports = {
  listItems,
  fetchItemById,
  createItem,
  updateItem,
  updateItemQuantity,
  updateItemStatus,
  deleteItem,
  listItemEvents
};
