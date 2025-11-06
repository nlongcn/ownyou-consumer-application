# Current System

**What's implemented now: Email Parser + IAB Classification System**

Last Updated: 2025-01-04

---

## Overview

This document describes the currently working OwnYou Consumer Application system. The system successfully downloads emails from Gmail/Outlook, processes them using multiple LLM providers, and classifies users according to IAB Audience Taxonomy 1.1.

**Current Status:** Email-only IAB classification working in production. Mission Agents system in progress (Phase 1).

**When to read this:** To understand what's already built and working before adding new features.

---

## System Architecture (Current)

### High-Level Flow

```
User Authentication (OAuth2)
    ↓
Email Download (Gmail/Outlook APIs)
    ↓
Email Summarization (Fast LLM)
    ↓
IAB Classification (LangGraph Workflow)
    ↓
Memory Storage (SQLite + LangGraph Store)
    ↓
Dashboard Display (Flask + Next.js)
```

### Components

```
┌─────────────────────────────────────────────────────────┐
│                 Frontend (Next.js)                       │
│  - Dashboard UI (http://localhost:3000)                 │
│  - Classification Viewer                                 │
│  - Analytics & Visualizations                            │
│  - Real-time Updates                                     │
└───────────────────────┬─────────────────────────────────┘
                        │ REST API
┌───────────────────────▼─────────────────────────────────┐
│               Backend (Flask)                            │
│  - API Endpoints (http://localhost:5001)                │
│  - Profile Management                                    │
│  - Evidence Retrieval                                    │
│  - Analysis Triggers                                     │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│          Email Processing Pipeline                       │
│                                                          │
│  Stage 1: Download → emails_raw.csv                     │
│  Stage 2: Summarize → emails_summarized.csv             │
│  Stage 3: Classify → profile.json                       │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│           LangGraph Workflow                             │
│  - load_emails → retrieve_profile → analyze_all →       │
│    evidence_judge → reconcile → update_memory            │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│              Memory Storage                              │
│  - SQLite: email_parser_memory.db                       │
│  - JSON: profile_{user}_{timestamp}.json                │
└─────────────────────────────────────────────────────────┘
```

---

## Primary Entry Points

### Command-Line Interface (CLI)

**Main entry point:** `src/email_parser/main.py`

```bash
# Quick processing (recommended for first-time users)
python -m src.email_parser.main --pull 50 --model openai

# Advanced: Specify providers and models
python -m src.email_parser.main --provider gmail outlook --max-emails 100 --email-model openai:gpt-4o-mini --taxonomy-model claude:claude-sonnet-4

# Stage-by-stage processing
python -m src.email_parser.main --provider gmail --max-emails 200 --download-only
python -m src.email_parser.main --summarize data/emails_raw_20250104.csv
python -m src.email_parser.main --classify data/emails_summarized_20250104.csv --model claude
```

**Installed commands (after `pip install -e .`):**

```bash
email-parser --pull 50 --model openai
email-parser-setup gmail
```

### Dashboard Web Interface

**Backend:** `dashboard/backend/app.py` (Flask)

```bash
cd dashboard/backend
python app.py
# Runs on http://localhost:5001
```

**Frontend:** `dashboard/frontend/` (Next.js)

```bash
cd dashboard/frontend
npm run dev
# Runs on http://localhost:3000
```

**Dashboard features:**
- Start new analysis (select provider, model, email count)
- View IAB classifications with evidence
- Analytics charts (demographics, interests, purchase intent)
- Real-time processing status
- LangGraph Studio visualization toggle

### Account Setup

**Interactive setup wizard:**

```bash
# Setup all providers
python -m src.email_parser.main setup

# Setup specific provider
python -m src.email_parser.main setup gmail
python -m src.email_parser.main setup outlook

# Check setup status
python -m src.email_parser.main setup status
```

**What setup does:**
- Guides OAuth2 configuration (Gmail: credentials.json, Outlook: Client ID/Secret)
- Tests authentication
- Stores tokens (token.json, ms_token.json)
- Validates API access

