#!/usr/bin/env python3
"""
VGC Sales Data Generator — XLSX Parser
=======================================
Reads SwiftPOS "PLU Sales by Member" XLSX exports and generates
multi-year sales_data.js for the spend tracking dashboard.

Usage:
  python3 generate_sales.py [path_to_xlsx_dir]

If no path given, looks for XLSX files in data/raw/sales/.
"""

from pathlib import Path
import sys, json, re, zipfile
import xml.etree.ElementTree as ET

BASE = Path(__file__).parent

# ── Category mapping (must match build.py) ────────────────────────────────────

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

SALES_EXCLUDE = [
    'ENTERTAINMENT','PENNANT','HOUSE GUEST','AUSTRALIAN SPORTS','COACHING',
    'HOTELCARE','GRANGE','ASC ','FOUNDATION','CORPORATE','FUNCTION','EVENT',
    'STAFF','ACCOUNT','A/C',
]


def get_cat(group_name):
    g = group_name.strip()
    if g in SALES_CATEGORY_MAP:
        return SALES_CATEGORY_MAP[g]
    gu = g.upper()
    for k, v in SALES_CATEGORY_MAP.items():
        if k.upper() in gu:
            return v
    return 'other'


def is_real(name):
    n = name.upper()
    if any(e in n for e in SALES_EXCLUDE):
        return False
    if name.upper() == name and len(name) > 3 and ' ' in name:
        return False
    return True


def parse_xlsx(filepath):
    """Parse a SwiftPOS PLU Sales by Member XLSX file.
    Returns list of member dicts: {id, name, total, fnb, proshop, golf, other, transactions, groups}
    """
    NS = {'ss': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

    with zipfile.ZipFile(filepath) as zf:
        # Find sheet file
        names = zf.namelist()
        sheet_file = None
        for candidate in ['xl/worksheets/sheet1.xml', 'xl/worksheets/sheet.xml']:
            if candidate in names:
                sheet_file = candidate
                break
        if not sheet_file:
            # Find any sheet
            for n in names:
                if 'worksheets/sheet' in n and n.endswith('.xml'):
                    sheet_file = n
                    break
        if not sheet_file:
            print(f"  ⚠  No worksheet found in {filepath.name}")
            return []

        # Shared strings
        shared = []
        if 'xl/sharedStrings.xml' in names:
            tree = ET.parse(zf.open('xl/sharedStrings.xml'))
            for si in tree.findall('.//ss:si', NS):
                shared.append(''.join(t.text or '' for t in si.findall('.//ss:t', NS)))

        sheet = ET.parse(zf.open(sheet_file))
        rows = sheet.findall('.//ss:row', NS)

        all_members = {}
        current_id = None
        current_name = None
        current_group = None

        for row_el in rows:
            cells = {}
            for cell in row_el.findall('ss:c', NS):
                ref = cell.get('r', '')
                col = ''.join(c for c in ref if c.isalpha())
                ct = cell.get('t', '')
                vel = cell.find('ss:v', NS)
                if vel is None:
                    val = ''
                elif ct == 's':
                    val = shared[int(vel.text)] if vel.text else ''
                else:
                    val = vel.text or ''
                cells[col] = val

            col_a = cells.get('A', '').strip()
            col_c = cells.get('C', '').strip()
            col_e = cells.get('E', '').strip()
            col_i = cells.get('I', '').strip()
            col_k = cells.get('K', '')
            col_p = cells.get('P', '')

            # Skip header/footer/page break rows
            if col_a in ('PLU', 'PLU Sales by Member', '') and not col_i:
                continue
            if col_a.startswith('SAL027') or col_a.startswith('The Victoria') or col_a.startswith('ABN ') or col_a.startswith('Park Road') or col_a.startswith('Ph:'):
                continue

            # Member row
            if col_a == 'Member' and col_c and col_e:
                mid = col_c
                mname = col_e
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

            # Group row
            if col_a == 'Group' and col_e and current_id:
                current_group = col_e
                continue

            # Group Total row
            if col_i == 'Group Total:' and current_id and current_group:
                try:
                    sales = float(col_p) if col_p else 0.0
                    if sales > 0:
                        cat = get_cat(current_group)
                        all_members[current_id][cat] += sales
                        all_members[current_id]['groups'][current_group] = (
                            all_members[current_id]['groups'].get(current_group, 0.0) + sales
                        )
                except (ValueError, TypeError):
                    pass
                continue

            # Member Total row
            if col_i == 'Member Total:' and current_id:
                try:
                    total = float(col_p) if col_p else 0.0
                    qty = float(col_k) if col_k else 0.0
                    all_members[current_id]['total'] = total
                    all_members[current_id]['transactions'] = int(qty)
                except (ValueError, TypeError):
                    pass
                current_id = None
                current_name = None
                current_group = None
                continue

        # Filter and round
        data = []
        for m in all_members.values():
            if not is_real(m['name']):
                continue
            # Round all monetary values
            m['total'] = round(m['total'], 2)
            m['fnb'] = round(m['fnb'], 2)
            m['proshop'] = round(m['proshop'], 2)
            m['golf'] = round(m['golf'], 2)
            m['other'] = round(m['other'], 2)
            m['groups'] = {k: round(v, 2) for k, v in m['groups'].items()}
            data.append(m)

        data.sort(key=lambda x: x['total'], reverse=True)
        return data


def derive_year_label(filename):
    """Extract year label from filename like '2023 Member Sales.xlsx' or '2026 Q1 Member Sales.xlsx'"""
    stem = Path(filename).stem
    # Match "2026 Q1" or "2023"
    m = re.match(r'^(\d{4}(?:\s+Q\d)?)', stem)
    if m:
        return m.group(1).strip()
    return stem


def main():
    # Determine source directory
    if len(sys.argv) > 1:
        src_dir = Path(sys.argv[1])
    else:
        src_dir = BASE / "data" / "raw" / "sales"

    if not src_dir.exists():
        print(f"  ⚠  Directory not found: {src_dir}")
        sys.exit(1)

    xlsx_files = sorted(src_dir.glob("*Member Sales*.xlsx"))
    if not xlsx_files:
        print(f"  ⚠  No Member Sales XLSX files in {src_dir}")
        sys.exit(1)

    print(f"\n  Processing {len(xlsx_files)} XLSX file(s) from {src_dir}\n")

    years = []
    year_data = {}

    for fp in xlsx_files:
        label = derive_year_label(fp.name)
        print(f"  Parsing {fp.name} ...", end='', flush=True)
        data = parse_xlsx(fp)
        total_rev = sum(d['total'] for d in data)
        print(f"  {len(data)} members · ${total_rev:,.2f}")
        years.append(label)
        year_data[label] = data

    # Build output
    output = {
        'years': years,
        'data': year_data
    }

    out_file = BASE / "data" / "exports" / "sales_data.js"
    out_file.parent.mkdir(parents=True, exist_ok=True)
    js = f"// Auto-generated by generate_sales.py — do not edit manually.\nconst SALES_DATA = {json.dumps(output, separators=(',', ':'))};\n"
    out_file.write_text(js, encoding='utf-8')

    kb = out_file.stat().st_size / 1024
    total_members = sum(len(d) for d in year_data.values())
    total_rev = sum(sum(m['total'] for m in d) for d in year_data.values())
    print(f"\n  ✅ {len(xlsx_files)} files · {len(years)} years · {total_members} member-years")
    print(f"     ${total_rev:,.2f} total revenue → {out_file.name} ({kb:.0f} KB)")


if __name__ == '__main__':
    main()
