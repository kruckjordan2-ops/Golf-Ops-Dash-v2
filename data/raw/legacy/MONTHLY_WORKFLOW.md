# VGC Golf Operations Hub — Monthly Workflow Guide
## The Victoria Golf Club

---

## Overview

Every month there are two things that may need updating on the site:

1. **Round tracking data** — new monthly rounds figures from your Excel file
2. **Member data** — members who have joined or left the club

Both are handled by running the build pipeline. This document walks through each scenario step by step.

---

## Part 1 — Monthly Rounds Update

### When to do this
At the end of each month once your annual round tracking Excel file has been updated with the new month's data.

### Step-by-step

**Step 1 — Update your Excel file**

Open your annual tracking file (e.g. `2026_Round_Tracking_Totals.xlsx`) and add the new month's data as you normally would. Make sure all sheets are up to date:
- Yearly Total To Date
- Pivot Table
- Occupancy Report
- Monthly Averages
- After 3pm Data

Save and close the file.

**Step 2 — Replace the file in the pipeline**

Copy your updated Excel file into:
```
vgc-pipeline/data/excel/
```
Replace the existing file. The filename must contain the year (e.g. `2026_Round_Tracking_Totals.xlsx`).

**Step 3 — Run the build**

- **Mac:** Double-click `run.command`
- **Windows:** Double-click `run.bat`
- **Terminal/Command Prompt:** `python build.py`

You should see output like:
```
✅  2023: 2023_Round_Tracking_Totals.xlsx
✅  2024: 2024_Round_Tracking_Totals.xlsx
✅  2025: 2025_Round_Tracking_Totals.xlsx
✅  2026: 2026_Round_Tracking_Totals.xlsx

2026... ✅  (3 months with data)

✅  Build complete — 5 files in site/
```

**Step 4 — Copy site files to your GitHub repo**

Copy all 5 files from `vgc-pipeline/site/` into your GitHub repo folder (`Golf-Operations-Data-Dashboard/`), replacing the old versions:
- `index.html`
- `rounds-dashboard.html`
- `member-lookup.html`
- `scorecard-generator.html`
- `CNAME`

**Step 5 — Commit and push**

Open **GitHub Desktop**:
1. You'll see the changed files listed (at minimum `rounds-dashboard.html`)
2. Write a commit message, e.g. `Add March 2026 round data`
3. Click **Commit to main**
4. Click **Push origin**

The live site at `ops.victoriagolf.com.au` will update within 30 seconds.

**Step 6 — Verify**

Visit `ops.victoriagolf.com.au`, enter the password, and confirm the new month appears in the Rounds Dashboard. Check the Monthly tab and Year Compare tab to make sure the data looks right.

---

## Part 2 — New Member Joins the Club

When a new member joins, their details need to be added to the member spreadsheet so they appear in the Member Lookup tool.

### Where the member data comes from

The member lookup is built from a **Golf Genius export**. Golf Genius is your source of truth — the pipeline reads whatever you export from there.

### Step-by-step

**Step 1 — Export a fresh member list from Golf Genius**

Log into Golf Genius → go to the Members section → export the full member list as an Excel file (`.xlsx` format preferred).

The export should include all current active members — new joiners will be in here automatically as long as they've been added to Golf Genius first.

**Step 2 — Drop the file into the pipeline**

Copy the exported file into:
```
vgc-pipeline/data/members/
```
Replace (or delete) the previous export. Only keep one file in this folder — the pipeline always uses the most recent one.

**Step 3 — Run the build**

Same as above — double-click `run.command` (Mac) or `run.bat` (Windows).

You should see:
```
✅  Found: Members_Spreadsheet_2026.xlsx
Parsing... ✅  1,402 members, 567KB
```

The member count will reflect the addition of new members.

**Step 4 — Commit and push**

In GitHub Desktop you'll see `member-lookup.html` listed as changed. Commit with a message like `Add new members April 2026` and push.

