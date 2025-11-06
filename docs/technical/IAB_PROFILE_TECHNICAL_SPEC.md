# IAB Taxonomy Profile Generator - Technical Specification

**Version:** 1.0
**Last Updated:** 2025-10-01
**Status:** Production Ready

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Core Features](#core-features)
4. [CLI Reference](#cli-reference)
5. [Output Specification](#output-specification)
6. [Workflow Details](#workflow-details)
7. [Memory & Persistence](#memory--persistence)
8. [Cost Tracking](#cost-tracking)
9. [Testing](#testing)
10. [API Usage](#api-usage)

---

## System Overview

### Purpose

The IAB Taxonomy Profile Generator analyzes email communications and generates evidence-based consumer profiles mapped to the **IAB Tech Lab Audience Taxonomy 1.1** standard. The system uses LLM-powered analysis with persistent memory to track confidence evolution across multiple sessions.

### Key Capabilities

- **Taxonomy-Compliant Profiling**: Maps to 1,568 IAB taxonomy categories
- **Confidence Evolution**: Bayesian confidence updates with evidence tracking
- **Incremental Processing**: Processes only new emails across sessions
- **Multi-Provider LLM**: Supports OpenAI, Claude, and Ollama
- **SQLite Persistence**: Zero-configuration local database storage
- **Cost Tracking**: Per-email and per-provider cost reporting

### Design Philosophy

- **Privacy-First**: Local processing, no cloud storage
- **Zero Setup**: SQLite-based, no database server required
- **Incremental**: Process only what's new
- **Transparent**: Full cost and confidence tracking
- **Extensible**: Ready for future data sources

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────┐
│                    CLI Layer                         │
│  (main.py - Argument parsing & orchestration)        │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│              LangGraph Workflow                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │  Load    │→ │ Retrieve │→ │ Route    │          │
│  │  Emails  │  │ Profile  │  │ Email    │          │
│  └──────────┘  └──────────┘  └────┬─────┘          │
│                                    │                 │
│  ┌─────────────────────────────────▼──────────────┐ │
│  │         Analyzer Nodes (Parallel)               │ │
│  │  ┌──────────────┐  ┌──────────────┐           │ │
│  │  │Demographics  │  │  Household   │           │ │
│  │  └──────────────┘  └──────────────┘           │ │
│  │  ┌──────────────┐  ┌──────────────┐           │ │
│  │  │  Interests   │  │  Purchase    │           │ │
│  │  └──────────────┘  └──────────────┘           │ │
│  └─────────────────────────────────┬──────────────┘ │
│                                    │                 │
│  ┌──────────────┐  ┌──────────┐  ┌▼─────────┐      │
│  │  Reconcile   │→ │  Update  │→ │ Export   │      │
│  │  Evidence    │  │  Memory  │  │ Profile  │      │
│  └──────────────┘  └──────────┘  └──────────┘      │
└─────────────────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│           Persistent Memory (SQLite)                 │
│  ┌────────────────┐  ┌────────────────┐            │
│  │Semantic Memory │  │Episodic Memory │            │
│  │(Taxonomy Facts)│  │(Email Records) │            │
│  └────────────────┘  └────────────────┘            │
└─────────────────────────────────────────────────────┘
```

### Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Workflow Engine** | LangGraph | State machine orchestration |
| **Memory System** | LangMem + SQLite | Persistent semantic/episodic memory |
| **LLM Integration** | OpenAI/Claude/Ollama | Content analysis |
| **Data Validation** | Pydantic | Schema validation |
| **CLI Framework** | argparse | Command-line interface |
| **Testing** | pytest | Automated testing |

---

## Core Features

### 1. IAB Taxonomy Mapping

**Taxonomy Coverage:**
- **Demographics** (rows 11-62): Age, Gender, Education, Occupation
- **Household** (rows 64-168): Location, Income, Property details
- **Personal Finance** (rows 175-207): Income levels, Net worth
- **Interests** (rows 209-704): 20+ major categories
- **Purchase Intent** (rows 707-1568): Product/service categories

**Taxonomy IDs:**
- Total taxonomy entries: 1,568
- Hierarchical structure: 5-tier depth
- Unique ID per entry

### 2. Confidence Evolution

**Bayesian Confidence Updates:**

```python
# Confirming evidence (same classification)
new_confidence = existing_confidence + (1 - existing_confidence) * confirmation_factor

# Contradicting evidence (different classification)
new_confidence = existing_confidence * (1 - contradiction_penalty)
```

**Confidence Thresholds:**
- High: ≥ 0.80
- Moderate: 0.60 - 0.79
- Low: < 0.60

**Evidence Tracking:**
- Supporting evidence: Email IDs confirming classification
- Contradicting evidence: Email IDs suggesting different classification
- Evidence count: Total number of supporting emails

### 3. Incremental Processing

**Session-Based Processing:**

1. **First Run**: Process all emails, store results
2. **Subsequent Runs**: Skip already-processed emails
3. **Force Reprocess**: Optional flag to reprocess all

**Processed Email Tracking:**
- SQLite table: `processed_emails`
- Namespace: `{user_id}/processed_emails`
- Key: email ID
- Value: processing metadata

### 4. Multi-Provider LLM Support

**Supported Providers:**

| Provider | Models | Pricing | Use Case |
|----------|--------|---------|----------|
| **OpenAI** | gpt-4o-mini, gpt-4o | $0.15-$10/1M tokens | Balanced performance |
| **Claude** | Sonnet 4, Sonnet 3.5 | $3-$15/1M tokens | Premium quality |
| **Ollama** | Any local model | Free | Privacy-focused |

**Configuration:**
```bash
# .env file
LLM_PROVIDER=openai  # or claude, ollama
OPENAI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
OLLAMA_BASE_URL=http://localhost:11434
```

---

## CLI Reference

### Command Structure

```bash
python -m src.email_parser.main [MODE] [OPTIONS]
```

### IAB Profile Generation Modes

#### Mode 1: From CSV File

```bash
python -m src.email_parser.main \
  --iab-csv <csv_file> \
  --iab-output <output_file> \
  [--user-id <user_id>] \
  [--force-reprocess]
```

**Parameters:**
- `--iab-csv`: Path to CSV file with email data
- `--iab-output`: Output JSON file path (default: `iab_consumer_profile.json`)
- `--user-id`: User identifier for multi-session tracking (optional)
- `--force-reprocess`: Reprocess all emails, ignore already-processed

**CSV Format:**
```csv
ID,Date,From,Subject,Summary
email_1,2025-01-01,sender@example.com,Subject Line,Email summary text
```

**Example:**
```bash
python -m src.email_parser.main \
  --iab-csv emails.csv \
  --iab-output profile.json \
  --user-id user_123
```

#### Mode 2: From Email Provider (Gmail/Outlook)

```bash
python -m src.email_parser.main \
  --iab-profile \
  --provider <gmail|outlook> \
  --max-emails <number> \
  --iab-output <output_file> \
  [--user-id <user_id>]
```

**Parameters:**
- `--iab-profile`: Enable IAB profile generation mode
- `--provider`: Email provider (gmail, outlook, hotmail)
- `--max-emails`: Number of emails to download (default: 50)
- `--iab-output`: Output JSON file
- `--user-id`: User identifier (optional)

**Example:**
```bash
python -m src.email_parser.main \
  --iab-profile \
  --provider gmail \
  --max-emails 100 \
  --user-id user_123
```

### Advanced Options

#### LLM Provider Configuration

```bash
# Use specific LLM provider (overrides .env)
LLM_PROVIDER=claude python -m src.email_parser.main --iab-csv emails.csv
```

#### Memory Backend Configuration

```bash
# Use custom SQLite database path
MEMORY_DATABASE_PATH=custom/path.db python -m src.email_parser.main --iab-csv emails.csv
```

#### Cost Tracking

Cost tracking is **automatic** and included in output logs:

```
IAB Profile Generation Complete:
  User: user_123
  Emails Processed: 50
  LLM Cost: $0.0045 USD ($0.0001 per email)
    openai: $0.0045
```

---

## Output Specification

### JSON Schema

```json
{
  "user_id": "string",
  "profile_version": 1,
  "generated_at": "ISO8601 timestamp",
  "schema_version": "1.0",
  "generator": {
    "system": "email_parser_iab_taxonomy",
    "llm_model": "provider:model",
    "workflow_version": "1.0"
  },
  "data_coverage": {
    "total_emails_analyzed": 0,
    "emails_this_run": 0,
    "date_range": "YYYY-MM-DD to YYYY-MM-DD"
  },
  "demographics": {
    "age_range": "string|null",
    "gender": "string|null",
    "education": "string|null",
    "occupation": "string|null",
    "marital_status": "string|null",
    "language": "string|null"
  },
  "household": {
    "location": "string|null",
    "income": "string|null",
    "length_of_residence": "string|null",
    "life_stage": "string|null",
    "median_home_value": "string|null",
    "monthly_housing_payment": "string|null",
    "number_of_adults": "string|null",
    "number_of_children": "string|null",
    "number_of_individuals": "string|null",
    "ownership": "string|null",
    "property_type": "string|null",
    "urbanization": "string|null"
  },
  "personal_finance": null,
  "interests": [
    {
      "taxonomy_id": 0,
      "tier_path": "string",
      "value": "string",
      "confidence": 0.0,
      "evidence_count": 0,
      "last_validated": "ISO8601 timestamp",
      "days_since_validation": 0
    }
  ],
  "purchase_intent": [...],
  "actual_purchases": [...],
  "memory_stats": {
    "total_facts_stored": 0,
    "high_confidence_facts": 0,
    "moderate_confidence_facts": 0,
    "low_confidence_facts": 0,
    "facts_needing_validation": 0,
    "average_confidence": 0.0
  },
  "section_confidence": {
    "demographics": 0.0,
    "household": 0.0,
    "interests": 0.0,
    "purchase_intent": 0.0,
    "actual_purchases": 0.0
  }
}
```

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `user_id` | string | Unique user identifier |
| `taxonomy_id` | integer | IAB taxonomy ID (1-1568) |
| `tier_path` | string | Hierarchical path (e.g., "Interest \| Technology") |
| `confidence` | float | Confidence score 0.0-1.0 |
| `evidence_count` | integer | Number of supporting emails |
| `last_validated` | string | ISO8601 timestamp of last update |
| `days_since_validation` | integer | Days since last evidence |

---

## Workflow Details

### Node Execution Flow

1. **load_emails**: Load and filter new emails
2. **retrieve_profile**: Get existing memories from SQLite
3. **route_email**: Determine which analyzers to run
4. **analyzers** (parallel): Run demographic/household/interest/purchase analyzers
5. **reconcile**: Update confidence scores with Bayesian logic
6. **update_memory**: Store results and mark emails processed
7. **export**: Build and export JSON profile

### Routing Logic

```python
def route_email(email):
    routes = []

    # Check for demographic signals
    if contains_personal_info(email):
        routes.append("demographics")

    # Check for household signals
    if contains_location_or_property(email):
        routes.append("household")

    # Check for interest signals
    if contains_topic_or_hobby(email):
        routes.append("interests")

    # Check for purchase signals
    if contains_order_or_product(email):
        routes.append("purchase")

    return routes if routes else ["interests"]  # default
```

### LLM Prompts

**Demographics Analyzer:**
```
Analyze this email and identify any demographic information:
- Age range
- Gender
- Education level
- Occupation
- Marital status
- Language

Email: {email_content}

Taxonomy options: {taxonomy_context}

Return JSON with taxonomy_id and confidence for each match.
```

**Interests Analyzer:**
```
Analyze this email and identify the user's interests:

Email: {email_content}

Available taxonomy categories:
{taxonomy_context}

Return JSON with taxonomy_id, value, confidence, and reasoning.
```

---

## Memory & Persistence

### SQLite Schema

**Memories Table:**
```sql
CREATE TABLE memories (
    namespace TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (namespace, key)
);

CREATE INDEX idx_namespace ON memories(namespace);
CREATE INDEX idx_key ON memories(key);
CREATE INDEX idx_namespace_key ON memories(namespace, key);
```

### Memory Types

**1. Semantic Memory** (Taxonomy Classifications)

Namespace: `{user_id}/iab_taxonomy_profile`
Key: `semantic_interests_{taxonomy_id}_{value}`

```json
{
  "memory_id": "semantic_interests_342_cryptocurrency",
  "taxonomy_id": 342,
  "category_path": "Interest | Cryptocurrency",
  "value": "Cryptocurrency",
  "confidence": 0.88,
  "evidence_count": 2,
  "supporting_evidence": ["email_1", "email_2"],
  "contradicting_evidence": [],
  "first_observed": "2025-10-01T00:00:00Z",
  "last_validated": "2025-10-01T00:00:00Z",
  "section": "interests"
}
```

**2. Episodic Memory** (Email Records)

Namespace: `{user_id}/iab_taxonomy_profile`
Key: `episodic_email_{email_id}`

```json
{
  "episode_id": "episodic_email_123",
  "email_id": "123",
  "taxonomy_selections": [342, 156],
  "confidence_contributions": {"342": 0.85, "156": 0.80},
  "processed_at": "2025-10-01T00:00:00Z",
  "llm_model": "openai:gpt-4o-mini"
}
```

**3. Processed Emails Tracking**

Namespace: `{user_id}/processed_emails`
Key: `{email_id}`

```json
{
  "processed_at": "2025-10-01T00:00:00Z",
  "session_id": "abc123"
}
```

### Backup & Migration

**Export all memories:**
```bash
python scripts/export_memories.py \
  --db data/email_parser_memory.db \
  --output backup.json
```

**Import memories:**
```bash
python scripts/import_memories.py \
  --input backup.json \
  --db data/new_database.db
```

**Merge with existing:**
```bash
python scripts/import_memories.py \
  --input backup.json \
  --db data/email_parser_memory.db \
  --merge
```

---

## Cost Tracking

### Pricing (as of 2025-10-01)

| Provider | Model | Input (per 1M tokens) | Output (per 1M tokens) |
|----------|-------|----------------------|------------------------|
| OpenAI | gpt-4o-mini | $0.15 | $0.60 |
| OpenAI | gpt-4o | $2.50 | $10.00 |
| Claude | Sonnet 4 | $3.00 | $15.00 |
| Claude | Sonnet 3.5 | $3.00 | $15.00 |
| Ollama | All models | $0.00 | $0.00 |

### Cost Tracking Output

**Per-Session Summary:**
```
=== LLM COST SUMMARY ===
Total Calls: 15
Total Tokens: 45,230
Total Cost: $0.0123 USD
Cost per Email: $0.0008 USD

=== BY PROVIDER ===
openai:
  Calls: 15
  Tokens: 45,230
  Cost: $0.0123 USD
```

### Cost Estimation

**Formula:**
```python
cost = (prompt_tokens / 1_000_000 * input_rate) + \
       (completion_tokens / 1_000_000 * output_rate)
```

**Typical Costs:**
- Single email analysis (gpt-4o-mini): ~$0.0001-0.0003
- 100 emails (gpt-4o-mini): ~$0.01-0.03
- 100 emails (Claude Sonnet 4): ~$0.15-0.25

---

## Testing

### Test Suite

**Unit Tests:**
```bash
pytest tests/unit/test_cost_tracker.py -v
# 9/9 tests passing
```

**Integration Tests:**
```bash
pytest tests/integration/test_sqlite_persistence.py -v
# 9/9 tests passing
```

**Manual E2E Tests:**
```bash
# Multi-session confidence evolution
./tests/manual/test_confidence_evolution.sh
```

### Test Coverage

| Component | Coverage | Tests |
|-----------|----------|-------|
| Cost Tracking | 100% | 9/9 passing |
| SQLite Persistence | 100% | 9/9 passing |
| Memory API | 100% | Documented |
| Workflow Integration | Manual | E2E verified |

### Verification Checklist

- [x] IAB profile generation from CSV
- [x] IAB profile generation from email providers
- [x] Incremental processing (skip processed)
- [x] Force reprocess flag
- [x] Confidence evolution across sessions
- [x] Cost tracking per provider
- [x] SQLite persistence
- [x] Export/import utilities
- [x] Multi-provider LLM support

---

## API Usage

### Python API

```python
from src.email_parser.main import EmailParser

# Initialize parser
parser = EmailParser()

# Generate profile from CSV
profile_path = parser.generate_iab_profile(
    csv_file="emails.csv",
    output_file="profile.json",
    user_id="user_123",
    force_reprocess=False
)

print(f"Profile saved to: {profile_path}")
```

### Programmatic Workflow Execution

```python
from src.email_parser.workflow import run_workflow
from src.email_parser.memory.manager import MemoryManager
from src.email_parser.memory.backends import SQLiteStore

# Setup memory
store = SQLiteStore("data/memory.db")
memory_manager = MemoryManager(user_id="user_123", store=store)

# Prepare emails
emails = [
    {
        "id": "email_1",
        "subject": "Subject",
        "body": "Content",
        "date": "2025-01-01"
    }
]

# Run workflow
final_state = run_workflow(
    user_id="user_123",
    emails=emails,
    memory_manager=memory_manager,
    force_reprocess=False
)

# Access results
print(f"Processed: {final_state['current_email_index']} emails")
print(f"Cost: ${final_state['cost_tracker'].get_total_cost():.4f}")
```

---

## Appendix

### File Locations

```
src/email_parser/
├── main.py                 # CLI entry point
├── workflow/
│   ├── executor.py         # Workflow orchestration
│   ├── graph.py            # LangGraph graph definition
│   ├── state.py            # Workflow state schema
│   ├── cost_tracker.py     # Cost tracking
│   ├── llm_wrapper.py      # LLM client wrapper
│   └── nodes/              # Workflow nodes
│       ├── load_emails.py
│       ├── retrieve_profile.py
│       ├── analyzers.py
│       ├── reconcile.py
│       └── update_memory.py
├── memory/
│   ├── manager.py          # Memory manager
│   ├── schemas.py          # Pydantic schemas
│   └── backends/
│       └── sqlite_store.py # SQLite backend
└── models/
    └── iab_profile.py      # Profile data models

tests/
├── unit/
│   └── test_cost_tracker.py
├── integration/
│   └── test_sqlite_persistence.py
└── manual/
    ├── test_confidence_evolution.sh
    └── MULTI_SESSION_TEST_RESULTS.md

scripts/
├── export_memories.py      # Export to JSON
└── import_memories.py      # Import from JSON

docs/
├── IAB_PROFILE_TECHNICAL_SPEC.md  # This document
├── MEMORY_MANAGER_API.md          # Memory API reference
└── PHASE_5_COMPLETION_SUMMARY.md  # Implementation summary
```

### Environment Variables

```bash
# LLM Provider
LLM_PROVIDER=openai|claude|ollama

# OpenAI
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-4o-mini

# Claude
ANTHROPIC_API_KEY=your_key
ANTHROPIC_MODEL=claude-sonnet-4

# Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=deepseek-r1:70b

# Memory Backend
MEMORY_BACKEND=sqlite
MEMORY_DATABASE_PATH=data/email_parser_memory.db
```

### Common Issues & Solutions

**Issue:** "CostTracker object has no attribute 'get_total_calls'"
**Solution:** Use `len(cost_tracker.calls)` instead

**Issue:** "MemoryManager API usage error"
**Solution:** Check `docs/MEMORY_MANAGER_API.md` for correct parameter names

**Issue:** "All emails already processed"
**Solution:** Use `--force-reprocess` flag to reprocess all emails

**Issue:** "Database locked"
**Solution:** Ensure no other processes are accessing the SQLite database

---

## Version History

### v1.0 (2025-10-01)
- Initial production release
- IAB Taxonomy 1.1 mapping
- Multi-provider LLM support
- SQLite persistence
- Cost tracking
- Incremental processing
- Export/import utilities

---

**Document Version:** 1.0
**Last Updated:** 2025-10-01
**Maintained By:** Email Parser Development Team
