#!/usr/bin/env python3
"""Extract and syntax-check the dashboard's inline JavaScript with Node."""
import re, subprocess, tempfile
from pathlib import Path
html=(Path(__file__).resolve().parents[1]/"index.html").read_text(encoding="utf-8")
scripts=re.findall(r"<script>([\s\S]*?)</script>",html,re.I)
if not scripts:
    raise SystemExit("FAIL: no inline dashboard script found")
with tempfile.NamedTemporaryFile("w",suffix=".js",encoding="utf-8",delete=False) as f:
    f.write(scripts[-1]); path=f.name
try:
    subprocess.run(["node","--check",path],check=True)
finally:
    Path(path).unlink(missing_ok=True)
print("PASS: dashboard JavaScript syntax is valid.")
