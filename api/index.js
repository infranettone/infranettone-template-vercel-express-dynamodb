// Punto de entrada serverless para Vercel (zero-config).
//
// Vercel detecta api/index.js como función y el rewrite de vercel.json le
// manda todo lo que no exista como archivo estático en public/ (filesystem
// first). El bridge de Vercel conserva la URL original, así que las rutas
// /api/* de Express funcionan tal cual. En local se usa src/server.js.

module.exports = require('../src/app');
