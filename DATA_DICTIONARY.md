# Data Dictionary

| Field | Type | Description | Validation |
|---|---|---|---|
| Agent_ID | Integer | Pseudonymous agent record identifier | Unique, required |
| Group | Category | Group A or Group B | A or B |
| Calls_Handled | Integer | Number of calls handled in the observation period | Non-negative |
| Talk_Time_min | Decimal | Average talk time in minutes | Non-negative |
| Hold_Time_min | Decimal | Average hold time in minutes | Non-negative |
| Handling_Time_min | Decimal | Average handling time in minutes | Non-negative |
| CSAT_Score | Integer | Customer satisfaction score | 0 to 100 |

**Provenance:** Transcribed from page 6 of the supplied TEAM 10 capstone presentation. The records are project sample data, not verified live production records.
