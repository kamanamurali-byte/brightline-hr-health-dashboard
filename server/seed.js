const fs = require('fs');
const path = require('path');
const { sql, getPool } = require('./db');
const { seedLogs } = require('./seed-data');

const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

async function seedDatabase() {
  let pool;
  try {
    pool = await getPool();
    await pool.request().batch(schemaSql);

    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      await new sql.Request(transaction).query('TRUNCATE TABLE dbo.integration_logs');
      for (const row of seedLogs) {
        const request = new sql.Request(transaction);
        request.input('integration', sql.NVarChar(255), row.integration);
        request.input('timestamp', sql.DateTime2(3), new Date(row.timestamp));
        request.input('status', sql.NVarChar(32), row.status);
        request.input('status_code', sql.Int, row.status_code);
        request.input('latency_ms', sql.Int, row.latency_ms);
        await request.query(
          'INSERT INTO dbo.integration_logs (integration, [timestamp], status, status_code, latency_ms) VALUES (@integration, @timestamp, @status, @status_code, @latency_ms)'
        );
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    console.log(`Seeded ${seedLogs.length} integration logs into SQL Server.`);
    await pool.close();
  } catch (error) {
    console.error('Failed to seed SQL Server database.', error);
    if (pool) await pool.close().catch(() => {});
    process.exitCode = 1;
  }
}

seedDatabase();
