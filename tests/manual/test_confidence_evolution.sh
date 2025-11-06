#!/bin/bash
# Multi-Session Confidence Evolution Test
# Tests that confidence scores increase across multiple sessions

set -e

echo "=========================================="
echo "Multi-Session Confidence Evolution Test"
echo "=========================================="
echo

# Setup
TEST_DB="data/test_multi_session.db"
TEST_USER="multi_session_test"

echo "Cleaning test database..."
rm -f "$TEST_DB"
echo

# Day 1
echo "Day 1: Processing first crypto email..."
MEMORY_DATABASE_PATH="$TEST_DB" python -m src.email_parser.main \
  --iab-csv tests/manual/crypto_email_day1.csv \
  --iab-output tests/manual/day1_profile.json \
  --user-id "$TEST_USER"

DAY1_CONF=$(cat tests/manual/day1_profile.json | python -m json.tool | grep -A 5 '"taxonomy_id": 342' | grep '"confidence"' | awk '{print $2}' | tr -d ',')
DAY1_EVID=$(cat tests/manual/day1_profile.json | python -m json.tool | grep -A 6 '"taxonomy_id": 342' | grep '"evidence_count"' | awk '{print $2}' | tr -d ',')
echo "  Cryptocurrency confidence: $DAY1_CONF"
echo "  Evidence count: $DAY1_EVID"
echo

# Day 2
echo "Day 2: Processing second crypto email..."
MEMORY_DATABASE_PATH="$TEST_DB" python -m src.email_parser.main \
  --iab-csv tests/manual/crypto_email_day2.csv \
  --iab-output tests/manual/day2_profile.json \
  --user-id "$TEST_USER"

DAY2_CONF=$(cat tests/manual/day2_profile.json | python -m json.tool | grep -A 5 '"taxonomy_id": 342' | grep '"confidence"' | awk '{print $2}' | tr -d ',')
DAY2_EVID=$(cat tests/manual/day2_profile.json | python -m json.tool | grep -A 6 '"taxonomy_id": 342' | grep '"evidence_count"' | awk '{print $2}' | tr -d ',')
echo "  Cryptocurrency confidence: $DAY2_CONF (was $DAY1_CONF)"
echo "  Evidence count: $DAY2_EVID (was $DAY1_EVID)"
echo

# Day 3
echo "Day 3: Processing third crypto email..."
MEMORY_DATABASE_PATH="$TEST_DB" python -m src.email_parser.main \
  --iab-csv tests/manual/crypto_email_day3.csv \
  --iab-output tests/manual/day3_profile.json \
  --user-id "$TEST_USER"

DAY3_CONF=$(cat tests/manual/day3_profile.json | python -m json.tool | grep -A 5 '"taxonomy_id": 342' | grep '"confidence"' | awk '{print $2}' | tr -d ',')
DAY3_EVID=$(cat tests/manual/day3_profile.json | python -m json.tool | grep -A 6 '"taxonomy_id": 342' | grep '"evidence_count"' | awk '{print $2}' | tr -d ',')
echo "  Cryptocurrency confidence: $DAY3_CONF (was $DAY2_CONF)"
echo "  Evidence count: $DAY3_EVID (was $DAY2_EVID)"
echo

# Verification
echo "=========================================="
echo "Verification"
echo "=========================================="
echo "Confidence evolution: $DAY1_CONF → $DAY2_CONF → $DAY3_CONF"
echo "Evidence count evolution: $DAY1_EVID → $DAY2_EVID → $DAY3_EVID"
echo

# Check monotonic increase
if (( $(echo "$DAY1_CONF < $DAY2_CONF" | bc -l) )) && (( $(echo "$DAY2_CONF < $DAY3_CONF" | bc -l) )); then
    echo "✅ PASS: Confidence increases monotonically"
else
    echo "❌ FAIL: Confidence did not increase monotonically"
    exit 1
fi

if [ "$DAY1_EVID" -eq 1 ] && [ "$DAY2_EVID" -eq 2 ] && [ "$DAY3_EVID" -eq 3 ]; then
    echo "✅ PASS: Evidence count increases correctly"
else
    echo "❌ FAIL: Evidence count incorrect"
    exit 1
fi

echo
echo "=========================================="
echo "Multi-Session Test PASSED"
echo "=========================================="