---

## Pipeline Architecture

### Three-Stage Independent Pipeline

**Key innovation:** Each stage can run independently with persistent state between stages.

#### Stage 1: Email Download

```bash
python -m src.email_parser.main --provider gmail --max-emails 100 --download-only
```

**What happens:**
1. OAuth2 authentication (cached tokens)
2. API calls to Gmail/Outlook
3. Download emails (subject, body, sender, date, metadata)
4. Save to CSV: `data/emails_raw_{timestamp}.csv`

**Output CSV structure:**

```csv
email_id,subject,sender,date,body,metadata
email_001,Your order is ready,shop@nike.com,2025-01-01,Your Nike Air Max...,{"labels": ["INBOX"]}
email_002,Meeting tomorrow,colleague@company.com,2025-01-02,Quick reminder...,{"thread_id": "abc123"}
```

**Providers:**
- Gmail: `src/email_parser/providers/gmail_provider.py`
- Outlook: `src/email_parser/providers/outlook_provider.py`

#### Stage 2: Email Summarization

```bash
python -m src.email_parser.main --summarize data/emails_raw_20250104.csv
```

**What happens:**
1. Load raw emails from CSV
2. Call EMAIL_MODEL (fast, cheap LLM: gpt-4o-mini)
3. Extract: sender_category, content_category, key_topics, user_intent
4. Save to CSV: `data/emails_summarized_{timestamp}.csv`

**Output CSV structure:**

```csv
email_id,subject,sender_category,content_category,key_topics,user_intent
email_001,Your order is ready,E-commerce,Shopping,Nike,Air Max,purchase confirmation
email_002,Meeting tomorrow,Professional,Work,team meeting,reminder,attend meeting
```

**Why separate stage:**
- Fast iteration: Test different summarization models without re-downloading emails
- Cost savings: Summarization is cheap (gpt-4o-mini), classification is expensive (gpt-4o/claude)
- Resilience: Can resume from summaries if classification fails

#### Stage 3: IAB Classification

```bash
python -m src.email_parser.main --classify data/emails_summarized_20250104.csv --model claude
```

**What happens:**
1. Load summarized emails
2. Retrieve existing user profile from memory
3. Batch optimizer groups emails (10-20 per batch based on model context window)
4. For each batch:
   - Demographics agent analyzes (age, gender, education, ethnicity)
   - Household agent analyzes (size, income, location, composition)
   - Interests agent analyzes (hobbies, activities, content preferences)
   - Purchase intent agent analyzes (shopping behavior, brand preferences)
5. Evidence judge validates each classification (LLM-as-Judge)
6. Reconcile results (update confidence scores, merge evidence)
7. Update memory (SQLite + LangGraph Store)
8. Save profile: `data/profile_{user}_{timestamp}.json`

**LangGraph workflow:** `src/email_parser/workflow/graph.py`

---

## Batch Processing Architecture

### Why Batch Processing?

**Performance improvement: 20-30x faster**

- Single-email processing: ~3 hours for 200 emails
- Batch processing: ~6 minutes for 200 emails

**How it works:**

```python
# src/email_parser/workflow/batch_optimizer.py

class BatchOptimizer:
    def calculate_batch_size(self, model_context_window: int, emails: List[Email]) -> int:
        """
        Calculate how many emails fit in context window.

        Strategy:
        - Target 60-80% of context window (safety margin)
        - Estimate tokens per email (subject + summary ~200 tokens)
        - Account for prompt overhead (~5000 tokens)
        - Return batch size (typically 10-20 emails)
        """
        available_tokens = int(model_context_window * 0.7)  # 70% utilization
        prompt_overhead = 5000
        usable_tokens = available_tokens - prompt_overhead

        avg_tokens_per_email = 200
        batch_size = usable_tokens // avg_tokens_per_email

        return min(batch_size, 25)  # Cap at 25 for quality
```

### Batch Processing Flow

