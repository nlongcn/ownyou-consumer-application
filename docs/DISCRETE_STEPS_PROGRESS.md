# Discrete Steps Implementation Progress

**Last Updated:** October 8, 2025
**Status:** ✅ Implementation Complete (Phases 1-3)

---

## Implementation Checklist

### Phase 1: CLI & Core Logic ✅ COMPLETED

- [x] **Step 1.1:** Add CLI flags to `src/email_parser/main.py`
  - Added: `--summarize-only`, `--input-csv`, `--email-model`, `--taxonomy-model`
  - Updated help examples with discrete step workflow
  - File: `src/email_parser/main.py` lines 1487-1510
  - Commit: 5428894

- [x] **Step 1.2:** Add CSV helper functions
  - File: `src/email_parser/main.py` lines 1088-1250
  - Functions added:
    - `load_raw_emails_from_csv(csv_path: str) -> List[RawEmail]` (lines 1088-1157)
    - `load_summaries_from_csv(csv_path: str) -> List[ProcessedEmail]` (lines 1159-1250)
  - Auto-detects CSV format and validates required columns
  - Commit: 5428894

- [x] **Step 1.3:** CSV format handling (no model changes needed)
  - Implemented via helper functions in Step 1.2
  - Auto-detection handles both raw and summaries formats
  - Commit: 5428894

- [x] **Step 1.4:** Implement `--summarize-only` execution logic
  - File: `src/email_parser/main.py` lines 1794-1835
  - Validates --input-csv, loads raw emails, applies model override
  - Processes with EMAIL_MODEL, exports to CSV, exits cleanly
  - Commit: 5428894

- [x] **Step 1.5:** Update `--iab-csv` to support summaries CSV
  - File: `src/email_parser/main.py` lines 1845-1872
  - Auto-detects CSV format (checks for 'Summary' column)
  - Supports --taxonomy-model override
  - Commit: 5428894

### Phase 2: Dashboard Backend API ✅ COMPLETED

- [x] **Step 2.1:** Add discrete step endpoints to `dashboard/backend/api/analyze.py`
  - Endpoints added:
    - `POST /api/analyze/download` (Step 1) - lines 241-351
    - `POST /api/analyze/summarize` (Step 2) - lines 354-457
    - `POST /api/analyze/classify` (Step 3) - lines 460-570
  - Each endpoint creates subprocess with appropriate CLI flags
  - Validates inputs, tracks jobs, returns job_id and output_file

- [x] **Step 2.2:** Update job tracking for multi-step workflows
  - Modified `running_jobs` dict to track:
    - Current step ('download'/'summarize'/'classify')
    - Checkpoint files (raw_csv, summaries_csv, profile_json)
    - Step-specific status and model info
  - Updated `/status` endpoint (lines 947-977) to return step metadata
  - Updated `/jobs` endpoint (lines 1047-1072) to include step info

- [x] **Step 2.3:** Model selection endpoint
  - Already exists: `GET /api/analyze/models` (lines 30-206)
  - Returns EMAIL_MODEL and TAXONOMY_MODEL separately
  - Supports per-step model selection via request parameters

### Phase 3: Frontend UI ✅ COMPLETED

- [x] **Step 3.1:** Update analyze page with step-by-step UI
  - File: `dashboard/frontend/app/analyze/page.tsx` (914 lines, +582 additions)
  - Added mode switcher: "Full Pipeline" | "Step-by-Step" tabs (lines 343-365)
  - Step-by-step mode: 3 expandable cards with status tracking (lines 689-910)
  - Prerequisites validation: Warning banners for missing input files
  - Auto-population: Outputs from previous steps auto-fill next step inputs

- [x] **Step 3.2:** Add model selection per step
  - EMAIL_MODEL dropdown for Step 2 (lines 787-810)
  - TAXONOMY_MODEL dropdown for Step 3 (lines 858-881)
  - Model selection persists from full pipeline mode

### Phase 4: Testing ⏳ READY FOR TESTING

- [ ] **Step 4.1:** Create integration test
  - File: `tests/test_discrete_steps.py` (to be created)
  - Test full pipeline: Step 1 → Step 2 → Step 3
  - Test model overrides
  - Test checkpoint file passing

- [ ] **Step 4.2:** Backward compatibility test
  - Verify existing `--iab-csv raw.csv` still works
  - Verify full pipeline mode unchanged

---

## Quick Resume Guide

### Current State: Implementation Complete, Ready for Testing

**What's Done:**
- ✅ Phase 1: CLI & Core Logic (Commit: 5428894)
  - All discrete step flags implemented
  - CSV I/O helpers functional
  - Auto-detection working
