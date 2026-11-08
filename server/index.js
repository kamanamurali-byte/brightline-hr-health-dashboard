const express = require('express');
const cors = require('cors');
const { query } = require('./db');
const { analyzeLogs } = require('./analyzer');
const { seedLogs } = require('./seed-data');

const app = express();
const PORT = Number(process.env.PORT || 5000);

app.use(cors());
app.use(express.json());

function buildFallbackResponse() {
  const payload = analyzeLogs(seedLogs);
  return {
    source: 'fallback',
    ...payload,
  };
}

app.get('/api/health', async (req, res) => {
  try {
    const result = await query(
      'SELECT integration, [timestamp], status, status_code, latency_ms FROM dbo.integration_logs ORDER BY integration, [timestamp] ASC'
    );

    if (!result.recordset.length) {
      const fallback = buildFallbackResponse();
      return res.json(fallback);
    }

    const payload = analyzeLogs(result.recordset);
    return res.json({
      source: 'database',
      ...payload,
    });
  } catch (error) {
    console.error('SQL Server query failed; falling back to static seed data.', error);
    return res.json(buildFallbackResponse());
  }
});

app.get('/', (req, res) => {
  res.json({
    name: 'Brightline HR Integration Health Diagnostic Engine',
    status: 'online',
  });
});

app.listen(PORT, () => {
  console.log(`Brightline HR health engine listening on port ${PORT}`);
});
