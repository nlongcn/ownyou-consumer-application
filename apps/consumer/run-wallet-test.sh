#!/bin/bash

# Wallet Persistence Test Runner
# Run this script to execute the automated Playwright test

set -e

echo "=================================================="
echo "OwnYou Consumer - Wallet Persistence Test"
echo "=================================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
  echo "ERROR: Must be run from apps/consumer directory"
  exit 1
fi

# Check if dev server is running
echo "Checking if dev server is running on port 3002..."
if ! curl -s http://localhost:3002 > /dev/null; then
  echo ""
  echo "ERROR: Dev server is not running on port 3002"
  echo "Please start the dev server first:"
  echo "  pnpm dev"
  echo ""
  exit 1
fi
echo "✓ Dev server is running"
echo ""

# Check if Playwright is installed
if [ ! -d "node_modules/@playwright/test" ]; then
  echo "Installing Playwright..."
  pnpm add -D @playwright/test
  echo ""
fi

# Install browsers if needed
echo "Checking Playwright browsers..."
if ! npx playwright --version > /dev/null 2>&1; then
  echo "Installing Playwright browsers..."
  npx playwright install chromium
  echo ""
fi
echo "✓ Playwright is ready"
echo ""

# Create test-results directory
mkdir -p test-results

# Run the test
echo "Running wallet persistence test..."
echo "=================================================="
echo ""

npx playwright test e2e/wallet-persistence.spec.ts --reporter=list

echo ""
echo "=================================================="
echo "Test Complete!"
echo ""
echo "Screenshots saved to: test-results/"
echo "  - wallet-before-auth.png"
echo "  - wallet-after-auth.png"
echo "  - wallet-after-reload.png"
echo ""
echo "To view the full HTML report, run:"
echo "  npx playwright show-report"
echo ""
