@echo off
REM ─────────────────────────────────────────────────
REM VGC Golf Operations — Windows Build Runner
REM Double-click this file to rebuild the site
REM ─────────────────────────────────────────────────

cd /d "%~dp0"

echo.
echo   VGC Golf Operations — Build Pipeline
echo   ─────────────────────────────────────
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo   ERROR: Python not found.
    echo   Install from python.org and try again.
    pause
    exit /b 1
)

REM Install dependencies if needed
python -c "import pandas, openpyxl" >nul 2>&1
if errorlevel 1 (
    echo   Installing required packages...
    pip install pandas openpyxl --quiet
)

REM Run the build
python build.py

echo.
pause
