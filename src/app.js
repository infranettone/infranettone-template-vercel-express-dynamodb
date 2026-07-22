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

// The frontend is served from this same app, so production needs no CORS. By
// default no CORS headers are sent (origin: false) instead of reflecting the
// caller's Origin; cross-origin callers must be listed explicitly in
// CORS_ORIGINS.
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : false, credentials: true }));
app.use(express.json({ limit: '1mb' }));

// Access auditing: record every request (server-side) except reads of the
// dashboard itself, so viewing metrics doesn't pollute them. The beacon track
// is recorded on its own route with the client fingerprint.
app.use((req, res, next) => {
  const p = req.path || '';
  if (!p.startsWith('/api/traffic') && req.method !== 'OPTIONS') record(req);
  next();
});

// Static frontend (the showcase). In production Vercel's CDN serves it; locally
// Express serves it.
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/items', itemsRouter);
app.use('/api/status', statusRouter);
app.use('/api/traffic', trafficRouter);

// Uniform error handler: services set err.status for 4xx.
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'internal error' });
});

module.exports = app;