```
Input: 100 emails
Model: gpt-4o (128K context window)
Batch Size: 15 emails (calculated dynamically)

Execution:
├─ Batch 1 (emails 1-15)  → Demographics Agent → 12 classifications
│                         → Household Agent   → 8 classifications
│                         → Interests Agent   → 22 classifications
│                         → Evidence Judge     → Validates all 42
│
├─ Batch 2 (emails 16-30) → Demographics Agent → 10 classifications
│                         → Household Agent   → 6 classifications
│                         → Interests Agent   → 19 classifications
│                         → Evidence Judge     → Validates all 35
│
├─ ... (7 batches total)
│
Result: 287 validated classifications in ~6 minutes
```

### Agent Prompt Pattern

```python
# Each agent receives batch of emails
prompt = f"""
You are analyzing {len(emails)} emails to extract IAB Taxonomy classifications.

Emails:
{format_email_batch(emails)}

Current User Profile:
{existing_profile}

Task: For EACH email, identify relevant IAB categories.

Output format (JSON):
[
    {{
        "email_id": "email_001",
        "taxonomy_id": "IAB18-1",
        "taxonomy_name": "Fashion",
        "confidence": 0.85,
        "evidence": "User received emails from Nike, Adidas showing interest in athletic wear"
    }},
    {{
        "email_id": "email_002",
        "taxonomy_id": "IAB17-12",
        ...
    }}
]
"""
```

**Key insight:** Single LLM call processes multiple emails and returns multiple classifications tagged with email IDs.

---

## LangGraph Workflow

### Workflow Graph

```
         ┌──────────────┐
         │ load_emails  │ ← Load batch of emails
         └──────┬───────┘
                │
         ┌──────▼────────┐
         │retrieve_profile│ ← Get existing IAB profile from memory
         └──────┬────────┘
                │
    ┌───────────┼───────────┐
    │           │           │
┌───▼────┐ ┌───▼────┐ ┌───▼────┐
│Demo    │ │House   │ │Interest│ ← Parallel agent calls (batch processing)
│Agent   │ │Agent   │ │Agent   │
└───┬────┘ └───┬────┘ └───┬────┘
    │           │           │
    └───────────┼───────────┘
                │
         ┌──────▼────────┐
         │evidence_judge │ ← Validate each classification (LLM-as-Judge)
         └──────┬────────┘
                │
         ┌──────▼────────┐
         │  reconcile    │ ← Merge with existing profile, update confidence
         └──────┬────────┘
                │
         ┌──────▼────────┐
         │update_memory  │ ← Write to SQLite + Store
         └───────────────┘
```

### Workflow State

```python
# src/email_parser/workflow/state.py

class AgentState(TypedDict):
    """State passed through workflow"""
    user_id: str
    emails: List[Email]
    existing_profile: Dict[str, Any]

    # Agent outputs
    demographics_classifications: List[Classification]
    household_classifications: List[Classification]
    interests_classifications: List[Classification]

    # Validated results
    all_classifications: List[Classification]

    # Metadata
    processing_metadata: Dict[str, Any]
```

### Nodes

**Load Emails:**

```python
# src/email_parser/workflow/nodes/load_emails.py
def load_emails_node(state: AgentState) -> dict:
    """Load batch of emails into state"""
    return {"emails": state["emails"]}
```

**Retrieve Profile:**

```python
# src/email_parser/workflow/nodes/retrieve_profile.py
def retrieve_profile_node(state: AgentState) -> dict:
    """Get existing IAB profile from memory"""
    profile = memory_manager.get_profile(state["user_id"])
    return {"existing_profile": profile}
```

**Analyze (Agent Nodes):**

```python
# src/email_parser/workflow/nodes/analyzers.py
def demographics_agent(state: AgentState) -> dict:
    """Analyze demographics (age, gender, education)"""
    classifications = llm_client.classify_demographics(
        emails=state["emails"],
        existing_profile=state["existing_profile"]
    )
    return {"demographics_classifications": classifications}

def household_agent(state: AgentState) -> dict:
    """Analyze household (size, income, location)"""
    # Similar pattern...

def interests_agent(state: AgentState) -> dict:
    """Analyze interests (hobbies, activities)"""
    # Similar pattern...
```

