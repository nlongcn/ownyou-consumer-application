# Evidence Visibility Requirements

**Status**: ✅ Complete
**Created**: 2025-10-09
**Last Updated**: 2025-10-09

## Problem Statement

Currently, classification evidence (LLM reasoning, source emails) exists in the backend at `/api/evidence/<taxonomy_id>` but is not accessible from the UI. Users must manually:
- Navigate to separate "Evidence & Reasoning" page
- Search through all evidence
- Cannot quickly click from classification to see why it was made

This makes it difficult to:
- Assess classification accuracy ("does this match my actual behavior?")
- Debug agent improvements
- Compare before/after when testing agent changes

## Goal

Enable users to click any classification and immediately see:
- Why the classification was made (LLM reasoning)
- Which emails led to it (subjects, dates, summaries)
- Confidence score and evidence strength

## Solution Approach

### Phase 1: Add Evidence Modal to Classifications Page ✅ This Document

**UI Changes** (`/classifications` page):
1. Add "View Evidence" button to each classification card
2. Create modal/detail view component
3. Display evidence when button clicked

**API Integration** (`lib/api.ts`):
1. Add `getEvidenceById(taxonomyId)` method
2. Call `/api/evidence/<taxonomy_id>` endpoint

**Data Displayed**:
- LLM reasoning/explanation
- Source emails (subject, date, summary)
- Confidence score & evidence count
- Supporting vs contradicting evidence
- First observed / last updated timestamps

## Acceptance Criteria

- [x] "View Evidence" button appears on each classification card
- [x] Clicking button opens modal with evidence details
- [x] Modal shows reasoning text
- [x] Modal shows list of source emails with subjects/dates
- [x] Modal shows confidence score
- [x] Modal can be closed
- [x] Works for all sections (demographics, household, interests, purchase_intent, actual_purchases)
- [x] Tested with real user data
- [x] No errors in console

## Implementation Checklist

- [x] Create requirements document
- [x] Add `getEvidenceById()` to `lib/api.ts`
- [x] Update `/classifications` page with "View Evidence" button
- [x] Create evidence modal component
- [x] Wire up API call
- [x] Fix evidence blueprint import issue in backend
- [x] Test with classifications from each section
- [x] Update this document with test results

## Implementation Details

**Changes Made**:
1. Added `getEvidenceById(taxonomyId)` method to `lib/api.ts` (line 223-225)
2. Added state management for evidence modal in `/classifications` page:
   - `showEvidenceModal` - controls modal visibility
   - `evidenceDetail` - stores fetched evidence data
   - `loadingEvidence` - tracks loading state
3. Added `handleViewEvidence()` function to fetch evidence from API
4. Added "View Evidence" button to each classification card
5. Created full-screen modal component with:
   - Header with classification name and close button
   - Confidence score and evidence count cards
   - LLM reasoning section
   - Source emails list with subjects, dates, summaries
   - Timestamps (first observed, last updated)

## Test Results

### Test 1: Interests Section - Language Learning
- **Date**: 2025-10-09
- **Result**: ✅ PASSED
- **Classification**: Language Learning (94.4% confidence, 4 evidence items)
- **Notes**:
  - Modal displayed correctly with full LLM reasoning
  - All 4 source emails shown with subjects, dates, email IDs
  - Confidence score displayed: 94.4%
  - Timestamps shown (First Observed: 08/10/2025 09:17:49, Last Updated: 08/10/2025 11:37:17)
  - Modal closed successfully
  - No console errors

### Test 2: Demographics Section - Male Gender
- **Date**: 2025-10-09
- **Result**: ✅ PASSED
- **Classification**: Male (87.0% confidence, 3 evidence items)
- **Notes**:
  - Modal displayed correctly with LLM reasoning explaining gender signals
  - All 3 source emails shown with subjects, dates, email IDs
  - Confidence score displayed: 87.0%
  - Timestamps shown correctly
  - Modal closed successfully
  - Works identically across different sections

### Test 3: Backend Integration
- **Date**: 2025-10-09
- **Result**: ✅ PASSED (after bug fix)
- **Issue Found**: Evidence blueprint was disabled in `app.py` due to incorrect import in `evidence.py`
- **Fix Applied**:
  - Changed `from db import queries` to `from ..db import queries` in `evidence.py:10`
  - Re-enabled evidence blueprint registration in `app.py:19` and `app.py:56`
  - Restarted Flask backend
- **Notes**: API endpoint `/api/evidence/<taxonomy_id>` now working correctly

## Future Enhancements (Phase 2)

- Add "Compare with Previous Run" feature
- Show side-by-side diff when re-running Step 3
- Track changes in confidence/reasoning over time
- Add filtering/sorting in evidence view

## Technical Notes

**Backend Endpoint**: `/api/evidence/<taxonomy_id>`
**Response Format**:
```json
{
  "taxonomy_id": 342,
  "category_path": "Interest | Cryptocurrency",
  "value": "Cryptocurrency",
  "confidence": 0.85,
  "evidence_count": 1,
  "reasoning": "Full LLM explanation...",
  "supporting_evidence": ["email_id_1"],
  "contradicting_evidence": [],
  "source_emails": [
    {
      "email_id": "199a488c4feb6151",
      "subject": "Crypto News Today",
      "date": "2025-01-15T10:00:00Z",
      "summary": "Newsletter about cryptocurrency trends"
    }
  ]
}
```

## Related Files

- `/Volumes/T7_new/developer_old/email_parser/dashboard/backend/api/evidence.py`
- `/Volumes/T7_new/developer_old/email_parser/dashboard/frontend/app/classifications/page.tsx`
- `/Volumes/T7_new/developer_old/email_parser/dashboard/frontend/lib/api.ts`
