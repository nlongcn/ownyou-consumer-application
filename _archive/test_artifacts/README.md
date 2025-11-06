# Test Artifacts Archive

**Archived:** 2025-10-13
**Reason:** Temporary test output files from development sessions

## Contents

This folder contains test output files, debug data, and temporary test artifacts generated during development and testing. These files represent point-in-time test results and debugging sessions.

### File Categories

**Test JSON Output Files:**
- `test_*.json` - Various test run outputs
- `final_*.json` - Final integration test results
- `verify_*.json` - Verification test outputs
- `user_123_*.json` - User-specific test profiles

**Test CSV Files:**
- `test_*.csv` - Test input data and results

**Tracking & Debug Files:**
- `tracker_*.json` - Development tracking artifacts
- `tracking_demo*.json` - Demonstration outputs
- `taxonomy_fix_*.json` - Taxonomy debugging outputs

## Current Testing

For current testing practices, see:
- `/tests/` - Active test suite with pytest
- `/docs/development/TESTING_STRATEGY.md` - Comprehensive testing strategy
- `/data/` - Current test databases and profiles

### Running Current Tests

```bash
# Run full test suite
pytest

# Run with coverage
pytest --cov=src

# Run specific test category
pytest tests/unit/
pytest tests/integration/
```

## Why Archived?

These files are archived because they:
1. Represent one-time test runs from specific dates
2. Are not part of the automated test suite
3. Were used for manual debugging and verification
4. Are superseded by current test data in `/data/`

## Safe to Delete?

Yes, these files can be safely deleted as they:
- Are not referenced by any active code
- Represent historical test runs only
- Have been superseded by current test infrastructure

---

**Note:** Before deleting, ensure all current tests pass and the system functions correctly.
