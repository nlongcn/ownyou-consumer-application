# IAB Taxonomy Classification System 1.0

**Version:** 1.0
**Date:** 2025-10-21
**Status:** Production

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [How Classification Works](#how-classification-works)
4. [Workflow Components](#workflow-components)
5. [Batch Processing](#batch-processing)
6. [Evidence Validation](#evidence-validation)
7. [Memory & Confidence Evolution](#memory--confidence-evolution)
8. [Debugging & Visualization](#debugging--visualization)
9. [Performance Characteristics](#performance-characteristics)
10. [API Reference](#api-reference)

---

## Overview

### What is the Classification System?

The IAB Taxonomy Classification System analyzes email communications and generates evidence-based consumer profiles mapped to the **IAB Tech Lab Audience Taxonomy 1.1** standard (1,568 categories).

### Key Innovation

**The system uses LLMs to identify taxonomy IDs, then validates them against the official IAB taxonomy to prevent fabricated categories.**

### Core Capabilities

- **Batch Processing**: Processes 10-50 emails per LLM call for 20-30x speed improvement
- **Evidence Validation**: LLM-as-Judge validates each classification individually
- **Confidence Evolution**: Bayesian updates track confidence across multiple email observations
- **Dynamic Batching**: Automatically adjusts batch size based on model context window
- **Privacy-First**: Local SQLite storage, no cloud dependencies

---

## System Architecture

### High-Level Flow

```
┌──────────────┐
│   Emails     │ (CSV, Gmail, Outlook)
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│  Step 1: Email Download (OAuth2)             │
│  Output: Raw emails CSV                      │
└──────────────────┬───────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────┐
│  Step 2: Email Summarization (EMAIL_MODEL)   │
│  Output: Summaries CSV                       │
└──────────────────┬───────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────┐
│  Step 3: IAB Classification (TAXONOMY_MODEL) │
│  ┌────────────────────────────────────────┐  │
│  │  Batch Optimizer                       │  │
│  │  ↓                                     │  │
│  │  Agent Classifiers (Parallel)         │  │
│  │  ↓                                     │  │
│  │  Evidence Judge Validator             │  │
│  │  ↓                                     │  │
│  │  Memory Reconciliation                │  │
│  └────────────────────────────────────────┘  │
│  Output: User profile JSON                   │
└──────────────────────────────────────────────┘
```

### Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Workflow Engine** | LangGraph | State machine orchestration |
| **Memory System** | SQLite | Persistent semantic/episodic memory |
| **LLM Integration** | OpenAI/Claude/Google | Multi-email batch classification |
| **Batch Optimization** | Dynamic sizing | Context window utilization |
| **Evidence Validation** | LLM-as-Judge | Quality assurance per classification |
| **Taxonomy Source** | IAB v1.1 Excel | Official tier structure lookup |

---

## How Classification Works

### The Complete Process (8 Steps)

#### Step 1: Email Ingestion

**Entry Points:**
- CSV file: `--iab-csv emails.csv`
- Email provider: `--provider gmail --max-emails 50`
- Existing database: Resume from previous session

**Output:** List of emails to process (filters out already-processed emails)

---

#### Step 2: Content-Based Routing

**File:** `src/email_parser/workflow/routing.py`

Each email is analyzed for keyword patterns to determine which analyzers should process it:

| Analyzer | Triggers |
|----------|----------|
| **Demographics** | `birthday`, `graduated`, `wedding`, `anniversary`, `resume` |
| **Household** | `zip code`, `mortgage`, `rent payment`, `utility bill`, `electric bill` |
| **Interests** | `newsletter`, `crypto`, `blockchain`, `technology`, `gaming`, `travel` |
| **Purchase** | `order confirmation`, `receipt`, `tracking number`, `shipped`, `invoice` |

**Default:** If no patterns match, routes to `demographics` + `interests`

---

#### Step 3: Batch Optimization

**File:** `src/email_parser/workflow/batch_optimizer.py`

The system dynamically calculates how many emails fit in the model's context window:

```python
# 1. Fetch context window from provider API
context_window = get_context_window(provider, model)
# Examples: gpt-5-mini=128K, gemini-2.5-flash=1M, claude-sonnet-4=200K

# 2. Calculate batch size
available_tokens = context_window * 0.70  # Reserve 30% for prompts/response
batch_size = available_tokens / avg_email_tokens
# Result: 10-50 emails per batch depending on model
```

**Key Benefits:**
- **gpt-5-mini (128K)**: ~35-45 emails per batch
- **gemini-2.5-flash (1M)**: ~100+ emails per batch (capped at 50 for quality)
- **claude-sonnet-4 (200K)**: ~50-60 emails per batch

---

#### Step 4: Taxonomy Context Building

**File:** `src/email_parser/workflow/taxonomy_context.py`

For each analyzer, the system loads curated taxonomy categories to provide the LLM:

```python
# Example: Demographics Context
"""
Age Ranges:
- 5: 25-29 (Young Adult)
- 6: 30-34 (Young Adult)
- 7: 35-39 (Mid Adult)

Gender:
- 20: Male
- 21: Female

Education:
- 32: Bachelor's Degree
- 33: Master's Degree
"""
```

**Purpose:** Constrains the LLM to select only from valid taxonomy IDs.

---

#### Step 5: Agent Classification (Batch)

**Files:**
- `src/email_parser/workflow/nodes/analyzers.py`
- `src/email_parser/workflow/prompts/__init__.py`

The LLM receives:
- **Input:** 10-50 email summaries
- **Taxonomy Context:** Valid taxonomy IDs and meanings
- **Task:** Identify patterns across ALL emails, not individual analysis

**Example Prompt:**

```
Analyze the user holistically across ALL 40 emails in this batch.

Your task:
1. Review ALL emails to understand the user's complete profile
2. Identify patterns across multiple emails (recurring newsletters, topics, brands)
3. For each classification, cite ALL supporting emails using email_numbers array
4. Stronger patterns (more emails) = higher confidence scores

Example: If user receives crypto newsletters in emails 1, 5, 12, 18, 24:
{
  "taxonomy_id": 342,
  "value": "Cryptocurrency",
  "confidence": 0.95,
  "reasoning": "User subscribed to 5 crypto newsletters: CoinDesk, Decrypt, ...",
  "email_numbers": [1, 5, 12, 18, 24]
}
```

**LLM Response:**

```json
{
  "classifications": [
    {
      "taxonomy_id": 342,
      "value": "Cryptocurrency",
      "confidence": 0.95,
      "reasoning": "User subscribed to multiple crypto publications",
      "email_numbers": [1, 5, 12, 18, 24]
    },
    {
      "taxonomy_id": 156,
      "value": "Technology",
      "confidence": 0.85,
      "reasoning": "Regular tech newsletters and event invites",
      "email_numbers": [2, 7, 15, 22, 30]
    }
  ]
}
```

---

#### Step 6: Taxonomy Lookup & Validation

**File:** `src/email_parser/workflow/nodes/analyzers.py:30-65`

**CRITICAL FIX:** This prevents fabricated taxonomy data.

For each classification returned by the LLM, we look up the **official IAB taxonomy entry**:

```python
def lookup_taxonomy_entry(taxonomy_id: int) -> Dict[str, Any]:
    """Look up official tier structure from IAB taxonomy Excel file."""
    loader = get_taxonomy_loader()
    entry = loader.taxonomy_by_id.get(taxonomy_id)

    return {
        "tier_1": entry['tier_1'],      # Official tier 1
        "tier_2": entry['tier_2'],      # Official tier 2
        "tier_3": entry['tier_3'],      # Official tier 3
        "tier_4": entry['tier_4'],      # Official tier 4
        "tier_5": entry['tier_5'],      # Official tier 5
        "category_path": "tier_1 | tier_2 | tier_3",
        "name": entry['name']
    }
```

**Example - Taxonomy ID 342:**

| Field | LLM Output (Untrusted) | Official Taxonomy (Trusted) |
|-------|----------------------|----------------------------|
| `value` | "Cryptocurrency" | ✓ Used for display only |
| `tier_1` | ❌ Not provided | "Interest" (from Excel) |
| `tier_2` | ❌ Not provided | "Careers" (from Excel) |
| `tier_3` | ❌ Not provided | "Remote Working" (from Excel) |
| `category_path` | ❌ Not provided | "Interest \| Careers \| Remote Working" |

**Result:** The tier structure is always from the official IAB taxonomy, never fabricated by the LLM.

---

#### Step 7: Evidence Judge Validation

**File:** `src/email_parser/workflow/nodes/evidence_judge.py`

Each classification is validated by an LLM-as-Judge to ensure evidence quality:

```python
# For classification: "Gender: Male, confidence: 0.9, reasoning: Title is 'Mr.'"

# Evidence Judge checks:
judge_response = evaluate_evidence(
    classification={
        "value": "Male",
        "confidence": 0.9,
        "reasoning": "Email addressed to 'Mr. Smith'"
    },
    email_context=email_summaries,
    guidelines=DEMOGRAPHICS_EVIDENCE_GUIDELINES
)

# Judge returns:
{
    "is_valid": True,
    "quality_score": 0.9,
    "evidence_type": "explicit",
    "issue": ""
}

# Adjustment:
final_confidence = base_confidence * quality_score  # 0.9 * 0.9 = 0.81
```

**Evidence Types:**
- **Explicit** (1.0): Direct statement ("I am 30 years old")
- **Contextual** (0.8): Strong inference (graduation year + current date)
- **Weak** (0.5): Weak signal (product purchase pattern)
- **Inappropriate** (0.0): Privacy violation (gender from name) → **BLOCKED**

---

#### Step 8: Memory Reconciliation

**File:** `src/email_parser/memory/reconciliation.py`

Each validated classification updates the persistent memory with Bayesian confidence evolution:

```python
# First observation: Email 1 shows "Cryptocurrency" interest
reconcile_evidence(
    taxonomy_id=342,
    section="interests",
    value="Cryptocurrency",
    confidence=0.85,
    email_id="email_001"
)
# Stored: confidence=0.85, evidence_count=1

# Second observation: Email 5 confirms "Cryptocurrency"
reconcile_evidence(
    taxonomy_id=342,
    section="interests",
    value="Cryptocurrency",  # Same value = confirming
    confidence=0.90,
    email_id="email_005"
)
# Updated: confidence=0.85 + (1-0.85)*0.5 = 0.925, evidence_count=2

# Third observation: Email 12 contradicts with different interest
reconcile_evidence(
    taxonomy_id=342,
    section="interests",
    value="Blockchain",  # Different value = contradicting
    confidence=0.75,
    email_id="email_012"
)
# Updated: confidence=0.925 * (1-0.3) = 0.648, contradicting_evidence=[email_012]
```

**Bayesian Formulas:**

```python
# Confirming evidence (same classification value)
new_confidence = existing + (1 - existing) * confirmation_factor
# confirmation_factor = 0.5 (moderate boost)

# Contradicting evidence (different classification value)
new_confidence = existing * (1 - contradiction_penalty)
# contradiction_penalty = 0.3 (moderate decrease)
```

**Database Storage (SQLite):**

```sql
INSERT INTO semantic_memories (
    memory_id,
    taxonomy_id,
    section,
    value,
    confidence,
    tier_1, tier_2, tier_3,
    category_path,
    evidence_count,
    supporting_evidence,
    contradicting_evidence
) VALUES (
    'semantic_interests_342_cryptocurrency',
    342,
    'interests',
    'Cryptocurrency',
    0.925,
    'Interest', 'Careers', 'Remote Working',
    'Interest | Careers | Remote Working',
    2,
    '["email_001", "email_005"]',
    '[]'
);
```

---

## Workflow Components

### LangGraph State Machine

**File:** `src/email_parser/workflow/graph.py`

The workflow is orchestrated by LangGraph, which provides:
- **State management:** Persistent state across nodes
- **Parallel execution:** All 4 analyzers run simultaneously
- **Conditional routing:** Skip/continue based on state
- **Checkpointing:** Optional state persistence for debugging

```
START
  ↓
load_emails (filter new emails)
  ↓
retrieve_profile (load existing memories)
  ↓
┌────────────────────┬────────────────────┐
│  demographics_     │  household_        │
│  analyzer          │  analyzer          │  (PARALLEL)
└──────────┬─────────┴──────────┬─────────┘
┌──────────┴─────────┬──────────┴─────────┐
│  interests_        │  purchase_         │
│  analyzer          │  analyzer          │
└──────────┬─────────┴──────────┬─────────┘
           │                    │
           └──────────┬─────────┘
                      ↓
            join_analyzers (wait for all)
                      ↓
            reconcile_evidence (update confidence)
                      ↓
            update_memory (store in SQLite)
                      ↓
            check_continuation
                      ↓
         ┌────────────┴────────────┐
         │                         │
    continue                      end
         │                         │
    advance_email                END
         │
         └──→ (loop back to retrieve_profile)
```

### Analyzer Nodes

**Demographics Analyzer** (`src/email_parser/workflow/nodes/analyzers.py:demographics_analyzer_node`)
- **Taxonomy Range:** rows 11-62 (Age, Gender, Education, Occupation, Marital Status, Language)
- **Evidence Requirements:** Explicit statements, event patterns (birthdays, graduations)
- **Privacy Protection:** Blocks gender inference from names

**Household Analyzer** (`src/email_parser/workflow/nodes/analyzers.py:household_analyzer_node`)
- **Taxonomy Range:** rows 64-168 (Location, Income, Property Type, Ownership, Urbanization)
- **Evidence Requirements:** Address information, utility bills, mortgage/rent payments

**Interests Analyzer** (`src/email_parser/workflow/nodes/analyzers.py:interests_analyzer_node`)
- **Taxonomy Range:** rows 209-704 (20+ major interest categories)
- **Evidence Requirements:** Newsletter subscriptions, event invitations, content engagement
- **Multi-Value:** Users can have many interests simultaneously

**Purchase Analyzer** (`src/email_parser/workflow/nodes/analyzers.py:purchase_analyzer_node`)
- **Taxonomy Range:** rows 707-1568 (Product/service categories)
- **Evidence Requirements:** Order confirmations, receipts, tracking numbers
- **Purchase Intent Flag:** Differentiates intent vs. actual purchase

---

## Batch Processing

### Why Batch Processing?

**Problem (Old System):** Processing emails one-by-one required separate LLM calls for each email.
- 200 emails × 2s per call = 400 seconds (6.7 minutes) for classification alone

**Solution (New System):** Process 10-50 emails per LLM call using context window efficiently.
- 200 emails ÷ 40 per batch = 5 batches × 20s per call = 100 seconds (1.7 minutes)
- **Performance Gain:** 4x faster classification

### Dynamic Batch Sizing

**File:** `src/email_parser/workflow/batch_optimizer.py`

```python
# Fetch context window from model
context_window = get_context_window_from_api(provider, model)

# Calculate optimal batch
available = context_window * 0.70  # Reserve 30% for prompts
batch_size = available / estimate_tokens_per_email(emails)

# Apply constraints
batch_size = min(batch_size, 50)  # Quality cap
batch_size = max(batch_size, 5)   # Minimum efficiency
```

**Model-Specific Batching:**

| Model | Context Window | Batch Size | Rationale |
|-------|---------------|------------|-----------|
| gpt-5-mini | 128K tokens | 35-45 emails | Balanced performance |
| gemini-2.5-flash | 1M tokens | 50 emails (capped) | Quality degrades beyond 50 |
| claude-sonnet-4 | 200K tokens | 50-60 emails | Premium quality maintained |
| ollama (local) | 8K tokens | 5-8 emails | Smaller context window |

### Holistic Analysis Approach

**Key Principle:** The LLM analyzes the user across ALL emails in the batch, not each email individually.

**Example:**

```
Input: 40 emails

Old Approach (BROKEN):
- LLM processes email 1 → outputs 2 classifications for email 1
- LLM processes email 2 → outputs 1 classification for email 2
- ...
- Result: Misses cross-email patterns, treats each email in isolation

New Approach (CORRECT):
- LLM processes ALL 40 emails together
- Identifies patterns: "User receives 5 crypto newsletters"
- Output: 1 classification citing emails [1, 5, 12, 18, 24]
- Result: Higher confidence, pattern recognition, context-aware
```

---

## Evidence Validation

### LLM-as-Judge Architecture

**Purpose:** Validate that agent classifications have appropriate evidence before storing.

**Process:**

```python
# 1. Agent outputs classification
classification = {
    "taxonomy_id": 20,
    "value": "Male",
    "confidence": 0.9,
    "reasoning": "Email addressed to 'Mr. Smith'",
    "email_numbers": [1, 5, 12]
}

# 2. Evidence judge evaluates
judge_result = evaluate_evidence(
    classification=classification,
    email_context=get_emails([1, 5, 12]),
    guidelines=DEMOGRAPHICS_EVIDENCE_GUIDELINES
)

# 3. Judge returns quality assessment
{
    "is_valid": True,
    "quality_score": 0.9,
    "evidence_type": "explicit",
    "issue": ""
}

# 4. Adjust confidence based on quality
final_confidence = 0.9 * 0.9 = 0.81

# 5. Block if inappropriate
if quality_score < 0.3:
    # Block classification (e.g., gender from name)
    logger.warning("Blocked inappropriate inference")
    continue
```

### Evidence Guidelines

**Demographics Evidence Guidelines:**

```python
DEMOGRAPHICS_EVIDENCE_GUIDELINES = """
✓ VALID Evidence:
- Age: Explicit statements, graduation dates, birthday emails
- Gender: Pronouns (he/him, she/her), self-identification only
- Education: Degree mentions, university emails, alumni communications
- Occupation: Job title in signature, work-related emails

✗ INVALID Evidence:
- Gender from names (William, Sarah, etc.) → BLOCKED
- Age from purchase patterns → Too weak
- Occupation from product interests → Inappropriate inference
"""
```

**Household Evidence Guidelines:**

```python
HOUSEHOLD_EVIDENCE_GUIDELINES = """
✓ VALID Evidence:
- Location: Address in emails, utility bills, local business communications
- Income: Salary statements, tax documents (explicit only)
- Property: Mortgage statements, rent receipts, HOA communications

✗ INVALID Evidence:
- Income from purchase amounts → Too speculative
- Property type from décor purchases → Weak inference
"""
```

### Batch Evidence Validation

**Optimization:** Validate multiple classifications in a single LLM call.

```python
# Old: 100 classifications = 100 LLM calls (20 minutes)
for classification in classifications:
    validate(classification)  # Serial execution

# New: 100 classifications = 4 batch calls (2 minutes)
batch_validate(classifications[0:25])   # Batch 1
batch_validate(classifications[25:50])  # Batch 2
batch_validate(classifications[50:75])  # Batch 3
batch_validate(classifications[75:100]) # Batch 4

# Performance: 10x faster
```

---

## Memory & Confidence Evolution

### Memory Types

**1. Semantic Memory** (Taxonomy Classifications)

```python
{
    "memory_id": "semantic_interests_342_cryptocurrency",
    "taxonomy_id": 342,
    "section": "interests",
    "value": "Cryptocurrency",
    "confidence": 0.925,
    "tier_1": "Interest",
    "tier_2": "Careers",
    "tier_3": "Remote Working",
    "category_path": "Interest | Careers | Remote Working",
    "evidence_count": 5,
    "supporting_evidence": ["email_001", "email_005", "email_012", "email_018", "email_024"],
    "contradicting_evidence": [],
    "first_observed": "2025-10-01T00:00:00Z",
    "last_validated": "2025-10-15T00:00:00Z"
}
```

**2. Episodic Memory** (Email Processing Records)

```python
{
    "episode_id": "episodic_email_001",
    "email_id": "email_001",
    "processed_at": "2025-10-01T10:30:00Z",
    "taxonomy_selections": [342, 156, 201],
    "confidence_contributions": {
        "342": 0.85,
        "156": 0.80,
        "201": 0.75
    },
    "llm_model": "openai:gpt-5-mini"
}
```

**3. Processed Emails Tracking**

```python
{
    "email_id": "email_001",
    "processed_at": "2025-10-01T10:30:00Z",
    "session_id": "session_abc123"
}
```

### Confidence Evolution

**Formula Types:**

```python
# Initial Classification
confidence = evidence_strength  # From agent (0.6-0.95)

# Confirming Evidence (same value observed again)
new_confidence = existing + (1 - existing) * 0.5
# Example: 0.80 + (1-0.80)*0.5 = 0.90

# Contradicting Evidence (different value observed)
new_confidence = existing * (1 - 0.3)
# Example: 0.90 * 0.7 = 0.63

# Temporal Decay (optional, not yet implemented)
decayed = confidence * (1 - decay_rate * days_since_validation)
```

**Multi-Session Evolution Example:**

```
Session 1 (Oct 1): Process 50 emails
- Email 5: "Cryptocurrency" interest detected → confidence=0.85

Session 2 (Oct 5): Process 30 emails
- Email 72: "Cryptocurrency" confirmed → confidence=0.85 + (1-0.85)*0.5 = 0.925

Session 3 (Oct 10): Process 40 emails
- Email 95: "Cryptocurrency" confirmed → confidence=0.925 + (1-0.925)*0.5 = 0.9625
- Email 103: "Blockchain" (different) → confidence=0.9625 * 0.7 = 0.674

Result: System learns from accumulated evidence across sessions.
```

### Database Schema

```sql
CREATE TABLE semantic_memories (
    memory_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    taxonomy_id INTEGER NOT NULL,
    section TEXT NOT NULL,
    value TEXT NOT NULL,
    confidence REAL NOT NULL,
    tier_1 TEXT,
    tier_2 TEXT,
    tier_3 TEXT,
    tier_4 TEXT,
    tier_5 TEXT,
    category_path TEXT,
    evidence_count INTEGER DEFAULT 1,
    supporting_evidence TEXT,  -- JSON array
    contradicting_evidence TEXT,  -- JSON array
    first_observed TEXT,
    last_validated TEXT,
    reasoning TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_user_taxonomy ON semantic_memories(user_id, taxonomy_id);
CREATE INDEX idx_section ON semantic_memories(section);
CREATE INDEX idx_confidence ON semantic_memories(confidence);
```

---

## Debugging & Visualization

### LangGraph Studio

**Purpose:** Visual workflow inspection for debugging classification logic.

**Setup:**

```bash
# Install Studio CLI
pip install langgraph-cli

# Start Studio (from project root)
langgraph dev

# Access UI
open http://127.0.0.1:2024
```

**Use Cases:**

1. **Trace Classification Decisions**
   - Click on any node to see input/output state
   - Inspect agent prompts and responses
   - View evidence judge validation results

2. **Debug Confidence Evolution**
   - See confidence scores at each step
   - Understand why classifications were blocked
   - Trace evidence reconciliation logic

3. **Batch Processing Analysis**
   - View how emails are batched
   - See which emails triggered which taxonomies
   - Understand routing decisions

4. **Time-Travel Debugging**
   - Replay past workflow executions
   - Compare results across different models
   - Reproduce issues from production

**Configuration Files:**
- `langgraph.json`: Studio configuration
- `src/email_parser/workflow/studio.py`: Studio entry point
- `data/studio_checkpoints.db`: Local checkpoint storage

**Privacy Note:** Studio runs 100% locally with no cloud dependencies.

### Logging

**Structured Logging:**

```bash
# Enable debug logging
python -m src.email_parser.main --iab-csv emails.csv --debug

# Log file location
tail -f logs/email_parser_YYYYMMDD_HHMMSS.log
```

**Key Log Events:**

```
INFO: Batch size: 40 emails (45,230 tokens / 89,600 available, 50.5% utilization)
INFO: Demographics agent: 5 classifications from 40 emails
INFO: Evidence judge: Validated 5 classifications (4 passed, 1 blocked)
INFO: Reconcile: Updated semantic_interests_342 (confidence 0.85 → 0.925)
INFO: Memory stored: 5 classifications → 3 unique taxonomy_ids
```

---

## Performance Characteristics

### Benchmarks (200 emails)

| Phase | Time | Bottleneck |
|-------|------|------------|
| **Step 1: Download** | 2-5 min | OAuth API rate limits |
| **Step 2: Summarization** | 3-8 min | LLM processing (serial) |
| **Step 3: Classification** | 5-8 min | Agent + judge processing |
| **Total** | **10-21 min** | Model-dependent |

### Step 3 Breakdown (Target: 5-8 minutes)

```
Phase                    Time    % of Total
─────────────────────────────────────────
Batch Optimization       0.5 min    10%
Agent Classification     2-4 min    40%
Evidence Validation      1-2 min    20%
Memory Reconciliation    0.5 min    10%
Database Operations      0.5 min    10%
Overhead                 0.5 min    10%
─────────────────────────────────────
Total                    5-8 min    100%
```

### Performance Factors

**Model Speed:**
- **gpt-5-mini**: Fastest, lowest cost (~$0.01 per 100 emails)
- **gemini-2.5-flash**: Fast with large context (~$0.02 per 100 emails)
- **claude-sonnet-4**: Premium quality (~$0.15 per 100 emails)

**Email Characteristics:**
- Average length: 200-500 words per summary
- Batch size: 10-50 emails depending on model
- Classification density: 1-3 taxonomies per email on average

**System Resources:**
- CPU: Minimal (mostly I/O bound)
- Memory: ~500MB for typical workloads
- Disk: SQLite writes ~1-2MB per 100 emails

---

## API Reference

### CLI Commands

**Basic Usage:**

```bash
# Process CSV file
python -m src.email_parser.main \
  --iab-csv emails_processed.csv \
  --iab-output profile.json \
  --user-id user_123

# Process from email provider
python -m src.email_parser.main \
  --provider gmail \
  --max-emails 100 \
  --iab-profile \
  --user-id user_123

# Force reprocess all emails
python -m src.email_parser.main \
  --iab-csv emails.csv \
  --force-reprocess \
  --user-id user_123
```

**Model Selection:**

```bash
# Use specific model for classification
LLM_PROVIDER=openai \
OPENAI_MODEL=gpt-5-mini \
python -m src.email_parser.main --iab-csv emails.csv

# Use Ollama for privacy
LLM_PROVIDER=ollama \
OLLAMA_MODEL=deepseek-r1:70b \
python -m src.email_parser.main --iab-csv emails.csv
```

### Output Format

**Profile JSON Structure:**

```json
{
  "user_id": "user_123",
  "profile_version": 1,
  "generated_at": "2025-10-21T15:30:00Z",
  "schema_version": "1.0",
  "generator": {
    "system": "email_parser_iab_taxonomy",
    "llm_model": "openai:gpt-5-mini",
    "workflow_version": "1.0"
  },
  "data_coverage": {
    "total_emails_analyzed": 200,
    "emails_this_run": 50,
    "date_range": "2025-01-01 to 2025-10-21"
  },
  "demographics": {
    "age_range": "30-34",
    "gender": null,
    "education": "Master's Degree",
    "occupation": "Software Engineer"
  },
  "household": {
    "location": "San Francisco, CA",
    "property_type": "Apartment",
    "ownership": "Renter"
  },
  "interests": [
    {
      "taxonomy_id": 342,
      "tier_path": "Interest | Careers | Remote Working",
      "value": "Cryptocurrency",
      "confidence": 0.925,
      "evidence_count": 5,
      "last_validated": "2025-10-21T15:30:00Z",
      "days_since_validation": 0
    }
  ],
  "purchase_intent": [],
  "actual_purchases": [
    {
      "taxonomy_id": 1203,
      "tier_path": "Shopping | Technology | Consumer Electronics",
      "value": "Laptop",
      "confidence": 0.95,
      "evidence_count": 2,
      "purchase_intent_flag": "actual_purchase"
    }
  ],
  "memory_stats": {
    "total_facts_stored": 23,
    "high_confidence_facts": 15,
    "moderate_confidence_facts": 6,
    "low_confidence_facts": 2,
    "average_confidence": 0.84
  },
  "section_confidence": {
    "demographics": 0.80,
    "household": 0.75,
    "interests": 0.87,
    "purchase_intent": 0.0,
    "actual_purchases": 0.92
  }
}
```

### Programmatic API

```python
from src.email_parser.workflow.executor import run_iab_taxonomy_workflow
from src.email_parser.memory.manager import MemoryManager
from src.email_parser.memory.backends.sqlite_store import SQLiteStore

# Initialize memory
store = SQLiteStore("data/email_parser_memory.db")
memory_manager = MemoryManager(user_id="user_123", store=store)

# Prepare emails
emails = [
    {
        "id": "email_001",
        "subject": "Crypto Weekly",
        "summary": "Newsletter covering crypto market analysis...",
        "date": "2025-10-21T10:00:00Z"
    }
]

# Run workflow
result = run_iab_taxonomy_workflow(
    user_id="user_123",
    emails=emails,
    memory_manager=memory_manager,
    force_reprocess=False,
    llm_provider="openai",
    llm_model="gpt-5-mini"
)

# Access results
print(f"Processed: {result['total_emails']} emails")
print(f"Classifications: {len(result['profile']['interests'])}")
print(f"Cost: ${result['cost_tracker'].get_total_cost():.4f}")
```

---

## Appendix: File Reference

### Core Workflow Files

```
src/email_parser/workflow/
├── graph.py                 # LangGraph state machine definition
├── executor.py              # Workflow execution logic
├── state.py                 # WorkflowState schema
├── routing.py               # Content-based email routing
├── batch_optimizer.py       # Dynamic batch sizing
├── taxonomy_context.py      # Taxonomy category loading
├── llm_wrapper.py           # LLM client abstraction
└── nodes/
    ├── load_emails.py       # Email loading and filtering
    ├── retrieve_profile.py  # Memory retrieval
    ├── analyzers.py         # 4 analyzer nodes
    ├── reconcile.py         # Confidence reconciliation
    ├── update_memory.py     # SQLite persistence
    └── evidence_judge.py    # LLM-as-Judge validation
```

### Memory System Files

```
src/email_parser/memory/
├── manager.py               # MemoryManager API
├── reconciliation.py        # Evidence reconciliation logic
├── confidence.py            # Bayesian confidence formulas
├── schemas.py               # Pydantic schemas
└── backends/
    └── sqlite_store.py      # SQLite storage implementation
```

### Configuration Files

```
.env                         # LLM provider credentials
langgraph.json              # LangGraph Studio config
data/
├── iab_taxonomy_v1.1.xlsx  # Official IAB taxonomy
└── email_parser_memory.db  # SQLite database
```

### Documentation Files

```
docs/
├── Classification1.0.md                          # This document
├── requirements/
│   ├── END_TO_END_TAXONOMY_WORKFLOW.md          # Workflow overview
│   ├── BATCH_PROCESSING_REQUIREMENTS.md         # Batch architecture
│   └── BATCH_EVIDENCE_JUDGE_SPEC.md             # Evidence validation
├── technical/
│   ├── IAB_PROFILE_TECHNICAL_SPEC.md            # Profile specification
│   └── LANGGRAPH_STUDIO_INTEGRATION.md          # Studio setup
└── STUDIO_QUICKSTART.md                         # 5-minute Studio guide
```

---

## Version History

### v1.0 (2025-10-21)
- Initial classification system documentation
- Covers batch processing, evidence validation, memory reconciliation
- Includes LangGraph Studio debugging guide
- Performance benchmarks and API reference

---

**Maintained By:** Email Parser Development Team
**Questions:** See `docs/README.md` for additional documentation
**Support:** File issues at project repository
