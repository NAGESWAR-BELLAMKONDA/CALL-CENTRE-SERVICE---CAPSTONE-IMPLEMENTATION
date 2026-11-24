# CALLCENTRE IQ — Call-Centre Service Performance Analysis Using t-Test for Difference of Means

**Subject:** Probability and Statistics  
**Course code for this implementation:** UBA0906  
**Project title:** Call-Centre Service Performance Analysis Using t-Test for Difference of Means

A full-stack capstone prototype with a premium glass-style analytics interface, a Node.js API, live demonstration events, CSV workflows, statistical comparison and optional CRM/telephony and PostgreSQL integrations.

## Main modules
1. **Executive Overview** — calls handled, average handling time, CSAT, agent count, metric comparison charts and group distribution.
2. **Data Explorer** — presentation sample records, validation, duplicate detection, filtering, CSV import/export and add-record workflow.
3. **Statistical Analysis Lab** — independent-samples t-test, Welch unequal-variance and Student pooled-variance choices, alpha selection, two-tailed p-value, degrees of freedom, confidence interval, effect size and calculation trace.
4. **Insights & Actions** — group scorecard, cautious evidence-based recommendations and audit trail.
5. **Live Operations** — backend URL configuration, health status, demo start/stop controls, connection status and SSE event feed.

## Run the full-stack demo
Requires Node.js 20+.

```bash
npm install
cp .env.example .env
npm start
```

Open `http://localhost:8080`. The backend serves the dashboard and API from the same origin. It starts a clearly labelled simulated event stream when no external API is configured.

## Backend endpoints
See [API_INTEGRATION.md](API_INTEGRATION.md) for all routes, CRM field mapping, push ingestion, PostgreSQL setup, deployment and data privacy notes. Key routes include `/api/health`, `/api/agents`, `/api/metrics`, `/api/stream`, `/api/demo/start`, and `/api/integrations/ingest`.

## Connect a real provider
Set `UPSTREAM_API_URL` and, if required, `UPSTREAM_API_KEY` in the backend host's environment settings. The adapter polls the approved endpoint and maps agent metric fields to the project schema. Never expose provider credentials in frontend code. The integration is configurable; a real provider has not been connected because no authorized CRM/telephony endpoint or credentials were supplied.

## Shared PostgreSQL
Set `DATABASE_URL` on the backend host to enable shared PostgreSQL persistence. The service creates agent and audit-event tables automatically. Without it, the prototype uses local JSON persistence; that is not a multi-instance shared database. Configure a managed PostgreSQL service and persistent storage for hosted use.

## Deployment
- **GitHub Pages:** static frontend preview; open Live Operations and configure the separately hosted Node backend URL.
- **Render or another Node host:** deploy from repository root with build command `npm install`, start command `npm start`, health path `/api/health`. Configure environment variables and PostgreSQL separately. Use HTTPS and restrict `APP_ORIGIN` to the deployed frontend origin.

The deployment workflow is under `.github/workflows/deploy.yml`. GitHub Actions validation checks the presentation CSV against the browser seed.

## Dataset provenance and discrepancy in supplied presentation
The 30 sample observations are transcribed from page 6 of the supplied TEAM 10 presentation. The fields are Agent_ID, Group, Calls_Handled, Talk_Time_min, Hold_Time_min, Handling_Time_min and CSAT_Score (15 records per group).

For Handling_Time_min, the page-6 rows recalculate to Group A mean **5.0667**, Group B mean **5.1067**, Welch t **−0.0798**, df **27.0794**, and two-sided p approximately **0.9370**. Page 10 instead reports means around 4.2 and 5.6, t around 3.45 and p = 0.002. These source figures do not reconcile. The app computes from the page-6 rows and does not hard-code page-10 results. Confirm the intended analysis dataset with the project guide before final submission. The page-6 table also does not contain an explicit training-status field, so Group A/B should not be labelled trained/untrained without confirmation.

## Important operating boundary
This is an end-to-end working **demonstration prototype** with backend APIs, persistence options and a provider adapter. Demo events are synthetic. Genuine production operation requires an approved provider endpoint, valid mapping, secrets, shared database, deployment configuration, user authentication/authorization and data-protection approval. Do not present simulated events as live customer data.
