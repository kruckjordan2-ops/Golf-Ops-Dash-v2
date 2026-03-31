#!/usr/bin/env python3
"""
VGC Rounds Dashboard — Data Generator
======================================
Run this script whenever the Excel file is updated to regenerate data.js.

Usage:
    python3 generate_data.py
    python3 generate_data.py "/path/to/VGC - MASTER Rounds Data - Updated.xlsx"

Output: tools/rounds-dashboard/data.js
"""

import sys
import json
import math
import calendar
from pathlib import Path

try:
    import pandas as pd
except ImportError:
    print("Installing pandas...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pandas", "openpyxl", "-q"])
    import pandas as pd

# ── CONFIG ────────────────────────────────────────────────────────────────────

# Try relative paths from repo root, then worktree location
_candidates = [
    Path(__file__).parent / "../Jordan Kruck (VGC File)/Round Tracking/VGC - MASTER Rounds Data - Updated.xlsx",
    Path(__file__).parent / "../../../Jordan Kruck (VGC File)/Round Tracking/VGC - MASTER Rounds Data - Updated.xlsx",
]
DEFAULT_XLSX = next((p for p in _candidates if p.resolve().exists()), _candidates[0])
OUTPUT_JS    = Path(__file__).parent / "tools/rounds-dashboard/data.js"

MONTHS = ['January','February','March','April','May','June',
          'July','August','September','October','November','December']

DAYS_SHORT = {'Mon':'Monday','Tue':'Tuesday','Wed':'Wednesday','Thu':'Thursday',
              'Fri':'Friday','Sat':'Saturday','Sun':'Sunday'}

DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

# Excel col  →  data.js key
FIELD_MAP = {
    'AM FIELD':       'am',
    'PM FIELD':       'pm',
    'AFTER 3PM':      'after3',
    'TOTAL FIELD':    'total',
    'No. GUESTS':     'guests',
    'MEMBER':         'members',
    'MEMBER / GUEST RATIO': 'guest_ratio',
    'MANAGER INTRO':  'mgr_intro',
    'INTERSTATE':     'interstate',
    'INTERNATIONAL':  'intl',
    'INDUSTRY GUEST': 'industry',
    'MEMB GUEST':     'memb_intro',
    'UNACCOMPANIED':  'memb_unaccomp',
    'CORPORATE':      'corporate',
    'EVENT':          'event',
    'NON-PLAYING':    'non_playing',
    'VOUCHER':        'voucher',
    'RECIPROCAL':     'recip',
    'COMP':           'comp',
}

# Keys to sum (not average) when aggregating
SUM_KEYS = ['am','pm','after3','total','guests','members','mgr_intro',
            'interstate','intl','industry','memb_intro','memb_unaccomp',
            'corporate','event','non_playing','voucher','recip','comp']

# Keys for occ_report (from Occupancy Daily Data sheet)
OCC_FIELD_MAP = {
    'AM FIELD':     'am_book',
    'AM SPOTS':     'am_spots',
    'AM OCCUPANCY': 'am_occ',
    'PM FIELD':     'pm_book',
    'PM SPOTS':     'pm_spots',
    'PM OCCUPANCY': 'pm_occ',
    'Total Field ': 'total_book',
    'AFTER 3PM':    'after3_book',
    'AFTER 3PM SPOTS': 'after3_spots',
}

# ── HELPERS ───────────────────────────────────────────────────────────────────

def safe(v):
    """Convert numpy/float NaN to None, else round to 6 dp."""
    if v is None:
        return None
    try:
        if math.isnan(float(v)):
            return None
        return round(float(v), 6)
    except (TypeError, ValueError):
        return None

def row_fields(row, field_map=FIELD_MAP):
    """Extract mapped fields from a DataFrame row."""
    out = {}
    for col, key in field_map.items():
        if col in row.index:
            v = safe(row[col])
            if v is not None:
                out[key] = v
    return out

def sum_group(group_df):
    """Sum all FIELD_MAP columns for a group of rows."""
    out = {}
    for col, key in FIELD_MAP.items():
        if col in group_df.columns and key != 'guest_ratio':
            v = safe(group_df[col].sum())
            if v is not None:
                out[key] = v
    # Compute guest_ratio from summed totals
    total  = out.get('total', 0) or 0
    guests = out.get('guests', 0) or 0
    out['guest_ratio'] = round(guests / total, 6) if total else 0.0
    return out

