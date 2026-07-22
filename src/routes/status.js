const express = require('express');
const { getStatus } = require('../services/statusService');

const router = express.Router();

// Minimal health check for external monitors (fast, no AWS calls).
router.get('/health', (req, res) => res.json({ ok: true }));

// Full connection status for the showcase panel.
router.get('/', async (req, res, next) => {
  try {
    res.json(await getStatus());
  } catch (err) { next(err); }
});

module.exports = router;
