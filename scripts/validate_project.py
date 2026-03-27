#!/usr/bin/env python3
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
HTML_FILES = sorted(list((ROOT / "tools").glob("*/index.html")) + list((ROOT / "site").glob("*.html")))
JS_FILES = sorted(list((ROOT / "tools").glob("*/app.js")) + list((ROOT / "tools").glob("*/data.js")) + list((ROOT / "site" / "assets").glob("*/app.js")) + list((ROOT / "data" / "exports").glob("*.js")))

errors = []

def check_links(path: Path):
    text = path.read_text(encoding="utf-8")
    for attr, rel in re.findall(r'(href|src)="([^"]+)"', text):
        if rel.startswith(("http://", "https://", "mailto:", "#", "data:")):
            continue
        target = (path.parent / rel).resolve()
        if not target.exists():
            errors.append(f"Missing target from {path.relative_to(ROOT)}: {rel}")

for html in HTML_FILES:
    check_links(html)

for js in JS_FILES:
    try:
        result = subprocess.run(["node", "--check", str(js)], capture_output=True, text=True)
    except FileNotFoundError:
        result = None
    if result is not None and result.returncode != 0:
        errors.append(f"JS syntax error in {js.relative_to(ROOT)}: {result.stderr.strip()}")

if errors:
    print("VALIDATION FAILED")
    for item in errors:
        print(" -", item)
    sys.exit(1)

print("VALIDATION PASSED")
for html in HTML_FILES:
    print(" - checked", html.relative_to(ROOT))
for js in JS_FILES:
    print(" - checked", js.relative_to(ROOT))
