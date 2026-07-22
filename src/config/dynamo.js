// Cliente compartido de DynamoDB (patrón single-table).
//
// Todo vive en UNA tabla, con claves pk/sk donde el prefijo de pk discrimina
// la entidad (ITEM, META…). Añadir una entidad nueva = añadir un prefijo en
// KEYS y un servicio nuevo; la tabla no cambia.
//
// Si faltan las credenciales AWS, isDynamoEnabled() devuelve false y los
// servicios caen a un almacenamiento en memoria: la plantilla funciona sin
// cuenta AWS (útil en dev y para probar el deploy antes de crear la infra).

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

const TABLE_NAME = process.env.DYNAMODB_TABLE || 'vedtemplate-app';
const REGION = process.env.AWS_REGION || 'eu-west-1';

// Prefijos de clave centralizados para que los servicios no diverjan.
const KEYS = {
  ITEM: 'ITEM',
};

let docClient = null;

function isDynamoEnabled() {
  return Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
}

// Construcción perezosa: importar este módulo nunca lanza sin credenciales.
function getDocClient() {
  if (!docClient) {
    const config = { region: REGION };
    // DYNAMODB_ENDPOINT permite apuntar a DynamoDB Local en tests.
    if (process.env.DYNAMODB_ENDPOINT) config.endpoint = process.env.DYNAMODB_ENDPOINT;
    const base = new DynamoDBClient(config);
    docClient = DynamoDBDocumentClient.from(base, {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return docClient;
}

module.exports = { getDocClient, isDynamoEnabled, TABLE_NAME, REGION, KEYS };
