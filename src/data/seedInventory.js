const masterInventory = require('./masterInventory');

const seedInventory = masterInventory.map((item) => ({
  ...item,
  quantity: 1,
  status: 'FULL'
}));

module.exports = seedInventory;
