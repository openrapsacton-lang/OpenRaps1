const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'data', 'bar_inventory.sqlite');
const db = new Database(dbPath);

db.pragma('foreign_keys = ON');

const starterItems = [
  { name: 'Redemption Bourbon', category: 'Whiskey', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Bourbon' },
  { name: 'Michter\'s Bourbon', category: 'Whiskey', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Bourbon; Small Batch' },
  { name: 'Pendleton Bourbon', category: 'Whiskey', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Bourbon; 10 Year' },
  { name: 'Taffer\'s Brown Buttered Bourbon', category: 'Whiskey', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Flavored Bourbon' },
  { name: 'Tin Cup Bourbon Whiskey', category: 'Whiskey', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Bourbon Whiskey' },
  { name: 'Green River Kentucky Bourbon Whiskey', category: 'Whiskey', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Bourbon Whiskey; Kentucky' },
  { name: 'Rabbit Hole Kentucky Bourbon Whiskey', category: 'Whiskey', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Bourbon Whiskey; Kentucky' },
  { name: '2XO American Oak Bourbon Whiskey', category: 'Whiskey', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Bourbon Whiskey; American Oak' },
  { name: '2XO Kentucky Bourbon Whiskey', category: 'Whiskey', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Bourbon Whiskey; Kentucky; Phoenix Blend' },
  { name: 'Yellowstone Bourbon Whiskey', category: 'Whiskey', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Bourbon Whiskey' },
  { name: 'Jameson Irish Whiskey', category: 'Whiskey', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Irish Whiskey' },
  { name: 'Redbreast Irish Whiskey', category: 'Whiskey', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Irish Whiskey; 12 Year' },
  { name: 'Pendleton Whiskey', category: 'Whiskey', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Whiskey' },
  { name: 'Stranahan\'s Blue Peak Colorado Single Malt Whiskey', category: 'Whiskey', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Single Malt; Colorado' },
  { name: 'George Dickel Tennessee Sour Mash Whiskey', category: 'Whiskey', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Tennessee Whiskey; Sour Mash' },
  { name: 'Crown Royal Apple Whiskey', category: 'Whiskey', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Flavored Whiskey; Apple' },
  { name: 'Jameson Orange', category: 'Whiskey', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Flavored Whiskey; Orange' },
  { name: 'Demon Seed Whiskey', category: 'Whiskey', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Flavored Whiskey; scorpion pepper, ginger, maple syrup' },
  { name: 'Amador Whiskey', category: 'Whiskey', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Cabernet Sauvignon barrel' },
  { name: 'Woodinville Rye Whiskey', category: 'Whiskey', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Rye Whiskey' },
  { name: 'Templeton Rye Whiskey', category: 'Whiskey', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Rye Whiskey' },
  { name: 'Michter\'s Straight Rye Whiskey', category: 'Whiskey', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Rye Whiskey' },
  { name: 'Johnnie Walker Black Label', category: 'Whiskey', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Scotch; 12 Year' },
  { name: 'Johnnie Walker Red Label', category: 'Whiskey', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Scotch' },
  { name: 'The Glenlivet Single Malt', category: 'Whiskey', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Single Malt Scotch; 12 Year' },
  { name: 'Glenfiddich Single Malt', category: 'Whiskey', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Single Malt Scotch; 12 Year' },
  { name: 'The Dalmore Single Malt', category: 'Whiskey', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Single Malt Scotch; 12 Year' },
  { name: 'Compass Box The Peat Monster', category: 'Whiskey', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Scotch' },
  { name: 'Goslings', category: 'Rum', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Dark Rum' },
  { name: 'Trader Vic\'s Spiced Rum', category: 'Rum', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Spiced Rum' },
  { name: 'The Kraken', category: 'Rum', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Spiced Rum' },
  { name: 'Trader Vic\'s Rum', category: 'Rum', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Light Rum (verify expression)' },
  { name: 'Flor de Cana Extra Seco', category: 'Rum', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Light Rum' },
  { name: 'Flor de Cana Gran Reserva', category: 'Rum', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Light Rum' },
  { name: 'Rum Sons Coffee Flavored Rum', category: 'Rum', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Flavored Rum; Coffee' },
  { name: 'El Mayor', category: 'Tequila', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Blanco; almost empty (verify)' },
  { name: 'Cabrito', category: 'Tequila', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Blanco' },
  { name: 'Tromba', category: 'Tequila', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Blanco' },
  { name: 'Rosaluna', category: 'Tequila', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Blanco' },
  { name: '1800 Coconut', category: 'Tequila', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Flavored Tequila; Coconut' },
  { name: 'House Infused Jalapeno Tequila', category: 'Tequila', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Flavored Tequila; House-infused' },
  { name: 'Don Julio Reposado', category: 'Tequila', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Reposado' },
  { name: 'Don Julio Anejo', category: 'Tequila', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Anejo (verify expression)' },
  { name: 'Tres Agaves Anejo', category: 'Tequila', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Anejo (verify expression)' },
  { name: 'Chamucos Anejo', category: 'Tequila', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Anejo (verify expression)' },
  { name: 'Cincoro Anejo', category: 'Tequila', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Anejo (verify expression)' },
  { name: 'Prairie Vodka', category: 'Vodka', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: '' },
  { name: 'Velo Vodka', category: 'Vodka', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Verify exact product name' },
  { name: 'Barr Hill', category: 'Vodka', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Vermont; verify (often gin brand)' },
  { name: 'Cold River Vodka', category: 'Vodka', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: '' },
  { name: 'Spring 44 Vodka', category: 'Vodka', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: '' },
  { name: 'Belvedere Vodka', category: 'Vodka', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: '' },
  { name: 'Ketel One Vodka', category: 'Vodka', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: '' },
  { name: 'House Infused Vanilla Vodka', category: 'Vodka', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Flavored Vodka; House-infused' },
  { name: 'Pearl Lemon Vodka', category: 'Vodka', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Flavored Vodka; Lemon' },
  { name: 'Prairie Cucumber Vodka', category: 'Vodka', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Flavored Vodka; Cucumber' },
  { name: 'Hanson Habanero Vodka', category: 'Vodka', quantity: 1, unit: 'bottle', status: 'FULL', par_level: 0.9, notes: 'Flavored Vodka; Habanero (verify expression)' }
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