**Evidence Judge:**

```python
# src/email_parser/workflow/nodes/evidence_judge.py
def evidence_judge_node(state: AgentState) -> dict:
    """Validate classifications using LLM-as-Judge"""
    all_classifications = (
        state["demographics_classifications"] +
        state["household_classifications"] +
        state["interests_classifications"]
    )

    validated = []
    for classification in all_classifications:
        # LLM validates evidence quality
        if is_evidence_valid(classification):
            validated.append(classification)

    return {"all_classifications": validated}
```

**Reconcile:**

```python
# src/email_parser/workflow/nodes/reconcile.py
def reconcile_node(state: AgentState) -> dict:
    """Merge new classifications with existing profile"""
    existing = state["existing_profile"]
    new_classifications = state["all_classifications"]

    reconciled = merge_classifications(existing, new_classifications)

    return {"all_classifications": reconciled}
```

**Update Memory:**

```python
# src/email_parser/workflow/nodes/update_memory.py
def update_memory_node(state: AgentState, store: Optional[MissionStore] = None) -> dict:
    """Write to SQLite + Store"""
    user_id = state["user_id"]
    classifications = state["all_classifications"]

    # Write to SQLite (backward compatibility)
    memory_manager.update_classifications(user_id, classifications)

    # Write to LangGraph Store (new system)
    if store:
        for c in classifications:
            store.put_iab_classification(user_id, c["taxonomy_id"], c)

    return {"memory_updated": True}
```

---

## LangGraph Studio Integration

### Visual Workflow Debugging

**LangGraph Studio provides visual workflow inspection for development:**

```bash
# Start Studio
langgraph dev

# Access UI
http://127.0.0.1:2024
```

### Features

**1. Visual Graph:**
- See all workflow nodes
- Click nodes to inspect input/output
- View edges and conditional logic

**2. Time-Travel Debugging:**
- Replay past executions
- Inspect state at each node
- Identify where classifications were created/validated

**3. State Inspection:**
- View complete state at each step
- See emails being processed
- Check agent outputs before validation

**4. Agent Behavior Analysis:**
- Which emails triggered which taxonomies?
- Why did confidence score change?
- Which evidence was used for classification?

### Configuration

**Studio configuration:** `langgraph.json` (project root)

```json
{
  "dependencies": ["src"],
  "graphs": {
    "iab_classification": "src/email_parser/workflow/studio.py:graph"
  },
  "env": ".env"
}
```

**Studio entry point:** `src/email_parser/workflow/studio.py`

```python
# Exports graph for Studio visualization
from src.email_parser.workflow.graph import create_classification_graph

graph = create_classification_graph()
```

**Checkpointer:** Local SQLite (`data/studio_checkpoints.db`)

### Dashboard Integration

**Auto-start Studio from dashboard:**

1. Navigate to http://localhost:3000/analyze
2. Check "Enable LangGraph Studio visualization"
3. Studio server auto-starts on port 2024
4. During analysis, click "View workflow in LangGraph Studio →"
5. Studio UI opens with direct link to execution

**Backend implementation:**

```python
# dashboard/backend/api/studio.py
@app.post("/api/studio/start")
def start_studio():
    """Auto-start Studio server"""
    subprocess.Popen(["langgraph", "dev"])
    return {"status": "started", "url": "http://127.0.0.1:2024"}
```

---

## Dashboard Details

### Backend API (Flask)

**File:** `dashboard/backend/app.py`

**Key endpoints:**

```python
# Profile endpoints
GET  /api/profile/<user_id>               # Get complete profile
GET  /api/profile/<user_id>/classifications  # Get all classifications

# Evidence endpoints
GET  /api/evidence/<user_id>/<taxonomy_id>  # Get evidence for classification

# Analysis endpoints
POST /api/analyze/start                   # Start new analysis
GET  /api/analyze/status/<job_id>         # Check analysis status
GET  /api/analyze/models                  # Get available LLM models

# Category endpoints
GET  /api/categories/demographics         # Get demographics categories
GET  /api/categories/interests            # Get interests categories
GET  /api/categories/household            # Get household categories

# Studio endpoints
POST /api/studio/start                    # Auto-start Studio
GET  /api/studio/status                   # Check if Studio running
```

