// Inserts a few sample records into the table (or into memory if there are no
// credentials, in which case it only serves to verify the code).
//
//   node scripts/seed.js

require('dotenv').config();
const { createItem, listItems } = require('../src/services/itemsService');

const SAMPLES = [
  'First sample record (seed)',
  'The template writes to DynamoDB via PutCommand',
  'Delete these records from the showcase Demo tab',
];

(async () => {
  for (const text of SAMPLES) {
    const item = await createItem(text);
    console.log('created:', item.id, '-', item.text);
  }
  const items = await listItems();
  console.log(`\nTotal records now: ${items.length}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
