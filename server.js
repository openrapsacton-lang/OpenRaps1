const path = require('path');
const express = require('express');
const morgan = require('morgan');
const { initDb } = require('./src/db');
const itemsRouter = require('./src/routes/items');

const app = express();
const PORT = process.env.PORT || 3000;

initDb();

app.use(morgan('dev'));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, message: 'Bar Inventory API is running.' });
});

app.use('/api/items', itemsRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || 'Unexpected server error.'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
