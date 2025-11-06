# Old Logs Archive

**Archived:** 2025-10-13
**Reason:** Historical log files from development and testing sessions

## Contents

This folder contains log files from various development and testing sessions. These logs captured debugging information, test runs, and system behavior during active development.

### Log Categories

**Agent Testing Logs:**
- `agent_test_output*.log` - Agent testing outputs
- `agent_validation_*.log` - Agent validation test logs

**Chat Logs:**
- `chat_logs_*.txt` - Interactive session logs from October 2024

**System Logs:**
- `email_parser.log*` - Rotated email parser logs
- `email_log.csv` - Email processing log entries
- `detailed_log.txt` - Detailed debugging log

**Test Run Logs:**
- `test_e2e_pipeline.log` - End-to-end pipeline test log
- `test_validation.log` - Validation test log
- `user_123_reprocess*.log` - User reprocessing logs

## Current Logging

Current log files are stored in:
- `/logs/` - Active structured logging directory
- Uses timestamped files: `structured_YYYYMMDD_HHMMSS.jsonl`
- Configured in `src/email_parser/utils/logger_setup.py`

### Viewing Current Logs

```bash
# List recent logs
ls -lt logs/

# Follow current log
tail -f logs/structured_*.jsonl

# Search logs
grep "ERROR" logs/*.jsonl
```

## Why Archived?

These log files are archived because:
1. They represent completed development sessions
2. Issues documented in these logs have been resolved
3. Current logging uses a different format (structured JSONL)
4. They are not referenced by any active debugging efforts

## Safe to Delete?

Yes, these files can be safely deleted as:
- All logged issues have been resolved or documented elsewhere
- Current system uses new logging infrastructure
- Historical debugging context has been captured in documentation

---

**Note:** If investigating historical issues, these logs may provide useful context. Otherwise, they can be removed.
