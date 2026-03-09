const fs = require('fs');
const { getDbPath } = require('../config/dbPath');

const dbPath = getDbPath();

if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log(`Inventory database reset: deleted ${dbPath}`);
} else {
  console.log(`Inventory database reset: no database found at ${dbPath}`);
}

console.log('Next step: run "npm run dev" to recreate and reseed the database.');
