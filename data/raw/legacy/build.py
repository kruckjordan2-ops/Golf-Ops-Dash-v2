"""
╔══════════════════════════════════════════════════════════════╗
║         VGC GOLF OPERATIONS — LOCAL BUILD PIPELINE          ║
║         The Victoria Golf Club                               ║
╠══════════════════════════════════════════════════════════════╣
║  WHAT THIS DOES                                              ║
║  Reads your Excel round tracking files + member spreadsheet  ║
║  and rebuilds the three HTML tools automatically.            ║
║                                                              ║
║  MONTHLY WORKFLOW                                            ║
║  1. Drop new annual Excel file into  data/excel/             ║
║  2. Double-click run.command (Mac) or run.bat (Windows)      ║
║     OR run:  python build.py  in Terminal/Command Prompt     ║
║  3. Open GitHub Desktop → Commit → Push                      ║
║  4. Site at ops.victoriagolf.com.au updates automatically    ║
║                                                              ║
║  MEMBER DATA WORKFLOW                                        ║
║  1. Export fresh spreadsheet from Golf Genius                ║
║  2. Drop into data/members/ (replace the old one)            ║
║  3. Run python build.py                                      ║
╚══════════════════════════════════════════════════════════════╝
"""

import sys, os, json, datetime, shutil, re
from pathlib import Path

# ── Dependency check ──────────────────────────────────────────
missing = []
try:    import pandas as pd
except: missing.append('pandas')
try:    import openpyxl
except: missing.append('openpyxl')

if missing:
    print("❌  Missing packages. Run this once:")
    print(f"    pip install {' '.join(missing)}")
    sys.exit(1)

import pandas as pd

# ── Paths ─────────────────────────────────────────────────────
BASE        = Path(__file__).parent
EXCEL_DIR   = BASE / 'data' / 'excel'
MEMBERS_DIR = BASE / 'data' / 'members'
SITE        = BASE / 'site'
TEMPLATES   = BASE / 'templates'

MONTHS = ['January','February','March','April','May','June',
          'July','August','September','October','November','December']
DAYS   = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

METRIC_ROWS = [
    ('AM Field','am'), ('PM Field','pm'), ('After 3PM','after3'),
    ('Total Field','total'), ('Guests','guests'),
    ('Member / Guest Ratio','guest_ratio'), ('Member Play','members'),
    ('Manger Intro','mgr_intro'), ('Interstate','interstate'),
    ('International','intl'), ('Industry Guest','industry'),
    ('Member Intro','memb_intro'), ('Member Guest Unaccompanied','memb_unaccomp'),
    ('Corporate','corporate'), ('Event','event'),
    ('Non Playing','non_playing'), ('Voucher','voucher'),
    ('Reciprocal','recip'), ('Competition','comp'),
]

def sf(v):
    """Safe float — returns 0.0 on any error or NaN"""
    try:
        f = float(v)
        return 0.0 if f != f else f
    except:
        return 0.0

print('=' * 60)
print('  VGC Golf Operations — Build Pipeline')
print(f'  {datetime.datetime.now().strftime("%d %b %Y %H:%M")}')
print('=' * 60)

# ═══════════════════════════════════════════════════════════════
# STEP 1 — FIND EXCEL FILES
# ═══════════════════════════════════════════════════════════════
print('\n📂  Scanning data/excel/ for round tracking files...')
EXCEL_DIR.mkdir(parents=True, exist_ok=True)

excel_files = {}
for f in sorted(EXCEL_DIR.glob('*.xlsx')):
    for y in range(2020, 2035):
        if str(y) in f.stem:
            excel_files[y] = f
            break

if not excel_files:
    print('    ❌  No Excel files found.')
    print('    Drop your annual round tracking files into data/excel/')
    print('    Filenames must contain the year, e.g. 2026_Round_Tracking_Totals.xlsx')
    sys.exit(1)

for y, f in sorted(excel_files.items()):
    print(f'    ✅  {y}: {f.name}')

# ═══════════════════════════════════════════════════════════════
# STEP 2 — PARSE EXCEL FILES
# ═══════════════════════════════════════════════════════════════
print(f'\n⚙️   Parsing {len(excel_files)} Excel file(s)...')

