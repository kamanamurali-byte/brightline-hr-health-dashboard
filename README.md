# Brightline HR API Integration Health Diagnostic Engine

This project analyzes integration request logs and presents daily triage metrics in a React dashboard. The backend uses Microsoft SQL Server and T-SQL for persistence and seeding.

## Stack

- Backend: Node.js, Express, `mssql`
- Database: Microsoft SQL Server (SQL Server Express, Developer, or another supported edition)
- Frontend: React 18
- Analytics: `server/analyzer.js`

## Requirements

- Node.js 18+
- Microsoft SQL Server installed and running
- SQL Server Authentication enabled with a login and password, or configure a SQL login for the app

## 1. Create the database

In SQL Server Management Studio (SSMS), connect to your local SQL Server instance and run:

```sql
CREATE DATABASE brightline_hr;
GO
```

The application creates the `dbo.integration_logs` table and indexes when the seed script runs. To use the schema file directly in SSMS, open `server/schema.sql` and execute it with `brightline_hr` selected.

For SQL Server Express, the instance is commonly `localhost\SQLEXPRESS`. For a default instance, use `localhost`. The port is commonly `1433`; named instances may use dynamic ports.

## 2. Configure the backend connection

Copy `server/.env.example` to `server/.env` and set your SQL Server details. Example for the default instance:

```env
DB_SERVER=localhost
DB_PORT=1433
DB_NAME=brightline_hr
DB_USER=sa
DB_PASSWORD=YOUR_SQL_SERVER_PASSWORD
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true
PORT=5000
```

For SQL Server Express, use:

```env
DB_SERVER=localhost
DB_INSTANCE=SQLEXPRESS
DB_NAME=brightline_hr
DB_USER=sa
DB_PASSWORD=YOUR_SQL_SERVER_PASSWORD
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true
PORT=5000
```

If SQL Server Browser is unavailable, configure SQL Server Express to listen on a fixed TCP port, set `DB_PORT` to that port, and omit `DB_INSTANCE`. A dynamically assigned port can be used temporarily, but may change when SQL Server restarts.

Do not commit `server/.env`; it contains credentials. The app expects SQL Server Authentication. Ensure the `sa` login (or another configured SQL login) is enabled and has permission to create/insert/read in the selected database.

## 3. Install packages

Open PowerShell in the project directory:

```powershell
cd .\server
npm install
cd ..\client
npm install
```

## 4. Create the schema and seed the data

```powershell
cd .\server
npm run seed
```

This applies `server/schema.sql`, truncates existing log rows, then inserts the exact 60 synthetic requests in a transaction.

## 5. Start the API

In a terminal:

```powershell
cd .\server
npm start
```

The API listens on `http://localhost:5000`; health metrics are at `http://localhost:5000/api/health`. If SQL Server is unavailable, the endpoint responds using the bundled static seed data and retries the database connection on subsequent requests.

## 6. Start the dashboard

In a second terminal:

```powershell
cd .\client
npm start
```

Open `http://localhost:3000`.

## Validation and packaging

Run the backend analytics tests:

```powershell
cd .\server
npm test
```

Run the analytics smoke test:

```powershell
cd .\server
node -e "const { analyzeLogs } = require('./analyzer'); const { seedLogs } = require('./seed-data'); console.log(JSON.stringify(analyzeLogs(seedLogs), null, 2));"
```

Build the frontend:

```powershell
cd .\client
npm run build
```

Package `server/`, `client/`, `README.md`, and `SOLUTION_DESIGN.md` for submission. Do not include `node_modules`, generated build output unless requested, or `server/.env`.

## Health thresholds

- **CRITICAL:** failure rate >= 25% or >= 3 timeouts
- **WARNING:** failure rate >= 8%, >= 2 HTTP 429 responses, or p95 exceeds the service SLA
- **HEALTHY:** failure rate < 8% and p95 is within the service SLA

Timeouts, errors, and 429 responses all count as failures. Percentiles use linear interpolation.