**Database queries:** `dashboard/backend/db/queries.py`

```python
def get_user_profile(user_id: str) -> Dict:
    """Query SQLite for user profile"""
    conn = get_db_connection()
    # Query memories table
    profile = conn.execute("""
        SELECT * FROM memories
        WHERE namespace LIKE ? AND key LIKE 'semantic_%'
    """, (f"%{user_id}%",)).fetchall()
    return format_profile(profile)
```

### Frontend (Next.js)

**Structure:** `dashboard/frontend/`

```
app/
├── page.tsx                    # Home (dashboard overview)
├── analytics/page.tsx          # Analytics charts
├── categories/page.tsx         # Browse IAB categories
├── evidence/page.tsx           # View evidence for classifications
├── profile/page.tsx            # User profile display
└── api/[...path]/route.ts     # API proxy (avoids CORS)

components/
├── ClassificationCard.tsx      # Individual classification display
├── AnalyticsChart.tsx          # Recharts visualizations
├── EvidenceList.tsx            # Evidence display with email excerpts
└── CategoryBrowser.tsx         # IAB taxonomy browser

lib/
├── api.ts                      # API client (fetch wrapper)
└── types.ts                    # TypeScript types
```

**API proxy pattern:**

```typescript
// app/api/[...path]/route.ts
export async function GET(request: Request, { params }: { params: { path: string[] } }) {
  // Proxy requests to Flask backend
  const path = params.path.join('/');
  const response = await fetch(`http://localhost:5001/api/${path}`, {
    headers: {
      'Cookie': request.headers.get('Cookie') || '',  // Forward session cookies
    },
  });
  return response;
}
```

**Why proxy:** Avoids CORS issues, handles session cookies correctly.

### Real-Time Updates

**Implementation:** Server-Sent Events (SSE)

```python
# Backend: Streaming progress updates
@app.get("/api/analyze/stream/<job_id>")
def stream_analysis_progress(job_id: str):
    def generate():
        while not analysis_complete(job_id):
            status = get_analysis_status(job_id)
            yield f"data: {json.dumps(status)}\n\n"
            time.sleep(1)
    return Response(generate(), mimetype="text/event-stream")

# Frontend: Listen for updates
const eventSource = new EventSource(`/api/analyze/stream/${jobId}`);
eventSource.onmessage = (event) => {
  const status = JSON.parse(event.data);
  updateProgressBar(status.progress);
};
```

---

## Configuration

### Environment Variables (.env)

**Critical settings:**

```env
# LLM Providers
LLM_PROVIDER=openai                     # Primary provider
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...

# Stage-Specific Models
EMAIL_MODEL=openai:gpt-4o-mini          # Fast model for summarization
TAXONOMY_MODEL=openai:gpt-4o            # Accurate model for classification

# Memory
MEMORY_BACKEND=sqlite
MEMORY_DATABASE_PATH=/path/to/data/email_parser_memory.db

# Email Providers
GMAIL_CREDENTIALS_FILE=credentials.json
GMAIL_TOKEN_FILE=token.json
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
MICROSOFT_TOKEN_FILE=ms_token.json

# Processing
MAX_EMAILS=500
BATCH_SIZE=50
LOG_LEVEL=INFO

# LangGraph Studio (Optional)
LANGSMITH_ORG_ID=your_org_id
LANGSMITH_PROJECT_ID=your_project_id
```

**Config loading:** `src/email_parser/utils/config.py`

```python
from dotenv import load_dotenv
import os

load_dotenv()

