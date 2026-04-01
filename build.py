#!/usr/bin/env python3
"""
VGC Golf Operations Hub — Master Build Script
==============================================
Zero external dependencies — works on Cloudflare Pages, Netlify,
GitHub Actions, or any machine with Python 3.6+.

No pip installs required. Uses only Python stdlib:
  zipfile + xml.etree  → reads xlsx files
  subprocess + re      → reads xls/pdf files
  json, shutil, pathlib → everything else

Data folder layout:
  data/raw/rounds/   → Monthly round tracking xlsx files
  data/raw/pace/     → MiClub Round Times xls files
  data/raw/sales/    → SwiftPOS PLU Sales PDF files
  data/exports/      → Auto-generated js files (do not edit)

Usage: python3 build.py
"""

from pathlib import Path
import sys, shutil, json, re, subprocess, zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from collections import defaultdict

BASE         = Path(__file__).parent
TOOLS        = BASE / "tools"
SITE         = BASE / "site"
ASSETS       = SITE / "assets"
DATA_RAW     = BASE / "data" / "raw"
DATA_EXPORTS = BASE / "data" / "exports"
CNAME_SRC    = DATA_RAW / "legacy" / "CNAME"

PAGES = {
    "index":               "home",
    "rounds-dashboard":    "rounds-dashboard",
    "member-lookup":       "member-lookup",
    "scorecard-generator": "scorecard-generator",
    "tee-timing":          "tee-timing",
    "pace-of-play":        "pace-of-play",
    "spend-tracking":      "spend-tracking",
}

DATA_TARGETS = {
    "rounds-dashboard":    "rounds-dashboard.data.js",
    "member-lookup":       "member-lookup.data.js",
    "scorecard-generator": "scorecard-generator.data.js",
    "pace-of-play":        "pace_data.js",
    "spend-tracking":      "sales_data.js",
}

MONTH_MAP = {
    'january':1,'february':2,'march':3,'april':4,'may':5,'june':6,
    'july':7,'august':8,'september':9,'october':10,'november':11,'december':12
}

FEMALE_NAMES = set([
    'mary','patricia','jennifer','linda','barbara','elizabeth','susan','jessica',
    'sarah','karen','lisa','nancy','betty','margaret','sandra','ashley','dorothy',
    'kimberly','emily','donna','carol','michelle','amanda','melissa','deborah',
    'stephanie','rebecca','sharon','laura','kathleen','amy','angela','shirley',
    'anna','brenda','pamela','emma','nicole','helen','samantha','katherine',
    'christine','debra','rachel','carolyn','janet','catherine','heather','diane',
    'julie','joyce','victoria','kelly','joan','evelyn','lauren','judith','olivia',
    'martha','cheryl','megan','andrea','ann','alice','jean','doris','beverly',
    'danielle','julia','grace','denise','amber','marilyn','gloria','theresa',
    'sara','janice','marie','anne','leanne','sue','leeanne','lynne','jan','ros',
    'roslyn','judy','robyn','wendy','fiona','alison','claire','tracey',
    'jacqueline','jackie','gillian','lesley','louise','natalie','tanya','joanne',
    'joanna','kylie','melanie','simone','yvonne','pauline','lorraine','vivienne',
    'penelope','felicity','georgina','harriet','suzanne','kathryn','debby',
    'corinne','taylor','hayley','holly','colleen','noeline','maree','kerrie',
    'shelley','sandy','mandy','cindy','trudy','bev','deb','liz','beth','ellie',
    'nell','connie','bonnie','sally','jenny','penny','ginny','winnie','annie',
    'rose','violet','lily','daisy','ruby','pearl','bronwyn','dianne','narelle',
    'sharyn','meryl','beverley','glenda','leigh','kim','pat','val','mel','sam',
    'alex','jo','lee','rae','renee','monique','dominique','nathalie','challis',
    'willison','sebire','priestley','neale','meyer','rendall','doig','mcmillan',
    'hawke','bowler','mcgorrery','saddington','brophy','champion','maddox',
])

SALES_EXCLUDE = [
    'ENTERTAINMENT','PENNANT','HOUSE GUEST','AUSTRALIAN SPORTS','COACHING',
    'HOTELCARE','GRANGE','ASC ','FOUNDATION','CORPORATE','FUNCTION','EVENT',
    'STAFF','ACCOUNT','A/C',
]

