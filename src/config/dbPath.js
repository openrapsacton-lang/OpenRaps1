const fs = require('fs');
const path = require('path');

function getDbPath() {
  return process.env.DB_PATH || path.join(__dirname, '..', '..', 'app-data', 'bar_inventory.sqlite');
}

function ensureDbDirectoryExists(dbPath) {
  const dbDir = path.dirname(dbPath);
  fs.mkdirSync(dbDir, { recursive: true });
}

module.exports = {
  getDbPath,
  ensureDbDirectoryExists
};
