const express = require('express');
const { getDashboard, getVisitorsView, track, simulate } = require('../services/trafficService');

const router = express.Router();

// Aggregated dashboard (KPIs, series, tops, redacted recent feed).
router.get('/', async (req, res, next) => {
  try {
    res.json(await getDashboard());
  } catch (err) { next(err); }
});

// Explorer of identified visitors.
router.get('/visitors', async (req, res, next) => {
  try {
    res.json(await getVisitorsView());
  } catch (err) { next(err); }
});

// Browser beacon: receives the client fingerprint and records the visit.
// Returns a visitor cookie so later accesses can be joined to the visitor.
router.post('/track', async (req, res, next) => {
  try {
    const result = await track(req, req.body || {});
    res.cookie
      ? res.cookie(result.cookie, result.visitorId, { maxAge: 31536000000, sameSite: 'Lax', httpOnly: false })
      : res.setHeader('Set-Cookie', `${result.cookie}=${result.visitorId}; Max-Age=31536000; Path=/; SameSite=Lax`);
    res.json({ ok: true, visitorId: result.visitorId.slice(0, 8), country: result.country, classifiedAsBot: result.isBot });
  } catch (err) { next(err); }
});

// Generates synthetic traffic to DEMONSTRATE the dashboard with live data.
router.post('/simulate', async (req, res, next) => {
  try {
    const count = Math.min(Number(req.body?.count) || 40, 200);
    res.json(await simulate(count));
  } catch (err) { next(err); }
});

module.exports = router;
