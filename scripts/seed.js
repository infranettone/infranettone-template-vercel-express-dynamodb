// Inserta unos registros de ejemplo en la tabla (o en memoria si no hay
// credenciales, en cuyo caso solo sirve para verificar el código).
//
//   node scripts/seed.js

require('dotenv').config();
const { createItem, listItems } = require('../src/services/itemsService');

const SAMPLES = [
  'Primer registro de ejemplo (seed)',
  'La plantilla escribe en DynamoDB vía PutCommand',
  'Borra estos registros desde la pestaña Demo del showcase',
];

(async () => {
  for (const text of SAMPLES) {
    const item = await createItem(text);
    console.log('creado:', item.id, '-', item.text);
  }
  const items = await listItems();
  console.log(`\nTotal registros ahora: ${items.length}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
