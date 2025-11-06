# Archive Directory

**Archived:** 2025-10-13
**Purpose:** Storage for deprecated files, old test artifacts, and historical data

## Contents

This directory contains files that have been archived from the project root to maintain a clean and organized codebase. All files here are preserved for historical reference and potential recovery but are not actively used by the current system.

### Subdirectories

- **legacy_scripts/** - Deprecated Python scripts superseded by the unified CLI (`src/email_parser/main.py`)
- **test_artifacts/** - Test output files, debug JSON files, and temporary test data
- **old_logs/** - Historical log files from development and testing sessions
- **old_email_csvs/** - Processed email CSV files from earlier testing
- **old_credentials/** - Deprecated OAuth token files (replaced by current tokens in root)
- **temp_files/** - Temporary files created by external tools (e.g., Excel temp files)

## Safe to Delete?

All files in this directory are candidates for deletion. Before permanently removing:

1. **Review contents** to ensure nothing critical was mistakenly archived
2. **Check git history** if you need to recover any archived files
3. **Verify current system** works correctly without these files
4. **Create a backup** if uncertain

## Current Active Files

For current, active project files, see:
- `/src/` - Source code
- `/data/` - Current data and databases
- `/logs/` - Active session logs
- `/docs/` - Current documentation
- Root directory - Essential configuration files

---

**Note:** This archive was created during repository cleanup to remove clutter while preserving historical artifacts for potential reference.
