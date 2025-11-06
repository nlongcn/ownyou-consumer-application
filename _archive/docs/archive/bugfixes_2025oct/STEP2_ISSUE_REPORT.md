# Step 2 (Summarize) API Route 404 Error - Detailed Report

**Date:** October 9, 2025
**Issue:** Step 2 (Summarize Emails) consistently fails with "API request failed" error in the browser

---

## Problem Summary

When users click "Run Step 2" in the Step-by-Step Analysis view, the request to `/api/analyze/summarize` returns a 404 error, causing the frontend to display "API request failed". This prevents users from progressing through the discrete workflow pipeline.

### Symptoms
- ✅ Step 1 (Download) works correctly
- ❌ Step 2 (Summarize) fails with 404 error
- ❓ Step 3 (Classify) - untested due to Step 2 failure
- **Error message shown to user:** "API request failed"
- **Browser console error:** `Failed to load resource: the server responded with a status of 404 (NOT FOUND)`
- **Next.js server log:** `POST /api/analyze/summarize 404 in 90ms`

---

## Architecture Context

### Frontend Structure
- **Framework:** Next.js 14.2.33 with App Router
- **API Client:** `dashboard/frontend/lib/api.ts`
  - Uses `API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || ''` (empty string = same origin)
  - All requests go through `fetch()` with `credentials: 'include'` for session cookies

### Backend Structure
- **Framework:** Flask running on port 5001
- **Endpoint:** `/api/analyze/summarize` (POST)
- **Authentication:** Session-based with cookies

### Routing Architecture
Next.js frontend proxies API requests to Flask backend using two approaches:

1. **Catch-all proxy route:** `app/api/[...path]/route.ts`
   - Should handle all `/api/*` requests
   - Forwards to Flask at `http://127.0.0.1:5001/api/{path}`

2. **Specific route handlers:** (created during debugging)
   - `app/api/analyze/download/route.ts` ✅ WORKS
   - `app/api/analyze/summarize/route.ts` ❌ FAILS
   - `app/api/analyze/classify/route.ts` ❓ UNTESTED
   - `app/api/analyze/status/[jobId]/route.ts` ❓ UNTESTED

---

## Timeline of Investigation & Attempted Fixes

### Initial Discovery
1. **Root Cause Identified:** Next.js 14 App Router doesn't proxy client-side `fetch()` calls through `next.config.js` rewrites
   - Rewrites only work for server-side navigation, not client-side API calls
   - This explains why direct browser requests fail

### Attempted Fix #1: Create App Router Proxy Routes
**Action:** Created explicit proxy route files in `app/api/analyze/`
- Created `summarize/route.ts`
- Created `classify/route.ts`
- Created `download/route.ts`
- Created `status/[jobId]/route.ts`

**Result:** ❌ Failed - Still getting 404 errors for summarize and classify

**Evidence:**
```
✓ Compiled /api/analyze/summarize in 84ms (279 modules)
POST /api/analyze/summarize 404 in 127ms
```

### Attempted Fix #2: Test Routes with curl
**Action:** Tested API routes directly with curl to verify they work

**Commands & Results:**
```bash
# Test download route
curl -X POST http://localhost:3000/api/analyze/download \
  -H "Content-Type: application/json" \
  -d '{"provider": "gmail", "max_emails": 5}'
# Result: 401 UNAUTHORIZED (reached Flask ✅)

# Test summarize route
curl -X POST http://localhost:3000/api/analyze/summarize \
  -H "Content-Type: application/json" \
  -d '{"input_csv": "test.csv", "email_model": "gpt-4"}'
# Result: 401 UNAUTHORIZED (reached Flask ✅)
```

**Conclusion:** Routes ARE working when tested directly with curl, but fail from browser

### Attempted Fix #3: Discovered Duplicate Routes
**Action:** Restarted Next.js server and noticed duplicate route warnings

