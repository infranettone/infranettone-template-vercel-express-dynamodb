// Shared DynamoDB client (single-table pattern).
//
// Everything lives in ONE table, keyed by pk/sk where the pk prefix
// discriminates the entity (ITEM, META…). Adding a new entity = add a prefix in
// KEYS plus a new service; the table does not change.
//
// If the AWS credentials are missing, isDynamoEnabled() returns false and the
// services fall back to in-memory storage: the template works with no AWS
// account (handy in dev and to test the deploy before creating the infra).

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

const TABLE_NAME = process.env.DYNAMODB_TABLE || 'vedtemplate-app';
const REGION = process.env.AWS_REGION || 'eu-west-1';

// Centralized key prefixes so the services can't drift apart.
const KEYS = {
  ITEM: 'ITEM',
  EVENT: 'EVENT',     // Access log: one item per access (with TTL).
  VISITOR: 'VISITOR', // Profile per visitor fingerprint.
};

let docClient = null;

function isDynamoEnabled() {
  return Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
}

// Lazily built: importing this module never throws without credentials.
function getDocClient() {
  if (!docClient) {
    const config = { region: REGION };
    // DYNAMODB_ENDPOINT lets tests point at DynamoDB Local.
    if (process.env.DYNAMODB_ENDPOINT) config.endpoint = process.env.DYNAMODB_ENDPOINT;
    const base = new DynamoDBClient(config);
    docClient = DynamoDBDocumentClient.from(base, {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return docClient;
}

module.exports = { getDocClient, isDynamoEnabled, TABLE_NAME, REGION, KEYS };
