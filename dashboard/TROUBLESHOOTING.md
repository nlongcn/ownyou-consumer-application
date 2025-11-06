# Dashboard Troubleshooting Guide

## Login Not Working - "Can't navigate away from login screen"

This is likely a caching or CORS issue. Follow these steps:

### Step 1: Verify Backend is Running

```bash
curl http://127.0.0.1:5000/health
```

Expected: `{"status": "healthy", ...}`

If not working:
```bash
# Start backend
python dashboard/backend/run.py
```

### Step 2: Test Login Endpoint Directly

```bash
curl -X POST http://127.0.0.1:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"user_id": "cost_test"}'
```

Expected: `{"success": true, "user_id": "cost_test", ...}`

### Step 3: Hard Refresh Frontend

The Next.js dev server caches code. You need to:

1. **Stop the Next.js server** (Ctrl+C in the terminal running `npm run dev`)
2. **Clear the Next.js cache**:
   ```bash
   cd dashboard/frontend
   rm -rf .next
   ```
3. **Restart the Next.js server**:
   ```bash
   npm run dev
   ```
4. **Hard refresh the browser**:
   - Chrome/Edge: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
   - Firefox: Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)

### Step 4: Check Browser Console

1. Open browser console (F12 → Console tab)
2. Try logging in with `cost_test`
3. Look for errors or console.log messages:
   - Should see: "Attempting login with user_id: cost_test"
   - Should see: "Login response: {success: true, ...}"
   - Should see: "Login successful, redirecting to dashboard"

### Step 5: Check Network Tab

1. Open browser DevTools (F12)
2. Go to Network tab
3. Try logging in
4. Look for the POST request to `/api/auth/login`
5. Check:
   - Status should be 200
   - Response should have `{"success": true, ...}`
   - Response Headers should include `Set-Cookie: session=...`

### Common Issues

#### Issue 1: CORS Error

**Symptoms**: Console shows "CORS policy" error

**Solution**:
1. Verify backend config allows your origin
2. Backend should be restarted after config changes
3. Current config allows:
   - `http://localhost:3000`
   - `http://127.0.0.1:3000`

#### Issue 2: Session Cookie Not Set

**Symptoms**: Login succeeds but dashboard still asks for login

**Solution**:
1. Check Network tab → Response Headers for `Set-Cookie`
2. Check Application tab → Cookies
3. Should see a `session` cookie for `127.0.0.1`

**Browser Setting**: Some browsers block third-party cookies
- Chrome: Settings → Privacy → Allow all cookies (for development)
- Firefox: Settings → Privacy → Standard (for development)

#### Issue 3: Port Mismatch

**Symptoms**: "Failed to fetch" or connection refused

**Solution**:
- Verify frontend uses correct API URL
- Check `dashboard/frontend/lib/api.ts` line 8
- Should be: `http://127.0.0.1:5000`
- NOT: `http://localhost:5000` (different domain)

#### Issue 4: Next.js Not Picking Up Changes

**Symptoms**: Code changes don't appear

**Solution**:
```bash
# Stop server (Ctrl+C)
cd dashboard/frontend
rm -rf .next
npm run dev
```

Then hard refresh browser (Ctrl+Shift+R)

### Full Reset (Nuclear Option)

If nothing works, do a complete reset:

```bash
# 1. Stop all servers
pkill -f "python dashboard/backend/run.py"
# Stop Next.js (Ctrl+C in terminal)

# 2. Clear Next.js cache
cd dashboard/frontend
rm -rf .next node_modules
npm install

# 3. Clear browser cache
# Chrome: Ctrl+Shift+Delete → Clear browsing data → Cached images

# 4. Restart backend
cd ../..
python dashboard/backend/run.py

# 5. Restart frontend (new terminal)
cd dashboard/frontend
npm run dev

# 6. Open browser in incognito mode
# Chrome: Ctrl+Shift+N
# Navigate to http://localhost:3000
```

### Manual Test Without Frontend

Test the full flow without the UI:

```bash
# 1. Login
curl -X POST http://127.0.0.1:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"user_id": "cost_test"}' \
  -c /tmp/cookies.txt

# 2. Get profile (should work with cookie)
curl http://127.0.0.1:5000/api/profile/summary \
  -b /tmp/cookies.txt

# 3. Should see profile data
```

If this works but browser doesn't, it's a frontend/CORS/cookie issue.

### Still Not Working?

Check the logs:

**Backend logs:**
```bash
tail -f logs/dashboard.log
# or
tail -f /tmp/flask_output.log
```

**Frontend logs:**
- Check the terminal running `npm run dev`
- Check browser console (F12 → Console)
- Check browser network tab (F12 → Network)

### Known Working Configuration

This should work:
- Backend: `http://127.0.0.1:5000` (Flask)
- Frontend: `http://localhost:3000` (Next.js)
- User IDs: `cost_test`, `cost_tracker_test`, `cost_tracker_test2`

### Contact/Debug Info to Provide

If you need help, provide:
1. Browser console errors (screenshot or copy text)
2. Network tab screenshot (showing the login POST request)
3. Backend logs from terminal
4. Operating system and browser version

---

## Quick Fix Checklist

- [ ] Backend running on port 5000
- [ ] Frontend running on port 3000
- [ ] Next.js cache cleared (`rm -rf .next`)
- [ ] Browser hard refreshed (Ctrl+Shift+R)
- [ ] Browser console shows no CORS errors
- [ ] Network tab shows 200 response for login
- [ ] Cookies tab shows `session` cookie

If all checked and still not working, try incognito mode or different browser.
