# LangGraph Studio - Quick Start Guide

**Get visual workflow debugging in 5 minutes**

---

## What You'll Get

- 📊 **Visual graph** of your email classification workflow
- 🔍 **Real-time state inspection** at each processing node
- ⏪ **Time-travel debugging** to replay and inspect past executions
- 🎯 **Agent behavior analysis** see which emails trigger which classifications

---

## Prerequisites

- Email parser installed and working
- Python environment active
- Emails successfully processing via CLI or dashboard

---

## Installation (2 minutes)

### Step 1: Install LangGraph CLI

```bash
pip install langgraph-cli
```

### Step 2: Verify Installation

```bash
langgraph --version
# Should output: langgraph-cli, version 0.1.0 (or higher)
```

---

## Configuration (1 minute)

The configuration files are already in your project:

**`langgraph.json`** (project root):
```json
{
  "dependencies": ["."],
  "graphs": {
    "email_taxonomy_workflow": "./src/email_parser/workflow/studio.py:create_graph"
  },
  "env": ".env"
}
```

**`src/email_parser/workflow/studio.py`** (Studio entry point):
- Already configured to use local SQLite storage
- No cloud dependencies required
- Uses same memory database as production

---

## Usage (2 minutes)

### Step 1: Start Studio

From project root:

```bash
langgraph dev --allow-blocking
```

**Why `--allow-blocking`?**
The memory manager uses synchronous file I/O (creating SQLite database directories). This is fine for local development but LangGraph Studio's dev mode warns about it. The `--allow-blocking` flag tells Studio this is intentional.

**Expected Output:**
```
Ready!
- API: http://127.0.0.1:2024
- Studio UI: https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024
- Docs: http://127.0.0.1:2024/docs
```

### Step 2: Open Studio UI

Open browser to: **http://127.0.0.1:2024**

### Step 3: Select Graph

Click on **`email_taxonomy_workflow`** in the left sidebar

### Step 4: View Workflow

You'll see a visual representation of:
- **load_emails** → Filter new emails
- **retrieve_profile** → Load existing classifications
- **analyze_all** → Run 4 agent analyzers
- **reconcile** → Update confidence scores
- **update_memory** → Save to database

---

## Visualizing Your CLI Runs (NEW!)

### Run Your Actual Email Parser in Studio

To see your **real production runs** in Studio:

**Terminal 1: Start Studio**
```bash
langgraph dev --allow-blocking
```

**Terminal 2: Run email_parser with debug mode**
```bash
# Enable Studio visualization
export LANGGRAPH_STUDIO_DEBUG=true

# Run your normal command
python -m src.email_parser.main --iab-csv emails.csv --user-id user_123

# Or with Gmail
python -m src.email_parser.main --iab-profile --provider gmail --max-emails 50
```

**What You'll See:**
- CLI logs show thread ID and Studio URL
- Open Studio UI → Click "Threads" tab
- Find your thread (e.g., `user_123_a1b2c3d4`)
- Click to view execution with full state at each node!

**Note:** The workflow runs normally but saves checkpoints so Studio can display it.

---

## Testing Workflow (5 minutes)

### Sample Input

Click "New Thread" and provide test data:

```json
{
  "user_id": "test_user",
  "emails": [
    {
      "id": "test_001",
      "subject": "Weekly Cryptocurrency Market Analysis",
      "body": "Bitcoin reached new highs this week. Ethereum continues strong performance in DeFi sector. Investment opportunities in alt coins...",
      "date": "2025-01-15"
    }
  ]
}
```

### Execute

1. Click **"Run"** button
2. Watch nodes execute in real-time
3. Green checkmarks show completed nodes

### Inspect Results

Click on any node to see:
- **Input State**: What data entered the node
- **Output State**: What data left the node
- **Agent Decisions**: Which classifications were made
- **Confidence Scores**: How evidence affected scores

---

## Key Features

### 1. Graph Visualization

**See your workflow structure:**
- Nodes = Processing steps
- Edges = Data flow
- Conditional routes = Decision points

### 2. State Inspector

**Drill down into data:**
```python
# Click "retrieve_profile" node
{
  "existing_profile": {
    "interests": [
      {
        "taxonomy_id": 342,
        "value": "Cryptocurrency",
        "confidence": 0.75,
        "evidence_count": 3
      }
    ]
  }
}
```

### 3. Time-Travel Debugging

**Replay any execution:**
1. Click "History" tab
2. Select past run
3. Step through nodes
4. Inspect state at each step

### 4. Batch Processing Visibility

**See email batching:**
- How many emails per batch
- Which emails grouped together
- Batch size optimization decisions

---

## Common Workflows

### Debug Agent Classification

**Issue**: Agent not classifying correctly

**Studio Workflow**:
1. Run test email
2. Click "analyze_all" node
3. Inspect `agent_results`
4. See which taxonomies were selected and why
5. Check `reasoning` field

