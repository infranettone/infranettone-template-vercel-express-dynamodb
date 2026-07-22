// Serverless entry point for Vercel (zero-config).
//
// Vercel detects api/index.js as a function and the vercel.json rewrite sends
// it everything that isn't a static file under public/ (filesystem first).
// Vercel's bridge preserves the original URL, so Express's /api/* routes work
// as-is. Locally, src/server.js is used.

module.exports = require('../src/app');