**Warning Messages:**
```
⚠ Duplicate page detected. pages/api/analyze/classify.ts and app/api/analyze/classify/route.ts
   resolve to /api/analyze/classify
⚠ Duplicate page detected. pages/api/analyze/summarize.ts and app/api/analyze/summarize/route.ts
   resolve to /api/analyze/summarize
⚠ Duplicate page detected. pages/api/analyze/status/[jobId].ts and
   app/api/analyze/status/[jobId]/route.ts resolve to /api/analyze/status/[jobId]
```

**Analysis:** Both Pages Router and App Router versions exist, causing conflicts

### Attempted Fix #4: Remove Pages Router Duplicates
**Action:** Deleted Pages Router API routes

```bash
rm -rf /Volumes/T7_new/developer_old/email_parser/dashboard/frontend/pages/api/analyze
```

**Result:** ❌ Failed - Duplicate warnings persist, 404 errors continue

**Note:** Verified files are deleted with `find` command, but Next.js still shows warnings (likely cached build artifacts)

### Attempted Fix #5: Server Restart
**Action:** Killed and restarted Next.js dev server to clear cache

**Result:** ❌ Failed - Still showing duplicate warnings and 404 errors

---

## Current State

### File Structure
```
dashboard/frontend/
├── app/
│   └── api/
│       ├── [...path]/route.ts          # Catch-all proxy (should handle all requests)
│       └── analyze/
│           ├── download/route.ts       # ✅ Works
│           ├── summarize/route.ts      # ❌ Returns 404
│           ├── classify/route.ts       # ❓ Untested
│           └── status/[jobId]/route.ts # ❓ Untested
└── pages/
    └── api/
        └── (deleted)
```

### Server Logs Evidence
```
POST /api/analyze/download 200 in 182ms  ✅ Works
POST /api/analyze/summarize 404 in 90ms  ❌ Fails
```

### Browser Behavior
1. Step 1 (Download) completes successfully
2. Step 2 input field auto-populates with output from Step 1
3. User clicks "Run Step 2"
4. Browser makes POST request to `/api/analyze/summarize`
5. Request returns 404
6. Frontend catches error and displays "API request failed"
7. No job is created, workflow is blocked

---

## Key Observations

### What Works
- ✅ Step 1 (Download Emails) works perfectly
- ✅ curl requests to `/api/analyze/summarize` reach Flask (return 401 auth error)
- ✅ curl requests to `/api/analyze/download` reach Flask and work
- ✅ The catch-all route exists and appears correctly implemented
- ✅ Specific route files exist with identical structure to working routes

### What Doesn't Work
- ❌ Browser requests to `/api/analyze/summarize` return 404
- ❌ Browser requests to `/api/analyze/classify` return 404 (based on earlier tests)
- ❌ Duplicate route warnings persist despite deleting Pages Router files