SALES_CATEGORY_MAP = {
    'BULK BEER':'fnb','PACK BEER':'fnb','GIN':'fnb','RUM':'fnb','WHISKEY':'fnb',
    'VODKA/OUZO/TEQUILA':'fnb','LIQUEURS':'fnb','MISC SPIRITS':'fnb',
    'BRANDY/COGNAC':'fnb','APERTIFS':'fnb','CHAMPAGNE/SPARKLING':'fnb',
    'WHITE WINE':'fnb','RED WINE':'fnb','DESSERT WINE':'fnb','FORTIFIED WINE':'fnb',
    'CELLAR LIST':'fnb','SOFT DRINK':'fnb','COFFEE/TEA':'fnb','MISC F&B':'fnb',
    'SANDWICHES':'fnb','CASUAL SERVERY':'fnb','MISC FOOD':'fnb','GOLF DRINKS':'fnb',
    'GOLF SNACKS':'fnb','CONFECTIONARY':'fnb','BREAKFAST':'fnb','LUNCH':'fnb',
    'ENTRÉE':'fnb','DESSERT':'fnb','SYSTEM':'fnb',
    'GOLF BALLS':'proshop','GOLF GLOVES':'proshop','GOLF TEES':'proshop',
    'ACCESSORIES':'proshop','GOLF CLUBS':'proshop','REPAIRS':'proshop',
    'HEADWEAR':'proshop','OUTERWEAR':'proshop','MENS SHIRTS':'proshop',
    'LADIES SHIRTS':'proshop','PANTS SHORTS':'proshop','SHOES':'proshop',
    'SOCKS':'proshop','BAGS BUGGIES':'proshop','PANTS SKIRT SKORT':'proshop',
    'Australian Open':'proshop',
    'COMP FEES':'golf','GREEN FEES':'golf','Range Balls':'golf','LESSONS':'golf',
    'CART HIRE':'golf','Club Hire':'golf','Intl/Interstate GFees':'golf',
    'Reciprocal Golfers':'golf','Paul Lessons':'golf',
    'Credit Card Surcharge':'other','Donation':'other',
}

PACE_JUNK  = ['Timesheet','Golf Only','Stableford','Stroke','Ambrose','Medley','Social','Event','Par ']
PACE_EVENTS = ['Stableford','Stroke','Par ','Nett','Ambrose','Medley','Medal','Timesheet','Social']


# ── HELPERS ───────────────────────────────────────────────────────────────────

def section(title):
    print(f"\n{'─'*50}\n  {title}\n{'─'*50}")

def excel_date(serial):
    """Convert Excel serial date number to YYYY-MM-DD string."""
    if not serial: return ''
    try:
        dt = datetime(1899, 12, 30) + timedelta(days=int(float(serial)))
        return dt.strftime('%Y-%m-%d')
    except Exception:
        return str(serial)

def safe_int(val, default=0):
    if val is None or val == '': return default
    try: return int(float(val))
    except Exception: return default

def safe_str(val):
    if val is None: return ''
    return str(val).strip()


# ── XLSX READER (zero dependencies) ──────────────────────────────────────────

