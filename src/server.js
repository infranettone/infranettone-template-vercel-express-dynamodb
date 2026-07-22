// Punto de entrada único.
//
// - En Vercel (@vercel/node) basta con exportar la app Express: la plataforma
//   la envuelve en una función serverless, no hay que hacer listen().
// - En local, si el archivo se ejecuta directamente, levanta el servidor HTTP.

const app = require('./app');

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  const HOST = process.env.HOST || '0.0.0.0';
  app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
  });
}

module.exports = app;