# ── LOAD DATA ─────────────────────────────────────────────────────────────────

def load_data(xlsx_path):
    xlsx = pd.ExcelFile(xlsx_path)

    # Main daily data
    df = pd.read_excel(xlsx, sheet_name='all daily data')
    df = df[df['DATE'].notna() & df['YEAR'].notna()].copy()
    df['YEAR'] = df['YEAR'].astype(int)
    df['month_num'] = pd.to_datetime(df['DATE']).dt.month
    df['day_full'] = df['DAY'].map(DAYS_SHORT)

    # Occupancy data
    occ = pd.read_excel(xlsx, sheet_name='Occupancy Daily Data')
    occ = occ[occ['DATE'].notna() & occ['YEAR'].notna()].copy()
    occ['YEAR'] = occ['YEAR'].astype(int)
    occ['month_num'] = pd.to_datetime(occ['DATE']).dt.month
    occ['MONTH'] = occ['MONTH'].astype(str)
    occ['day_full'] = occ['DAY'].map(DAYS_SHORT)

    return df, occ

# ── BUILD RAW OBJECT ──────────────────────────────────────────────────────────

def build_raw(df, occ):
    years = sorted(df['YEAR'].unique())
    # Exclude years with virtually no data (future placeholders)
    years = [y for y in years if df[df['YEAR']==y]['TOTAL FIELD'].sum() > 0]

    raw = {}

    for year in years:
        ydf  = df[df['YEAR'] == year]
        yocc = occ[occ['YEAR'] == year]

        # ── YEARLY ──────────────────────────────────────────────────────────
        yearly = sum_group(ydf)
        # Remove 'after3' from yearly if it's 0 (years before tracking started)
        if yearly.get('after3', 0) == 0:
            yearly.pop('after3', None)

        # ── MONTHLY ─────────────────────────────────────────────────────────
        monthly = {}
        for mn in MONTHS:
            mdf = ydf[ydf['MONTH'] == mn]
            if mdf.empty:
                continue
            mo_num = MONTHS.index(mn) + 1
            m = sum_group(mdf)
            m['month_num'] = mo_num
            # Remove after3 if 0 for this month
            if m.get('after3', 0) == 0:
                m.pop('after3', None)
            monthly[mn] = m

        # ── PIVOT (month × day-of-week) ──────────────────────────────────────
        pivot = {}
        for mn in MONTHS:
            mdf = ydf[ydf['MONTH'] == mn]
            if mdf.empty:
                continue
            pivot[mn] = {}
            for day in DAYS:
                ddf = mdf[mdf['day_full'] == day]
                if ddf.empty:
                    continue
                d = sum_group(ddf)
                if d.get('after3', 0) == 0:
                    d.pop('after3', None)
                pivot[mn][day] = d

        # ── DAY-OF-WEEK ──────────────────────────────────────────────────────
        dow = {}
        for day in DAYS:
            ddf = ydf[ydf['day_full'] == day]
            if ddf.empty:
                continue
            d = sum_group(ddf)
            if d.get('after3', 0) == 0:
                d.pop('after3', None)
            dow[day] = d

        # ── OCCUPANCY REPORT (month × day-of-week) ───────────────────────────
        occ_report = {}
        for mn in MONTHS:
            mocc = yocc[yocc['MONTH'] == mn]
            if mocc.empty:
                continue
            occ_report[mn] = {}
            for day in DAYS:
                docc = mocc[mocc['day_full'] == day]
                if docc.empty:
                    continue
                am_book  = safe(docc['AM FIELD'].sum()) or 0
                am_spots = safe(docc['AM SPOTS'].sum()) or 0
                pm_book  = safe(docc['PM FIELD'].sum()) or 0
                pm_spots = safe(docc['PM SPOTS'].sum()) or 0
                total_book  = am_book + pm_book
                total_spots = am_spots + pm_spots
                entry = {
                    'am_occ':    round(am_book  / am_spots,  6) if am_spots  else 0,
                    'am_book':   am_book,
                    'am_spots':  am_spots,
                    'pm_occ':    round(pm_book  / pm_spots,  6) if pm_spots  else 0,
                    'pm_book':   pm_book,
                    'pm_spots':  pm_spots,
                    'total_occ': round(total_book / total_spots, 6) if total_spots else 0,
                    'total_book':  total_book,
                    'total_spots': total_spots,
                }
                # After 3pm occupancy (from Oct 2025 onwards)
                if 'AFTER 3PM' in docc.columns and 'AFTER 3PM SPOTS' in docc.columns:
                    a3_book  = safe(docc['AFTER 3PM'].sum()) or 0
                    a3_spots = safe(docc['AFTER 3PM SPOTS'].sum()) or 0
                    if a3_book or a3_spots:
                        entry['after3_book']  = a3_book
                        entry['after3_spots'] = a3_spots
                        entry['after3_occ']   = round(a3_book / a3_spots, 6) if a3_spots else 0
                occ_report[mn][day] = entry

        # ── MONTHLY AVERAGES ─────────────────────────────────────────────────
        monthly_avgs = {}
        for mn in MONTHS:
            mdf = ydf[ydf['MONTH'] == mn]
            if mdf.empty:
                continue
            mo_num = MONTHS.index(mn) + 1
            days_in_month = calendar.monthrange(year, mo_num)[1]
            avgs = {}
            for col, key in FIELD_MAP.items():
                if key == 'guest_ratio':
                    continue
                if col not in mdf.columns:
                    continue
                total_val = safe(mdf[col].sum()) or 0
                if total_val == 0:
                    continue
                avgs[key] = {
                    'total':  total_val,
                    'daily':  round(total_val / days_in_month, 6),
                    'weekly': round(total_val / (days_in_month / 7), 6),
                }
            # guest_ratio avg
            t  = (monthly.get(mn) or {}).get('total', 0) or 0
            g  = (monthly.get(mn) or {}).get('guests', 0) or 0
            avgs['guest_ratio'] = {
                'total':  round(g / t, 6) if t else 0,
                'daily':  round(g / t, 6) if t else 0,
                'weekly': round(g / t, 6) if t else 0,
            }
            monthly_avgs[mn] = avgs

        raw[str(year)] = {
            'yearly':       yearly,
            'pivot':        pivot,
            'monthly':      monthly,
            'occ_report':   occ_report,
            'monthly_avgs': monthly_avgs,
            'dow':          dow,
        }

    return raw, [str(y) for y in years]

