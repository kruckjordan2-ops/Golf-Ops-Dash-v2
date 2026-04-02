#!/usr/bin/env python3
"""
Generate competition-data.data.js from MiClub competition & social participation export.

Input:
  data/raw/competition/2026 Jan-Mar Competition & Social Rounds.xls
  Two sheets:
    - Member Social Participation     (membership#, name, category, social rounds, age)
    - Member Competition Participatio (membership#, name, category, comp rounds, age)

Outputs:
  tools/competition-data/data.js
  data/exports/competition-data.data.js
  site/assets/data/competition-data.data.js
"""

import json, sys
from pathlib import Path
from datetime import date
from collections import defaultdict

try:
    import xlrd
except ImportError:
    print("xlrd not installed — run: pip3 install xlrd")
    raise

BASE  = Path(__file__).parent
TODAY = date.today().isoformat()

XLS_FILE = BASE / "data" / "raw" / "competition" / "2026 Jan-Mar Competition & Social Rounds.xls"

OUTPUTS = [
    BASE / "tools" / "competition-data" / "data.js",
    BASE / "data"  / "exports"          / "competition-data.data.js",
    BASE / "site"  / "assets" / "data"  / "competition-data.data.js",
]

# Map raw categories to display groups (mirrors generate_bookings.py)
CATEGORY_GROUP = {
    "Full Member":           "Full Member",
    "Ordinary Member":       "Full Member",
    "Ordinary Member.":      "Full Member",
    "Life Member":           "Full Member",
    "Honorary Member":       "Honorary",
    "Honorary Club Pro":     "Honorary",
    "Honorary Other":        "Honorary",
    "Senior Full Member":    "Senior",
    "Senior Ordinary Member":"Senior",
    "Senior Ordinary Member.":"Senior",
    "Veteran Full Member":   "Veteran",
    "Veteran Ordinary Member":"Veteran",
    "Veteran Ordinary Member.":"Veteran",
    "Country Full Member":   "Country",
    "Country Ordinary Member":"Country",
    "Country Ordinary Member.":"Country",
    "Interstate Full Member":"Interstate/Overseas",
    "Interstate Ordinary Member":"Interstate/Overseas",
    "Overseas Full Member":  "Interstate/Overseas",
    "Overseas Ordinary Member":"Interstate/Overseas",
    "Junior Over 21 Full Member":    "Junior",
    "Junior Over 21 Ordinary Member":"Junior",
    "Junior Under 21 Full Member":   "Junior",
    "Junior Under 21 Ordinary Member":"Junior",
    "Sub Junior Member":     "Junior",
    "Non Playing Member":    "Non Playing",
    "Non Playing Junior Over 21":"Non Playing",
    "Non Playing Junior Over 21 Member":"Non Playing",
    "Non Playing Member.":   "Non Playing",
    "Social Member":         "Social/Public",
    "Public Member":         "Social/Public",
    "Life Member.":          "Full Member",
    "Veteran Full Member.":  "Veteran",
    "Sub Junior Member.":    "Junior",
    "Honorary - Other":      "Honorary",
}

AGE_BRACKETS = [
    ("Under 30", 0, 29),
    ("30-49",   30, 49),
    ("50-64",   50, 64),
    ("65-79",   65, 79),
    ("80+",     80, 999),
]


def clean_cat(raw):
    s = str(raw or "").strip()
    return CATEGORY_GROUP.get(s, s or "Unknown")


def age_bracket(age):
    if age is None:
        return "Unknown"
    for label, lo, hi in AGE_BRACKETS:
        if lo <= age <= hi:
            return label
    return "Unknown"


def read_sheet(wb, sheet_name):
    """Read an XLS sheet into list of dicts."""
    sh = wb.sheet_by_name(sheet_name)
    headers = [sh.cell_value(0, c) for c in range(sh.ncols)]
    rows = []
    for r in range(1, sh.nrows):
        row = {}
        for c, h in enumerate(headers):
            row[h] = sh.cell_value(r, c)
        rows.append(row)
    return rows