class Config:
    # LLM
    LLM_PROVIDER = os.getenv("LLM_PROVIDER", "openai")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

    # Models
    EMAIL_MODEL = os.getenv("EMAIL_MODEL", "openai:gpt-4o-mini")
    TAXONOMY_MODEL = os.getenv("TAXONOMY_MODEL", "openai:gpt-4o")

    # Memory
    MEMORY_DATABASE_PATH = os.getenv("MEMORY_DATABASE_PATH")

    # Processing
    MAX_EMAILS = int(os.getenv("MAX_EMAILS", "500"))
    BATCH_SIZE = int(os.getenv("BATCH_SIZE", "50"))
```

### Model Configuration

**Supported LLM providers:**

```python
# OpenAI (Recommended)
LLM_PROVIDER=openai
OPENAI_MODEL=gpt-4o              # Accurate, fast, cost-effective
# or
OPENAI_MODEL=gpt-4o-mini         # Cheaper, faster, good for summaries

# Claude (Best quality)
LLM_PROVIDER=claude
ANTHROPIC_MODEL=claude-sonnet-4-20250514  # Premium quality

# Google Gemini (Good balance)
LLM_PROVIDER=google
GOOGLE_MODEL=gemini-2.0-flash-exp

# Ollama (Local, free)
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=deepseek-r1:70b     # Requires local Ollama server
```

**Stage-specific models:**

```bash
# Use cheap model for summaries, premium for classification
EMAIL_MODEL=openai:gpt-4o-mini \
TAXONOMY_MODEL=claude:claude-sonnet-4 \
python -m src.email_parser.main --pull 100
```

---

## Data Storage

### SQLite Database

**File:** `data/email_parser_memory.db`

**Schema:**

```sql
-- LangGraph Store memories table
CREATE TABLE memories (
    namespace TEXT,     -- Namespace tuple as string
    key TEXT,          -- Memory key
    value BLOB,        -- JSON data
    created_at TEXT,
    updated_at TEXT,
    PRIMARY KEY (namespace, key)
);

-- Example rows
namespace                           key                    value (JSON)
-----------------------------------|----------------------|------------------
ownyou.iab_classifications.nick    semantic_IAB1-1        {"confidence": 0.85, ...}
ownyou.iab_classifications.nick    semantic_IAB18-3       {"confidence": 0.92, ...}
ownyou.user_preferences.nick       preferences            {"disable_shopping": false}
```

**Access:**

```bash
# Inspect database
sqlite3 data/email_parser_memory.db

# View tables
.tables

# Query classifications
SELECT namespace, key, json_extract(value, '$.confidence')
FROM memories
WHERE namespace LIKE '%nick%' AND key LIKE 'semantic_%';

# Count classifications
SELECT COUNT(*) FROM memories WHERE key LIKE 'semantic_%';
```

### JSON Profile Exports

**File:** `data/profile_{user}_{timestamp}.json`

**Structure:**

```json
{
  "schema_version": "2.0",
  "user_id": "nick",
  "generated_at": "2025-01-04T10:00:00Z",

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
        "GitHub notifications",
        "Stack Overflow digests"
      ]
    }
  ],

  "household": { ... },
  "purchase_intent": [ ... ]
}
```

---

## Testing

### Test Organization

```
tests/
├── unit/                        # Unit tests
│   ├── test_batch_optimizer.py
│   └── test_memory_manager.py
├── integration/                 # Integration tests
│   ├── test_complete_system.py  # Master system test
│   └── test_iab_store_integration.py
├── mission_agents/              # Mission agent tests (new)
│   ├── memory/
│   └── models/
└── dashboard/                   # API tests
    └── test_api.py
```

### Running Tests

```bash
# All tests
pytest

# Specific test file
pytest tests/unit/test_batch_optimizer.py

# With coverage
pytest --cov=src --cov-report=html

# Integration tests only
pytest tests/integration/

