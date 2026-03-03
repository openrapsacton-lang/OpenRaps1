const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'data', 'bar_inventory.sqlite');
const db = new Database(dbPath);

db.pragma('foreign_keys = ON');

const starterItems = [
  { name: 'House Vodka', category: 'Vodka', quantity: 8, unit: 'bottle', status: 'FULL', par_level: 4, notes: 'Well vodka' },
  { name: 'House Tequila', category: 'Tequila', quantity: 6, unit: 'bottle', status: 'FULL', par_level: 4, notes: 'Blanco' },
  { name: 'House Rum', category: 'Rum', quantity: 5, unit: 'bottle', status: 'FULL', par_level: 4, notes: 'Light rum' },
  { name: 'House Whiskey', category: 'Whiskey', quantity: 4, unit: 'bottle', status: 'LOW', par_level: 5, notes: 'Blended' },
  { name: 'London Dry Gin', category: 'Gin', quantity: 7, unit: 'bottle', status: 'FULL', par_level: 4, notes: '' },
  { name: 'Triple Sec', category: 'Liqueur', quantity: 3, unit: 'bottle', status: 'LOW', par_level: 3, notes: 'Orange liqueur' },
  { name: 'Bourbon', category: 'Whiskey', quantity: 6, unit: 'bottle', status: 'FULL', par_level: 4, notes: 'For old fashioned' },
  { name: 'Dry Vermouth', category: 'Liqueur', quantity: 2, unit: 'bottle', status: 'ORDERED', par_level: 2, notes: '' }
];

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0 CHECK (quantity >= 0),
      unit TEXT NOT NULL DEFAULT 'bottle',
      status TEXT NOT NULL,
      par_level REAL NOT NULL DEFAULT 0 CHECK (par_level >= 0),
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_items_name_ci ON items (LOWER(name));

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      action TEXT NOT NULL,
      details_json TEXT NOT NULL,
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_events_item_id ON events (item_id);
    CREATE INDEX IF NOT EXISTS idx_items_updated_at ON items (updated_at);
  `);

  db.prepare(`
    UPDATE items
    SET status = 'ORDERED',
        updated_at = datetime('now')
    WHERE status = 'IN_TRANSIT'
  `).run();

  const count = db.prepare('SELECT COUNT(*) AS count FROM items').get().count;
  if (count === 0) {
    const insertItem = db.prepare(`
      INSERT INTO items (name, category, quantity, unit, status, par_level, notes)
      VALUES (@name, @category, @quantity, @unit, @status, @par_level, @notes)
    `);
    const insertEvent = db.prepare(`
      INSERT INTO events (item_id, action, details_json)
      VALUES (?, 'SEED', ?)
    `);

    const seedTxn = db.transaction((items) => {
      for (const item of items) {
        const result = insertItem.run(item);
        insertEvent.run(result.lastInsertRowid, JSON.stringify(item));
      }
    });

    seedTxn(starterItems);
  }
}

module.exports = {
  db,
  initDb
};
