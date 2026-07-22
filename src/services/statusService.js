// Live status of all the template's connections.
//
// Feeds the "Connections" tab of the showcase: which environment variables are
// present, whether DynamoDB responds and with what latency, where the process
// runs (Vercel or local) and which storage mode the app is in.

const { DescribeTableCommand, DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { isDynamoEnabled, TABLE_NAME, REGION } = require('../config/dynamo');

async function checkDynamo() {
  if (!isDynamoEnabled()) {
    return { enabled: false, reachable: false, detail: 'No AWS credentials: memory mode' };
  }
  const config = { region: REGION };
  if (process.env.DYNAMODB_ENDPOINT) config.endpoint = process.env.DYNAMODB_ENDPOINT;
  const client = new DynamoDBClient(config);
  const t0 = Date.now();
  try {
    const res = await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
    return {
      enabled: true,
      reachable: true,
      latencyMs: Date.now() - t0,
      tableStatus: res.Table.TableStatus,
      itemCount: res.Table.ItemCount,
      billingMode: res.Table.BillingModeSummary?.BillingMode || 'PROVISIONED',
      detail: `Table "${TABLE_NAME}" in ${REGION}`,
    };
  } catch (err) {
    return { enabled: true, reachable: false, latencyMs: Date.now() - t0, detail: err.name + ': ' + err.message };
  } finally {
    client.destroy();
  }
}

async function getStatus() {
  const dynamo = await checkDynamo();
  return {
    timestamp: new Date().toISOString(),
    runtime: {
      node: process.version,
      platform: process.env.VERCEL ? 'Vercel (serverless)' : 'Local / other',
      region: process.env.VERCEL_REGION || null,
      uptimeSeconds: Math.round(process.uptime()),
    },
    env: {
      AWS_REGION: Boolean(process.env.AWS_REGION),
      DYNAMODB_TABLE: Boolean(process.env.DYNAMODB_TABLE),
      AWS_ACCESS_KEY_ID: Boolean(process.env.AWS_ACCESS_KEY_ID),
      AWS_SECRET_ACCESS_KEY: Boolean(process.env.AWS_SECRET_ACCESS_KEY),
      CORS_ORIGINS: Boolean(process.env.CORS_ORIGINS),
    },
    storage: { mode: isDynamoEnabled() ? 'dynamodb' : 'memory', table: TABLE_NAME, region: REGION },
    dynamo,
  };
}

module.exports = { getStatus };
