const fs = require('fs');
const path = require('path');

function getDbPath() {
  const configuredPath = process.env.DB_PATH && process.env.DB_PATH.trim();

  if (configuredPath) {
    return path.resolve(configuredPath);
  }

  return path.join(__dirname, '..', '..', 'app-data', 'bar_inventory.sqlite');
}

function ensureDbDirectoryExists(dbPath) {
  const dbDir = path.dirname(dbPath);
  fs.mkdirSync(dbDir, { recursive: true });
}

module.exports = {
  getDbPath,
  ensureDbDirectoryExists
};
