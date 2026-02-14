#!/bin/bash
# PriceWatch Scraper - Unix runner
# Run with: ./run-scraper.sh

cd "$(dirname "$0")/.."

echo "==================================================="
echo "  PriceWatch Scraper"
echo "==================================================="
echo

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed!"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Run the scraper
echo "Starting scraper..."
echo
npx tsx src/entry/cli.ts run --all

echo
echo "==================================================="
echo "Done!"
echo "==================================================="
