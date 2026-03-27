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
    "index": "home",
    "rounds-dashboard": "rounds-dashboard",
    "member-lookup": "member-lookup",
    "scorecard-generator": "scorecard-generator",
}

DATA_TARGETS = {
    "rounds-dashboard": "rounds-dashboard.data.js",
    "member-lookup": "member-lookup.data.js",
    "scorecard-generator": "scorecard-generator.data.js",
}

SITE.mkdir(exist_ok=True)
ASSETS.mkdir(exist_ok=True)

for slug, tool_name in PAGES.items():
    src_dir = TOOLS / tool_name
    asset_dir = ASSETS / tool_name
    asset_dir.mkdir(parents=True, exist_ok=True)

    html = (src_dir / "index.html").read_text(encoding="utf-8")
    html = html.replace('href="styles.css"', f'href="assets/{tool_name}/styles.css"')
    html = html.replace('src="app.js"', f'src="assets/{tool_name}/app.js"')
    html = html.replace('src="data.js"', f'src="assets/data/{DATA_TARGETS.get(tool_name, tool_name + ".data.js")}"')
    html = html.replace('href="../home/index.html"', "href=\"index.html\"")
    html = html.replace('href="../rounds-dashboard/index.html"', "href=\"rounds-dashboard.html\"")
    html = html.replace('href="../member-lookup/index.html"', "href=\"member-lookup.html\"")
    html = html.replace('href="../scorecard-generator/index.html"', "href=\"scorecard-generator.html\"")

    target_name = "index.html" if slug == "index" else f"{slug}.html"
    (SITE / target_name).write_text(html, encoding="utf-8")

    shutil.copy2(src_dir / "styles.css", asset_dir / "styles.css")
    shutil.copy2(src_dir / "app.js", asset_dir / "app.js")

assets_data = ASSETS / "data"
assets_data.mkdir(parents=True, exist_ok=True)
for tool_name, filename in DATA_TARGETS.items():
    src = DATA_EXPORTS / filename
    if src.exists():
        shutil.copy2(src, assets_data / filename)

if CNAME_SRC.exists():
    shutil.copy2(CNAME_SRC, SITE / "CNAME")

print("✅ Site built in site/")
for path in sorted(SITE.glob('*')):
    print(" -", path.name)
