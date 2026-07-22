// CRUD de "registros" de demostración.
//
// Con DynamoDB habilitado, cada registro se guarda como:
//   pk = "ITEM"            (partición única: volumen bajo, consulta simple)
//   sk = "<isoDate>#<id>"  (orden cronológico natural al hacer Query)
//
// Sin credenciales, los registros viven en un array en memoria del proceso.
// En Vercel eso significa que sobreviven mientras viva la lambda: suficiente
// para la demo, y el panel de estado deja claro qué modo está activo.

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
    const err = new Error('text es obligatorio');
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
  // Recuperamos el sk buscando el id (100 items máximo: aceptable en demo).
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
