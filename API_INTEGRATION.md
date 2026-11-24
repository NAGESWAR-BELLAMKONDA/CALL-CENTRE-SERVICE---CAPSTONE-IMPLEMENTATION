# CALLCENTRE IQ — API and live integration guide

## Run locally
1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Run `npm start`.
5. Open `http://localhost:8080`; health is at `/api/health`.

The server starts in labelled demo mode if no upstream API URL is configured. It simulates agent updates every 3.5 seconds and broadcasts events over Server-Sent Events. These records are simulated, not real production telephony data.

## API routes

| Method | Route | Description |
|---|---|---|
| GET | `/api/health` | Service health, source mode and sync status |
| GET | `/api/config` | Safe configuration status; secrets are never returned |
| GET | `/api/agents` | Current agent dataset |
| GET | `/api/agents/:id` | One agent record |
| POST | `/api/agents` | Add one validated record |
| POST | `/api/agents/bulk` | Replace dataset with a validated JSON array |
| GET | `/api/metrics` | Descriptive group summaries |
| GET | `/api/events` | Recent event history |
| GET | `/api/stream` | Server-Sent Events stream |
| POST | `/api/demo/start` | Start simulated updates |
| POST | `/api/demo/stop` | Stop simulated updates |
| POST | `/api/integrations/ingest` | Secure external push ingestion |
| GET | `/api/report` | Machine-readable report snapshot |

## Real CRM / telephony API connection

Set backend environment variables:
- `UPSTREAM_API_URL`: approved HTTPS endpoint.
- `UPSTREAM_API_KEY`: optional bearer token for that provider.
- `UPSTREAM_POLL_MS`: polling interval (minimum 10 seconds).

The endpoint may return a JSON array or an object containing `data`, `agents`, or `records` arrays. Field aliases are mapped to the capstone schema: Agent_ID, Group, Calls_Handled, Talk_Time_min, Hold_Time_min, Handling_Time_min, CSAT_Score. The upstream API must be authorized by the data owner and map to these fields.

For a push integration, configure `INGEST_API_KEY` on the server and send `POST /api/integrations/ingest` with `X-Ingest-Key` and a JSON record (or `{ "data": [...] }`). Never put this key in browser JavaScript.

## Shared database

Set `DATABASE_URL` to a PostgreSQL connection string. The service creates `agent_records` and `audit_events` tables and loads/saves records there. The local JSON store remains a fallback/demo cache. On Render, create or connect a managed PostgreSQL database and add its internal connection string as `DATABASE_URL`; do not commit credentials. Without DATABASE_URL, the demo uses local JSON persistence, which is not shared between separate deployments or instances.

## Deploy

Deploy this repository as a Node web service using `npm install` and `npm start`, with health-check path `/api/health`. The static GitHub Pages deployment remains a frontend-only option; open Live Operations and paste the Node backend URL to connect it. Set `APP_ORIGIN` to the exact front-end origin for production rather than leaving wildcard CORS enabled.

## Data privacy and academic scope

Use pseudonymous agent IDs and approved, minimized metrics. Do not upload customer names, telephone numbers, recordings, payment information or other personal data into the college demo. The project compares independent groups using descriptive statistics and an independent-samples t-test in the browser. The demo stream is simulated and must be described as simulated during evaluation.