def parse_pivot(df):
    result = {}
    current_month = None
    header_row = None
    MCOLS = {
        'Sum of AM FIELD':'am','Sum of PM FIELD':'pm','Sum of AFTER 3PM':'after3',
        'Sum of TOTAL FIELD':'total','Sum of No. GUESTS':'guests',
        'Sum of MEMBER':'members','Sum of MANAGER INTRO':'mgr_intro',
        'Sum of INTERSTATE':'interstate','Sum of INTERNATIONAL':'intl',
        'Sum of INDUSTRY GUEST':'industry','Sum of MEMB GUEST MICLUB':'memb_intro',
        'Sum of MEMB GUEST UNACCOMPANIED':'memb_unaccomp',
        'Sum of CORPORATE':'corporate','Sum of EVENT':'event',
        'Sum of NON-PLAYING':'non_playing','Sum of VOUCHER':'voucher',
        'Sum of RECIP':'recip','Sum of COMP':'comp',
    }
    for _, row in df.iterrows():
        v0 = str(row.iloc[0]).strip() if pd.notna(row.iloc[0]) else ''
        if v0.upper() in [m.upper() for m in MONTHS]:
            current_month = next(m for m in MONTHS if m.upper() == v0.upper())
            result[current_month] = {}
            header_row = None
            continue
        if v0 == 'Row Labels':
            header_row = list(row)
            continue
        if current_month and header_row and v0 in [d[:3] for d in DAYS]:
            day = next(d for d in DAYS if d[:3] == v0)
            result[current_month][day] = {}
            for ci, ch in enumerate(header_row):
                cs = str(ch).strip() if pd.notna(ch) else ''
                if cs in MCOLS and ci < len(row) and pd.notna(row.iloc[ci]):
                    result[current_month][day][MCOLS[cs]] = sf(row.iloc[ci])
    return result

def parse_occ(df):
    result = {}
    cur_m = None
    cur_d = None
    for _, row in df.iterrows():
        if len(row) < 6: continue
        l1 = str(row.iloc[1]).strip() if pd.notna(row.iloc[1]) else ''
        l2 = str(row.iloc[2]).strip() if pd.notna(row.iloc[2]) else ''
        bk, sp, oc = row.iloc[3], row.iloc[4], row.iloc[5]
        for m in MONTHS:
            if l1 == m:
                cur_m = m
                if m not in result: result[m] = {}
                break
        if cur_m:
            for d in DAYS:
                if d in l1:
                    cur_d = d
                    if d not in result[cur_m]: result[cur_m][d] = {}
                    break
            if cur_d and cur_m and pd.notna(oc):
                try:
                    v = sf(oc)
                    if v > 0:
                        if l2 == 'AM':
                            result[cur_m][cur_d].update({'am_occ':v,'am_book':sf(bk),'am_spots':sf(sp)})
                        elif l2 == 'PM':
                            result[cur_m][cur_d].update({'pm_occ':v,'pm_book':sf(bk),'pm_spots':sf(sp)})
                        elif 'Total' in l1:
                            result[cur_m][cur_d].update({'total_occ':v,'total_book':sf(bk),'total_spots':sf(sp)})
                except: pass
    return result

def parse_avgs(df):
    result = {}
    cur_months = []
    for _, row in df.iterrows():
        v1 = str(row.iloc[1]).strip() if pd.notna(row.iloc[1]) else ''
        if v1 in MONTHS:
            cur_months = []
            for i in range(4):
                ci = 1 + i*5
                if ci < len(row) and pd.notna(row.iloc[ci]) and str(row.iloc[ci]).strip() in MONTHS:
                    m = str(row.iloc[ci]).strip()
                    cur_months.append(m)
                    if m not in result: result[m] = {}
            continue
        for lbl, key in METRIC_ROWS:
            if lbl.lower() in v1.lower():
                for i, m in enumerate(cur_months):
                    ti, wi, di = 2+i*5, 3+i*5, 4+i*5
                    if di < len(row):
                        try:
                            result[m][key] = {
                                'total': sf(row.iloc[ti]),
                                'weekly': sf(row.iloc[wi]),
                                'daily': sf(row.iloc[di]),
                            }
                        except: pass
    return result

