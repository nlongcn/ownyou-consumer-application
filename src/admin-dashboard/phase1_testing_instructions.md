# Phase 1 Fixes - Manual Testing Instructions
**Date:** 2025-11-13
**Status:** Fixes implemented, ready for manual testing

---

## What Was Fixed

### Fix #1: Stop Sending Raw Email Bodies to Workflow ✅
- **Location**: `app/emails/page.tsx:565-567`
- **Change**: Removed `body` field, only send `summary` to classifier
- **Impact**: 10x-20x token reduction

### Fix #2: Display Summaries in UI ✅
- **Location**: `app/emails/page.tsx:1084-1091`
- **Change**: Display `email.summary` instead of `email.body`
- **Impact**: Users see clean LLM summaries, not HTML gibberish

### Fix #3: Add Verification Logging ✅
- **Location**: `app/emails/page.tsx:540-553`
- **Change**: Added batch preparation logging
- **Impact**: Can verify summaries are populated

---

## Testing Steps

### Prerequisites

1. **Clear Browser Cache**:
   - Open DevTools (F12)
   - Application tab → Storage → Clear site data
   - This ensures fresh classifications

2. **Verify Dev Server Running**:
   - Navigate to http://localhost:3001/emails
   - Page should load without errors

### Test Execution

**Step 1: Configure Settings**

1. Select **Email Provider**: Gmail Only (or your preferred provider)
2. Set **Maximum Emails**: 5 (for faster testing)
3. Select **Email Summarization Model**: gpt-5-nano
4. Select **IAB Classification Model**: gpt-4o-mini
5. **Uncheck** "Skip summarization" (we want to test summaries)

**Step 2: Download & Classify Emails**

1. Click "Connect Gmail & Download" (or Outlook)
2. Complete OAuth flow if prompted
3. Wait for download to complete
4. Wait for summarization (should see progress)
5. Wait for classification (should see progress)

**Step 3: Verify Expected Behavior**

Open browser DevTools Console (F12 → Console) and look for:

#### ✅ Verification Logging (Fix #3)

Should see logs like:
```
📧 [Stage 3] Preparing batch for classification: {
  batch: 1,
  total_batches: 1,
  email_count: 5,
  summaries_present: 5,  // ← All emails should have summaries
  sample_emails: [
    {
      id: "...",
      subject: "...",
      has_summary: true,  // ← Each email has summary
      summary_length: 245,  // ← Length in characters
      summary_preview: "Tripadvisor promotes a dog-friendly..."  // ← Clean text
    },
    { has_summary: true, summary_length: 312, ... }
  ]
}
```

**❌ FAILURE INDICATORS:**
- `summaries_present: 0` → Summarization failed
- `has_summary: false` → Email missing summary
- `summary_preview: 'NO SUMMARY'` → Empty summaries

#### ✅ UI Displays Summaries (Fix #2)

After emails are classified, scroll down to email list and verify:

**CORRECT (After Fix):**
- Email content shows clean, readable summaries
- Example: _"Tripadvisor promotes a dog-friendly holiday contest sponsored by CESAR®. Users have limited time to enter the sweepstakes for a chance to win a trip."_

**WRONG (Before Fix):**
- Email content shows HTML artifacts
- Example: `"Time's running out...&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;..."`

#### ✅ Distinct Classifications (No Contamination)

Verify each email has DIFFERENT classifications:

**Expected (No Contamination):**
- Email #1 (Tripadvisor): "Travel & Tourism" or "Food & Beverage Services"
- Email #2 (Newsletter): "Education & Careers" or "Technology"
- Email #3 (Bank statement): "Finance & Banking"
- Email #4 (Shopping): "Retail & Consumer Goods"
- Email #5 (Fitness app): "Health & Fitness"

**WRONG (Contaminated):**
- All 5 emails show "1 Adult - 77% confidence"
- Multiple emails with identical reasoning
- Same confidence score across different content types

---

## Success Criteria

| Criterion | How to Verify | Expected Result |
|-----------|---------------|-----------------|
| **Summaries Populated** | Console log | `summaries_present: 5` |
| **Summaries Displayed** | Visual inspection | Clean text, no HTML `&zwnj;` artifacts |
| **Distinct Classifications** | Email list | Each email has different IAB category |
| **Token Reduction** | Network tab | Smaller API request sizes (~200 tokens vs ~2000) |
| **No Cross-Contamination** | Classifications | Different confidence scores & reasoning |

---

## Troubleshooting

### Issue: `summaries_present: 0`

**Cause**: Summarization stage failed

**Debug Steps**:
1. Check console for OpenAI API errors
2. Verify API key is valid in Settings
3. Check `email.summary` is being set after summarization
4. Verify gpt-5-nano model is accessible

### Issue: Still Seeing HTML Artifacts in UI

**Cause**: Browser cache or React state issue

**Fix**:
1. Hard refresh (Cmd+Shift+R or Ctrl+Shift+R)
2. Clear site data (DevTools → Application → Storage)
3. Restart dev server

### Issue: Identical Classifications (Contamination Persists)

**Possible Causes**:
1. Empty summaries (all emails classified based on empty text)
2. IndexedDB cache from previous run
3. Filter logic in `/api/classify` broken

**Debug Steps**:
1. Verify `summaries_present` count matches email count
2. Clear IndexedDB (DevTools → Application → IndexedDB → Delete)
3. Add more logging to `/api/classify/route.ts` (Phase 2)

---

## If Testing Passes

**Next Steps**:
1. Test remaining scenarios (invalid API key, missing key, Google provider)
2. Document architectural decision
3. Create pull request with all changes
4. Mark Phase 1 complete

---

## If Testing Fails

**Immediate Actions**:
1. Document exact failure mode with screenshots
2. Capture full console logs
3. Check Phase 2 investigation steps in `/tmp/code_review_summary.md`
4. Add additional logging to `/api/classify/route.ts`

---

## Related Documentation

- **Phase 1 Fixes Summary**: `/tmp/phase1_fixes_complete.md`
- **Code Review Summary**: `/tmp/code_review_summary.md`
- **Verification Results**: `/tmp/workflow_verification_results.md`
- **Original Code Review**: `/tmp/workflow_code_review_complete.md`

---

## Quick Reference: Where to Look

- **Console Logs**: Browser DevTools → Console tab
- **Network Requests**: Browser DevTools → Network tab (filter: `classify`)
- **Email List**: Main page, scroll down after classification
- **IndexedDB**: DevTools → Application tab → IndexedDB → ownyou-admin
- **Classification Details**: Click on any email to expand

---

**Status**: Application ready for testing at http://localhost:3001/emails

**Reminder**: Clear browser cache before testing to ensure fresh classifications.
