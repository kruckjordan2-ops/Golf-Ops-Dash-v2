#!/usr/bin/env python3
from pathlib import Path
import shutil

BASE = Path(__file__).parent
TOOLS = BASE / "tools"
SITE = BASE / "site"
ASSETS = SITE / "assets"
DATA_EXPORTS = BASE / "data" / "exports"
CNAME_SRC = BASE / "data" / "raw" / "legacy" / "CNAME"

PAGES = {
    "index":               "home",
    "rounds-dashboard":    "rounds-dashboard",
    "member-lookup":       "member-lookup",
    "scorecard-generator": "scorecard-generator",
    "tee-timing":          "tee-timing",       # F&B Timing Sync
    "pace-of-play":        "pace-of-play",     # Pace of Play Analyser
}

DATA_TARGETS = {
    "rounds-dashboard":    "rounds-dashboard.data.js",
    "member-lookup":       "member-lookup.data.js",
    "scorecard-generator": "scorecard-generator.data.js",
    "pace-of-play":        "pace_data.js",     # member pace data
}

# ── BUILD ─────────────────────────────────────────────────────────
SITE.mkdir(exist_ok=True)
ASSETS.mkdir(exist_ok=True)

for slug, tool_name in PAGES.items():
    src_dir = TOOLS / tool_name
    asset_dir = ASSETS / tool_name
    asset_dir.mkdir(parents=True, exist_ok=True)

    html = (src_dir / "index.html").read_text(encoding="utf-8")

    # Fix asset paths
    html = html.replace('href="styles.css"',   f'href="assets/{tool_name}/styles.css"')
    html = html.replace('src="app.js"',         f'src="assets/{tool_name}/app.js"')
    html = html.replace('src="data.js"',        f'src="assets/data/{DATA_TARGETS.get(tool_name, tool_name + ".data.js")}"')
    html = html.replace('src="pace_data.js"',   f'src="assets/data/pace_data.js"')

    # Fix nav links
    html = html.replace('href="../home/index.html"',               'href="index.html"')
    html = html.replace('href="../rounds-dashboard/index.html"',   'href="rounds-dashboard.html"')
    html = html.replace('href="../member-lookup/index.html"',      'href="member-lookup.html"')
    html = html.replace('href="../scorecard-generator/index.html"','href="scorecard-generator.html"')
    html = html.replace('href="../tee-timing/index.html"',         'href="tee-timing.html"')
    html = html.replace('href="../pace-of-play/index.html"',       'href="pace-of-play.html"')

    target_name = "index.html" if slug == "index" else f"{slug}.html"
    (SITE / target_name).write_text(html, encoding="utf-8")

    # Copy CSS and JS assets
    for asset in ["styles.css", "app.js"]:
        src_file = src_dir / asset
        if src_file.exists():
            shutil.copy2(src_file, asset_dir / asset)

# ── DATA FILES ────────────────────────────────────────────────────
assets_data = ASSETS / "data"
assets_data.mkdir(parents=True, exist_ok=True)

for tool_name, filename in DATA_TARGETS.items():
    src = DATA_EXPORTS / filename
    if src.exists():
        shutil.copy2(src, assets_data / filename)
        print(f"  ✓ data: {filename}")
    else:
        print(f"  ⚠ missing: {filename} (expected at data/exports/{filename})")

# ── CNAME ─────────────────────────────────────────────────────────
if CNAME_SRC.exists():
    shutil.copy2(CNAME_SRC, SITE / "CNAME")

# ── REPORT ────────────────────────────────────────────────────────
print("\n✅ Site built → site/")
for path in sorted(SITE.glob("*")):
    print(f"  - {path.name}")

