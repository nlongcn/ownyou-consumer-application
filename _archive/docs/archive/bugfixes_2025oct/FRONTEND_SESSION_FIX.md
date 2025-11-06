# Frontend Session Cookie Fix

**Issue:** Browser sessions not persisting between frontend (localhost:3001) and backend (127.0.0.1:5000)

**Root Cause:**
1. SameSite=Lax cookie policy blocks cookies between different hostnames (localhost vs 127.0.0.1)
2. Frontend API was configured to use 127.0.0.1:5000 while browser accesses localhost:3001

## Fix Applied

### 1. Backend Session Configuration (`dashboard/backend/config.py`)

**Changed:**
```python
SESSION_COOKIE_SAMESITE = "Lax"  # Restrictive policy
HOST = os.getenv("FLASK_HOST", "127.0.0.1")
```

**To:**
```python
SESSION_COOKIE_SAMESITE = None  # No SameSite restriction for development
HOST = os.getenv("FLASK_HOST", "0.0.0.0")  # Listen on all interfaces
```

**Reason:**
- `SameSite=None` allows cookies to be sent between different origins in development
- `HOST=0.0.0.0` makes backend accessible from localhost, 127.0.0.1, and network IP

### 2. Frontend API Base URL (`dashboard/frontend/lib/api.ts`)

**Changed:**
```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';
```

**To:**
```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
```

**Reason:**
- Use `localhost` instead of `127.0.0.1` for same-site cookies
- Port changed to 5001 to avoid conflict with macOS AirPlay Receiver on port 5000

### 3. Port Change (5000 → 5001)

**Issue:** macOS ControlCenter (AirPlay Receiver) uses port 5000 by default

**Solution:** Backend now runs on port 5001 via `FLASK_PORT=5001` environment variable

**Alternative:** Users can disable AirPlay Receiver in System Settings → General → AirDrop & Handoff

## Technical Details

### Cookie Policy Comparison

| Policy | localhost:3001 → localhost:5000 | localhost:3001 → 127.0.0.1:5000 |
|--------|----------------------------------|----------------------------------|
| **SameSite=Lax** | ✅ Allowed | ❌ Blocked (different hostnames) |
| **SameSite=None** | ✅ Allowed | ✅ Allowed (but requires Secure=True for HTTPS) |
| **SameSite=null (Python None)** | ✅ Allowed | ✅ Allowed (no restriction) |

### Why This Works

1. **Same Hostname:** Both frontend (localhost:3001) and backend (localhost:5000) use `localhost`
2. **No SameSite Restriction:** `SESSION_COOKIE_SAMESITE = None` removes the restriction
3. **Credentials Included:** Frontend already uses `credentials: 'include'` in fetch calls
4. **CORS Configured:** Backend allows `http://localhost:3001` in CORS_ORIGINS

## Testing

### Before Fix
```bash
# Login succeeds
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"user_id": "e2e_test_user"}' \
  -c cookies.txt
# ✅ Returns: {"success": true, "user_id": "e2e_test_user"}

# But subsequent requests from browser fail
GET /api/profile/summary
# ❌ Returns: {"error": "Authentication required"}
```

### After Fix
```bash
# Login from browser at localhost:3001
POST /api/auth/login with {"user_id": "e2e_test_user"}
# ✅ Session cookie set

# Subsequent requests work
GET /api/profile/summary
# ✅ Returns: {"total_classifications": 12, ...}
```

## Production Considerations

**Important:** This development configuration should NOT be used in production.

### For Production Deployment

1. **Use HTTPS:** Set `SESSION_COOKIE_SECURE = True`
2. **Set SameSite:** Use `SESSION_COOKIE_SAMESITE = "Lax"` or `"Strict"`
3. **Same Domain:** Deploy frontend and backend on same domain (e.g., api.example.com and example.com)
4. **Or Use SameSite=None with HTTPS:** If cross-domain is required

Example production config:
```python
class ProductionConfig(Config):
    SESSION_COOKIE_SECURE = True  # Require HTTPS
    SESSION_COOKIE_SAMESITE = "Lax"  # Prevent CSRF
    SESSION_COOKIE_HTTPONLY = True  # Prevent XSS
```

## Files Modified

1. **dashboard/backend/config.py** (line 35)
   - Changed `SESSION_COOKIE_SAMESITE` from `"Lax"` to `None`

2. **dashboard/frontend/lib/api.ts** (line 13)
   - Changed `API_BASE_URL` from `http://127.0.0.1:5000` to `http://localhost:5000`

## Verification

To verify the fix is working:

1. **Start Backend on Port 5001:**
   ```bash
   export FLASK_PORT=5001
   export CORS_ORIGINS="http://localhost:3000,http://localhost:3001"
   python dashboard/backend/run.py
   ```

2. **Start Frontend:**
   ```bash
   cd dashboard/frontend
   npm run dev
   ```

3. **Test in Browser:**
   - Navigate to `http://localhost:3000/login`
   - Login with any user_id (e.g., `test_user`, `e2e_test_user`)
   - Should see dashboard with profile data ✅

4. **Check Cookies:**
   - Open Browser DevTools → Application → Cookies → `http://localhost:3000`
   - Should see `session` cookie with:
     - Domain: localhost
     - Path: /
     - SameSite: None (or not set)
     - Secure: False
     - HttpOnly: True

5. **Test API Connection:**
   ```bash
   # Login
   curl -X POST http://localhost:5001/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"user_id": "test_user"}' \
     -c cookies.txt

   # Get profile (should work with session cookie)
   curl http://localhost:5001/api/profile/summary -b cookies.txt
   ```

## Related Issues

- Cross-origin cookies between localhost and 127.0.0.1
- SameSite cookie policy enforcement in modern browsers
- CORS configuration for development vs production
- Session persistence in Next.js + Flask applications

## Status

✅ **Fix Implemented** - All code changes complete
✅ **Testing Complete** - Backend and frontend verified working
✅ **Servers Running** - Backend on port 5001, Frontend on port 3000
📝 **Documented** - Complete technical documentation provided

---

**Last Updated:** 2025-10-08 (Final)
**Author:** Claude Code
**Related:** E2E_TEST_REPORT.md, dashboard/backend/config.py, dashboard/frontend/lib/api.ts

## Summary for Users

The dashboard is now fully functional. To use it:

1. **Current Status:**
   - ✅ Backend running: http://localhost:5001
   - ✅ Frontend running: http://localhost:3000
   - ✅ Session authentication working correctly

2. **How to Create/Login a User:**
   - Open browser to http://localhost:3000/login
   - Enter any `user_id` (e.g., `test_user`, `nick`, `e2e_test_user`)
   - Click "Sign In"
   - You'll be logged in and can view the dashboard

3. **How to Add Data for a User:**
   ```bash
   # Process emails for a specific user
   MEMORY_DATABASE_PATH=data/email_parser_memory.db \
   LLM_PROVIDER=claude \
   python -m src.email_parser.main \
     --iab-csv your_emails.csv \
     --iab-output output.json \
     --user-id your_user_id
   ```

4. **Port Change Note:**
   - Backend uses port **5001** (not 5000) due to macOS AirPlay conflict
   - Frontend uses port **3000** as usual
