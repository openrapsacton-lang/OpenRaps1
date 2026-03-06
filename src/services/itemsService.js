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

function calculateAutoStatus(currentStatus, quantity, parLevel) {
  if (currentStatus === 'DISCONTINUED') return 'DISCONTINUED';
  if (quantity === 0) return 'OUT';
  if (quantity <= parLevel) return 'LOW';
  return 'FULL';
}

function listItems({ search, category, status, sort = 'status', order = 'desc' }) {
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


  const sortColumn = ALLOWED_SORT_FIELDS[sort] || 'status';
  const sortOrder = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const statusRank = `CASE status
    WHEN 'OUT' THEN 1
    WHEN 'LOW' THEN 2
    WHEN 'ORDERED' THEN 3
    WHEN 'FULL' THEN 4
    WHEN 'DISCONTINUED' THEN 5
    ELSE 6
  END`;

  const isStatusSort = sortColumn === 'status';
  const primarySort = isStatusSort ? statusRank : sortColumn;
  const primaryOrder = isStatusSort && sortOrder === 'DESC' ? 'ASC' : sortOrder;

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const query = `
    SELECT * FROM items
    ${whereSql}
    ORDER BY ${primarySort} ${primaryOrder}, LOWER(name) ASC, id ASC
  `;

  return db.prepare(query).all(...params);
}

function createItem(payload) {
  const autoStatus = calculateAutoStatus(payload.status, payload.quantity, payload.par_level);
  const input = { ...payload, status: autoStatus };

  const stmt = db.prepare(`
    INSERT INTO items (name, category, quantity, unit, status, par_level, wine_type, notes)
    VALUES (@name, @category, @quantity, @unit, @status, @par_level, @wine_type, @notes)
  `);

  const result = stmt.run(input);
  const item = fetchItemById(result.lastInsertRowid);
  logEvent(item.id, 'CREATE_ITEM', { new: item });
  if (item.status !== payload.status) {
    logEvent(item.id, 'AUTO_STATUS_CHANGE', {
      reason: 'quantity_or_par_rule',
      before: payload.status,
      after: item.status
    });
  }
  return item;
}

function updateItem(id, payload) {
  const existing = fetchItemById(id);
  if (!existing) return null;

  const computedStatus = calculateAutoStatus(payload.status, payload.quantity, payload.par_level);
  const updated = {
    ...existing,
    ...payload,
    status: computedStatus,
    updated_at: datetimeNowIso()
  };

  db.prepare(`
    UPDATE items
    SET name = @name,
        category = @category,
        quantity = @quantity,
        unit = @unit,
        status = @status,
        par_level = @par_level,
        wine_type = @wine_type,
        notes = @notes,
        updated_at = @updated_at
    WHERE id = @id
  `).run({ ...updated, id });

  const item = fetchItemById(id);
  logEvent(id, 'UPDATE_ITEM', { before: existing, after: item });
  if (item.status !== existing.status && item.status !== payload.status) {
    logEvent(id, 'AUTO_STATUS_CHANGE', {
      reason: 'quantity_or_par_rule',
      before: payload.status,
      after: item.status
    });
  }
  return item;
}

function updateItemQuantity(id, { delta, quantity }) {
  const existing = fetchItemById(id);
  if (!existing) return null;

  const nextQuantity = typeof quantity === 'number' ? quantity : existing.quantity + delta;
  const nextStatus = calculateAutoStatus(existing.status, nextQuantity, existing.par_level);

  db.prepare(`
    UPDATE items
    SET quantity = ?,
        status = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(nextQuantity, nextStatus, id);

  const item = fetchItemById(id);
  logEvent(id, 'UPDATE_QUANTITY', {
    before: existing.quantity,
    after: item.quantity,
    mode: typeof quantity === 'number' ? 'absolute' : 'delta',
    delta: typeof delta === 'number' ? delta : null
  });

  if (existing.status !== item.status) {
    logEvent(id, 'AUTO_STATUS_CHANGE', {
      reason: 'quantity_or_par_rule',
      before: existing.status,
      after: item.status
    });
  }

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

function datetimeNowIso() {
  return new Date().toISOString();
}

module.exports = {
  listItems,
  fetchItemById,
  createItem,
  updateItem,
  updateItemQuantity,
  updateItemStatus,
  deleteItem,
  listItemEvents,
  calculateAutoStatus
};
