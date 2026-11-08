# Solution Design: Brightline HR Integration Health Diagnostic Engine

## Problem restatement

Brightline HR’s ops team is currently reactive: customer support tickets are often filed only after a vendor integration has been failing for hours or days. The core challenge is not just collecting logs, but turning noisy raw telemetry into a daily triage signal that ops teams can understand without pausing their workflow. The business requires a simple but defensible classification model that distinguishes healthy integrations from degraded ones and recommends a next action based on failure rate, latency, and failure type.

## Failure classification taxonomy

To make the diagnostic engine operationally useful, the design first classifies failures by cause rather than only by HTTP outcome. Socket timeouts are treated as critical because they often indicate a stuck dependency or exhausted upstream connection pool; they are not soft failures. Upstream 5xx responses are recorded as vendor-side incidents and are weighted as material reliability drops. Throttling responses (429s) are treated as a pacing problem on the Brightline side, which is meaningful because it signals that Brightline may be overloading a third-party API contract. The final decision matrix uses a combination of total failure rate, timeout count, and p95 latency. This keeps the engine honest: a vendor can be unhealthy even when its latency remains low if the error rate crosses the threshold.

## Analysis of the 60 seed logs

The seed dataset contains exactly 60 synthetic requests across five integrations with a balanced pattern of success, timeout, 5xx, and 429 events. Greenhouse ATS Sync has 5 socket timeouts and 1 error, which yields a 50% failure rate and makes it the most critical integration. ADP Payroll Sync has 5 500s and a 41.7% failure rate, which is severe enough to require an urgent escalation even though its median latency is modest. DocuSign Envelope API has 4 429 throttles and a 33.3% failure rate, which indicates a pacing problem rather than a complete outage. Slack Notifications and Workday Directory Sync both sit at 8.33% failure rate and become warnings under the chosen thresholds, which is appropriate because they are elevated but still below the critical cutoff.

The latency logic uses linear interpolation across the full latency distribution for p50, p95, and p99, which prevents a few 30-second timeout values from hiding the true operational behavior of the rest of the sample. This is especially important for Greenhouse, where the timeout outliers would otherwise dominate the perception of “normal” latency. Putting the percentiles on the full data distribution makes the dashboard more trustworthy for operations work.

## Design trade-offs and assumptions

The model uses a simple daily-sample window from a synthetic hour of logs. In production, this would likely evolve into a rolling or sliding-window calculation with a tighter focus on recent request volumes. The decision thresholds are intentionally conservative: 8% failure rate is a reliable warning threshold for an operations dashboard, while 25% is a strong critical threshold. The p95 SLA checks ensure that latency can trigger a warning even when failure rate remains seemingly low. We weight 429s as failure events because they are operationally costly and signal backpressure that can quickly become an incident.

## Future production roadmap

The next step is to move from the static seed dataset to a real streaming architecture: ingest logs into SQL Server or a warehouse, compute a rolling window of the last 24 hours, and expose the health engine through an API polled by an ops dashboard. A second phase would add automated circuit breakers, exponential-backoff policies, and auto-remediation for vendors that are repeatedly rate-limited. Finally, we would integrate PagerDuty or Slack webhooks so that a warning escalates to the right team without requiring manual triage. This preserves the day-one value of the dashboard while making it easier to scale into a mature incident-response system.
