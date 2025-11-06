# Dashboard Quick Start Guide

## Prerequisites

- Python 3.8+ with dependencies installed
- Node.js 18+ and npm
- SQLite database with IAB profile data

## Start Backend API

```bash
# Terminal 1: Start Flask backend
cd /Volumes/T7_new/developer_old/email_parser
python dashboard/backend/run.py
```

Backend will start on: `http://127.0.0.1:5000`

Verify health: `curl http://127.0.0.1:5000/health`

## Start Frontend

```bash
# Terminal 2: Install dependencies and start Next.js
cd /Volumes/T7_new/developer_old/email_parser/dashboard/frontend
npm install
npm run dev
```

Frontend will start on: `http://localhost:3000`

## Access Dashboard

1. Open browser: `http://localhost:3000`
2. Login page will appear
3. Enter a user ID from the database:
   - `cost_test`
   - `cost_tracker_test`
   - `cost_tracker_test2`
4. Click "Login"
5. Dashboard will load with user's profile summary

## Features Available

### Main Dashboard ✅
- Profile summary cards (total classifications, demographics, household, interests, purchase intent, actual purchases)
- Quick action buttons (placeholders for future pages)
- Real-time data from backend API

### Analysis Runner (3-Step Discrete Control) ✅
The analysis workflow consists of three independent stages that can be run or re-run separately:

1. **Email Download** - Fetch emails from Gmail/Outlook via OAuth → `emails_raw.csv`
2. **Email Summarization** - Pre-process emails with EMAIL_MODEL → `emails_summaries.csv`
3. **IAB Classification** - Run classification agents with TAXONOMY_MODEL → `user_profile.json`

**Features**:
- Run full pipeline or individual steps
- Resume from any checkpoint if previous steps completed
- Test different models without re-downloading
- Model selection per step (EMAIL_MODEL vs TAXONOMY_MODEL)
- Progress tracking and job status polling
- Cost estimation before running

**Why Discrete Steps?**
- **Resilience**: Re-run failed steps without reprocessing earlier stages
- **Iteration**: Test classification models without re-summarizing
- **Cost savings**: Skip expensive LLM calls when experimenting
- **State persistence**: CSV files act as checkpoints between stages

### Coming Soon
- Classification Explorer (sortable table)
- Evidence Viewer (detailed evidence drill-down)
- Memory Timeline (profile evolution over time)
- Confidence Analysis (Bayesian confidence visualization)
- Active Categories Browser (hierarchical taxonomy tree)
- Mission Preview (consumer-facing card mockups)

## Troubleshooting

### Backend Issues

**Error: Module not found**
```bash
pip install -r dashboard/backend/requirements.txt
```

**Error: Database not found**
- Ensure `data/email_parser_memory.db` exists
- Run IAB profile generation first to populate data

**Error: Port 5000 already in use**
```bash
# Kill existing Flask process
pkill -f "python dashboard/backend/run.py"
```

### Frontend Issues

**Error: Cannot connect to API**
- Verify backend is running on port 5000
- Check `.env.local` has correct API URL
- Ensure CORS is enabled in Flask config

**Error: npm install fails**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Error: Module not found**
- Ensure all dependencies are installed
- Check tsconfig.json paths configuration

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with user_id
- `POST /api/auth/logout` - Logout
- `GET /api/auth/status` - Check auth status

### Profile
- `GET /api/profile/summary` - Profile summary counts
- `GET /api/profile/classifications?section=interests` - Get classifications
- `GET /api/profile/sections` - Get all sections

### Analytics
- `GET /api/analytics/costs` - Cost tracking records
- `GET /api/analytics/costs/total` - Total cost summary
- `GET /api/analytics/runs` - Analysis run history
- `GET /api/analytics/confidence/history` - Confidence evolution

### Analysis Runner (3-Step Workflow)
- `POST /api/analyze/download` - Step 1: Download emails from Gmail/Outlook
- `POST /api/analyze/summarize` - Step 2: Summarize emails with EMAIL_MODEL
- `POST /api/analyze/classify` - Step 3: Run IAB classification with TAXONOMY_MODEL
- `POST /api/analyze/full` - Run full pipeline (all 3 steps)
- `GET /api/analyze/status/{job_id}` - Poll job status
- `GET /api/analyze/models` - Get available LLM models

## Development

### Backend
```bash
# Run with debug mode
FLASK_DEBUG=True python dashboard/backend/run.py

# View logs
tail -f logs/dashboard.log

# Test API manually
curl -X POST http://127.0.0.1:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"user_id": "cost_test"}' \
  -c cookies.txt

curl http://127.0.0.1:5000/api/profile/summary -b cookies.txt
```

### Frontend
```bash
# Run development server with verbose output
npm run dev

# Build for production
npm run build

# Type check
npm run lint
```

## Architecture

```
┌──────────────────────────────────────┐
│   Browser (localhost:3000)           │
│   - Next.js 14                       │
│   - React 18                         │
│   - Tailwind CSS                     │
└──────────────┬───────────────────────┘
               │ HTTP/REST
               │
┌──────────────▼───────────────────────┐
│   Flask API (127.0.0.1:5000)         │
│   - Session-based auth               │
│   - User-scoped queries              │
└──────────────┬───────────────────────┘
               │
┌──────────────▼───────────────────────┐
│   SQLite Database                    │
│   - LangMem store                    │
│   - Cost tracking                    │
│   - Classification history           │
└──────────────────────────────────────┘
```

## Next Steps

1. ✅ **Main Dashboard Complete** - Profile summary with cards
2. ✅ **Analysis Runner (Documented)** - 3-step discrete workflow architecture
3. 🔄 **Implement Analysis Runner Backend** - Add discrete step API endpoints
4. 🔄 **Implement Analysis Runner Frontend** - Step-by-step UI with progress tracking
5. 🔄 **Build Classification Explorer** - Sortable/filterable table
6. 🔄 **Build Evidence Viewer** - Detailed evidence with LLM reasoning
7. 🔄 **Build Memory Timeline** - Interactive timeline with slider
8. 🔄 **Build Confidence Analysis** - Bayesian visualization
9. 🔄 **Build Categories Browser** - Hierarchical taxonomy tree
10. 🔄 **Build Mission Preview** - Card mockups

## Documentation

- **Full Requirements**: `docs/DASHBOARD_REQUIREMENTS.md`
- **Backend API Docs**: `dashboard/backend/README.md`
- **Frontend Docs**: `dashboard/frontend/README.md`
- **Implementation Status**: `dashboard/IMPLEMENTATION_STATUS.md`
- **Test Results**: `dashboard/TEST_RESULTS.md`

## Support

For issues:
1. Check this guide first
2. Review error logs (backend: `logs/dashboard.log`, frontend: browser console)
3. Verify both services are running
4. Check database has data for the user_id

---

**Last Updated**: October 1, 2025
**Status**: Phase 1 Complete - Main Dashboard Operational