# ── WRITE OUTPUT ──────────────────────────────────────────────────────────────

def write_output(raw, years, output_path):
    json_str = json.dumps(raw, separators=(',', ':'))
    years_js  = json.dumps(years)

    content = (
        f"// Auto-generated by generate_data.py — do not edit manually.\n"
        f"// Re-run generate_data.py after updating the Excel source.\n"
        f"window.ROUNDS_DASHBOARD_RAW = {json_str};\n"
        f"window.ROUNDS_DASHBOARD_YEARS = {years_js};\n"
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(content, encoding='utf-8')
    print(f"✓ Wrote {output_path}")
    print(f"  Years: {years}")
    size_kb = output_path.stat().st_size / 1024
    print(f"  File size: {size_kb:.1f} KB")

# ── MAIN ──────────────────────────────────────────────────────────────────────

def main():
    xlsx_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_XLSX
    xlsx_path = xlsx_path.resolve()

    if not xlsx_path.exists():
        print(f"ERROR: Excel file not found: {xlsx_path}")
        print("Usage: python3 generate_data.py [path/to/xlsx]")
        sys.exit(1)

    print(f"Reading: {xlsx_path}")
    df, occ = load_data(xlsx_path)
    print(f"  Rows loaded: {len(df):,}  |  Years: {sorted(df['YEAR'].unique())}")

    raw, years = build_raw(df, occ)

    output_path = Path(__file__).parent / "tools/rounds-dashboard/data.js"
    write_output(raw, years, output_path)
    print("\nDone! Refresh your browser to see updated data.")

if __name__ == '__main__':
    main()
