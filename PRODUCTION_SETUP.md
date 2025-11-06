# Production Setup Guide

## What Changed

I've fixed the TypeScript errors and set up proper production deployment, but **I have NOT tested the production start commands in a live environment**. Here's what needs to be tested:

## Files Created/Modified

### ✅ Fixed Issues

1. **`dashboard/frontend/app/analytics/page.tsx`**
   - Fixed TypeScript type mismatch
   - Now imports `AnalysisRun` type from `lib/api.ts`
   - Updated field references to match API response

2. **`requirements.txt`**
   - Added Flask dependencies (Flask, Flask-CORS, Flask-Session)
   - Added gunicorn for production WSGI server

3. **`wsgi.py`** (NEW)
   - Production entry point for gunicorn
   - Handles Python path setup automatically
   - Usage: `gunicorn -w 4 -b 0.0.0.0:5001 wsgi:app`

4. **`test_production.sh`** (NEW)
   - Script to verify production setup
   - Checks dependencies, ports, configuration

5. **`README.md`**
   - Updated production start instructions
   - Added detailed step-by-step guide
   - Added alternative background process methods

## ⚠️ YOU NEED TO TEST

### Test 1: Frontend Build

```bash
cd dashboard/frontend
rm -rf .next node_modules
npm install
npm run build
```

**Expected:** Build should complete without TypeScript errors

**If it fails:** Check the error message and let me know

### Test 2: Production Test Script

```bash
cd /path/to/ownyou_consumer_application
chmod +x test_production.sh
./test_production.sh
```

**Expected:** All checks should pass (✓)

### Test 3: Backend Production Start

```bash
# Terminal 1
cd /path/to/ownyou_consumer_application
source .venv_dashboard/bin/activate  # or your venv
gunicorn -w 4 -b 0.0.0.0:5001 wsgi:app
```

**Expected:**
```
[INFO] Starting gunicorn 21.2.0
[INFO] Listening at: http://0.0.0.0:5001
[INFO] Using worker: sync
[INFO] Booting worker with pid: XXXXX
```

**Test it works:**
```bash
# In another terminal
curl http://localhost:5001/health
# Should return: {"status":"healthy","service":"iab-dashboard-api","version":"1.0.0"}
```

### Test 4: Frontend Production Start

```bash
# Terminal 2 (after backend is running)
cd dashboard/frontend
npm start
```

**Expected:**
```
▲ Next.js 14.2.33
- Local:        http://localhost:3000
✓ Ready in Xs
```

**Test it works:**
- Open browser to http://localhost:3000
- Should see the dashboard login page
- Try logging in with user ID
- Navigate through the app

## Common Issues & Solutions

### Issue 1: Frontend Build Fails

**Error:** TypeScript compilation errors

**Solution:**
```bash
cd dashboard/frontend
rm -rf .next node_modules package-lock.json
npm install
npm run build
```

### Issue 2: Gunicorn Import Error

**Error:** `ModuleNotFoundError: No module named 'dashboard'`

**Solution:** Make sure you're running from the project root where `wsgi.py` is located

### Issue 3: Port Already in Use

**Error:** `Address already in use`

**Solution:**
```bash
# Kill processes
lsof -ti:5001 | xargs kill -9  # Backend
lsof -ti:3000 | xargs kill -9  # Frontend
```

### Issue 4: Frontend "No Build Found"

**Error:** `Could not find a production build`

**Solution:**
```bash
cd dashboard/frontend
npm run build  # Must complete successfully first
npm start
```

## Production Deployment Checklist

Before deploying to production:

- [ ] Frontend builds without errors (`npm run build`)
- [ ] Backend starts with gunicorn (`gunicorn -w 4 -b 0.0.0.0:5001 wsgi:app`)
- [ ] Frontend starts in production mode (`npm start`)
- [ ] Can access backend health check (http://localhost:5001/health)
- [ ] Can access frontend (http://localhost:3000)
- [ ] Can login to application
- [ ] All API endpoints work
- [ ] Environment variables are properly configured
- [ ] Set up process manager (PM2, systemd, supervisor)
- [ ] Set up reverse proxy (nginx, Apache)
- [ ] Set up SSL/TLS certificates
- [ ] Configure proper logging
- [ ] Set up monitoring and alerts

## Recommended Production Architecture

```
Internet
    ↓
Nginx (Reverse Proxy + SSL)
    ↓
    ├─→ Frontend (Next.js) :3000
    └─→ Backend (Gunicorn) :5001
            ↓
        Flask App
            ↓
        SQLite Database
```

## Quick Commands Reference

```bash
# Development Mode (Recommended)
./start_app.sh
./stop_app.sh

# Production Mode - Test First!
# Terminal 1: Backend
gunicorn -w 4 -b 0.0.0.0:5001 wsgi:app

# Terminal 2: Frontend
cd dashboard/frontend && npm start

# Background Processes
nohup gunicorn -w 4 -b 0.0.0.0:5001 wsgi:app > backend.log 2>&1 &
cd dashboard/frontend && nohup npm start > ../../frontend.log 2>&1 &

# Stop Background Processes
pkill -f gunicorn
pkill -f "next start"
```

## Next Steps

1. **Test the frontend build** - Confirm TypeScript errors are fixed
2. **Test production backend** - Verify gunicorn can start the app
3. **Test production frontend** - Verify Next.js production mode works
4. **Test full stack** - Verify frontend can communicate with backend
5. **Report results** - Let me know what works/doesn't work

## Summary

**What's Ready:**
- ✅ TypeScript errors fixed
- ✅ Production entry point created (`wsgi.py`)
- ✅ Dependencies added (`requirements.txt`)
- ✅ Documentation updated
- ✅ Test script created

**What Needs Testing:**
- ⚠️ Frontend production build
- ⚠️ Backend with gunicorn
- ⚠️ Frontend with `npm start`
- ⚠️ Full stack integration
- ⚠️ API functionality

**Please run the tests above and report any issues!**
