const SLA_BY_INTEGRATION = {
  'Slack Notifications': 300,
  'ADP Payroll Sync': 500,
  'DocuSign Envelope API': 1000,
  'Workday Directory Sync': 350,
  'Greenhouse ATS Sync': 1000,
};

const STATUS_PRIORITY = {
  CRITICAL: 0,
  WARNING: 1,
  HEALTHY: 2,
};

function calculatePercentile(values, percentile) {
  if (!values.length) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];

  const index = (percentile / 100) * (sorted.length - 1);
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);

  if (lowerIndex === upperIndex) {
    return sorted[lowerIndex];
  }

  const lowerValue = sorted[lowerIndex];
  const upperValue = sorted[upperIndex];
  const weight = index - lowerIndex;

  return lowerValue + (upperValue - lowerValue) * weight;
}

function analyzeLogs(rows = []) {
  const grouped = rows.reduce((acc, row) => {
    const integration = row.integration;
    if (!acc[integration]) {
      acc[integration] = [];
    }
    acc[integration].push(row);
    return acc;
  }, {});

  const services = Object.keys(grouped)
    .map((integration) => {
      const entries = grouped[integration];
      const totalRequests = entries.length;
      const latencyValues = entries.map((entry) => Number(entry.latency_ms || 0));
      const timeoutCount = entries.filter((entry) => entry.status === 'timeout').length;
      const rateLimitCount = entries.filter((entry) => entry.status_code === 429).length;
      const errorCount = entries.filter(
        (entry) => entry.status === 'error' && entry.status_code !== 429,
      ).length;
      const failureCount = entries.filter(
        (entry) => entry.status === 'error' || entry.status === 'timeout' || entry.status_code === 429,
      ).length;
      const failureRatePct = (failureCount / totalRequests) * 100;
      const p50 = calculatePercentile(latencyValues, 50);
      const p95 = calculatePercentile(latencyValues, 95);
      const p99 = calculatePercentile(latencyValues, 99);
      const avgLatencyMs = latencyValues.reduce((sum, value) => sum + value, 0) / totalRequests;
      const slaThreshold = SLA_BY_INTEGRATION[integration] ?? 1000;

      let status = 'HEALTHY';
      if (failureRatePct >= 25 || timeoutCount >= 3) {
        status = 'CRITICAL';
      } else if (failureRatePct >= 8 || rateLimitCount >= 2 || p95 > slaThreshold) {
        status = 'WARNING';
      }

      const reasons = [];
      if (timeoutCount > 0) {
        reasons.push(`${timeoutCount} socket timeout${timeoutCount > 1 ? 's' : ''}`);
      }
      if (rateLimitCount > 0) {
        reasons.push(`${rateLimitCount} 429 throttl${rateLimitCount > 1 ? 'es' : 'e'}`);
      }
      if (errorCount > 0) {
        reasons.push(`${errorCount} upstream ${errorCount > 1 ? 'errors' : 'error'}`);
      }
      if (p95 > slaThreshold) {
        reasons.push(`p95 latency ${p95.toFixed(0)}ms exceeds SLA ${slaThreshold}ms`);
      }
      if (reasons.length === 0) {
        reasons.push('No material reliability or latency anomalies detected in the rolling sample');
      }

      const recommendations = [];
      if (status === 'CRITICAL') {
        if (timeoutCount > 0) {
          recommendations.push('Immediately investigate socket timeouts, retry loops, and upstream connection pool saturation.');
        }
        if (errorCount > 0) {
          recommendations.push('Open a vendor escalation with the partner team and confirm whether a previously healthy API contract or outage is causing repeated 5xx responses.');
        }
        if (rateLimitCount > 0) {
          recommendations.push('Reduce request concurrency and enable adaptive backoff with jitter to avoid hitting the partner rate ceiling.');
        }
        recommendations.push('Apply a temporary circuit breaker or customer-facing alert to contain downstream damage while the incident is remediated.');
      } else if (status === 'WARNING') {
        recommendations.push('Increase monitoring sensitivity and validate recent configuration or deployment changes against the affected integration.');
        recommendations.push('Add a short retry window with exponential backoff and pacing controls to reduce transient failure rates.');
        if (p95 > slaThreshold) {
          recommendations.push('Review payload size, network path latency, and vendor throughput for the SLA breach before the next business peak.');
        }
      } else {
        recommendations.push('Continue routine monitoring and retain this integration in the daily health digest.');
        recommendations.push('Use the existing baseline to catch early drift before failure rate or latency crosses the warning threshold.');
      }

      return {
        integration,
        status,
        failureRatePct: Number(failureRatePct.toFixed(2)),
        p50: Math.round(p50),
        p95: Math.round(p95),
        p99: Math.round(p99),
        avgLatencyMs: Math.round(avgLatencyMs),
        timeoutCount,
        rateLimitCount,
        errorCount,
        totalRequests,
        rootCause: reasons.join('; '),
        recommendation: recommendations.join(' '),
      };
    })
    .sort((a, b) => {
      const statusDelta = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
      if (statusDelta !== 0) return statusDelta;
      return b.failureRatePct - a.failureRatePct;
    });

  const summary = {
    totalIntegrations: services.length,
    criticalCount: services.filter((service) => service.status === 'CRITICAL').length,
    warningCount: services.filter((service) => service.status === 'WARNING').length,
    healthyCount: services.filter((service) => service.status === 'HEALTHY').length,
    totalRequests: rows.length,
  };

  return {
    generatedAt: new Date().toISOString(),
    summary,
    services,
  };
}

module.exports = {
  calculatePercentile,
  analyzeLogs,
};
