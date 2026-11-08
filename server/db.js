const sql = require('mssql');
require('dotenv').config();

const config = {
  server: process.env.DB_SERVER || 'localhost',
  ...(process.env.DB_INSTANCE ? {} : { port: Number(process.env.DB_PORT || 1433) }),
  database: process.env.DB_NAME || 'brightline_hr',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false',
    ...(process.env.DB_INSTANCE ? { instanceName: process.env.DB_INSTANCE } : {}),
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  connectionTimeout: 5000,
  requestTimeout: 15000,
};

let pool;
let connectionPromise;

async function query(statement) {
  const activePool = await getPool();
  return activePool.request().query(statement);
}

async function getPool() {
  if (pool && pool.connected) return pool;
  if (connectionPromise) return connectionPromise;

  pool = new sql.ConnectionPool(config);
  pool.on('error', (error) => {
    console.error('Unexpected SQL Server pool error:', error);
    pool = null;
    connectionPromise = null;
  });

  const activePool = pool;
  connectionPromise = activePool.connect()
    .then(() => activePool)
    .catch((error) => {
      if (pool === activePool) pool = null;
      throw error;
    })
    .finally(() => {
      connectionPromise = null;
    });

  return connectionPromise;
}

module.exports = { sql, getPool, query };