def parse_after3(df):
    by_day = {}
    in_day = False
    for _, row in df.iterrows():
        l1 = str(row.iloc[1]).strip() if pd.notna(row.iloc[1]) else ''
        l2 = str(row.iloc[2]).strip() if pd.notna(row.iloc[2]) else ''
        if 'By Day' in l1: in_day = True
        if in_day and l1 in DAYS and l2 == 'After 3pm':
            if pd.notna(row.iloc[3]):
                by_day[l1] = {'bookings':sf(row.iloc[3]),'spots':sf(row.iloc[4]),'occ':sf(row.iloc[5])}
    return {'by_day': by_day}

def parse_year(path, year):
    print(f'    {year}...', end=' ', flush=True)
    xl = pd.ExcelFile(path)
    sheets = xl.sheet_names
    yd = {}

    # Yearly totals
    if 'Yearly Total To Date' in sheets:
        df = pd.read_excel(path, sheet_name='Yearly Total To Date', header=None)
        yearly = {}
        for _, row in df.iterrows():
            lbl = str(row.iloc[1]).strip() if pd.notna(row.iloc[1]) else ''
            for mlbl, key in METRIC_ROWS:
                if mlbl.lower() in lbl.lower() and pd.notna(row.iloc[2]):
                    yearly[key] = sf(row.iloc[2])
        yd['yearly'] = yearly

    # Pivot → monthly totals
    if 'Pivot Table' in sheets:
        df = pd.read_excel(path, sheet_name='Pivot Table', header=None)
        pvt = parse_pivot(df)
        yd['pivot'] = pvt
        monthly = {}
        for mn in MONTHS:
            if mn in pvt:
                monthly[mn] = {'month_num': MONTHS.index(mn)+1}
                for d, dv in pvt[mn].items():
                    for k, v in dv.items():
                        monthly[mn][k] = monthly[mn].get(k, 0) + v
        yd['monthly'] = monthly

    if 'Occupancy Report' in sheets:
        df = pd.read_excel(path, sheet_name='Occupancy Report', header=None)
        yd['occ_report'] = parse_occ(df)

    if 'Monthly Averages' in sheets:
        df = pd.read_excel(path, sheet_name='Monthly Averages', header=None)
        yd['monthly_avgs'] = parse_avgs(df)

    if 'After 3pm Data' in sheets:
        df = pd.read_excel(path, sheet_name='After 3pm Data', header=None)
        yd['after3pm'] = parse_after3(df)

    # DOW from pivot
    dow = {}
    for mn, days in yd.get('pivot', {}).items():
        for d, metrics in days.items():
            if d not in dow:
                dow[d] = {}
            for k, v in metrics.items():
                dow[d][k] = dow[d].get(k, 0) + v
    yd['dow'] = dow

    months_ok = sum(1 for m in MONTHS if yd.get('monthly', {}).get(m, {}).get('total', 0) > 0)
    print(f'✅  ({months_ok} months with data)')
    return yd

all_data = {}
for year, path in sorted(excel_files.items()):
    all_data[year] = parse_year(path, year)

rounds_json = json.dumps(all_data, separators=(',', ':'))
print(f'\n    Data parsed: {len(rounds_json)//1024}KB')

# ═══════════════════════════════════════════════════════════════
# STEP 3 — PARSE MEMBER SPREADSHEET
# ═══════════════════════════════════════════════════════════════
print('\n👥  Scanning data/members/ for member spreadsheet...')
MEMBERS_DIR.mkdir(parents=True, exist_ok=True)

member_files = (list(MEMBERS_DIR.glob('*.xlsx')) +
                list(MEMBERS_DIR.glob('*.xls')))
members_json = None

if not member_files:
    print('    ⚠️   No member spreadsheet found — member-lookup.html will not be updated.')
    print('        Export from Golf Genius and drop into data/members/')