The Member Lookup tool on the live site will now include the new member.

---

## Part 3 — Member Leaves the Club

When a member resigns, retires, or is otherwise removed, they should be removed from the member lookup tool so staff don't see outdated records.

### Step-by-step

**Step 1 — Remove the member in Golf Genius first**

Before updating the site, make sure the member has been marked as inactive or removed in Golf Genius. The pipeline reads whatever Golf Genius exports, so if they're still in Golf Genius they'll still appear on the site.

**Step 2 — Export a fresh member list from Golf Genius**

Same as the new member process — export the full active member list. Since the departed member has been removed from Golf Genius, they will not appear in the export.

**Step 3 — Drop the file into the pipeline**

Copy the new export into `vgc-pipeline/data/members/`, replacing the old file.

**Step 4 — Run the build**

Double-click `run.command` or `run.bat`.

The member count should be lower — confirm it looks right in the terminal output.

**Step 5 — Commit and push**

In GitHub Desktop, commit with a message like `Remove departed members April 2026` and push.

The member is now removed from the live site.

---

## Part 4 — New Financial Year (New Annual Excel File)

At the start of each new year, you'll have a new annual tracking file. The pipeline handles multiple years automatically.

### Step-by-step

**Step 1 — Create your new annual Excel file**

Set up your new `2027_Round_Tracking_Totals.xlsx` file as normal.

**Step 2 — Add it to the pipeline**

Drop it into `vgc-pipeline/data/excel/`. Leave the previous years in there too — the pipeline reads all of them.

Your `data/excel/` folder should contain all years:
```
data/excel/
├── 2023_Round_Tracking_Totals.xlsx
├── 2024_Round_Tracking_Totals.xlsx
├── 2025_Round_Tracking_Totals.xlsx
├── 2026_Round_Tracking_Totals.xlsx
└── 2027_Round_Tracking_Totals.xlsx   ← new
```

**Step 3 — Run the build**

The new year will be detected automatically and will appear in all dashboard charts, year compare tabs, and filters.

**Step 4 — Commit and push**

---

## Quick Reference

| Situation | Action |
|-----------|--------|
| New month's rounds data | Update Excel → copy to `data/excel/` → run build → push |
| New member joined | Export from Golf Genius → copy to `data/members/` → run build → push |
| Member left | Remove in Golf Genius first → export → copy to `data/members/` → run build → push |
| Multiple members joined/left at once | Handle all changes in Golf Genius → single export → run build → push |
| New financial year | Add new Excel to `data/excel/` → run build → push |
| Both rounds and members changed | Update both files → run build once → push |

---

## Checklist — End of Month

- [ ] Annual Excel file updated with new month's data
- [ ] Excel file copied into `vgc-pipeline/data/excel/`
- [ ] Any new members added to Golf Genius
- [ ] Any departed members removed from Golf Genius
- [ ] Fresh member export from Golf Genius copied to `vgc-pipeline/data/members/`
- [ ] `run.command` or `run.bat` executed — no errors shown
- [ ] Site files copied from `site/` to GitHub repo folder
- [ ] Committed and pushed in GitHub Desktop
- [ ] Live site checked — new month visible in dashboard ✅

---

## Troubleshooting

| Problem | What to check |
|---------|--------------|
| Build fails with "No Excel files found" | Filename must contain the year, e.g. `2026_Round_...` |
| New member not showing in lookup | Check they've been added in Golf Genius first, then re-export |
| Departed member still showing | Check they've been removed/deactivated in Golf Genius first |
| Member count looks wrong | Compare the count in the build output to Golf Genius's total |
| Dashboard not showing new month | Make sure all required sheets are complete in the Excel file |
| Site not updating after push | Wait 60 seconds, then hard-refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows) |
| Password prompt not accepting password | Password is `Broncos6!` — check caps lock |

---

*Last updated: March 2026*
*VGC Golf Operations Hub — The Victoria Golf Club*