def read_xlsx(filepath, sheet_name='Daily Numbers'):
    """
    Read an xlsx file using only Python stdlib (zipfile + xml.etree).
    Returns list of dicts using first row as headers.
    """
    NS = {'ss': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

    with zipfile.ZipFile(filepath) as zf:
        names = zf.namelist()

        # Shared strings
        shared = []
        if 'xl/sharedStrings.xml' in names:
            tree = ET.parse(zf.open('xl/sharedStrings.xml'))
            for si in tree.findall('.//ss:si', NS):
                shared.append(''.join(t.text or '' for t in si.findall('.//ss:t', NS)))

        # Find target sheet index
        wb = ET.parse(zf.open('xl/workbook.xml'))
        sheets = wb.findall('.//ss:sheet', NS)
        sheet_idx = 1
        for i, s in enumerate(sheets, 1):
            if s.get('name') == sheet_name:
                sheet_idx = i
                break

        sheet_file = f'xl/worksheets/sheet{sheet_idx}.xml'
        if sheet_file not in names:
            sheet_file = 'xl/worksheets/sheet1.xml'

        sheet = ET.parse(zf.open(sheet_file))

        # Build sparse row/col data (xlsx only stores non-empty cells)
        rows_data = {}
        for row_el in sheet.findall('.//ss:row', NS):
            row_num = int(row_el.get('r', 0))
            row_cells = {}
            for cell in row_el.findall('ss:c', NS):
                ref = cell.get('r', '')
                # Extract column letters
                col_letters = ''.join(c for c in ref if c.isalpha())
                # Convert column letters to 0-based index
                col_idx = 0
                for ch in col_letters:
                    col_idx = col_idx * 26 + (ord(ch.upper()) - ord('A') + 1)
                col_idx -= 1

                cell_type = cell.get('t', '')
                val_el = cell.find('ss:v', NS)
                if val_el is None:
                    val = ''
                elif cell_type == 's':
                    val = shared[int(val_el.text)] if val_el.text else ''
                else:
                    val = val_el.text or ''
                row_cells[col_idx] = val
            rows_data[row_num] = row_cells

        if not rows_data:
            return []

        # Find header row (usually row 1)
        sorted_rows = sorted(rows_data.keys())
        header_row = rows_data[sorted_rows[0]]
        max_col = max(header_row.keys()) if header_row else 0
        headers = [header_row.get(c, '') for c in range(max_col + 1)]

        # Build records
        records = []
        for row_num in sorted_rows[1:]:
            row = rows_data[row_num]
            if not row: continue
            record = {}
            for c, h in enumerate(headers):
                if h:
                    record[h] = row.get(c, '')
            records.append(record)

        return records


# ── STEP 1: ROUNDS ────────────────────────────────────────────────────────────

def process_rounds():
    section("ROUNDS DATA")

    # ── Delegate to generate_data.py if available (richer output format) ──────
    gen = BASE / "generate_data.py"
    if gen.exists():
        print("  Using generate_data.py for rich hierarchical output...")
        result = subprocess.run([sys.executable, str(gen)], cwd=str(BASE))
        if result.returncode == 0:
            src = TOOLS / "rounds-dashboard" / "data.js"
            # Append static member stats so they travel with the data file
            memb_file = DATA_RAW / "memb_stats.json"
            if memb_file.exists() and src.exists():
                memb = json.loads(memb_file.read_text())
                existing = src.read_text(encoding="utf-8")
                if "ROUNDS_DASHBOARD_MEMB" not in existing:
                    src.write_text(
                        existing + "\nwindow.ROUNDS_DASHBOARD_MEMB=" +
                        json.dumps(memb, separators=(',',':')) + ";\n",
                        encoding="utf-8"
                    )
            if src.exists():
                out = DATA_EXPORTS / "rounds-dashboard.data.js"
                shutil.copy2(src, out)
                kb = out.stat().st_size / 1024
                print(f"\n  ✅ Synced tools/rounds-dashboard/data.js → {out.name} ({kb:.0f} KB)")
            return
        print("  ⚠  generate_data.py failed — falling back to built-in parser")

    # ── Fallback: built-in flat-record parser ─────────────────────────────────
    rounds_dir = DATA_RAW / "rounds"
    if not rounds_dir.exists():
        print("  ⚠  data/raw/rounds/ not found")
        return

    # Check for master file first
    master = DATA_RAW / "master" / "VGC_-_MASTER_Rounds_Data.xlsx"
    if master.exists():
        xlsx_files = [master]
        master_mode = True
        print(f"  Using master file: {master.name}")
    else:
        xlsx_files = sorted(rounds_dir.glob("*.xlsx"))
        master_mode = False
    if not xlsx_files:
        print("  ⚠  No xlsx files in data/raw/rounds/")
        return

    all_records = []

    for fp in xlsx_files:
        if master_mode:
            year = 0  # will be set per-row from YEAR column
            month_name = ''
            month = 0
        else:
            match = re.match(r'(\d{4})_([A-Za-z]+)_', fp.stem)
            if not match:
                print(f"  ⚠  Skipping {fp.name} — must be YYYY_Month_Round_Tracking.xlsx")
                continue
            year = int(match.group(1))
            month_name = match.group(2).lower()
            month = MONTH_MAP.get(month_name)
            if not month:
                print(f"  ⚠  Skipping {fp.name} — unrecognised month")
                continue

        try:
            sheet_name = 'all daily data' if master_mode else 'Daily Numbers'
            rows = read_xlsx(fp, sheet_name)
        except Exception as e:
            print(f"  ⚠  Could not read {fp.name}: {e}")
            continue

        count = 0
        for row in rows:
            date_val = row.get('DATE', '')
            if not date_val: continue

            # Handle both serial dates and string dates
            if date_val.replace('.','').isdigit():
                date_str = excel_date(date_val)
            else:
                try:
                    date_str = datetime.strptime(date_val, '%Y-%m-%d').strftime('%Y-%m-%d')
                except Exception:
                    continue

            if not date_str: continue

            # In master mode, get year/month from the row data
            if master_mode:
                try: year = int(float(row.get('YEAR', date_str[:4])))
                except: year = int(date_str[:4])
                month_name = row.get('MONTH', '')
                month = MONTH_MAP.get(month_name, int(date_str[5:7]))

            total  = safe_int(row.get('TOTAL FIELD'))
            guests = safe_int(row.get('No. GUESTS'))
            # Master file uses slightly different column names
            miclub = safe_int(row.get('MEMB GUEST MICLUB') or row.get('MEMB GUEST'))
            unaccomp = safe_int(row.get('MEMB GUEST UNACCOMPANIED') or row.get('UNACCOMPANIED'))
            recip = safe_int(row.get('RECIP') or row.get('RECIPROCAL'))

            all_records.append({
                "date": date_str, "year": year, "month": month,
                "monthName": month_name.capitalize() if not master_mode else month_name,
                "day": safe_str(row.get('DAY')),
                "amField": safe_int(row.get('AM FIELD')),
                "pmField": safe_int(row.get('PM FIELD')),
                "after3pm": safe_int(row.get('AFTER 3PM')),
                "totalField": total,
                "guests": guests,
                "members": safe_int(row.get('MEMBER')),
                "memberGuestRatio": round(guests/total, 4) if total > 0 else 0,
                "managerIntro": safe_int(row.get('MANAGER INTRO')),
                "interstate": safe_int(row.get('INTERSTATE')),
                "international": safe_int(row.get('INTERNATIONAL')),
                "industryGuest": safe_int(row.get('INDUSTRY GUEST')),
                "membGuestMiclub": miclub,
                "membGuestUnaccompanied": unaccomp,
                "corporate": safe_int(row.get('CORPORATE')),
                "event": safe_int(row.get('EVENT')),
                "nonPlaying": safe_int(row.get('NON-PLAYING')),
                "voucher": safe_int(row.get('VOUCHER')),
                "recip": recip,
                "comp": safe_int(row.get('COMP')),
                "variance": safe_int(row.get('VARIANCE', 0)),
                "notes": safe_str(row.get('Notes') or row.get('NOTES')),
            })
            count += 1

        print(f"  ✓  {fp.name}  ({count} days)")

    if not all_records:
        print("  ⚠  No records loaded")
        return

    all_records.sort(key=lambda r: r["date"])
    years = sorted(set(r["year"] for r in all_records))
    total_rounds = sum(r["totalField"] for r in all_records)

    years_js = json.dumps([str(y) for y in years])
    js = (f"// VGC Rounds — {len(all_records)} days · "
          f"{total_rounds:,} rounds · {', '.join(str(y) for y in years)}\n"
          f"window.ROUNDS_DASHBOARD_RAW = {json.dumps(all_records)};\n"
          f"window.ROUNDS_DASHBOARD_YEARS = {years_js};\n")

    tools_out = TOOLS / "rounds-dashboard" / "data.js"
    tools_out.write_text(js, encoding="utf-8")
    out = DATA_EXPORTS / "rounds-dashboard.data.js"
    shutil.copy2(tools_out, out)
    print(f"\n  ✅ {len(all_records)} days · {total_rounds:,} rounds · "
          f"{len(xlsx_files)} files → {out.name}")


# ── STEP 2: PACE OF PLAY ─────────────────────────────────────────────────────

def process_pace():
    section("PACE OF PLAY DATA")
    pace_dir = DATA_RAW / "pace"
    if not pace_dir.exists():
        print("  ⚠  data/raw/pace/ not found")
        return

    xls_files = sorted(list(pace_dir.glob("*.xls")) + list(pace_dir.glob("*.xlsx")))

    # ── Delegate to generate_pace.py if available (richer output) ────────────
    gen = BASE / "generate_pace.py"
    if gen.exists() and xls_files:
        print("  Using generate_pace.py for richer output...")
        result = subprocess.run(
            [sys.executable, str(gen)] + [str(f) for f in xls_files],
            cwd=str(BASE)
        )
        if result.returncode == 0:
            src = TOOLS / "pace-of-play" / "pace_data.js"
            if src.exists():
                out = DATA_EXPORTS / "pace_data.js"
                shutil.copy2(src, out)
                kb = out.stat().st_size / 1024
                print(f"\n  ✅ Synced tools/pace-of-play/pace_data.js → {out.name} ({kb:.0f} KB)")
            return
        print("  ⚠  generate_pace.py failed — falling back to built-in parser")

    if not xls_files:
        print("  ⚠  No xls files in data/raw/pace/")
        return

    all_records = []
    seen = set()

    for f in xls_files:
        result = subprocess.run(['strings', str(f)], capture_output=True, text=True)
        lines = [l.strip() for l in result.stdout.split('\n') if l.strip()]
        current_event = 'Unknown'
        current_name = None

        for i, l in enumerate(lines):
            if any(x in l for x in PACE_EVENTS) and len(l) < 80:
                current_event = l
                continue
            if (re.match(r'^[A-Z][a-z]+ [A-Z][a-z]+', l) and len(l) < 40
                    and not any(x in l for x in PACE_EVENTS)):
                current_name = l
            m = re.match(r'^0?([3-5]):([0-5][0-9])$', l)
            if m:
                h, mn = int(m.group(1)), int(m.group(2))
                total = h*60 + mn
                if 180 <= total <= 330:
                    key = (str(f), i, total)
                    if key not in seen:
                        seen.add(key)
                        fmt_s = current_event.lower()
                        fmt = ('stableford' if 'stableford' in fmt_s else
                               'par' if 'par' in fmt_s and 'stroke' not in fmt_s else
                               'stroke' if any(x in fmt_s for x in ['stroke','nett','medal']) else
                               'ambrose' if 'ambrose' in fmt_s else 'other')
                        gender = ('f' if current_name and
                                  current_name.split()[0].lower() in FEMALE_NAMES else 'm')
                        if current_name and not any(x in current_name for x in PACE_JUNK):
                            all_records.append({
                                'name': re.sub(r'[#`$\\]', '', current_name).strip(),
                                'mins': total, 'gender': gender, 'fmt': fmt,
                            })
        print(f"  ✓  {f.name}")

    if not all_records:
        print("  ⚠  No pace records found")
        return

    member_all = defaultdict(list)
    member_gender = {}
    for r in all_records:
        member_all[r['name']].append(r['mins'])
        member_gender[r['name']] = r['gender']

    member_data = [
        {'name': n, 'gender': member_gender[n], 'rounds': len(vals),
         'avgMins': round(sum(vals)/len(vals), 1), 'allTimes': vals}
        for n, vals in member_all.items()
        if not any(x in n for x in PACE_JUNK)
    ]
    member_data.sort(key=lambda x: x['avgMins'], reverse=True)

    js = f"// Auto-generated by build.py — do not edit manually.\nconst PACE_DATA = {json.dumps(member_data)};\n"
    tools_out = TOOLS / "pace-of-play" / "pace_data.js"
    tools_out.write_text(js, encoding="utf-8")
    out = DATA_EXPORTS / "pace_data.js"
    shutil.copy2(tools_out, out)
    print(f"\n  ✅ {len(xls_files)} files · {len(member_data)} members → {out.name}")


# ── STEP 3: SALES ─────────────────────────────────────────────────────────────

def process_sales():
    section("MEMBER SPEND DATA (SwiftPOS)")
    sales_dir = DATA_RAW / "sales"
    if not sales_dir.exists():
        print("  ⚠  data/raw/sales/ not found")
        return

    pdf_files = sorted(sales_dir.glob("*.pdf"))
    if not pdf_files:
        print("  ⚠  No PDF files in data/raw/sales/")
        return

    member_pat = re.compile(r'^\s*Member\s+(\d+)\s+(.+?)(?:\s{3,}|$)')
    group_pat  = re.compile(r'^\s*Group\s+(\d+)\s+(.+?)(?:\s{3,}|$)')
    gtotal_pat = re.compile(r'Group Total:\s+([\d,.]+)\s+\$([\d,.-]+)\s+\$([\d,.-]+)')
    mtotal_pat = re.compile(r'Member Total:\s+([\d,.]+)\s+\$([\d,.-]+)\s+\$([\d,.-]+)')
    SKIP = {'SAL027','PLU Sales by Member','PLU               Description',
            'PLU             Description','Reporting Period','The Victoria Golf Club',
            'ABN 84','Park Road','Ph:','SwiftPOS'}

    def get_cat(g):
        g = g.strip()
        if g in SALES_CATEGORY_MAP: return SALES_CATEGORY_MAP[g]
        gu = g.upper()
        for k, v in SALES_CATEGORY_MAP.items():
            if k.upper() in gu: return v
        return 'other'

    def is_real(name):
        n = name.upper()
        if any(e in n for e in SALES_EXCLUDE): return False
        if name.upper() == name and len(name) > 3 and ' ' in name: return False
        return True

    all_members = {}

    for pdf_file in pdf_files:
        result = subprocess.run(
            ['pdftotext', '-layout', str(pdf_file), '-'],
            capture_output=True, text=True
        )
        if result.returncode != 0:
            print(f"  ⚠  Could not parse {pdf_file.name} — pdftotext not installed?")
            continue

        lines = result.stdout.split('\n')
        current_id = None
        current_name = None
        current_group = None

        for line in lines:
            if any(s in line for s in SKIP): continue

            mm = member_pat.match(line)
            if mm and 'Group' not in line and 'Total' not in line:
                mid = mm.group(1).strip()
                mname = mm.group(2).strip()
                if mname and not mname[0].isdigit():
                    current_id = mid
                    current_name = mname
                    current_group = None
                    if mid not in all_members:
                        all_members[mid] = {
                            'id': mid, 'name': mname, 'total': 0.0,
                            'fnb': 0.0, 'proshop': 0.0, 'golf': 0.0,
                            'other': 0.0, 'transactions': 0, 'groups': {}
                        }
                continue

            gm = group_pat.match(line)
            if gm and current_id and 'Total' not in line:
                current_group = gm.group(2).strip()
                continue

            gt = gtotal_pat.search(line)
            if gt and current_id and current_group:
                try:
                    sales = float(gt.group(3).replace(',', ''))
                    if sales > 0:
                        cat = get_cat(current_group)
                        all_members[current_id][cat] += sales
                        g = current_group
                        all_members[current_id]['groups'][g] = (
                            all_members[current_id]['groups'].get(g, 0.0) + sales)
                except ValueError:
                    pass
                continue

            mt = mtotal_pat.search(line)
            if mt and current_id and 'Group Total' not in line:
                try:
                    all_members[current_id]['total'] = float(mt.group(3).replace(',', ''))
                    all_members[current_id]['transactions'] = int(float(mt.group(1).replace(',', '')))
                except ValueError:
                    pass

        print(f"  ✓  {pdf_file.name}")

    data = [m for m in all_members.values() if is_real(m['name'])]
    data.sort(key=lambda x: x['total'], reverse=True)
    total_rev = sum(d['total'] for d in data)

    out = DATA_EXPORTS / "sales_data.js"
    out.write_text(f"const SALES_DATA = {json.dumps(data)};\n", encoding="utf-8")
    print(f"\n  ✅ {len(pdf_files)} PDF(s) · {len(data)} members · ${total_rev:,.2f} → {out.name}")


# ── STEP 4: MEMBERS ───────────────────────────────────────────────────────────

def process_members():
    section("MEMBER LOOKUP DATA")
    gen = BASE / "generate_member.py"
    if not gen.exists():
        print("  ⚠  generate_member.py not found — skipping")
        return
    result = subprocess.run([sys.executable, str(gen)], cwd=str(BASE))
    if result.returncode != 0:
        print("  ⚠  generate_member.py failed")
        return
    src = DATA_EXPORTS / "member-lookup.data.js"
    if src.exists():
        kb = src.stat().st_size / 1024
        print(f"\n  ✅ member-lookup.data.js regenerated ({kb:.0f} KB)")


# ── STEP 5: BUILD SITE ────────────────────────────────────────────────────────

def build_site():
    section("BUILDING SITE")
    SITE.mkdir(exist_ok=True)
    ASSETS.mkdir(exist_ok=True)

    for slug, tool_name in PAGES.items():
        src_dir = TOOLS / tool_name
        asset_dir = ASSETS / tool_name
        asset_dir.mkdir(parents=True, exist_ok=True)

        index_file = src_dir / "index.html"
        if not index_file.exists():
            print(f"  ⚠  Missing tools/{tool_name}/index.html — skipping")
            continue

        html = index_file.read_text(encoding="utf-8")

        html = html.replace('href="styles.css"',   f'href="assets/{tool_name}/styles.css"')
        html = html.replace('src="app.js"',         f'src="assets/{tool_name}/app.js"')
        data_file = DATA_TARGETS.get(tool_name, tool_name + ".data.js")
        html = html.replace('src="data.js"',        f'src="assets/data/{data_file}"')
        html = html.replace('src="pace_data.js"',  'src="assets/data/pace_data.js"')
        html = html.replace('src="sales_data.js"', 'src="assets/data/sales_data.js"')

        html = html.replace('href="../home/index.html"',                'href="index.html"')
        html = html.replace('href="../rounds-dashboard/index.html"',    'href="rounds-dashboard.html"')
        html = html.replace('href="../member-lookup/index.html"',       'href="member-lookup.html"')
        html = html.replace('href="../scorecard-generator/index.html"', 'href="scorecard-generator.html"')
        html = html.replace('href="../tee-timing/index.html"',          'href="tee-timing.html"')
        html = html.replace('href="../pace-of-play/index.html"',        'href="pace-of-play.html"')
        html = html.replace('href="../spend-tracking/index.html"',      'href="spend-tracking.html"')

        target = "index.html" if slug == "index" else f"{slug}.html"
        (SITE / target).write_text(html, encoding="utf-8")

        for asset in ["styles.css", "app.js"]:
            src_file = src_dir / asset
            if src_file.exists():
                shutil.copy2(src_file, asset_dir / asset)

        print(f"  ✓  {target}")

    assets_data = ASSETS / "data"
    assets_data.mkdir(parents=True, exist_ok=True)
    for tool_name, filename in DATA_TARGETS.items():
        src = DATA_EXPORTS / filename
        if src.exists():
            shutil.copy2(src, assets_data / filename)
        else:
            print(f"  ⚠  Missing: {filename} (run build after adding data files)")

    if CNAME_SRC.exists():
        shutil.copy2(CNAME_SRC, SITE / "CNAME")


# ── MAIN ──────────────────────────────────────────────────────────────────────

def main():
    print("\n" + "="*50)
    print("  VGC Golf Operations Hub — Build")
    print("="*50)

    DATA_EXPORTS.mkdir(parents=True, exist_ok=True)

    process_rounds()
    process_pace()
    process_sales()
    process_members()
    build_site()

    print("\n" + "="*50)
    print("  BUILD COMPLETE")
    print("="*50)
    for tool_name, filename in DATA_TARGETS.items():
        f = DATA_EXPORTS / filename
        if f.exists():
            kb = f.stat().st_size / 1024
            print(f"  ✓  {filename:<40} {kb:>6.0f} KB")
        else:
            print(f"  ✗  {filename:<40} MISSING")
    print(f"\n  tools/ data files : synced")
    print(f"  site/ built at    : {SITE}")
    print(f"\n  ✅  Done! Run: git add -A && git commit -m 'data update' && git push")
    print("="*50 + "\n")


if __name__ == "__main__":
    main()