else:
    mfile = sorted(member_files)[-1]
    print(f'    ✅  Found: {mfile.name}')
    print('    Parsing...', end=' ', flush=True)
    try:
        try:
            mdf = pd.read_excel(mfile)
        except Exception:
            mdf = pd.read_excel(mfile, engine='xlrd')

        mdf['Membership Date'] = pd.to_datetime(mdf.get('Membership Date',''), dayfirst=True, errors='coerce')
        mdf['Birthday']        = pd.to_datetime(mdf.get('Birthday',''), dayfirst=True, errors='coerce')
        today = datetime.date.today()

        def ss(v):
            if v is None or (isinstance(v, float) and v != v): return ''
            return str(v).strip()

        def si(v):
            try:
                f = float(v)
                return None if f != f else int(f)
            except: return None

        def age_grp(a):
            if a is None: return 'Unknown'
            if a < 30: return 'Under 30'
            if a < 40: return '30s'
            if a < 50: return '40s'
            if a < 60: return '50s'
            if a < 70: return '60s'
            if a < 80: return '70s'
            return '80+'

        def ten_bkt(t):
            if t is None: return 'Unknown'
            if t < 2:  return 'New (<2yr)'
            if t < 5:  return '2-5yr'
            if t < 10: return '5-10yr'
            if t < 20: return '10-20yr'
            if t < 30: return '20-30yr'
            if t < 50: return '30-50yr'
            return '50+yr'

        mdf['Age']    = mdf['Birthday'].apply(
            lambda b: (today - b.date()).days // 365 if pd.notna(b) else None)
        mdf['Tenure'] = mdf['Membership Date'].apply(
            lambda d: (today - d.date()).days // 365 if pd.notna(d) else None)
        mdf['JoinYr'] = mdf['Membership Date'].apply(
            lambda d: int(d.year) if pd.notna(d) else None)
        mdf['AgeGrp']  = mdf['Age'].apply(age_grp)
        mdf['TenBkt']  = mdf['Tenure'].apply(ten_bkt)

        def gc(row, *names):
            for n in names:
                if n in row.index and pd.notna(row[n]): return ss(row[n])
            return ''

        members = []
        for _, r in mdf.iterrows():
            members.append({
                'id':           ss(r.get('GGS_ID','')),
                'first':        gc(r,'First Name'),
                'last':         gc(r,'Last Name'),
                'email':        gc(r,'Email'),
                'phone':        gc(r,'Cell Phone'),
                'gender':       gc(r,'Gender'),
                'birthday':     r['Birthday'].strftime('%d/%m/%Y') if pd.notna(r['Birthday']) else '',
                'age':          si(r['Age']),
                'age_group':    r['AgeGrp'],
                'join_date':    r['Membership Date'].strftime('%d/%m/%Y') if pd.notna(r['Membership Date']) else '',
                'join_year':    si(r['JoinYr']),
                'tenure':       si(r['Tenure']),
                'tenure_bucket':r['TenBkt'],
                'suffix':       gc(r,'Suffix'),
                'driver':       gc(r,'Driver'),
                'irons':        gc(r,'Irons'),
                'wedges':       gc(r,'Wedges'),
                'putter':       gc(r,'Putter'),
                'woods':        gc(r,'Woods & Fairways'),
                'ball':         gc(r,'Golf Ball Brand'),
                'shoe_brand':   gc(r,'Golf Shoe Brand'),
                'apparel_size': gc(r,'Apparel Size'),
                'shoe_size':    gc(r,'Shoe Size'),
            })

        def vc(col, top=8):
            s = mdf[col].dropna().astype(str)
            s = s[~s.isin(['','nan'])]
            return {k: int(v) for k,v in s.value_counts().head(top).items()}

        total = len(mdf)
        analytics = {
            'total':        total,
            'male':         int((mdf.get('Gender','') == 'Male').sum()),
            'female':       int((mdf.get('Gender','') == 'Female').sum()),
            'avg_age':      round(float(mdf['Age'].dropna().mean()), 1),
            'median_age':   round(float(mdf['Age'].dropna().median()), 1),
            'avg_tenure':   round(float(mdf['Tenure'].dropna().mean()), 1),
            'age_groups':   dict(mdf['AgeGrp'].value_counts()),
            'tenure_buckets': dict(mdf['TenBkt'].value_counts()),
            'join_trend':   {str(y): int((mdf['JoinYr']==y).sum()) for y in range(2010, today.year+1)},
            'driver_brands': vc('Driver') if 'Driver' in mdf.columns else {},
            'iron_brands':   vc('Irons')  if 'Irons'  in mdf.columns else {},
            'ball_brands':   vc('Golf Ball Brand') if 'Golf Ball Brand' in mdf.columns else {},
            'gender_by_age': {
                ag: {
                    'M': int((mdf[mdf['AgeGrp']==ag].get('Gender','') == 'Male').sum()),
                    'F': int((mdf[mdf['AgeGrp']==ag].get('Gender','') == 'Female').sum()),
                }
                for ag in ['Under 30','30s','40s','50s','60s','70s','80+','Unknown']
            },
            'email_pct':    round(mdf['Email'].notna().sum() / total * 100, 1) if 'Email' in mdf.columns else 0,
            'phone_pct':    round(mdf['Cell Phone'].notna().sum() / total * 100, 1) if 'Cell Phone' in mdf.columns else 0,
            'new_5yr':      int((mdf['JoinYr'] >= today.year - 5).sum()),
            'long_10plus':  int((mdf['Tenure'] >= 10).sum()),
        }

        # Convert any numpy int64/float64 to native Python types for JSON
        import numpy as np
        def clean(obj):
            if isinstance(obj, dict): return {k: clean(v) for k,v in obj.items()}
            if isinstance(obj, list): return [clean(v) for v in obj]
            if isinstance(obj, (np.integer,)): return int(obj)
            if isinstance(obj, (np.floating,)): return float(obj)
            return obj
        members_json = json.dumps(clean({'members': members, 'analytics': analytics}), separators=(',',':'))
        print(f'✅  {total} members, {len(members_json)//1024}KB')

    except Exception as e:
        print(f'❌  Error: {e}')
        import traceback; traceback.print_exc()

# ═══════════════════════════════════════════════════════════════
# STEP 4 — INJECT DATA INTO TEMPLATES AND WRITE SITE FILES
# ═══════════════════════════════════════════════════════════════
print('\n🔨  Building HTML files...')
SITE.mkdir(parents=True, exist_ok=True)

# Helper: inject data into template placeholder
def inject(template_path, out_path, replacements):
    content = template_path.read_text(encoding='utf-8')
    for placeholder, value in replacements.items():
        content = content.replace(placeholder, value)
    out_path.write_text(content, encoding='utf-8')
    size = out_path.stat().st_size
    print(f'    ✅  {out_path.name} ({size//1024}KB)')

# Rounds dashboard
tmpl_dash = TEMPLATES / 'rounds-dashboard.html'
if tmpl_dash.exists():
    inject(tmpl_dash, SITE / 'rounds-dashboard.html', {
        'VGC_ROUNDS_DATA_PLACEHOLDER': rounds_json,
    })
else:
    print('    ⚠️   templates/rounds-dashboard.html not found — skipping.')

# Member lookup
tmpl_memb = TEMPLATES / 'member-lookup.html'
if tmpl_memb.exists() and members_json:
    inject(tmpl_memb, SITE / 'member-lookup.html', {
        'VGC_MEMBERS_DATA_PLACEHOLDER': members_json,
    })
elif not tmpl_memb.exists():
    print('    ⚠️   templates/member-lookup.html not found — skipping.')

# Hub and scorecard — just copy straight across (no data injection needed)
for fname in ['index.html', 'scorecard-generator.html', 'CNAME']:
    src = TEMPLATES / fname
    if src.exists():
        shutil.copy2(src, SITE / fname)
        print(f'    ✅  {fname} (copied)')
    else:
        print(f'    ⚠️   templates/{fname} not found — skipping.')

# ═══════════════════════════════════════════════════════════════
# STEP 5 — SUMMARY
# ═══════════════════════════════════════════════════════════════
site_files = list(SITE.glob('*.html')) + list(SITE.glob('CNAME'))
print(f'\n✅  Build complete — {len(site_files)} files in site/')
print('\n   NEXT STEPS:')
print('   1. Open GitHub Desktop')
print('   2. You should see the updated files in the Changes list')
print('   3. Write a commit message e.g. "Update March 2026 data"')
print('   4. Click Commit to main → Push origin')
print('   5. ops.victoriagolf.com.au updates in ~30 seconds')
print()
