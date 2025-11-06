# OwnYou Consumer Application

A comprehensive email parsing and consumer intelligence system that analyzes Gmail and Outlook emails using multiple LLM providers to build detailed IAB Taxonomy consumer profiles. The system provides advanced analytics including demographic classification, interest profiling, purchase intent prediction, and household analysis.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Starting the Application](#starting-the-application)
- [How It Works](#how-it-works)
- [Usage Examples](#usage-examples)
- [Development](#development)
- [Troubleshooting](#troubleshooting)

---

## Overview

The OwnYou Consumer Application is a privacy-first email analysis system that:

- **Downloads emails** from Gmail and Outlook via OAuth2
- **Processes emails** using multiple LLM providers (OpenAI, Claude, Google Gemini, Ollama)
- **Classifies users** according to IAB Audience Taxonomy 1.1
- **Builds consumer profiles** with demographics, interests, purchase intent, and household data
- **Provides analytics dashboard** for visualizing consumer insights
- **Maintains privacy** through local processing and encrypted storage

### Key Features

- **Multi-Provider Email Support**: Gmail and Outlook integration with OAuth2
- **Multi-LLM Processing**: OpenAI GPT-5, Claude Sonnet-4, Google Gemini, Ollama (local)
- **Batch Processing**: Intelligent batching for 20-30x faster processing
- **IAB Taxonomy Mapping**: 1,600+ categories across demographics, interests, and purchase intent
- **Visual Dashboard**: React/Next.js frontend with real-time analytics
- **LangGraph Workflow**: Agentic workflow with evidence validation
- **Privacy-First**: No cloud storage, local SQLite persistence

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                      │
│  - Dashboard UI (React + Tailwind CSS)                       │
│  - Classification Viewer                                     │
│  - Analytics & Visualizations (Recharts)                     │
│  - Real-time Updates                                         │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP/REST API
┌───────────────────────────▼─────────────────────────────────┐
│                    Backend (Flask API)                       │
│  - Authentication & Session Management                       │
│  - Profile & Analytics Endpoints                             │
│  - Evidence Retrieval                                        │
│  - Model Selection & Analysis Triggers                       │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│               Email Processing Pipeline                      │
│                                                              │
│  Step 1: Email Download (OAuth2)                            │
│  ├─ Gmail Provider                                          │
│  └─ Outlook Provider                                        │
│                                                              │
│  Step 2: Email Summarization (EMAIL_MODEL)                  │
│  └─ Fast LLM processing to extract key information          │
│                                                              │
│  Step 3: IAB Classification (TAXONOMY_MODEL)                │
│  ├─ LangGraph Agentic Workflow                             │
│  ├─ Batch Optimizer (10-20 emails per batch)               │
│  ├─ Category-Specific Agents                               │
│  ├─ Evidence Judge (LLM-as-Judge validation)               │
│  └─ Memory Manager (LangMem + SQLite)                      │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                   Data Persistence                           │
│  - SQLite Database (LangMem storage)                        │
│  - User Profiles (JSON exports)                             │
│  - Email Summaries (CSV)                                    │
│  - Classification History                                   │
└─────────────────────────────────────────────────────────────┘
```

### Processing Pipeline

**Three-Stage Independent Pipeline:**

1. **Email Download** → Raw emails CSV
2. **Email Summarization** → Summaries CSV (with EMAIL_MODEL)
3. **IAB Classification** → User profile JSON (with TAXONOMY_MODEL)

Each stage can be run independently, allowing for:

- Resilience (re-run failed steps)
- Iteration (test different models)
- Cost savings (skip expensive LLM calls)

### Batch Processing

The IAB Classification stage uses intelligent batching:

- Dynamically calculates batch size based on model context window
- Processes 10-20 emails per LLM call
- **20-30x faster** than single-email processing
- Evidence validation for each classification

---

## Prerequisites

### System Requirements

- **Python**: 3.8 or higher
- **Node.js**: 18.x or higher
- **npm**: 9.x or higher
- **Operating System**: macOS, Linux, or Windows

### Required Accounts

1. **LLM Provider** (choose at least one):

   - OpenAI API key (recommended)
   - Anthropic API key (Claude)
   - Google AI API key (Gemini)
   - Local Ollama (no key required)
2. **Email Providers** (choose at least one):

   - Gmail: Google Cloud project with Gmail API enabled
   - Outlook: Microsoft Azure app registration

---

## Installation

### 1. Clone the Repository

```bash
cd /path/to/your/workspace
git clone <repository-url>
cd ownyou_consumer_application
```

### 2. Backend Setup

#### Install Python Dependencies

```bash
# Create virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Optional: Install development dependencies
pip install -e ".[dev]"
```

#### Verify Installation

```bash
python -m src.email_parser.main --version
```

### 3. Frontend Setup

```bash
cd dashboard/frontend

# Install dependencies
npm install

# Verify installation
npm run build
```

---

## Configuration

### 1. Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env  # If example exists, or create manually
```

**Minimal .env Configuration:**

```env
# =============================================================================
# LLM Provider Configuration
# =============================================================================

# Primary provider: openai, claude, google, or ollama
LLM_PROVIDER=openai

# OpenAI Configuration (Recommended)
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini
OPENAI_TEMPERATURE=1.0

# Claude (Anthropic) Configuration (Optional)
ANTHROPIC_API_KEY=your_anthropic_api_key_here
ANTHROPIC_MODEL=claude-sonnet-4-20250514

# Google Gemini Configuration (Optional)
GOOGLE_API_KEY=your_google_api_key_here

# Ollama Configuration (Local, Optional)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=deepseek-r1:70b

# =============================================================================
# Stage-Specific Model Configuration
# =============================================================================

# Format: provider:model
EMAIL_MODEL=openai:gpt-4o-mini        # Fast model for email summarization
TAXONOMY_MODEL=openai:gpt-4o          # Accurate model for classification

# =============================================================================
# Memory Backend Configuration
# =============================================================================

MEMORY_BACKEND=sqlite
MEMORY_DATABASE_PATH=/Volumes/T7_new/developer_old/ownyou_consumer_application/data/email_parser_memory.db

# =============================================================================
# LangGraph Studio Configuration (Optional)
# =============================================================================

# LangSmith Project Deep-Linking
# These enable direct links to your specific LangSmith project from the dashboard
# Find these values in your LangSmith project URL:
# https://smith.langchain.com/o/{ORG_ID}/projects/p/{PROJECT_ID}

LANGSMITH_ORG_ID=your_organization_id_here
LANGSMITH_PROJECT_ID=your_project_id_here

# =============================================================================
# Email Provider Configuration
# =============================================================================

# Gmail Configuration
GMAIL_CREDENTIALS_FILE=credentials.json
GMAIL_TOKEN_FILE=token.json

# Microsoft Graph (Outlook) Configuration
MICROSOFT_CLIENT_ID=your_client_id_here
MICROSOFT_CLIENT_SECRET=your_client_secret_here
MICROSOFT_TENANT_ID=common
MICROSOFT_TOKEN_FILE=ms_token.json

# =============================================================================
# Processing Configuration
# =============================================================================

MAX_EMAILS=500
BATCH_SIZE=50
LOG_LEVEL=INFO
```

### 2. Email Provider Setup

#### Gmail Setup

```bash
# Interactive setup wizard
python -m src.email_parser.main setup gmail

# Manual setup:
# 1. Create Google Cloud project
# 2. Enable Gmail API
# 3. Create OAuth 2.0 credentials
# 4. Download credentials as credentials.json
# 5. Place in project root
```

#### Outlook Setup

```bash
# Interactive setup wizard
python -m src.email_parser.main setup outlook

# Manual setup:
# 1. Register app in Azure Portal
# 2. Add Microsoft Graph Mail.Read permission
# 3. Copy Client ID and Client Secret to .env
```

### 3. Verify Configuration

```bash
# Check setup status
python -m src.email_parser.main setup status

# Test database connection
python -m src.email_parser.main --test-db
```

---

## Starting the Application

### Quick Start (Recommended)

Use the provided start script that handles cleanup and startup:

```bash
# From project root
./start_app.sh
```

### Manual Start (Step-by-Step)

#### Step 1: Kill Any Running Instances

```bash
# Kill backend (Flask)
lsof -ti:5001 | xargs kill -9 2>/dev/null || true

# Kill frontend (Next.js)
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Verify ports are free
lsof -i:5001
lsof -i:3000
```

#### Step 2: Start Backend Server

```bash
# Option A: Using Python module
cd /path/to/ownyou_consumer_application
python3 dashboard/backend/run.py

# Option B: Using Flask directly
cd dashboard/backend
python3 -m flask run --host=0.0.0.0 --port=5001

# Backend will start on: http://localhost:5001
```

Expected output:

```
 * Serving Flask app 'app'
 * Debug mode: on
INFO:werkzeug:WARNING: This is a development server.
 * Running on http://0.0.0.0:5001
```

#### Step 3: Configure Frontend Environment

**IMPORTANT:** Before starting the frontend, verify the API URL configuration to avoid CORS issues.

```bash
# Navigate to frontend directory
cd /path/to/ownyou_consumer_application/dashboard/frontend

# Check .env.local file exists
cat .env.local
```

The `.env.local` file **MUST** have an empty `NEXT_PUBLIC_API_URL` to use the Next.js API proxy:

```env
# Backend API URL
# IMPORTANT: Leave empty to use Next.js proxy (avoids CORS issues)
# This routes requests through /api which handles session cookies properly
NEXT_PUBLIC_API_URL=
```

**DO NOT set it to `http://localhost:5001`** - this bypasses the proxy and causes CORS errors.

#### Step 4: Start Frontend

```bash
# Start development server (already in dashboard/frontend)
npm run dev

# Frontend will start on: http://localhost:3000
```

Expected output:

```
   ▲ Next.js 14.2.0
   - Local:        http://localhost:3000
   - Network:      http://192.168.1.x:3000

 ✓ Ready in 2.3s
```

#### Step 5: Open Application

Open your browser and navigate to:

```
http://localhost:3000
```

### Stopping the Application

#### Option 1: Graceful Shutdown

Press `Ctrl+C` in each terminal window running backend/frontend.

#### Option 2: Force Kill

```bash
# Kill all processes on ports
lsof -ti:5001 | xargs kill -9
lsof -ti:3000 | xargs kill -9

# Or kill by process name
pkill -f "flask run"
pkill -f "next dev"
```

### Production Start

**Note:** For development, use the Quick Start method above. Production mode is for deployment only.

**Prerequisites:**

```bash
# Ensure you're in the virtual environment
source venv/bin/activate  # or .venv_dashboard/bin/activate

# Install production dependencies
pip install -r requirements.txt  # Includes gunicorn
```

**Step 1: Build Frontend**

```bash
cd dashboard/frontend
npm run build

# Verify build succeeded (should create .next directory)
ls -la .next/
```

**Step 2: Start Backend (Terminal 1)**

```bash
# From project root
cd /path/to/ownyou_consumer_application

# Activate virtual environment
source venv/bin/activate  # or .venv_dashboard/bin/activate

# Start with gunicorn using wsgi.py entry point
gunicorn -w 4 -b 0.0.0.0:5001 wsgi:app

# Backend will run on http://localhost:5001
# Press Ctrl+C to stop
```

**Step 3: Start Frontend (Terminal 2)**

```bash
cd /path/to/ownyou_consumer_application/dashboard/frontend

# Start production frontendcd 
npm start

# Frontend will run on http://localhost:3000
# Press Ctrl+C to stop
```

**Production Notes:**

- The `wsgi.py` file in the project root is the production entry point
- For background processes, use process managers:
  - **PM2 (Node.js):** `pm2 start npm --name "frontend" -- start`
  - **systemd (Linux):** Create service files for both backend/frontend
  - **supervisor:** Alternative process manager
- Set `FLASK_ENV=production` in `.env` for production mode
- Use nginx or Apache as a reverse proxy in front of gunicorn
- Set up proper logging and monitoring

**Alternative: Background Processes**

```bash
# Start backend in background
nohup gunicorn -w 4 -b 0.0.0.0:5001 wsgi:app > backend.log 2>&1 &

# Start frontend in background
cd dashboard/frontend
nohup npm start > ../../frontend.log 2>&1 &

# View logs
tail -f backend.log
tail -f frontend.log

# Stop processes
pkill -f gunicorn
pkill -f "next start"
```

---

## How It Works

### Workflow Overview

1. **User Authentication**: OAuth2 flow for Gmail/Outlook
2. **Email Download**: Fetch emails via provider APIs
3. **Email Summarization**: Extract key information with LLM
4. **IAB Classification**: Multi-agent workflow classifies emails
5. **Profile Building**: Aggregate classifications into user profile
6. **Dashboard Display**: Visualize insights in real-time

### Detailed Processing Flow

#### 1. Email Download

```python
# Command
python -m src.email_parser.main --provider gmail --max-emails 100

# What happens:
# - OAuth2 authentication
# - API calls to Gmail/Outlook
# - Download emails (subject, body, metadata)
# - Save to CSV: data/emails_raw_<timestamp>.csv
```

#### 2. Email Summarization

```bash
# Triggered automatically or manually
python -m src.email_parser.main --summarize emails_raw.csv

# What happens:
# - Load raw emails
# - Call EMAIL_MODEL (fast, cheap model)
# - Extract: sender, category, key topics, intent
# - Save to CSV: data/emails_summarized_<timestamp>.csv
```

#### 3. IAB Classification (The Magic)

```bash
# Start classification
python -m src.email_parser.main --classify emails_summarized.csv

# What happens:
# 1. Load summarized emails
# 2. Retrieve existing user profile from LangMem
# 3. Batch optimizer groups emails (10-20 per batch)
# 4. For each batch:
#    a. Demographics agent analyzes (age, gender, education)
#    b. Household agent analyzes (size, income, location)
#    c. Interests agent analyzes (hobbies, preferences)
#    d. Purchase intent agent analyzes (shopping behavior)
# 5. Evidence judge validates each classification
# 6. Update LangMem semantic memory
# 7. Save profile JSON: data/profile_<user>_<timestamp>.json
```

**Batch Processing Example:**

```
Input: 100 emails
Context Window: 128,000 tokens
Batch Size: 15 emails

Process:
├─ Batch 1 (emails 1-15)  → 42 classifications
├─ Batch 2 (emails 16-30) → 38 classifications
├─ Batch 3 (emails 31-45) → 51 classifications
└─ ... (7 batches total)

Result: Profile with 287 validated classifications
Time: ~6 minutes (vs 3 hours single-email)
```

#### 4. Profile Structure

```json
{
  "schema_version": "2.0",
  "user_id": "nick",
  "generated_at": "2025-01-28T12:34:56Z",

  "demographics": {
    "age": {
      "primary": {
        "taxonomy_id": 12,
        "value": "35-44",
        "confidence": 0.92,
        "evidence_count": 15
      }
    },
    "gender": {
      "primary": {
        "taxonomy_id": 59,
        "value": "Male",
        "confidence": 0.88,
        "evidence_count": 23
      }
    }
  },

  "interests": [
    {
      "taxonomy_id": 342,
      "category": "Technology & Computing",
      "subcategory": "Software Development",
      "confidence": 0.95,
      "evidence_count": 47,
      "evidence": [
        "GitHub notifications about pull requests",
        "Stack Overflow digest emails"
      ]
    }
  ],

  "purchase_intent": [
    {
      "taxonomy_id": 1234,
      "category": "Consumer Electronics",
      "subcategory": "Laptops",
      "confidence": 0.78,
      "evidence_count": 5,
      "purchase_intent_flag": true
    }
  ]
}
```

### LangGraph Workflow

The classification uses a sophisticated LangGraph workflow:

```
                  ┌──────────────┐
                  │ Load Emails  │
                  └──────┬───────┘
                         │
                  ┌──────▼────────┐
                  │ Retrieve      │
                  │ Profile       │
                  └──────┬────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
    │Demo     │    │House    │    │Interest │
    │Agent    │    │Agent    │    │Agent    │
    └────┬────┘    └────┬────┘    └────┬────┘
         │               │               │
         └───────────────┼───────────────┘
                         │
                  ┌──────▼────────┐
                  │ Evidence      │
                  │ Judge         │
                  └──────┬────────┘
                         │
                  ┌──────▼────────┐
                  │ Reconcile     │
                  │ Results       │
                  └──────┬────────┘
                         │
                  ┌──────▼────────┐
                  │ Update        │
                  │ Memory        │
                  └───────────────┘
```

**Visual Debugging with LangGraph Studio:**

```bash
# Start LangGraph Studio
langgraph dev

# Open in browser
http://127.0.0.1:2024

# Features:
# - Visual workflow graph
# - State inspection at each node
# - Time-travel debugging
# - Replay past executions
```

---

## Usage Examples

### 1. Quick Analysis (Recommended for First Time)

```bash
# Download and analyze 50 emails from Gmail
python -m src.email_parser.main --pull 50 --model openai
```

This single command:

- Downloads 50 emails
- Summarizes them
- Classifies into IAB taxonomy
- Saves profile to data/

### 2. Multi-Provider Analysis

```bash
# Analyze emails from both Gmail and Outlook
python -m src.email_parser.main --provider gmail outlook --max-emails 100
```

### 3. Step-by-Step Processing

```bash
# Step 1: Download only
python -m src.email_parser.main --provider gmail --max-emails 200 --download-only

# Step 2: Summarize
python -m src.email_parser.main --summarize data/emails_raw_20250128.csv

# Step 3: Classify (use different model)
python -m src.email_parser.main --classify data/emails_summarized_20250128.csv --model claude
```

### 4. Dashboard-Driven Workflow

1. Start backend and frontend (see [Starting the Application](#starting-the-application))
2. Navigate to http://localhost:3000
3. Click "New Analysis"
4. Select provider (Gmail/Outlook)
5. Choose models:
   - Email Model: Fast/cheap (gpt-4o-mini)
   - Taxonomy Model: Accurate (gpt-4o or claude-sonnet-4)
6. Set email count (50-500)
7. Click "Start Analysis"
8. Monitor progress in real-time
9. View results in Classifications tab

### 5. Using Different LLM Providers

```bash
# OpenAI (Recommended - fastest, cost-effective)
python -m src.email_parser.main --pull 100 --model openai

# Claude (Best quality, more expensive)
python -m src.email_parser.main --pull 100 --model claude

# Google Gemini (Good balance)
python -m src.email_parser.main --pull 100 --model google

# Ollama (Local, free, slower)
python -m src.email_parser.main --pull 100 --model ollama
```

### 6. Stage-Specific Models

```bash
# Use cheap model for summarization, premium for classification
EMAIL_MODEL=openai:gpt-4o-mini \
TAXONOMY_MODEL=claude:claude-sonnet-4 \
python -m src.email_parser.main --pull 100
```

---

## Development

### Project Structure

```
ownyou_consumer_application/
├── src/
│   └── email_parser/
│       ├── main.py                      # CLI entry point
│       ├── providers/                   # Email providers
│       │   ├── gmail_provider.py
│       │   └── outlook_provider.py
│       ├── llm_clients/                 # LLM integrations
│       │   ├── openai_client.py
│       │   ├── claude_client.py
│       │   └── google_client.py
│       ├── workflow/                    # LangGraph workflow
│       │   ├── graph.py                 # Workflow definition
│       │   ├── nodes/                   # Workflow nodes
│       │   │   ├── analyzers.py         # Agent nodes
│       │   │   ├── reconcile.py         # Reconciliation
│       │   │   └── update_memory.py     # Memory updates
│       │   ├── batch_optimizer.py       # Batching logic
│       │   └── state.py                 # Workflow state
│       ├── memory/                      # LangMem integration
│       │   └── manager.py
│       ├── analysis/                    # Legacy analyzers
│       ├── models/                      # Pydantic models
│       └── utils/                       # Utilities
├── dashboard/
│   ├── backend/                         # Flask API
│   │   ├── app.py                       # Flask app
│   │   ├── api/                         # API endpoints
│   │   │   ├── analyze.py               # Analysis triggers
│   │   │   ├── profile.py               # Profile retrieval
│   │   │   └── evidence.py              # Evidence endpoints
│   │   └── db/
│   │       └── queries.py               # Database queries
│   └── frontend/                        # Next.js app
│       ├── app/                         # App router
│       ├── components/                  # React components
│       └── lib/                         # Utilities
├── data/                                # Data directory
│   ├── email_parser_memory.db           # SQLite database
│   └── profile_*.json                   # Profile exports
├── logs/                                # Log files
├── tests/                               # Test suite
├── .env                                 # Configuration
├── requirements.txt                     # Python deps
└── README.md                            # This file
```

### Running Tests

```bash
# Run all tests
pytest

# Run specific test suite
pytest tests/unit/
pytest tests/integration/

# Run with coverage
pytest --cov=src --cov-report=html

# Run specific test
pytest tests/unit/test_batch_optimizer.py::test_calculate_batch_size
```

### Code Quality

```bash
# Format code
black src/ tests/

# Lint
flake8 src/

# Type checking
mypy src/

# Sort imports
isort src/ tests/
```

### Debugging

**Enable Debug Logging:**

```bash
# In .env
LOG_LEVEL=DEBUG

# Or via command line
python -m src.email_parser.main --pull 50 --debug
```

**LangGraph Studio Debugging:**

LangGraph Studio provides visual workflow debugging and real-time state inspection.

**Option 1: Auto-Start via Dashboard (Recommended)**

The dashboard can automatically start Studio when you enable visualization:

1. Navigate to http://localhost:3000/analyze
2. Check "Enable LangGraph Studio visualization" checkbox
3. Studio server automatically starts on port 2024
4. During analysis, click "View workflow in LangGraph Studio →"
5. Studio UI opens with direct link to your project

**Option 2: Manual Start via CLI**

```bash
# Start Studio manually
langgraph dev

# Set debug mode (optional)
export LANGGRAPH_STUDIO_DEBUG=true

# Run workflow
python -m src.email_parser.main --pull 10

# View in Studio at http://127.0.0.1:2024
```

**Features:**

- Visual workflow graph with node inspection
- Time-travel debugging (replay past executions)
- State inspection at each workflow step
- Real-time execution monitoring
- Evidence trail visualization

### Database Inspection

```bash
# Open SQLite database
sqlite3 data/email_parser_memory.db

# View tables
.tables

# Query memories
SELECT * FROM memories WHERE namespace LIKE '%nick%' LIMIT 10;

# Count classifications
SELECT COUNT(*) FROM memories WHERE key LIKE 'semantic_%';
```

---

## Troubleshooting

### CORS Errors (Access-Control-Allow-Origin)

**Problem:** Browser console shows CORS errors like:
```
Access to fetch at 'http://localhost:5001/api/...' from origin 'http://localhost:3000'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present
```

**Root Cause:** The frontend is making requests directly to Flask instead of using the Next.js API proxy.

**Solution:**

1. **Check frontend environment configuration:**
   ```bash
   cd dashboard/frontend
   cat .env.local
   ```

2. **Ensure `NEXT_PUBLIC_API_URL` is empty:**
   ```env
   # Correct configuration (empty = use Next.js proxy)
   NEXT_PUBLIC_API_URL=

   # WRONG - causes CORS errors
   # NEXT_PUBLIC_API_URL=http://localhost:5001
   ```

3. **Restart frontend to pick up changes:**
   ```bash
   # Kill frontend
   lsof -ti:3000 | xargs kill -9

   # Restart
   cd dashboard/frontend
   npm run dev
   ```

4. **Verify the fix:**
   - Open browser DevTools (F12)
   - Go to Network tab
   - Refresh page
   - API requests should go to `/api/...` (not `http://localhost:5001/api/...`)

**Why This Works:**
- Empty `NEXT_PUBLIC_API_URL` makes requests use relative paths (`/api/...`)
- Next.js API proxy ([app/api/[...path]/route.ts](dashboard/frontend/app/api/[...path]/route.ts)) forwards requests to Flask
- Proxy handles CORS headers and session cookies automatically
- No cross-origin requests = no CORS issues

**Prevention:** Never set `NEXT_PUBLIC_API_URL=http://localhost:5001` in development.

### Port Already in Use

**Problem:** `Address already in use` error

**Solution:**

```bash
# Kill processes on ports
lsof -ti:5001 | xargs kill -9  # Backend
lsof -ti:3000 | xargs kill -9  # Frontend

# Verify ports are free
lsof -i:5001
lsof -i:3000
```

### OAuth2 Authentication Fails

**Problem:** Gmail/Outlook authentication fails

**Solution:**

```bash
# Re-run setup wizard
python -m src.email_parser.main setup gmail

# Delete cached tokens
rm token.json          # Gmail
rm ms_token.json       # Outlook

# Check credentials file exists
ls -la credentials.json
```

### Database Locked Error

**Problem:** `database is locked`

**Solution:**

```bash
# Stop all processes
pkill -f "python.*email_parser"

# Check for locks
fuser data/email_parser_memory.db

# Remove lock file if exists
rm data/email_parser_memory.db-shm
rm data/email_parser_memory.db-wal
```

### LLM API Errors

**Problem:** `Rate limit exceeded` or `Invalid API key`

**Solution:**

```bash
# Check API key in .env
cat .env | grep API_KEY

# Test API connection
python -c "
from openai import OpenAI
client = OpenAI()
print(client.models.list())
"

# Use different provider
python -m src.email_parser.main --pull 50 --model claude
```

### Frontend Build Fails

**Problem:** `npm run build` fails

**Solution:**

```bash
# Clear cache
rm -rf dashboard/frontend/.next
rm -rf dashboard/frontend/node_modules

# Reinstall
cd dashboard/frontend
npm install

# Rebuild
npm run build
```

### No Emails Downloaded

**Problem:** Email download returns 0 emails

**Solution:**

```bash
# Check authentication
python -m src.email_parser.main setup status

# Test provider connection
python -m src.email_parser.main --provider gmail --max-emails 1 --debug

# Verify email access
# - Gmail: Check Gmail API is enabled in Google Cloud Console
# - Outlook: Check Mail.Read permission in Azure Portal
```

### Memory/Performance Issues

**Problem:** High memory usage or slow processing

**Solution:**

```bash
# Reduce batch size
export BATCH_SIZE=25

# Use faster model for EMAIL_MODEL
export EMAIL_MODEL=openai:gpt-4o-mini

# Process fewer emails
python -m src.email_parser.main --pull 50 --model openai

# Clear old data
rm data/emails_*.csv
rm data/profile_*.json
```

---

## Additional Resources

- **CLAUDE.md**: Development guidelines and architecture details
- **docs/**: Comprehensive documentation
  - `requirements/`: Feature specifications
  - `reference/`: Technical references
  - `STUDIO_QUICKSTART.md`: LangGraph Studio guide
- **tests/**: Test suite with examples
- **_archive/**: Historical documentation

## Support

For issues, questions, or contributions:

1. Check [Troubleshooting](#troubleshooting) section
2. Review existing issues in repository
3. Create new issue with:
   - Error message
   - Steps to reproduce
   - Environment details (OS, Python version)
   - Relevant logs from `logs/` directory

---

## License

[Specify your license here]

## Acknowledgments

- IAB Tech Lab for Audience Taxonomy 1.1
- LangChain/LangGraph for workflow orchestration
- OpenAI, Anthropic, Google for LLM APIs
- Email provider APIs (Gmail, Microsoft Graph)
