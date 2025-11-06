# Dashboard Quick Start Guide

## Starting the Dashboard

### 1. Start Backend (Terminal 1)
```bash
export FLASK_PORT=5001
export CORS_ORIGINS="http://localhost:3000,http://localhost:3001"
python dashboard/backend/run.py
```

Backend will be available at: http://localhost:5001

### 2. Start Frontend (Terminal 2)
```bash
cd dashboard/frontend
npm run dev
```

Frontend will be available at: http://localhost:3000

## Using the Dashboard

### Login / Create User
1. Open browser to http://localhost:3000/login
2. Enter any `user_id` (creates new user if doesn't exist):
   - Example: `test_user`
   - Example: `e2e_test_user`
   - Example: `your_name`
3. Click "Sign In"

The system uses user_id-based authentication - there's no separate signup. Any user_id you enter will create a session.

### View Profile Data
After login, you'll see the dashboard showing:
- Profile summary with classification counts
- Demographics (age, gender, education, etc.)
- Household information
- Interests and hobbies
- Purchase intent signals
- Actual purchase history

**Note:** New users will have empty profiles. You need to process emails to populate data.

### Process Emails for a User
To add data for a user, process their emails:

```bash
# From project root
MEMORY_DATABASE_PATH=data/email_parser_memory.db \
LLM_PROVIDER=claude \
python -m src.email_parser.main \
  --iab-csv emails.csv \
  --iab-output profile.json \
  --user-id your_user_id
```

Then refresh the dashboard to see the new classifications.

## Testing with Existing Data

To test with pre-existing data, use the `e2e_test_user`:

```bash
# Process test emails
MEMORY_DATABASE_PATH=data/email_parser_memory.db \
LLM_PROVIDER=claude \
python -m src.email_parser.main \
  --iab-csv test_e2e_evidence_validation.csv \
  --iab-output test_output.json \
  --user-id e2e_test_user
```

Then login with `user_id: e2e_test_user` to see the results.

## Troubleshooting

### Port 5000 Already in Use
**Issue:** macOS AirPlay Receiver uses port 5000 by default

**Solutions:**
1. **Use port 5001** (recommended): Set `FLASK_PORT=5001` as shown above
2. **Disable AirPlay**: System Settings → General → AirDrop & Handoff → Disable AirPlay Receiver

### Login Not Working
**Check:**
1. Backend is running on port 5001: `curl http://localhost:5001/health`
2. Frontend is running on port 3000: Open http://localhost:3000
3. Browser console for errors (F12 → Console tab)

### No Data Showing
**Possible causes:**
1. User has no processed emails - run email processing first
2. Wrong user_id - make sure you're logged in with the same user_id used during processing
3. Database path mismatch - ensure `MEMORY_DATABASE_PATH=data/email_parser_memory.db` matches

## API Testing (Optional)

Test the backend API directly:

```bash
# Login
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"user_id": "test_user"}' \
  -c cookies.txt

# Get profile summary
curl http://localhost:5001/api/profile/summary -b cookies.txt

# Get classifications
curl http://localhost:5001/api/profile/classifications -b cookies.txt
```

## Architecture

- **Backend:** Flask (Python) on port 5001
  - Session-based authentication
  - SQLite database (data/email_parser_memory.db)
  - CORS enabled for localhost origins

- **Frontend:** Next.js (React) on port 3000
  - API client with cookie-based sessions
  - Responsive dashboard UI
  - Real-time data updates

## Related Documentation

- `FRONTEND_SESSION_FIX.md` - Technical details of session cookie fix
- `E2E_TEST_REPORT.md` - End-to-end testing results
- `dashboard/backend/config.py` - Backend configuration
- `dashboard/frontend/lib/api.ts` - Frontend API client
