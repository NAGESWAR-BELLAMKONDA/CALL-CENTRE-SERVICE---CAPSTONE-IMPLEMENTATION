#!/usr/bin/env python3
"""CI validation for the presentation's 30-row call-centre dataset."""
import csv, json, math, re, statistics
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
CSV_PATH = ROOT / "data" / "call_centre_agents.csv"
match = re.search(r"const SEED=(\[[\s\S]*?\]);\s*const KEYS", HTML)
if not match:
    raise SystemExit("FAIL: embedded SEED dataset not found in index.html")
embedded = json.loads(match.group(1))
with CSV_PATH.open(newline="", encoding="utf-8-sig") as f:
    imported = list(csv.DictReader(f))
required = ["Agent_ID","Group","Calls_Handled","Talk_Time_min","Hold_Time_min","Handling_Time_min","CSAT_Score"]
if len(embedded) != 30 or len(imported) != 30:
    raise SystemExit(f"FAIL: expected 30 records; embedded={len(embedded)}, CSV={len(imported)}")
if len({int(r["Agent_ID"]) for r in imported}) != 30:
    raise SystemExit("FAIL: duplicate Agent_ID values found")
if not all(r["Group"] in ("A","B") for r in imported):
    raise SystemExit("FAIL: Group must be A or B")
if set(imported[0].keys()) != set(required):
    raise SystemExit("FAIL: CSV headers do not match required schema")
for row in imported:
    for key in required:
        if key != "Group" and not math.isfinite(float(row[key])):
            raise SystemExit(f"FAIL: invalid numeric value in {key}")
    if not 0 <= float(row["CSAT_Score"]) <= 100:
        raise SystemExit("FAIL: CSAT_Score outside 0..100")
for a,b in zip(embedded, imported):
    for key in required:
        left = str(a[key])
        right = str(b[key])
        if key in ("Agent_ID","Calls_Handled","CSAT_Score"):
            if int(float(left)) != int(float(right)):
                raise SystemExit(f"FAIL: embedded and CSV differ at Agent_ID {a['Agent_ID']} field {key}")
        elif key == "Group":
            if left != right: raise SystemExit(f"FAIL: embedded and CSV group mismatch at Agent_ID {a['Agent_ID']}")
        elif not math.isclose(float(left), float(right), abs_tol=1e-9):
            raise SystemExit(f"FAIL: embedded and CSV differ at Agent_ID {a['Agent_ID']} field {key}")
a = [float(r["Handling_Time_min"]) for r in imported if r["Group"] == "A"]
b = [float(r["Handling_Time_min"]) for r in imported if r["Group"] == "B"]
if len(a) != 15 or len(b) != 15:
    raise SystemExit(f"FAIL: expected 15 agents per group; A={len(a)}, B={len(b)}")
mean_a, mean_b = statistics.mean(a), statistics.mean(b)
var_a, var_b = statistics.variance(a), statistics.variance(b)
se2 = var_a/len(a) + var_b/len(b)
t_value = (mean_a-mean_b)/math.sqrt(se2)
df = se2**2 / ((var_a/len(a))**2/(len(a)-1) + (var_b/len(b))**2/(len(b)-1))
print("PASS: 30 records, 15 per group, unique IDs, valid schema, and embedded/CSV parity.")
print(f"Handling-time check: Group A mean={mean_a:.4f}; Group B mean={mean_b:.4f}; Welch t={t_value:.4f}; df={df:.4f}.")
print("Note: p-value is calculated in the browser app; presentation slide 10 contains a different summary that should be reconciled.")