- ✅ Phase 2: Dashboard Backend API (Commit: e365eee)
  - Three discrete step endpoints: /download, /summarize, /classify
  - Job tracking updated with step metadata
  - Status endpoints return checkpoint file info
- ✅ Phase 3: Frontend UI (Ready to commit)
  - Step-by-step mode with 3-step cards
  - Auto-population of inputs from previous outputs
  - Model selection per step
  - Prerequisites validation

**Next Steps:**
1. **Commit frontend implementation**
2. **Manual testing** - Try step-by-step mode in browser (http://localhost:3001/analyze)
3. **Optional: Create integration tests** (Step 4.1-4.2)

**CLI Test Commands:**
```bash
# Test Step 1 (Download)
python -m src.email_parser.main --provider gmail --max-emails 10 --output data/raw.csv

# Test Step 2 (Summarize)
python -m src.email_parser.main --summarize-only --input-csv data/raw.csv --output data/summaries.csv

# Test Step 3 (Classify)
python -m src.email_parser.main --iab-csv data/summaries.csv --iab-output data/profile.json --user-id test
```

**API Test Commands:**
```bash
# Ensure backend is running on port 5001
# Test Step 1 API
curl -X POST http://localhost:5001/api/analyze/download \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"provider": "gmail", "max_emails": 10}'

# Test Step 2 API
curl -X POST http://localhost:5001/api/analyze/summarize \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"input_csv": "data/raw_user_123_20251008_120000.csv", "email_model": "google:gemini-2.0-flash-exp"}'

# Test Step 3 API
curl -X POST http://localhost:5001/api/analyze/classify \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"input_csv": "data/summaries_user_123_20251008_120500.csv", "taxonomy_model": "openai:gpt-4o-mini"}'

# Check job status
curl http://localhost:5001/api/analyze/status/<job_id> -H "Cookie: session=..."
```

---

## Implementation Notes

### CSV Format Specifications

**Step 1 Output (Raw Emails):**
```csv
ID,Date,From,Subject,body_plain,provider
msg123,2025-10-08,sender@example.com,Hello,Email body text,gmail
```

**Step 2 Output (Summaries):**
```csv
ID,Date,From,Subject,Summary,Category,Products,Status
msg123,2025-10-08,sender@example.com,Hello,Email summary,Personal,,completed
```

**Step 3 Input:** Either format (auto-detected by checking for 'Summary' column)

### Model Override Priority

1. **CLI argument** (highest)
   - `--email-model google:gemini-2.0-flash-exp`
2. **.env file** (fallback)
   - `EMAIL_MODEL=google:gemini-2.0-flash-exp`
3. **Error** (no default)

### Key Design Decisions

1. **Backward Compatibility:** Existing `--iab-csv` command auto-detects CSV format
2. **Checkpoint Files:** Named with timestamp for easy identification
3. **State Persistence:** CSV files act as checkpoints between steps
4. **Error Handling:** Each step validates prerequisites before execution

---

## Dependencies Between Steps

```
Step 1 (Download)
  ↓ produces: raw_emails.csv
Step 2 (Summarize)
  ↓ produces: summaries.csv
Step 3 (Classify)
  ↓ produces: profile.json
```

**Important:**
- Step 2 requires Step 1 output OR existing raw CSV
- Step 3 requires Step 2 output OR existing raw CSV (will auto-summarize)
- Can skip Step 2 if using legacy workflow (backward compat)

---

## Commit Strategy

**Commit after each major step:**

1. After Step 1.1: "Add CLI flags for discrete Step 2 control"
2. After Step 1.5: "Implement discrete 3-step CLI workflow"
3. After Step 2.3: "Add dashboard API endpoints for discrete steps"
4. After Step 3.2: "Add frontend UI for step-by-step analysis"
5. After Step 4.2: "Add tests for discrete step workflow"

---

## Troubleshooting

### CSV Format Issues

**Problem:** Step 2 can't read raw CSV
**Solution:** Check CSV has required columns: `ID`, `body_plain`
**Debug:** `python -c "import pandas as pd; print(pd.read_csv('raw.csv').columns)"`

**Problem:** Step 3 can't read summaries CSV
**Solution:** Check CSV has `Summary` column
**Debug:** `python -c "import pandas as pd; df = pd.read_csv('summaries.csv'); print('Summary' in df.columns)"`

### Model Override Not Working

**Problem:** CLI `--email-model` ignored
**Solution:** Check format is `provider:model` (e.g., `google:gemini-2.0-flash-exp`)
**Debug:** Add logging to show which model is being used

---

**End of Progress Document**

This document will be updated as implementation progresses.