### Understand Confidence Changes

**Issue**: Confidence score unexpectedly low/high

**Studio Workflow**:
1. Run email that should affect confidence
2. Click "reconcile" node
3. Compare `existing_profile` vs `reconciliation_data`
4. See evidence type (confirming/contradicting)
5. Check confidence calculation

### Track Evidence Trail

**Issue**: Want to see which emails support a classification

**Studio Workflow**:
1. Run multiple test emails
2. Click "update_memory" node
3. Inspect `updated_profile`
4. See `supporting_evidence` list
5. Map back to email IDs

---

## Tips & Tricks

### Auto-Reload on Code Changes

Studio automatically reloads when you edit code:

```bash
# Terminal 1: Keep Studio running
langgraph dev

# Terminal 2: Edit code
vim src/email_parser/agents/interests_agent.py

# Studio reloads automatically - test immediately!
```

### Filter Logs

Use Studio console to see only relevant logs:

```javascript
// In browser console
filter('interests')  // Show only interests agent logs
```

### Save Interesting Runs

Bookmark runs for later:
1. Complete a run
2. Click "⭐" icon
3. Access via "Bookmarks" tab

### Export State for Analysis

Download state as JSON:
1. Click on any node
2. Click "Export" button
3. Analyze in external tools

---

## Troubleshooting

### Studio Won't Start

**Error**: `Port 2024 already in use`

**Solution**:
```bash
# Kill existing process
lsof -i :2024
kill -9 <PID>

# Or use different port
langgraph dev --port 3024
```

### Graph Not Loading

**Error**: `Graph not found`

**Solution**:
1. Check `langgraph.json` exists in project root
2. Verify `studio.py` path is correct
3. Ensure PYTHONPATH includes project root:
   ```bash
   export PYTHONPATH="${PYTHONPATH}:$(pwd)"
   ```

### Import Errors

**Error**: `ModuleNotFoundError: No module named 'src'`

**Solution**:
```bash
# Run from project root
cd /path/to/email_parser
langgraph dev
```

### Checkpoint Database Locked

**Error**: `database is locked`

**Solution**:
```bash
# Delete checkpoint database (safe, only affects Studio)
rm data/studio_checkpoints.db*

# Restart Studio
langgraph dev --allow-blocking
```

### BlockingError: Blocking call to os.mkdir

**Error**: `BlockingError: Blocking call to os.mkdir` or "Failed to preview graph"

**Cause**: Memory manager creates database directories using synchronous I/O

**Solution**:
```bash
# Use --allow-blocking flag (recommended for local dev)
langgraph dev --allow-blocking
```

This is normal for local development and doesn't affect functionality.

---

## Next Steps

### Learn More

- 📖 **Technical Spec**: `docs/technical/LANGGRAPH_STUDIO_INTEGRATION.md`
- ✅ **Implementation Guide**: `docs/tasks/LANGGRAPH_STUDIO_IMPLEMENTATION_CHECKLIST.md`
- 🔧 **Checkpointer Options**: `docs/reference/CHECKPOINTER_OPTIONS.md`

### Advanced Usage

- **LangSmith Integration**: Optional cloud monitoring (coming soon)
- **Custom Metadata**: Add node descriptions for better visualization
- **Streaming**: Real-time progress updates during long runs

### Team Collaboration

- Share interesting runs via exported JSON
- Document edge cases with bookmarked executions
- Create test suites from Studio examples

---

## Privacy & Security

### What Data Does Studio See?

Studio has access to:
- ✅ Email summaries (same as production workflow)
- ✅ Agent classifications and reasoning
- ✅ Confidence scores and evidence
- ✅ Memory database state

Studio does NOT:
- ❌ Send data to cloud (runs 100% locally)
- ❌ Store raw email content (same as production)
- ❌ Require internet (except for LLM API calls)
- ❌ Expose ports beyond localhost

### Where is Data Stored?

- **Checkpoints**: `data/studio_checkpoints.db` (local SQLite)
- **Memory**: `data/email_parser_memory.db` (same as production)
- **Logs**: Standard application logs

All data stays on your machine. Delete checkpoint file anytime:
```bash
rm data/studio_checkpoints.db
```

---

## Support

### Questions?

- Read technical docs: `docs/technical/LANGGRAPH_STUDIO_INTEGRATION.md`
- Check implementation guide: `docs/tasks/LANGGRAPH_STUDIO_IMPLEMENTATION_CHECKLIST.md`
- Review reference docs: `docs/reference/CHECKPOINTER_OPTIONS.md`

### Found a Bug?

Open an issue with:
- Studio version (`langgraph --version`)
- Error message
- Steps to reproduce
- Expected vs actual behavior

---

**Ready to debug visually?**

```bash
langgraph dev --allow-blocking
```

Open https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024 and start exploring!
