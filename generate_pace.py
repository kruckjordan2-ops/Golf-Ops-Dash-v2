#!/usr/bin/env python3
"""
VGC Pace of Play — Data Generator
===================================
Converts one or more "Round Times Report" XLS exports into pace_data.js.

Usage:
    python3 generate_pace.py file1.xls [file2.xls ...]
    python3 generate_pace.py                          # uses default folder scan

Drops results into: tools/pace-of-play/pace_data.js
"""

import sys
import json
import re
import statistics
from pathlib import Path

try:
    import xlrd
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "xlrd", "-q"])
    import xlrd

# ── CONFIG ────────────────────────────────────────────────────────────────────

OUTPUT = Path(__file__).parent / "tools/pace-of-play/pace_data.js"
MEMBER_DB = Path(__file__).parent / "data/exports/member-lookup.data.js"

# Use App sheet (more records, first-last name format)
SHEET = "Time Per Round App"
COL_DATE     = 0
COL_EVENT    = 1
COL_NAME     = 2
COL_GROUP    = 3   # booking group — used to filter 9-hole
COL_ROUND_T  = 9  # "Round Time by App" — HH:MM string

# Plausible 18-hole window (minutes). Outside = data error, skip.
MIN_MINS = 120
MAX_MINS = 420

# ── LOAD MEMBER GENDER DB ────────────────────────────────────────────────────

def load_gender_db():
    """Build {normalised_name: 'm'|'f'} from member-lookup.data.js."""
    if not MEMBER_DB.exists():
        return {}
    with open(MEMBER_DB, encoding="utf-8") as f:
        content = f.read()
    txt = re.sub(r"^[^{]*", "", content.strip()).rstrip(";").strip()
    data = json.loads(txt)
    out = {}
    for m in data.get("members", []):
        full = f"{m.get('first','')} {m.get('last','')}".strip().lower()
        g = "f" if str(m.get("gender", "")).lower().startswith("f") else "m"
        out[full] = g
        # also index as "last, first" for scorecard sheet compatibility
        lf = f"{m.get('last','')} {m.get('first','')}".strip().lower()
        out[lf] = g
    return out

def normalise_name(raw):
    """Normalise whitespace and title-case."""
    return " ".join(raw.strip().split())

def parse_mins(t):
    """Parse 'HH:MM' string to integer minutes. Returns None if unparseable."""
    t = str(t).strip()
    if ":" not in t:
        return None
    parts = t.split(":")
    try:
        return int(parts[0]) * 60 + int(parts[1])
    except (ValueError, IndexError):
        return None

def is_nine_hole(group_name):
    return "9 hole" in str(group_name).lower()

# ── PROCESS FILES ─────────────────────────────────────────────────────────────

def process_files(xls_paths):
    gender_db = load_gender_db()
    print(f"  Gender DB: {len(gender_db)} name entries loaded")

    # name → {rounds, times}
    players = {}

    total_rows = skipped_nine = skipped_time = 0

    for path in xls_paths:
        wb = xlrd.open_workbook(str(path))
        if SHEET not in wb.sheet_names():
            print(f"  WARNING: '{SHEET}' not found in {path.name} — skipping")
            continue
        sh = wb.sheet_by_name(SHEET)
        file_rows = 0
        for r in range(1, sh.nrows):
            row = [sh.cell_value(r, c) for c in range(sh.ncols)]
            name_raw = str(row[COL_NAME]).strip()
            if not name_raw:
                continue
            # Filter 9-hole
            if is_nine_hole(row[COL_GROUP]):
                skipped_nine += 1
                continue
            # Parse round time
            mins = parse_mins(row[COL_ROUND_T])
            if mins is None or mins < MIN_MINS or mins > MAX_MINS:
                skipped_time += 1
                continue
            name = normalise_name(name_raw)
            if name not in players:
                players[name] = {"times": []}
            players[name]["times"].append(mins)
            file_rows += 1
            total_rows += 1
        print(f"  {path.name}: {file_rows:,} valid rows")

    print(f"  Total: {total_rows:,} valid rows | skipped 9-hole: {skipped_nine:,} | skipped bad time: {skipped_time:,}")

    # Build output records
    records = []
    for name, d in sorted(players.items()):
        times = sorted(d["times"])
        avg = round(statistics.mean(times), 1)
        # Gender lookup — try direct then partial
        key = name.lower()
        gender = gender_db.get(key)
        if gender is None:
            # try matching first word (first name only)
            first = key.split()[0] if key else ""
            for db_key, g in gender_db.items():
                if db_key.startswith(first + " "):
                    gender = g
                    break
        records.append({
            "name": name,
            "gender": gender or "m",
            "rounds": len(times),
            "avgMins": avg,
            "allTimes": times,
        })

    # Sort by most rounds played desc, then name
    records.sort(key=lambda x: (-x["rounds"], x["name"]))
    return records

# ── WRITE OUTPUT ──────────────────────────────────────────────────────────────

def write_output(records):
    json_str = json.dumps(records, separators=(",", ":"))
    content = (
        "// Auto-generated by generate_pace.py — do not edit manually.\n"
        "// Re-run generate_pace.py after each new Round Times Report export.\n"
        f"const PACE_DATA = {json_str};\n"
    )
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(content, encoding="utf-8")
    print(f"\n✓ Wrote {OUTPUT}")
    print(f"  Players: {len(records):,}")
    print(f"  File size: {OUTPUT.stat().st_size/1024:.1f} KB")

# ── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) > 1:
        paths = [Path(a) for a in sys.argv[1:]]
    else:
        # Default: look for XLS files in ~/Downloads matching the report name
        import glob
        pattern = str(Path.home() / "Downloads" / "Round Times Report*.xls")
        paths = sorted(Path(p) for p in glob.glob(pattern))
        if not paths:
            print("ERROR: No XLS files provided and none found in ~/Downloads")
            print("Usage: python3 generate_pace.py file1.xls [file2.xls ...]")
            sys.exit(1)

    missing = [p for p in paths if not p.exists()]
    if missing:
        for p in missing:
            print(f"ERROR: File not found: {p}")
        sys.exit(1)

    print(f"Processing {len(paths)} file(s):")
    for p in paths:
        print(f"  · {p.name}")
    print()

    records = process_files(paths)
    write_output(records)
    print("\nDone! Refresh the Pace of Play tool in your browser.")

if __name__ == "__main__":
    main()
