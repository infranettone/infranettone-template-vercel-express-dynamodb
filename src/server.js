// Single entry point.
//
// - On Vercel (@vercel/node) exporting the Express app is enough: the platform
//   wraps it in a serverless function, no listen() needed.
// - Locally, if the file is run directly, it starts the HTTP server.

const app = require('./app');

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  const HOST = process.env.HOST || '0.0.0.0';
  app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
  });
}

module.exports = app;
