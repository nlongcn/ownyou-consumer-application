# Old Email CSVs Archive

**Archived:** 2025-10-13
**Reason:** Historical processed email CSV files from earlier testing

## Contents

This folder contains processed email CSV files from earlier development and testing sessions:

- `emails_processed.csv` - Combined email processing output
- `gmail_emails_processed.csv` - Gmail-specific processed emails
- `outlook_emails_processed.csv` - Outlook-specific processed emails

## Current Data Storage

Current email data is stored in:
- `/data/` - Current test CSV files and databases
- Timestamped files (e.g., `test_final_validation.csv`)
- Databases with user-specific identifiers

### Data Flow

```
1. Email Download → CSV with raw email data
2. Summarization → CSV with email summaries
3. IAB Classification → JSON profile + Database storage
```

## Why Archived?

These CSV files are archived because:
1. They contain data from earlier testing sessions
2. Current system generates timestamped output files
3. The data has been superseded by newer test runs
4. Files lack context (no timestamp, no user ID)

## Safe to Delete?

Yes, these files can be safely deleted as:
- They are not referenced by any active code
- The data is not current or actively used
- New test runs generate fresh data

---

**Note:** If you need to recover historical email data, check git history before deleting.
