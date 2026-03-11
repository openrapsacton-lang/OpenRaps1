const Database = require('better-sqlite3');
const seedInventory = require('./data/seedInventory');
const { getDbPath, ensureDbDirectoryExists } = require('./config/dbPath');

const dbPath = getDbPath();
ensureDbDirectoryExists(dbPath);

const db = new Database(dbPath);

db.pragma('foreign_keys = ON');

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
      wine_type TEXT DEFAULT '',
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

  const itemColumns = db.prepare('PRAGMA table_info(items)').all();
  const hasWineType = itemColumns.some((column) => column.name === 'wine_type');
  if (!hasWineType) {
    db.exec("ALTER TABLE items ADD COLUMN wine_type TEXT DEFAULT ''");
  }

  db.prepare(`
    UPDATE items
    SET status = 'ORDERED',
        updated_at = datetime('now')
    WHERE status = 'IN_TRANSIT'
  `).run();

  db.prepare(`
    UPDATE items
    SET wine_type = CASE
      WHEN LOWER(notes) LIKE '%sparkling%' OR LOWER(notes) LIKE '%prosecco%' OR LOWER(notes) LIKE '%champagne%' OR LOWER(notes) LIKE '%cava%' THEN 'Sparkling'
      WHEN LOWER(notes) LIKE '%rosé%' OR LOWER(notes) LIKE '%rose%' THEN 'Rose'
      WHEN LOWER(notes) LIKE '%red%' THEN 'Red'
      WHEN LOWER(notes) LIKE '%white%' THEN 'White'
      ELSE wine_type
    END
    WHERE category = 'Wine' AND (wine_type IS NULL OR TRIM(wine_type) = '')
  `).run();

  const count = db.prepare('SELECT COUNT(*) AS count FROM items').get().count;
  if (count === 0) {
    const insertItem = db.prepare(`
      INSERT INTO items (name, category, quantity, unit, status, par_level, wine_type, notes)
      VALUES (@name, @category, @quantity, @unit, @status, @par_level, @wine_type, @notes)
    `);
    const insertEvent = db.prepare(`
      INSERT INTO events (item_id, action, details_json)
      VALUES (?, 'SEED', ?)
    `);

    const seedTxn = db.transaction((items) => {
      for (const item of items) {
        const result = insertItem.run({ wine_type: '', ...item });
        insertEvent.run(result.lastInsertRowid, JSON.stringify(item));
      }
    });

    seedTxn(seedInventory);
  }
}

module.exports = {
  db,
  initDb
};
