const express = require('express');
const { getStatus } = require('../services/statusService');

const router = express.Router();

// Health check mínimo para monitores externos (rápido, sin tocar AWS).
router.get('/health', (req, res) => res.json({ ok: true }));

// Estado completo de conexiones para el panel del showcase.
router.get('/', async (req, res, next) => {
  try {
    res.json(await getStatus());
  } catch (err) { next(err); }
});

module.exports = router;
