const assert = require('node:assert/strict');
const test = require('node:test');
const { analyzeLogs, calculatePercentile } = require('./analyzer');
const { seedLogs } = require('./seed-data');

test('calculates interpolated percentiles', () => {
  assert.equal(calculatePercentile([100, 200, 300], 50), 200);
  assert.equal(calculatePercentile([100, 200, 300], 95), 290);
  assert.equal(calculatePercentile([], 95), 0);
});

test('summarizes all 60 seed requests using the documented health thresholds', () => {
  const { summary, services } = analyzeLogs(seedLogs);

  assert.deepEqual(summary, {
    totalIntegrations: 5,
    criticalCount: 3,
    warningCount: 2,
    healthyCount: 0,
    totalRequests: 60,
  });
  assert.equal(services.find((service) => service.integration === 'Greenhouse ATS Sync').timeoutCount, 5);
  assert.equal(services.find((service) => service.integration === 'ADP Payroll Sync').failureRatePct, 41.67);
});

test('reports 429 throttles as pacing issues, not upstream errors', () => {
  const docusign = analyzeLogs(seedLogs).services.find(
    (service) => service.integration === 'DocuSign Envelope API',
  );

  assert.equal(docusign.rateLimitCount, 4);
  assert.equal(docusign.errorCount, 0);
  assert.match(docusign.rootCause, /4 429 throttles/);
  assert.doesNotMatch(docusign.rootCause, /upstream error/);
  assert.match(docusign.recommendation, /Reduce request concurrency/);
  assert.doesNotMatch(docusign.recommendation, /vendor escalation/);
});
