# VGC Dashboard Project

This version is set up so each tool has its own editable source files.

## Folder layout

- `tools/home/` → hub page
- `tools/rounds-dashboard/` → rounds dashboard source
- `tools/member-lookup/` → member lookup source
- `tools/scorecard-generator/` → scorecard generator source
- `data/exports/` → editable browser data files
- `data/raw/` → original Excel, CSV and legacy pipeline files
- `site/` → deployable output built from the source files
- `archive/original-html/` → original uploaded single-file HTML backups

## Easiest workflow

1. Edit one of these:
   - `tools/.../index.html`
   - `tools/.../styles.css`
   - `tools/.../app.js`
   - `data/exports/*.js`
2. Run:
   - Mac: double-click `run.command`
   - Windows: double-click `run.bat`
   - or `python build.py`
3. Upload or push the contents of `site/`

## Git recommendation

Use one repo for the whole folder.

Good commit examples:
- `Update rounds data`
- `Tidy member lookup filters`
- `Adjust scorecard styling`
- `Refresh homepage links`

## Important

The easiest edit path is now the split source files.
If you still want the old spreadsheet-driven pipeline, the original files are preserved under `data/raw/legacy/`.
