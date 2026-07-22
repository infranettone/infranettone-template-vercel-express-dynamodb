require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const itemsRouter = require('./routes/items');
const statusRouter = require('./routes/status');
const trafficRouter = require('./routes/traffic');
const { record } = require('./services/trafficService');

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

// Auditoría de accesos: registra cada request (server-side) salvo las lecturas
// del propio dashboard, para no contaminar las métricas al mirarlas. El track
// del beacon se registra en su propia ruta con el fingerprint del cliente.
app.use((req, res, next) => {
  const p = req.path || '';
  if (!p.startsWith('/api/traffic') && req.method !== 'OPTIONS') record(req);
  next();
});

// Frontend estático (el showcase). En producción lo sirve el CDN de Vercel;
// en local lo sirve Express.
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/items', itemsRouter);
app.use('/api/status', statusRouter);
app.use('/api/traffic', trafficRouter);

// Manejador de errores uniforme: los servicios marcan err.status para 4xx.
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'error interno' });
});

module.exports = app;
