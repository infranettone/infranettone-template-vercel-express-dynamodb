require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const itemsRouter = require('./routes/items');
const statusRouter = require('./routes/status');

const app = express();
app.set('trust proxy', true);

// El frontend se sirve desde esta misma app, así que producción no necesita
// CORS. Por defecto no se envían cabeceras CORS (origin: false) en lugar de
// reflejar el Origin del llamante; orígenes cruzados deben listarse
// explícitamente en CORS_ORIGINS.
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : false, credentials: true }));
app.use(express.json({ limit: '1mb' }));

// Frontend estático (el showcase).
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/items', itemsRouter);
app.use('/api/status', statusRouter);

// Manejador de errores uniforme: los servicios marcan err.status para 4xx.
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'error interno' });
});

module.exports = app;
