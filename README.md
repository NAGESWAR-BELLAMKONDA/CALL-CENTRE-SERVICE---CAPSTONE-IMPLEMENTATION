# Call-Centre Service Performance Analysis Using t-Test for Difference of Means

**SIMATS Engineering | Probability & Statistics | Course code: UBA0906**

A professional browser-based analytics workspace aligned to the 14-page TEAM 10 capstone presentation.

## Implemented modules

1. **Executive Overview** — KPI cards and charts for calls handled, talk time, hold time, handling time, CSAT and group distribution.
2. **Data Explorer** — 30-row source dataset from presentation page 6, validation checks, search/group filters, CSV import/export, and add-record workflow.
3. **Statistical Analysis Lab** — independent-samples t-test for the selected metric, Welch unequal-variance and Student pooled-variance options, selectable alpha, two-tailed p-value, degrees of freedom, confidence interval, effect-size estimate and calculation trace.
4. **Insights & Actions** — group scorecard, evidence-aware operational recommendations and browser-session audit trail.

## Dataset provenance and presentation discrepancy

The included 30 observations are transcribed from the dataset table on **page 6** of the supplied TEAM 10 presentation. Fields: Agent_ID, Group, Calls_Handled, Talk_Time_min, Hold_Time_min, Handling_Time_min and CSAT_Score. There are 15 Group A and 15 Group B records. The exact CSV is in `data/call_centre_agents.csv`.

For Handling_Time_min, recalculation from page-6 records gives:
- Group A mean: **5.0667 minutes**
- Group B mean: **5.1067 minutes**
- Welch t: **−0.0798**
- Welch df: **27.0794**
- Two-sided p-value: **approximately 0.9370**

However, **page 10** reports approximate means of 4.2 and 5.6, t ≈ 3.45 and p = 0.002. These two result sets do not agree. The application intentionally uses the actual 30-row table on page 6 and calculates from the loaded records; it does not hard-code slide-10 results. Confirm the correct dataset/calculation with the project guide before final academic submission.

Page 10 also describes Group A as trained and Group B as untrained, but page 6 has no separate training-status column. Confirm that mapping before attributing group differences to training.

## Run and data persistence

Open `index.html` in a modern browser. Chart rendering uses Chart.js from jsDelivr, so an internet connection is required for charts. Data import, add-record, filtering and analysis run in the browser. Changes are saved in that browser's local storage; they are not synchronized across devices or users.

This is a deployable interactive analytics prototype, **not a live connection to a call-centre telephony/CRM feed**. Live production integration requires an approved API/database endpoint, credentials, authentication, privacy controls and an agreed refresh/streaming contract.

## Deployment

GitHub Actions runs `scripts/validate_dataset.py` before deploying the static app to GitHub Pages. The workflow validates the 30-row CSV against the embedded browser seed.

## Validation

```bash
python scripts/validate_dataset.py
```