def main():
    if not XLS_FILE.exists():
        print(f"  ⚠  Competition data not found: {XLS_FILE}")
        sys.exit(1)

    wb = xlrd.open_workbook(str(XLS_FILE))
    print(f"  Reading {XLS_FILE.name}...")

    # Read both sheets
    social_rows = read_sheet(wb, "Member Social Participation")
    comp_rows   = read_sheet(wb, "Member Competition Participatio")

    # Index by membership number
    social_map = {}
    for r in social_rows:
        mid = str(r.get("Membership Number", "")).strip()
        if mid:
            social_map[mid] = r

    comp_map = {}
    for r in comp_rows:
        mid = str(r.get("Membership Number", "")).strip()
        if mid:
            comp_map[mid] = r

    # Merge — union of all member IDs, skip totals rows
    all_ids = sorted(set(social_map.keys()) | set(comp_map.keys()))
    all_ids = [mid for mid in all_ids if mid.lower() not in ("total", "totals", "")]
    members = []

    for mid in all_ids:
        sr = social_map.get(mid, {})
        cr = comp_map.get(mid, {})
        # Get name/category/age from whichever sheet has them
        ref = cr if cr else sr
        first = str(ref.get("First Name", "")).strip()
        last  = str(ref.get("Last Name", "")).strip()
        raw_cat = str(ref.get("Category", "")).strip()
        raw_age = ref.get("Age", None)
        try:
            age = int(float(raw_age)) if raw_age else None
        except (ValueError, TypeError):
            age = None

        try:
            comp_rounds   = int(float(cr.get("Competition Rounds", 0))) if cr else 0
        except (ValueError, TypeError):
            comp_rounds = 0
        try:
            social_rounds = int(float(sr.get("Social Rounds", 0))) if sr else 0
        except (ValueError, TypeError):
            social_rounds = 0
        total = comp_rounds + social_rounds

        members.append({
            "id":          mid,
            "first":       first,
            "last":        last,
            "name":        f"{first} {last}",
            "category":    clean_cat(raw_cat),
            "rawCategory": raw_cat,
            "age":         age,
            "ageBracket":  age_bracket(age),
            "compRounds":  comp_rounds,
            "socialRounds":social_rounds,
            "totalRounds": total,
            "compPct":     round(comp_rounds / total, 4) if total > 0 else 0,
        })

    print(f"  Merged {len(members)} members ({len(comp_map)} comp, {len(social_map)} social)")

    # Sort by total rounds descending
    members.sort(key=lambda m: m["totalRounds"], reverse=True)

    # Summary KPIs
    total_comp   = sum(m["compRounds"] for m in members)
    total_social = sum(m["socialRounds"] for m in members)
    total_rounds = total_comp + total_social
    comp_only    = sum(1 for m in members if m["compRounds"] > 0 and m["socialRounds"] == 0)
    social_only  = sum(1 for m in members if m["socialRounds"] > 0 and m["compRounds"] == 0)
    both         = sum(1 for m in members if m["compRounds"] > 0 and m["socialRounds"] > 0)
    active_comp  = sum(1 for m in members if m["compRounds"] > 0)
    active_social= sum(1 for m in members if m["socialRounds"] > 0)

    summary = {
        "totalMembers":  len(members),
        "totalComp":     total_comp,
        "totalSocial":   total_social,
        "totalRounds":   total_rounds,
        "avgComp":       round(total_comp / active_comp, 1) if active_comp else 0,
        "avgSocial":     round(total_social / active_social, 1) if active_social else 0,
        "avgTotal":      round(total_rounds / len(members), 1) if members else 0,
        "compOnly":      comp_only,
        "socialOnly":    social_only,
        "both":          both,
        "activeComp":    active_comp,
        "activeSocial":  active_social,
        "compPct":       round(total_comp / total_rounds, 4) if total_rounds else 0,
    }

    # By category
    cat_agg = defaultdict(lambda: {"comp": 0, "social": 0, "count": 0})
    for m in members:
        c = cat_agg[m["category"]]
        c["comp"]   += m["compRounds"]
        c["social"] += m["socialRounds"]
        c["count"]  += 1

    by_category = []
    for name, v in sorted(cat_agg.items(), key=lambda x: x[1]["comp"] + x[1]["social"], reverse=True):
        total = v["comp"] + v["social"]
        by_category.append({
            "name":    name,
            "comp":    v["comp"],
            "social":  v["social"],
            "total":   total,
            "count":   v["count"],
            "avgComp": round(v["comp"] / v["count"], 1) if v["count"] else 0,
            "avgSocial": round(v["social"] / v["count"], 1) if v["count"] else 0,
            "compPct": round(v["comp"] / total, 4) if total else 0,
        })

    # By age bracket
    age_agg = defaultdict(lambda: {"comp": 0, "social": 0, "count": 0})
    for m in members:
        a = age_agg[m["ageBracket"]]
        a["comp"]   += m["compRounds"]
        a["social"] += m["socialRounds"]
        a["count"]  += 1

    bracket_order = [b[0] for b in AGE_BRACKETS]
    by_age = []
    for label in bracket_order:
        v = age_agg.get(label, {"comp": 0, "social": 0, "count": 0})
        total = v["comp"] + v["social"]
        by_age.append({
            "name":    label,
            "comp":    v["comp"],
            "social":  v["social"],
            "total":   total,
            "count":   v["count"],
            "avgComp": round(v["comp"] / v["count"], 1) if v["count"] else 0,
            "avgSocial": round(v["social"] / v["count"], 1) if v["count"] else 0,
            "compPct": round(v["comp"] / total, 4) if total else 0,
        })

    # Assemble output
    data = {
        "meta": {
            "period":    XLS_FILE.stem.replace("Competition & Social Rounds", "").strip(),
            "generated": TODAY,
            "source":    XLS_FILE.name,
        },
        "summary":     summary,
        "members":     members,
        "byCategory":  by_category,
        "byAge":       by_age,
    }

    js = f"// Auto-generated by generate_competition.py — do not edit manually\nwindow.COMPETITION_DATA = {json.dumps(data, separators=(',', ':'))};\n"

    for out in OUTPUTS:
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(js, encoding="utf-8")
        kb = len(js) / 1024
        print(f"  ✅ {out} ({kb:.0f} KB)")


if __name__ == "__main__":
    main()
