# CORS Issues - Recurring Bug Documentation

**Status:** Resolved (with prevention measures)
**Last Occurrence:** 2025-10-30
**Severity:** High (blocks all API functionality)
**Root Cause:** Frontend environment misconfiguration

---

## Problem Description

### Symptoms

Browser console displays CORS error when frontend attempts to communicate with backend:

```
Access to fetch at 'http://localhost:5001/api/analyze/models?refresh=true'
from origin 'http://localhost:3000' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

**Additional Symptoms:**
- API requests fail with `TypeError: Failed to fetch`
- Network tab shows requests to `http://localhost:5001/api/...` instead of `/api/...`
- Backend is running and healthy (verified with `curl`)
- CORS headers ARE present when testing with curl, but browser still reports error

### Why This is Confusing

The error message is misleading because:
1. **Flask CORS is properly configured** - `flask-cors` is set up correctly in `dashboard/backend/app.py`
2. **CORS headers ARE being sent** - Testing with `curl -H "Origin: http://localhost:3000"` shows proper headers
3. **The real issue is the frontend bypassing the proxy** - Direct cross-origin requests trigger browser CORS

**Key Insight:** Browsers show "CORS error" for many types of failed requests, even when the actual problem is elsewhere (authentication, network, etc.). In this case, the frontend was making direct requests to Flask, which technically IS a CORS issue, but the solution is not to "fix CORS" - it's to stop making cross-origin requests entirely.

---

## Root Cause Analysis

### Architecture Context

The application uses a **Next.js API proxy pattern**:

```
Browser Request
    │
    ├─> CORRECT: http://localhost:3000/api/...
    │   └─> Next.js proxy (dashboard/frontend/app/api/[...path]/route.ts)
    │       └─> Flask backend (http://localhost:5001/api/...)
    │           ✓ Same-origin (no CORS)
    │           ✓ Session cookies work
    │           ✓ Headers preserved
    │
    └─> WRONG: http://localhost:3000 → http://localhost:5001/api/...
        ✗ Cross-origin request (triggers CORS)
        ✗ Session cookies blocked
        ✗ Preflight requests required
```

### Configuration Error

The frontend API client (`dashboard/frontend/lib/api.ts`) reads `NEXT_PUBLIC_API_URL` from environment:

```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';
```

**When `NEXT_PUBLIC_API_URL=http://localhost:5001`:**
- Requests go directly to Flask
- Browser enforces CORS policy
- Session cookies are not sent (cross-origin)
- Even though Flask has CORS headers, browser blocks cookies

**When `NEXT_PUBLIC_API_URL=` (empty):**
- Requests use relative paths (`/api/...`)
- Next.js proxy handles forwarding
- Same-origin request (no CORS)
- Session cookies work properly

### How This Keeps Recurring

1. Developer sees two servers (3000 and 5001)
2. Assumes frontend needs backend URL
3. Sets `NEXT_PUBLIC_API_URL=http://localhost:5001`
4. CORS errors appear
5. Developer tries to "fix CORS" in Flask
6. Wastes time on wrong solution

**The pattern:** Intuition says "point frontend at backend URL" but the correct pattern for Next.js is "use empty URL to enable proxy".

---

## Solution

### Quick Fix

1. **Edit frontend environment file:**
   ```bash
   cd dashboard/frontend
   nano .env.local
   ```

2. **Set API URL to empty:**
   ```env
   # Backend API URL
   # IMPORTANT: Leave empty to use Next.js proxy (avoids CORS issues)
   NEXT_PUBLIC_API_URL=
   ```

3. **Restart frontend:**
   ```bash
   lsof -ti:3000 | xargs kill -9
   npm run dev
   ```

4. **Verify fix:**
   - Open browser DevTools → Network tab
   - Refresh page
   - API calls should go to `/api/...` (relative path)
   - NOT `http://localhost:5001/api/...` (absolute URL)

### Verification Steps

1. **Check environment config:**
   ```bash
   cd dashboard/frontend
   cat .env.local | grep NEXT_PUBLIC_API_URL
   # Should show: NEXT_PUBLIC_API_URL=
   ```

2. **Test backend health:**
   ```bash
   curl -i -H "Origin: http://localhost:3000" http://localhost:5001/health
   # Should return 200 with Access-Control-Allow-Origin header
   ```

3. **Test API endpoint:**
   ```bash
   # This will fail with 401 (auth required) but should show CORS headers
   curl -i -H "Origin: http://localhost:3000" http://localhost:5001/api/analyze/models
   ```

4. **Check browser Network tab:**
   - Requests should be to `localhost:3000/api/...`
   - Status codes indicate auth/business logic errors (not CORS)

---

## Prevention Measures

### 1. Documentation Updates

✅ Added prominent warning in [README.md](../../README.md):
- New "Configure Frontend Environment" section before starting frontend
- Clear explanation of proxy pattern
- Dedicated CORS troubleshooting section

### 2. Default Configuration

The `.env.local.example` or template should explicitly document:

```env
# Backend API URL Configuration
# =============================================================================
# IMPORTANT: In development, LEAVE THIS EMPTY to use the Next.js API proxy.
#
# Why empty?
#   - Empty value → requests use relative paths (/api/...)
#   - Next.js proxy (app/api/[...path]/route.ts) forwards to Flask
#   - No CORS issues, session cookies work properly
#
# Common mistake: Setting to http://localhost:5001 bypasses proxy and causes CORS errors.
#
# Only set this for production deployment when frontend and backend are on different domains.
# =============================================================================
NEXT_PUBLIC_API_URL=
```

### 3. Runtime Validation

Consider adding a startup check in `dashboard/frontend/lib/api.ts`:

