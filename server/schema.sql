IF OBJECT_ID(N'dbo.integration_logs', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.integration_logs (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    integration NVARCHAR(255) NOT NULL,
    [timestamp] DATETIME2(3) NOT NULL,
    status NVARCHAR(32) NOT NULL,
    status_code INT NULL,
    latency_ms INT NOT NULL
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'idx_integration_logs_integration_timestamp'
    AND object_id = OBJECT_ID(N'dbo.integration_logs')
)
BEGIN
  CREATE INDEX idx_integration_logs_integration_timestamp
    ON dbo.integration_logs (integration, [timestamp] DESC);
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'idx_integration_logs_status'
    AND object_id = OBJECT_ID(N'dbo.integration_logs')
)
BEGIN
  CREATE INDEX idx_integration_logs_status
    ON dbo.integration_logs (status);
END;
