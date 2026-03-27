#!/bin/bash
# ─────────────────────────────────────────────────
# VGC Golf Operations — Mac Build Runner
# Double-click this file to rebuild the site
# ─────────────────────────────────────────────────

cd "$(dirname "$0")"

echo ""
echo "  VGC Golf Operations — Build Pipeline"
echo "  ─────────────────────────────────────"
echo ""

# Check Python is available
if ! command -v python3 &> /dev/null; then
    echo "  ❌  Python 3 not found."
    echo "  Install from python.org then try again."
    read -p "  Press Enter to close..."
    exit 1
fi

# Install dependencies if needed
python3 -c "import pandas, openpyxl" 2>/dev/null || {
    echo "  Installing required packages..."
    pip3 install pandas openpyxl --quiet
}

# Run the build
python3 build.py

echo ""
read -p "  Press Enter to close..."