```typescript
// Warn if API URL is set in development
if (process.env.NODE_ENV === 'development' && API_BASE_URL) {
  console.warn(
    '⚠️  NEXT_PUBLIC_API_URL is set in development. This may cause CORS issues.\n' +
    'Consider leaving it empty to use the Next.js API proxy.\n' +
    `Current value: ${API_BASE_URL}`
  );
}
```

### 4. Start Script Enhancement

Update `start_app.sh` to validate configuration:

```bash
#!/bin/bash
# Check frontend configuration
if grep -q "NEXT_PUBLIC_API_URL=http://" dashboard/frontend/.env.local 2>/dev/null; then
    echo "⚠️  Warning: NEXT_PUBLIC_API_URL is set to an HTTP URL"
    echo "   This may cause CORS issues in development."
    echo "   Recommended: NEXT_PUBLIC_API_URL= (empty)"
    read -p "   Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi
```

---

## Technical Deep Dive

### Why Next.js API Proxy Pattern?

**Benefits:**
1. **No CORS**: Same-origin requests to `/api/...`
2. **Session cookies**: Work automatically (same domain)
3. **Environment separation**: Backend URL not exposed to browser
4. **Middleware opportunity**: Can add auth, logging, rate limiting
5. **Production flexibility**: Easy to change backend URL without rebuilding frontend

**How It Works:**

```typescript
// dashboard/frontend/app/api/[...path]/route.ts
export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  const apiPath = params.path.join('/');
  const flaskUrl = `${FLASK_API_URL}/api/${apiPath}${request.nextUrl.search}`;

  const response = await fetch(flaskUrl, {
    headers: request.headers,
    credentials: 'include', // Forward cookies
  });

  return new NextResponse(await response.text(), {
    status: response.status,
    headers: response.headers,
  });
}
```

**Request Flow:**
1. Browser: `GET /api/profile/summary`
2. Next.js: Intercepts via API route
3. Next.js: Fetches `http://localhost:5001/api/profile/summary`
4. Next.js: Returns response to browser
5. Browser: Sees same-origin response (no CORS)

### CORS vs Proxy Pattern Decision Matrix

| Scenario | Use CORS | Use Proxy |
|----------|----------|-----------|
| Development (separate ports) | ❌ | ✅ |
| Production (same domain) | ❌ | ✅ |
| Production (different domains) | ✅ | ❌ |
| Mobile app | ✅ | N/A |
| Third-party integration | ✅ | N/A |

**Our case:** Development with Next.js → **Always use proxy**

---

## Testing Checklist

After applying fix, verify:

- [ ] Frontend environment has `NEXT_PUBLIC_API_URL=` (empty)
- [ ] Both backend (5001) and frontend (3000) are running
- [ ] Browser Network tab shows requests to `/api/...` (relative)
- [ ] No CORS errors in browser console
- [ ] Login/authentication works
- [ ] API calls return data (not 401/403)
- [ ] Session persists across page refreshes

---

## Related Files

- **Frontend Config:** `dashboard/frontend/.env.local`
- **API Client:** `dashboard/frontend/lib/api.ts`
- **Next.js Proxy:** `dashboard/frontend/app/api/[...path]/route.ts`
- **Backend CORS:** `dashboard/backend/app.py` (line 47)
- **Backend Config:** `dashboard/backend/config.py` (lines 27-29)

---

## Historical Occurrences

### 2025-10-30 - Initial Documentation
- **Trigger:** `NEXT_PUBLIC_API_URL=http://localhost:5001` in `.env.local`
- **Impact:** All API calls failed with CORS errors
- **Resolution Time:** ~15 minutes (after identifying root cause)
- **Prevention Actions:**
  - Updated README.md with prominent warning
  - Created this documentation
  - Recommended adding runtime validation

---

## Additional Notes

### macOS AirPlay Port Conflict

**Related Issue:** Port 5000 is used by AirPlay Receiver on macOS.

**Solution:** Use port 5001 for Flask backend (already configured).

**Verification:**
```bash
lsof -i :5000  # Should show AirPlay process
lsof -i :5001  # Should show Flask/gunicorn
```

### Session Cookie Requirements

For the proxy pattern to work with session authentication:

1. **Backend must set cookies:** Flask-Session configured in `app.py`
2. **Proxy must forward cookies:** `credentials: 'include'` in fetch
3. **Same origin:** Browser allows cookies within `localhost:3000`

**If sessions still fail after CORS fix:**
```bash
# Check backend session config
grep SESSION dashboard/backend/config.py

# Verify cookies are being set
curl -i http://localhost:3000/api/auth/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"user_id": "test"}'
# Look for Set-Cookie header
```

---

## Lessons Learned

1. **CORS errors are often symptoms, not root cause** - Always verify the request pattern first
2. **Next.js API routes are powerful** - Use them for same-origin benefits
3. **Environment variables need good documentation** - Counter-intuitive patterns need explanation
4. **Test with curl first** - Eliminates browser complexity from debugging
5. **Network tab is your friend** - Shows actual request URLs, not what you think they are

---

## Future Improvements

### Short Term
- [ ] Add startup validation script
- [ ] Create `.env.local.example` with detailed comments
- [ ] Add runtime warning in API client

### Medium Term
- [ ] Consider Next.js API route middleware for auth
- [ ] Add E2E tests that would catch this configuration error
- [ ] Create troubleshooting command: `npm run doctor`

### Long Term
- [ ] Evaluate moving to Next.js Server Actions (eliminates need for Flask)
- [ ] Consider tRPC for type-safe API calls
- [ ] Implement monitoring for CORS-related errors in production

---

**Last Updated:** 2025-10-30
**Maintainer:** Development Team
**Related Docs:** [README.md](../../README.md), [CLAUDE.md](../../CLAUDE.md)
