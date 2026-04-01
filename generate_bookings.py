#!/usr/bin/env python3
"""
Generate booking-analysis.data.js from MiClub booking exports.

Inputs (from Golf Ops Data For Dashboard/Booking Report (Member & Guest)/):
  - Booking Report Jan-Mar 2026.xls   (14,334 row transaction log)
  - 2026 Q1 Member Booking Report.xls (member-level summary)

Outputs:
  tools/booking-analysis/data.js
  data/exports/booking-analysis.data.js
  site/assets/data/booking-analysis.data.js
"""

import json, sys
from pathlib import Path
from datetime import date
from collections import defaultdict

try:
    import pandas as pd
except ImportError:
    print("pandas not installed — run: pip3 install pandas xlrd")
    raise

BASE   = Path(__file__).parent
DATA   = Path("/Users/jordankruck/Desktop/Golf Ops Data For Dashboard")
TODAY  = date.today().isoformat()

BOOKING_FILE = DATA / "Booking Report (Member & Guest)" / "Booking Report Jan-Mar 2026.xls"
SUMMARY_FILE = DATA / "Booking Report (Member & Guest)" / "2026 Q1 Member Booking Report.xls"

OUTPUTS = [
    BASE / "tools"  / "booking-analysis" / "data.js",
    BASE / "data"   / "exports"          / "booking-analysis.data.js",
    BASE / "site"   / "assets" / "data"  / "booking-analysis.data.js",
]

DOW_ORDER  = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]
HOUR_RANGE = range(6, 19)

# Simplify the 32 raw categories into 8 display groups
CATEGORY_GROUP = {
    "Full Member":           "Full Member",
    "Ordinary Member":       "Full Member",
    "Life Member":           "Full Member",
    "Honorary Member":       "Honorary",
    "Honorary Club Pro":     "Honorary",
    "Honorary Other":        "Honorary",
    "Senior Full Member":    "Senior",
    "Senior Ordinary Member":"Senior",
    "Veteran Full Member":   "Veteran",
    "Veteran Ordinary Member":"Veteran",
    "Country Full Member":   "Country",
    "Country Ordinary Member":"Country",
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
    "Social Member":         "Social/Public",
    "Public Member":         "Social/Public",
    "Guests":                "Guest",
    "Visitor":               "Visitor",
}


def clean_cat(raw):
    """Normalise category: strip trailing period, map to group."""
    s = str(raw or "").strip().rstrip(".")
    return CATEGORY_GROUP.get(s, s or "Unknown")


def is_visitor(row):
    mn = str(row.get("Membership Number", "") or "").strip()
    cat = str(row.get("Membership Category", "") or "").strip().rstrip(".")
    return mn.upper().startswith("VIS") or cat == "Visitor"


def zero_dow():
    return {d: {"total":0,"comp":0,"social":0,"checked_in":0} for d in DOW_ORDER}

def zero_hour():
    return {str(h): {"total":0,"comp":0,"social":0} for h in HOUR_RANGE}


