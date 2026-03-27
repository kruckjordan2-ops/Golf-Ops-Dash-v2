# VGC Golf Operations — Local Build Pipeline
## The Victoria Golf Club

This folder contains everything you need to update the live website yourself.

---

## How it works

```
vgc-ops-pipeline/
├── build.py              ← The script that does everything
├── run.command           ← Mac: double-click to run
├── run.bat               ← Windows: double-click to run
│
├── data/
│   ├── excel/            ← Drop annual Excel round tracking files here
│   ├── members/          ← Drop Golf Genius member export here
│   └── vgc_daily.csv     ← Legacy daily CSV (kept for reference)
│
├── templates/            ← Master HTML files — DO NOT EDIT unless you
│   ├── index.html           know what you're doing. These are the
│   ├── rounds-dashboard.html source files. Data gets injected into them
│   ├── member-lookup.html   when you run the build.
│   ├── scorecard-generator.html
│   └── CNAME
│
└── site/                 ← OUTPUT — these files go to GitHub
    ├── index.html           (DO NOT edit these directly — they get
    ├── rounds-dashboard.html overwritten every build)
    ├── member-lookup.html
    ├── scorecard-generator.html
    └── CNAME
```

---

## Monthly rounds update

**When:** End of each month when you have the new Excel file from MiClub/tracking.

**Steps:**

1. Drop the new Excel file into `data/excel/`
   - File must have the year in the name, e.g. `2026_Round_Tracking_Totals.xlsx`
   - If updating an existing year, just replace the file

2. Double-click `run.command` (Mac) or `run.bat` (Windows)
   - You'll see each year parse with a tick
   - Should take about 30–60 seconds

3. Open **GitHub Desktop**
   - You'll see `site/rounds-dashboard.html` listed as changed
   - Write a commit message: `Update April 2026 round data`
   - Click **Commit to main** → **Push origin**

4. Site at `ops.victoriagolf.com.au` updates within 30 seconds ✅

---

## Member data update

**When:** Whenever you export a fresh member list from Golf Genius.

**Steps:**

1. Export the spreadsheet from Golf Genius (`.xlsx` format preferred)
2. Drop it into `data/members/` — replace the old file
3. Double-click `run.command` or `run.bat`
4. Commit and push in GitHub Desktop

---

## What each Excel file needs

Your annual round tracking Excel files must have these sheets:
- `Yearly Total To Date`
- `Pivot Table`
- `Occupancy Report`
- `Monthly Averages`
- `After 3pm Data` *(2025+ only)*

These are the standard sheets in your VGC tracking files — no changes needed.

---

## Adding a new year

When 2027 starts:
1. Create your `2027_Round_Tracking_Totals.xlsx` tracking file
2. Drop it into `data/excel/`
3. Run the build — 2027 will appear automatically in the dashboard

---

## If something goes wrong

**"No Excel files found"**
→ Make sure your file has the year in the filename and is in `data/excel/`

**"Python not found"**
→ Install Python from python.org (3.8 or newer)

**"ModuleNotFoundError: pandas"**
→ Run in Terminal: `pip install pandas openpyxl`

**"Build succeeded but site looks wrong"**
→ Open `site/rounds-dashboard.html` in your browser to check locally first

**Site not updating after push**
→ Wait 60 seconds and hard-refresh (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)

---

## Editing the tools directly

| What you want to change | File to edit |
|------------------------|--------------|
| Hub layout / styling | `templates/index.html` |
| Scorecard generator | `templates/scorecard-generator.html` |
| Dashboard chart logic | `templates/rounds-dashboard.html` |
| Member lookup layout | `templates/member-lookup.html` |

After editing a template file, run the build to push changes into `site/`, then commit and push.

**Never edit files in `site/` directly** — they get overwritten every time you run the build.

---

## Password

The site password is set in `templates/index.html`, `templates/rounds-dashboard.html`,
`templates/member-lookup.html`, and `templates/scorecard-generator.html`.

To change the password, contact whoever set up the pipeline — the password is stored
as a SHA-256 hash, not in plain text, so it can't be changed by hand.
