# Quick Start Guide

Get up and running with OwnYou Consumer Application in 5 minutes!

## Prerequisites Check

```bash
# Check Python (need 3.8+)
python3 --version

# Check Node.js (need 18.x+)
node --version
npm --version
```

## 1. Install Dependencies (First Time Only)

```bash
# Navigate to project
cd /path/to/ownyou_consumer_application

# Install Python dependencies
pip3 install -r requirements.txt

# Install frontend dependencies
cd dashboard/frontend
npm install
cd ../..
```

## 2. Configure Environment

Create `.env` file in project root:

```bash
# Minimal configuration for quick start
LLM_PROVIDER=openai
OPENAI_API_KEY=your_key_here
EMAIL_MODEL=openai:gpt-4o-mini
TAXONOMY_MODEL=openai:gpt-4o-mini

MEMORY_DATABASE_PATH=/Volumes/T7_new/developer_old/ownyou_consumer_application/data/email_parser_memory.db
```

## 3. Setup Email Provider

```bash
# Gmail setup (recommended for first time)
python3 -m src.email_parser.main setup gmail

# Follow the OAuth flow in your browser
# Authorize the application
# Credentials will be saved as token.json
```

## 4. Start the Application

### Option A: Using Helper Scripts (Easiest)

```bash
# Make scripts executable (first time only)
chmod +x start_app.sh stop_app.sh

# Start everything
./start_app.sh

# Stop everything when done
./stop_app.sh
```

### Option B: Manual Start

**Terminal 1 - Backend:**
```bash
# Kill any existing instances
lsof -ti:5001 | xargs kill -9

# Start backend
python3 dashboard/backend/run.py
```

**Terminal 2 - Frontend:**
```bash
# Kill any existing instances
lsof -ti:3000 | xargs kill -9

# Start frontend
cd dashboard/frontend
npm run dev
```

## 5. Access the Application

Open your browser:
```
http://localhost:3000
```

## 6. Run Your First Analysis

### Via Dashboard (Recommended)

1. Navigate to http://localhost:3000
2. Click "New Analysis"
3. Select "Gmail"
4. Choose models:
   - Email Model: `gpt-4o-mini`
   - Taxonomy Model: `gpt-4o-mini`
5. Set email count: `50`
6. Click "Start Analysis"
7. Wait 3-5 minutes
8. View results in "Classifications" tab

### Via Command Line

```bash
# Quick analysis (download + summarize + classify)
python3 -m src.email_parser.main --pull 50 --model openai

# Results saved to:
# - data/emails_raw_<timestamp>.csv
# - data/emails_summarized_<timestamp>.csv
# - data/profile_<user>_<timestamp>.json
```

## 7. View Results

### In Dashboard

- **Overview**: See classification counts by category
- **Classifications**: Browse all IAB taxonomy classifications
- **Evidence**: View email evidence for each classification
- **Analytics**: View trends and insights

### In Files

```bash
# Latest profile
ls -lt data/profile_*.json | head -1

# View profile
cat data/profile_nick_<timestamp>.json | python3 -m json.tool
```

## Common Commands

```bash
# Start application
./start_app.sh

# Stop application
./stop_app.sh

# Check if running
lsof -i:5001  # Backend
lsof -i:3000  # Frontend

# View logs
tail -f backend.out
tail -f frontend.out

# Quick analysis
python3 -m src.email_parser.main --pull 50 --model openai

# Check setup status
python3 -m src.email_parser.main setup status
```

## Troubleshooting

### Port Already in Use
```bash
# Force kill processes
lsof -ti:5001 | xargs kill -9
lsof -ti:3000 | xargs kill -9
```

### OAuth Failed
```bash
# Re-run setup
rm token.json
python3 -m src.email_parser.main setup gmail
```

### Frontend Won't Start
```bash
# Clear and reinstall
cd dashboard/frontend
rm -rf node_modules .next
npm install
npm run dev
```

### Backend Crashes
```bash
# Check logs
cat backend.out

# Verify Python dependencies
pip3 install -r requirements.txt

# Test import
python3 -c "from dashboard.backend.app import create_app; print('OK')"
```

## What's Next?

1. **Read Full Documentation**: See [README.md](README.md) for comprehensive guide
2. **Try Different Models**: Test Claude, Gemini, or local Ollama
3. **Explore LangGraph Studio**: Visualize workflow with `langgraph dev`
4. **Check Analytics**: Review classification trends in dashboard
5. **Export Profiles**: Use profile JSON for downstream applications

## Need Help?

- **Full Documentation**: [README.md](README.md)
- **Architecture Details**: [CLAUDE.md](CLAUDE.md)
- **Studio Guide**: [docs/STUDIO_QUICKSTART.md](docs/STUDIO_QUICKSTART.md)
- **Issue Tracker**: Create issue in repository

## Example Workflow

```bash
# 1. Start application
./start_app.sh

# 2. Open browser to http://localhost:3000

# 3. Run analysis via dashboard (50 emails)

# 4. While waiting, view LangGraph workflow:
#    Open new terminal:
langgraph dev
#    Open http://127.0.0.1:2024

# 5. View results in dashboard when complete

# 6. Stop application when done
./stop_app.sh
```

That's it! You're ready to build consumer intelligence profiles from email data.