### Critical Discrepancy
**curl (command line) vs. Browser:**
- curl → `/api/analyze/summarize` → 401 (reaches Flask) ✅
- Browser → `/api/analyze/summarize` → 404 (doesn't reach Flask) ❌

This suggests a **routing precedence issue** or **session/cookie handling problem** specific to browser requests.

---

## Code Comparison

### Working Route (download/route.ts)
```typescript
export async function POST(request: NextRequest) {
  const body = await request.text();
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'host') {
      headers.set(key, value);
    }
  });
  const response = await fetch(`${FLASK_API_URL}/api/analyze/download`, {
    method: 'POST',
    headers,
    body,
    credentials: 'include',
  });
  // ... response handling
}
```

### Failing Route (summarize/route.ts)
```typescript
export async function POST(request: NextRequest) {
  const body = await request.text();
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'host') {
      headers.set(key, value);
    }
  });
  const response = await fetch(`${FLASK_API_URL}/api/analyze/summarize`, {
    method: 'POST',
    headers,
    body,
    credentials: 'include',
  });
  // ... response handling
}
```

**Difference:** Only the Flask endpoint URL differs (intentionally). Structure is identical.

---

## Theories & Hypotheses

### Theory 1: Route Precedence Conflict
The catch-all route `app/api/[...path]/route.ts` may be intercepting some requests before they reach the specific routes. In Next.js App Router, specific routes should take precedence, but there may be an edge case.

**Evidence:**
- Catch-all route exists and is compiled
- Specific routes exist and are compiled
- Only some routes work (download) while others fail (summarize, classify)

### Theory 2: Next.js Build Cache Corruption
Despite deleting Pages Router files, Next.js continues showing duplicate warnings. The build cache may be corrupted.

**Evidence:**
- Duplicate warnings persist after file deletion
- `find` command confirms files are deleted
- Restarting server doesn't clear warnings

### Theory 3: Specific Route Name Conflict
The words "summarize" and "classify" may conflict with Next.js reserved words or internal routing logic, while "download" does not.

**Evidence:**
- "download" works consistently
- "summarize" and "classify" fail consistently
- All routes have identical code structure

### Theory 4: Request Timing or Race Condition
The browser may be making requests before the routes are fully registered, causing intermittent 404s.

**Evidence:**
- Next.js logs show: `✓ Compiled /api/analyze/summarize in 84ms (279 modules)`
- Followed immediately by: `POST /api/analyze/summarize 404 in 90ms`
- But sometimes routes work (as evidenced by earlier successful tests)

---

## Recommended Next Steps

### Immediate Actions
1. **Clear Next.js cache completely:**
   ```bash
   rm -rf .next
   rm -rf node_modules/.cache
   npm run dev
   ```

2. **Remove specific routes and rely solely on catch-all:**
   ```bash
   rm -rf app/api/analyze
   # Keep only app/api/[...path]/route.ts
   ```

3. **Add detailed logging to catch-all route:**
   ```typescript
   console.log(`[Proxy] ${request.method} /api/${apiPath} -> ${url}`)
   ```

4. **Check for Pages Router remnants:**
   ```bash
   find . -path ./node_modules -prune -o -name "*.ts" -type f | xargs grep -l "pages/api"
   ```

### Debugging Steps
1. Add console.log to browser to see exact request being made
2. Add console.log to Next.js routes to see which route is handling request
3. Check Network tab in browser DevTools for request headers
4. Compare working (download) vs failing (summarize) requests in Network tab

### Alternative Approaches
1. **Use Next.js middleware** instead of API routes for proxying
2. **Configure CORS on Flask** and call Flask directly from browser
3. **Use next.config.js async rewrites** (requires experimental features)
4. **Implement a single catch-all route** at `/api/[...path]` only

---

## Impact Assessment

### User Impact
- **Severity:** HIGH - Blocks entire discrete workflow
- **Workaround:** None - users cannot test different models without re-downloading emails
- **Affected Users:** All users attempting to use Step-by-Step mode

### Development Impact
- **Time Spent:** ~3 hours of debugging
- **Code Created:** 4 new API proxy route files
- **Rollback Complexity:** Low - can revert to catch-all only

---

## Files Modified During Investigation

### Created
- `app/api/analyze/download/route.ts`
- `app/api/analyze/summarize/route.ts`
- `app/api/analyze/classify/route.ts`
- `app/api/analyze/status/[jobId]/route.ts`

### Deleted
- `pages/api/analyze/*` (entire directory)

### Not Modified (but analyzed)
- `app/api/[...path]/route.ts` (catch-all proxy)
- `lib/api.ts` (API client)
- `app/analyze/page.tsx` (UI component)

---

## Conclusion

Despite creating explicit proxy routes and removing duplicate Pages Router files, Step 2 (Summarize) continues to fail with 404 errors in the browser while working correctly via curl. The root cause appears to be a **routing conflict or precedence issue** in Next.js App Router, potentially related to:

1. Catch-all route vs specific route precedence
2. Build cache corruption with duplicate route warnings
3. Specific route names conflicting with Next.js internals
4. Request timing or registration race conditions

The most promising next step is to **clear the Next.js build cache completely** and **rely solely on the catch-all route** rather than maintaining both catch-all and specific routes.
