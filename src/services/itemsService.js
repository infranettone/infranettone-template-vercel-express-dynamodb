// CRUD for demo "records".
//
// With DynamoDB enabled, each record is stored as:
//   pk = "ITEM"            (single partition: low volume, simple query)
//   sk = "<isoDate>#<id>"  (natural chronological order on Query)
//
// Without credentials, records live in an in-process memory array. On Vercel
// that means they survive as long as the lambda lives: enough for the demo, and
// the status panel makes clear which mode is active.

const crypto = require('crypto');
const { QueryCommand, PutCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { getDocClient, isDynamoEnabled, TABLE_NAME, KEYS } = require('../config/dynamo');

const memoryStore = [];
const MAX_TEXT = 500;

function makeItem(text) {
  const createdAt = new Date().toISOString();
  const id = crypto.randomUUID();
  return { id, text, createdAt };
}

async function listItems() {
  if (!isDynamoEnabled()) {
    return [...memoryStore].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const res = await getDocClient().send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': KEYS.ITEM },
    ScanIndexForward: false,
    Limit: 100,
  }));
  return (res.Items || []).map(({ id, text, createdAt }) => ({ id, text, createdAt }));
}

async function createItem(text) {
  if (typeof text !== 'string' || !text.trim()) {
    const err = new Error('text is required');
    err.status = 400;
    throw err;
  }
  const item = makeItem(text.trim().slice(0, MAX_TEXT));
  if (!isDynamoEnabled()) {
    memoryStore.push(item);
    return item;
  }
  await getDocClient().send(new PutCommand({
    TableName: TABLE_NAME,
    Item: { pk: KEYS.ITEM, sk: `${item.createdAt}#${item.id}`, ...item },
  }));
  return item;
}

async function deleteItem(id) {
  if (!isDynamoEnabled()) {
    const idx = memoryStore.findIndex((i) => i.id === id);
    if (idx === -1) return false;
    memoryStore.splice(idx, 1);
    return true;
  }
  // Recover the sk by looking up the id (100 items max: acceptable for the demo).
  const items = await getDocClient().send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': KEYS.ITEM },
    Limit: 100,
  }));
  const found = (items.Items || []).find((i) => i.id === id);
  if (!found) return false;
  await getDocClient().send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { pk: KEYS.ITEM, sk: found.sk },
  }));
  return true;
}

module.exports = { listItems, createItem, deleteItem };