def main():
    print(f"  Reading: {BOOKING_FILE.name}")
    if not BOOKING_FILE.exists():
        print(f"  ✗  Not found: {BOOKING_FILE}")
        sys.exit(1)

    # ── Load transaction log ─────────────────────────────────────────────────
    df = pd.read_excel(BOOKING_FILE, engine="xlrd")

    # Normalize columns
    df.columns = [c.strip() for c in df.columns]
    df["Membership Category"] = df["Membership Category"].astype(str).str.strip().str.rstrip(".")
    df["Gender"]              = df["Gender"].astype(str).str.strip()
    df["Event Date"]          = pd.to_datetime(df["Event Date"], errors="coerce")
    df["Tee Time"]            = pd.to_datetime(df["Tee Time"],   errors="coerce")
    df["Played in Comp"]      = df["Played in Comp"].astype(bool)
    df["Checked In"]          = df["Checked In"].astype(bool)
    df["Membership Number"]   = df["Membership Number"].astype(str).str.strip()

    df["month"]    = df["Event Date"].dt.strftime("%B")
    df["dow"]      = df["Event Date"].dt.strftime("%A")
    df["hour"]     = df["Tee Time"].dt.hour.fillna(-1).astype(int)
    df["cat_grp"]  = df["Membership Category"].apply(lambda x: CATEGORY_GROUP.get(x.strip(), x.strip() or "Unknown"))
    df["visitor"]  = df.apply(is_visitor, axis=1)
    df["member"]   = ~df["visitor"]

    months_present = [m for m in ["January","February","March","April","May","June",
                                   "July","August","September","October","November","December"]
                      if m in df["month"].unique()]

    # ── Totals ────────────────────────────────────────────────────────────────
    total       = len(df)
    checked_in  = int(df["Checked In"].sum())
    comp        = int(df["Played in Comp"].sum())
    social      = total - comp
    visitors    = int(df["visitor"].sum())
    no_shows    = total - checked_in
    unique_mems = int(df[df["member"]]["Membership Number"].nunique())

    # ── By Month ─────────────────────────────────────────────────────────────
    by_month = {}
    for mo in months_present:
        sub = df[df["month"] == mo]
        by_month[mo] = {
            "total":          len(sub),
            "comp":           int(sub["Played in Comp"].sum()),
            "social":         int((~sub["Played in Comp"]).sum()),
            "checked_in":     int(sub["Checked In"].sum()),
            "no_shows":       int((~sub["Checked In"]).sum()),
            "visitors":       int(sub["visitor"].sum()),
            "unique_members": int(sub[sub["member"]]["Membership Number"].nunique()),
        }

    # ── By Day of Week ────────────────────────────────────────────────────────
    by_dow = zero_dow()
    for dow in DOW_ORDER:
        sub = df[df["dow"] == dow]
        by_dow[dow] = {
            "total":      len(sub),
            "comp":       int(sub["Played in Comp"].sum()),
            "social":     int((~sub["Played in Comp"]).sum()),
            "checked_in": int(sub["Checked In"].sum()),
        }

    # ── By Hour ───────────────────────────────────────────────────────────────
    by_hour = zero_hour()
    for h in HOUR_RANGE:
        sub = df[df["hour"] == h]
        by_hour[str(h)] = {
            "total":  len(sub),
            "comp":   int(sub["Played in Comp"].sum()),
            "social": int((~sub["Played in Comp"]).sum()),
        }

    # ── By Category ───────────────────────────────────────────────────────────
    cat_agg = defaultdict(lambda: {"total":0,"comp":0,"social":0,"checked_in":0})
    for _, r in df.iterrows():
        g = r["cat_grp"]
        cat_agg[g]["total"]      += 1
        cat_agg[g]["comp"]       += 1 if r["Played in Comp"] else 0
        cat_agg[g]["social"]     += 0 if r["Played in Comp"] else 1
        cat_agg[g]["checked_in"] += 1 if r["Checked In"] else 0
    by_category = sorted(
        [{"name": k, **v} for k, v in cat_agg.items()],
        key=lambda x: x["total"], reverse=True
    )

    # ── By Gender ─────────────────────────────────────────────────────────────
    by_gender = {}
    for g in ["Male","Female","Unknown"]:
        sub = df[df["Gender"] == g]
        if len(sub):
            by_gender[g] = {
                "total":      len(sub),
                "comp":       int(sub["Played in Comp"].sum()),
                "social":     int((~sub["Played in Comp"]).sum()),
                "checked_in": int(sub["Checked In"].sum()),
            }

    # ── Top Members ───────────────────────────────────────────────────────────
    mem_df = df[df["member"]].copy()
    mem_df["full_name"] = (
        mem_df["First Name"].astype(str).str.strip() + " " +
        mem_df["Last Name"].astype(str).str.strip()
    ).str.strip()

    mem_agg = mem_df.groupby("Membership Number").agg(
        name=("full_name", "first"),
        category=("Membership Category", "first"),
        gender=("Gender", "first"),
        total=("Membership Number", "count"),
        comp=("Played in Comp", "sum"),
        checked_in=("Checked In", "sum"),
    ).reset_index()
    mem_agg["social"] = mem_agg["total"] - mem_agg["comp"]
    mem_agg["comp"]   = mem_agg["comp"].astype(int)
    mem_agg["checked_in"] = mem_agg["checked_in"].astype(int)
    mem_agg = mem_agg.sort_values("total", ascending=False).head(100)

    top_members = [
        {
            "name":          r["name"],
            "member_number": r["Membership Number"],
            "category":      CATEGORY_GROUP.get(r["category"], r["category"]),
            "gender":        r["gender"],
            "total":         int(r["total"]),
            "comp":          int(r["comp"]),
            "social":        int(r["social"]),
            "checked_in":    int(r["checked_in"]),
        }
        for _, r in mem_agg.iterrows()
    ]

    # ── By Month × DOW (for filtered DOW chart) ─────────────────────────────
    by_month_dow = {}
    for mo in months_present:
        sub_mo = df[df["month"] == mo]
        by_month_dow[mo] = {}
        for dow in DOW_ORDER:
            sub = sub_mo[sub_mo["dow"] == dow]
            by_month_dow[mo][dow] = {
                "total":      len(sub),
                "comp":       int(sub["Played in Comp"].sum()),
                "social":     int((~sub["Played in Comp"]).sum()),
                "checked_in": int(sub["Checked In"].sum()),
            }

    # ── By Month × Hour (for filtered hour chart) ────────────────────────────
    by_month_hour = {}
    for mo in months_present:
        sub_mo = df[df["month"] == mo]
        by_month_hour[mo] = {}
        for h in HOUR_RANGE:
            sub = sub_mo[sub_mo["hour"] == h]
            by_month_hour[mo][str(h)] = {
                "total":  len(sub),
                "comp":   int(sub["Played in Comp"].sum()),
                "social": int((~sub["Played in Comp"]).sum()),
            }

    # ── By Month × Category (for filtered category chart) ────────────────────
    by_month_cat = {}
    for mo in months_present:
        sub_mo = df[df["month"] == mo]
        cat_mo = defaultdict(lambda: {"total":0,"comp":0,"social":0,"checked_in":0})
        for _, r in sub_mo.iterrows():
            g = r["cat_grp"]
            cat_mo[g]["total"]      += 1
            cat_mo[g]["comp"]       += 1 if r["Played in Comp"] else 0
            cat_mo[g]["social"]     += 0 if r["Played in Comp"] else 1
            cat_mo[g]["checked_in"] += 1 if r["Checked In"] else 0
        by_month_cat[mo] = dict(cat_mo)

    # ── Top Visiting Clubs ────────────────────────────────────────────────────
    visitor_df = df[df["visitor"] & df["Home Club"].notna()]
    club_counts = (visitor_df["Home Club"].astype(str).str.strip()
                   .value_counts().head(15).reset_index())
    club_counts.columns = ["name","count"]
    home_clubs = [{"name": r["name"], "count": int(r["count"])}
                  for _, r in club_counts.iterrows()
                  if r["name"] not in ("nan","","The Victoria Golf Club","Victoria Golf Club")]

    # ── Assemble output ───────────────────────────────────────────────────────
    data = {
        "meta": {
            "generated":  TODAY,
            "date_range": f"{months_present[0]} – {months_present[-1]} 2026",
            "months":     months_present,
        },
        "totals": {
            "bookings":        total,
            "checked_in":      checked_in,
            "no_shows":        no_shows,
            "comp":            comp,
            "social":          social,
            "unique_members":  unique_mems,
            "visitors":        visitors,
        },
        "by_month":      by_month,
        "by_dow":        by_dow,
        "by_hour":       by_hour,
        "by_month_dow":  by_month_dow,
        "by_month_hour": by_month_hour,
        "by_month_cat":  by_month_cat,
        "by_category":   by_category,
        "by_gender":     by_gender,
        "top_members":   top_members,
        "home_clubs":    home_clubs,
    }

    js = (f"// VGC Booking Analysis — generated {TODAY}\n"
          f"// {total:,} bookings · {months_present[0]}–{months_present[-1]} 2026\n"
          f"window.BOOKING_DATA = {json.dumps(data, separators=(',',':'))};\n")

    for out in OUTPUTS:
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(js, encoding="utf-8")

    kb = len(js.encode()) / 1024
    print(f"  ✅ {total:,} bookings · {unique_mems:,} members · "
          f"{len(months_present)} months → booking-analysis.data.js ({kb:.0f} KB)")


if __name__ == "__main__":
    main()