# Verbose output
pytest -v
```

### Master System Test

**File:** `tests/integration/test_complete_system.py`

**What it tests:**
- Email download (mocked providers)
- Email summarization
- IAB classification workflow
- Batch processing
- Memory storage (SQLite + Store)
- Profile export

**Run before commits:**

```bash
pytest tests/integration/test_complete_system.py -v
```

---

## Logging

### Log Files

**Location:** `logs/email_parser_{timestamp}.log`

**Structure:**

```
2025-01-04 10:00:00 INFO [main] Starting email parser
2025-01-04 10:00:05 INFO [gmail_provider] Authenticated successfully
2025-01-04 10:00:10 INFO [gmail_provider] Downloaded 50 emails
2025-01-04 10:00:15 INFO [summarizer] Summarized 50 emails
2025-01-04 10:00:20 INFO [batch_optimizer] Calculated batch size: 15
2025-01-04 10:01:30 INFO [demographics_agent] Classified 15 emails → 12 classifications
2025-01-04 10:02:45 INFO [evidence_judge] Validated 42 classifications
2025-01-04 10:03:00 INFO [update_memory] Updated memory with 42 classifications
```

**Log levels:**

```bash
# Set in .env
LOG_LEVEL=DEBUG    # Very verbose (development)
LOG_LEVEL=INFO     # Standard (production)
LOG_LEVEL=WARNING  # Errors only
```

---

## Performance Characteristics

### Typical Processing Times

```
50 emails:
├─ Download: 10-20 seconds
├─ Summarization: 30-60 seconds (gpt-4o-mini)
├─ Classification: 2-4 minutes (gpt-4o, batched)
└─ Total: ~5 minutes

200 emails:
├─ Download: 30-60 seconds
├─ Summarization: 2-3 minutes
├─ Classification: 6-10 minutes (gpt-4o, batched)
└─ Total: ~12 minutes

500 emails:
├─ Download: 1-2 minutes
├─ Summarization: 5-8 minutes
├─ Classification: 15-25 minutes
└─ Total: ~30 minutes
```

### Cost Estimates (OpenAI gpt-4o)

```
50 emails:
├─ Summarization: $0.05 (gpt-4o-mini)
├─ Classification: $0.30 (gpt-4o, batched)
└─ Total: ~$0.35

200 emails:
├─ Summarization: $0.20
├─ Classification: $1.20
└─ Total: ~$1.40

500 emails:
├─ Summarization: $0.50
├─ Classification: $3.00
└─ Total: ~$3.50
```

---

## Known Limitations

### Current System

1. **Email-only:** Only processes emails (no calendar, financial, photos yet)
2. **Single-user:** One user per system (multi-user in Phase 1)
3. **Local processing:** No cloud deployment yet (Phase 7)
4. **SQLite only:** No PostgreSQL support yet (Phase 7)
5. **No Mission Agents:** IAB classification only (Mission Agents in Phase 1-3)

### Planned Improvements

**Phase 1 (In Progress):**
- Self-sovereign authentication (wallet-based)
- Multi-user support
- Mission Agent foundation (data models, Store)

**Phase 2:**
- Multi-source connectors (calendar, financial, photos, health, social, browsing)
- IAB classification for all sources

**Phase 3:**
- Mission Agents (shopping, restaurant, travel, events, bill, health, cooking, content)
- Trigger system (memory, schedule, user, external)

**Phase 4:**
- REST API for Mission Cards
- Feedback processing with LLM analysis

**Phase 5:**
- React Native consumer app

**Phase 6:**
- BBS+ pseudonymous IDs
- Publisher SSO SDK integration

**Phase 7:**
- PostgreSQL migration
- Production deployment
- Performance optimization

---

## Related Documentation

- **Project Structure**: `reference/PROJECT_STRUCTURE.md` - Detailed file organization
- **Architectural Decisions**: `reference/ARCHITECTURAL_DECISIONS.md` - Critical constraints
- **Development Guidelines**: `reference/DEVELOPMENT_GUIDELINES.md` - Coding standards
- **Strategic Roadmap**: `docs/plans/2025-01-04-ownyou-strategic-roadmap.md` - Phase planning
- **README**: `README.md` - Installation and usage guide
- **Studio Quickstart**: `docs/STUDIO_QUICKSTART.md` - LangGraph Studio guide

---

**Remember:** This is what's working NOW. For what's planned, see the Strategic Roadmap.
