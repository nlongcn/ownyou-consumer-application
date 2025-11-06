# End-to-End Taxonomy Classification Workflow

This document explains the complete workflow from email ingestion to IAB Taxonomy classification in the email parser system.

## Overview

The system processes emails through 8 distinct steps to classify them using the official IAB Audience Taxonomy v1.1. The key innovation is using LLMs to identify relevant taxonomy IDs, then looking up the official tier structure from the IAB taxonomy Excel file to prevent fabricated categories.

---

## Step 1: Email Ingestion

Emails enter the system via `main.py` through multiple pathways:

- **Gmail/Outlook OAuth download**: `--provider gmail outlook`
- **CSV import**: `--iab-csv emails.csv`
- **Direct processing**: Emails already in the database

**Entry Point**: `src/email_parser/main.py`

---

## Step 2: Content-Based Routing

**File**: `src/email_parser/workflow/routing.py:20-82`

The system uses **pattern matching** on email subject + body to determine which analyzers should process the email.

### Pattern Examples

**Interests Analyzer** (`routing.py:162-199`):
- Keywords: `"newsletter"`, `"crypto"`, `"bitcoin"`, `"blockchain"`, `"technology"`, `"investing"`, `"startup"`, `"gaming"`, `"fitness"`, `"travel"`

**Purchase Analyzer** (`routing.py:89-120`):
- Keywords: `"order confirmation"`, `"receipt"`, `"tracking number"`, `"shipped"`, `"invoice"`, `"payment received"`

**Household Analyzer** (`routing.py:123-159`):
- Keywords: `"electric bill"`, `"mortgage"`, `"apartment"`, `"zip code"`, `"utility bill"`, `"rent payment"`

**Demographics Analyzer** (`routing.py:207-239`):
- Keywords: `"birthday"`, `"wedding"`, `"graduated"`, `"resume"`, `"anniversary"`

### Routing Logic

```python
# routing.py:20-82
def route_email_to_analyzers(state: WorkflowState) -> List[str]:
    email_content = f"{email_subject} {email_body}".lower()

    analyzers = []

    if _is_purchase_email(email_content):
        analyzers.append("purchase")
    if _is_household_email(email_content):
        analyzers.append("household")
    if _is_interests_email(email_content):
        analyzers.append("interests")
    if _is_demographics_email(email_content):
        analyzers.append("demographics")

    # Default: if no specific signals
    if not analyzers:
        analyzers = ["demographics", "interests"]

    return analyzers
```

**Example**: Email with subject "Crypto Venture Weekly" matches `"crypto"` → routed to **interests analyzer**

---

## Step 3: Taxonomy Context Building

**File**: `src/email_parser/workflow/taxonomy_context.py`

For each analyzer type, the system loads **curated taxonomy categories** to send to the LLM. This provides the LLM with valid taxonomy_id values and their official meanings.

### Example: Demographics Context

```python
# taxonomy_context.py:14-68
def get_demographics_taxonomy_context() -> str:
    return """
Demographics Categories (IAB Audience Taxonomy 1.1):

Age Ranges:
- 5: 25-29 (Young Adult)
- 6: 30-34 (Young Adult)
- 7: 35-39 (Mid Adult)

Gender:
- 20: Male
- 21: Female

Education Level:
- 32: Bachelor's Degree
- 33: Master's Degree
- 34: Doctorate

Marital Status:
- 40: Single
- 41: Married
- 42: Divorced
"""
```

This context is inserted into the LLM prompt to constrain the model to select from valid taxonomy IDs only.

---

## Step 4: LLM Prompt Construction

**File**: `src/email_parser/workflow/prompts/__init__.py`

Each analyzer type has a specialized prompt template that instructs the LLM to:

1. Analyze email content for specific signals
2. Select from provided taxonomy categories
3. Return only valid taxonomy_ids with confidence scores
4. Provide reasoning based on email content

### Example: INTERESTS_PROMPT_TEMPLATE

```python
# prompts/__init__.py:95-146
INTERESTS_PROMPT_TEMPLATE = """
You are an expert at analyzing email content to identify interests and hobbies of the recipient.

## Task
Analyze the following email and identify interest signals using the IAB Audience Taxonomy.

## Email Content
Subject: {subject}
Body: {body}

## Relevant Taxonomy Categories
{taxonomy_categories}  # Inserted from Step 3

## Instructions
1. Carefully analyze the email for interest signals (hobbies, topics, activities, subscriptions)
2. Look for:
   - Newsletter topics
   - Event invitations
   - Content subscriptions
   - Discussion of hobbies or activities
3. You can identify MULTIPLE interests from a single email
4. Only classify if you have reasonable confidence (≥0.6)
5. Return empty classifications array if no signals found

## Output Format
Return ONLY a JSON object (no markdown, no additional text):
{
  "classifications": [
    {
      "taxonomy_id": 342,
      "value": "Cryptocurrency",
      "confidence": 0.85,
      "reasoning": "Brief explanation based on email content"
    }
  ]
}

## Important Guidelines
- Confidence scores: 0.6 (low), 0.7-0.8 (medium), 0.9-0.95 (high)
- Never exceed 0.95 confidence
- Only include taxonomy_id, value, confidence, reasoning
- Be specific in reasoning (reference actual email content)
"""
```

**Key Instruction**: LLM must return **ONLY taxonomy_id** from the provided list, not fabricate new categories.

---

## Step 5: LLM Analysis

**Files**:
- `src/email_parser/workflow/llm_wrapper.py`
- `src/email_parser/workflow/nodes/analyzers.py`

### Example: interests_analyzer_node

```python
# analyzers.py:270-292
def interests_analyzer_node(state: WorkflowState) -> WorkflowState:
    email = get_current_email(state)

    # 1. Get LLM client
    llm_client = AnalyzerLLMClient(
        provider=state.get("llm_provider"),
        model=state.get("llm_model"),
        cost_tracker=state.get("cost_tracker"),
        workflow_tracker=state.get("tracker")
    )

    # 2. Build prompt with taxonomy context
    taxonomy_context = get_cached_taxonomy_context("interests")
    prompt = INTERESTS_PROMPT_TEMPLATE.format(
        subject=email.get("subject", ""),
        body=email.get("body", "")[:2000],  # Limit to 2000 chars
        taxonomy_categories=taxonomy_context
    )

    # 3. Call LLM
    response = llm_client.analyze_email(prompt, max_tokens=1000, temperature=0.1)

    # 4. Parse classifications
    classifications = response.get("classifications", [])

    # Continue to Step 6...
```

### Example LLM Response

For email: "Crypto Venture Weekly: September 22-26, 2025"

```json
{
  "classifications": [
    {
      "taxonomy_id": 342,
      "value": "Cryptocurrency",
      "confidence": 0.85,
      "reasoning": "Email is from Messari Research about crypto venture capital funding rounds and market analysis"
    },
    {
      "taxonomy_id": 156,
      "value": "Technology",
      "confidence": 0.80,
      "reasoning": "Discusses blockchain technology platforms and software development companies"
    }
  ]
}
```

**CRITICAL**: LLM returns `taxonomy_id` (integer), `value` (label), `confidence` (float), and `reasoning` (explanation).

---

## Step 6: Taxonomy Lookup & Validation (THE FIX)

**File**: `src/email_parser/workflow/nodes/analyzers.py:30-65, 298-320`

This is **THE CRITICAL FIX** that prevents fabricated taxonomy data. For each classification returned by the LLM, we look up the **official IAB taxonomy entry** to get the real tier structure.

### lookup_taxonomy_entry() Function

```python
# analyzers.py:30-65
def lookup_taxonomy_entry(taxonomy_id: int) -> Optional[Dict[str, Any]]:
    """
    Look up taxonomy entry by ID and return tier information.

    Returns:
        Dict with tier_1, tier_2, tier_3, tier_4, tier_5, category_path, name
        or None if not found
    """
    loader = _get_taxonomy_loader()
    entry = loader.taxonomy_by_id.get(taxonomy_id)

    if not entry:
        logger.warning(f"Taxonomy ID {taxonomy_id} not found in IAB taxonomy")
        return None

    # Build category_path from tiers
    tiers = [entry['tier_1'], entry['tier_2'], entry['tier_3'],
             entry['tier_4'], entry['tier_5']]
    non_empty_tiers = [t for t in tiers if t]
    category_path = " | ".join(non_empty_tiers)

    return {
        "tier_1": entry['tier_1'],
        "tier_2": entry['tier_2'],
        "tier_3": entry['tier_3'],
        "tier_4": entry['tier_4'],
        "tier_5": entry['tier_5'],
        "category_path": category_path,
        "name": entry['name']
    }
```

### Using the Lookup in Analyzers

```python
# analyzers.py:298-320
for classification in classifications:
    taxonomy_id = classification.get("taxonomy_id")  # 342

    # ✅ LOOK UP REAL TAXONOMY (THE FIX!)
    taxonomy_entry = lookup_taxonomy_entry(taxonomy_id)
    if not taxonomy_entry:
        logger.warning(f"Skipping invalid taxonomy_id: {taxonomy_id}")
        continue

    selection = {
        "taxonomy_id": taxonomy_id,           # 342
        "section": "interests",
        "value": classification.get("value"), # "Cryptocurrency" (from LLM)
        "confidence": 0.85,

        # ✅ USE REAL TIER VALUES FROM IAB TAXONOMY EXCEL FILE
        "category_path": taxonomy_entry["category_path"],  # "Interest | Careers | Remote Working"
        "tier_1": taxonomy_entry["tier_1"],   # "Interest"
        "tier_2": taxonomy_entry["tier_2"],   # "Careers"
        "tier_3": taxonomy_entry["tier_3"],   # "Remote Working"
        "tier_4": taxonomy_entry["tier_4"],   # ""
        "tier_5": taxonomy_entry["tier_5"],   # ""

        "reasoning": classification.get("reasoning")
    }
    state["interests_results"].append(selection)
```

### What Changed: Before vs After

**BEFORE THE FIX** (BROKEN):
```python
# ❌ FABRICATED TIERS
selection = {
    "tier_1": "Interest",
    "tier_2": classification.get("value"),  # "Cryptocurrency" (FAKE! Not in taxonomy)
    "tier_3": "",
    "category_path": f"Interest | {classification.get('value')}"
}
```

**AFTER THE FIX** (CORRECT):
```python
# ✅ REAL TIERS FROM IAB TAXONOMY EXCEL FILE
taxonomy_entry = lookup_taxonomy_entry(342)
selection = {
    "tier_1": "Interest",       # From taxonomy_by_id[342]['tier_1']
    "tier_2": "Careers",        # From taxonomy_by_id[342]['tier_2']
    "tier_3": "Remote Working", # From taxonomy_by_id[342]['tier_3']
    "tier_4": "",
    "tier_5": "",
    "category_path": "Interest | Careers | Remote Working"
}
```

### Real Example: Taxonomy ID 342

Looking up taxonomy ID 342 in the IAB Taxonomy v1.1 Excel file:

| Taxonomy ID | Tier 1   | Tier 2  | Tier 3         | Name            |
|-------------|----------|---------|----------------|-----------------|
| 342         | Interest | Careers | Remote Working | Cryptocurrency  |

The **tier hierarchy** is the official IAB classification structure. The **value** field is the LLM's human-readable label for display purposes only.

---

## Step 7: Memory Storage & Reconciliation

**File**: `src/email_parser/memory/reconciliation.py`

Each validated taxonomy selection is stored in SQLite as a **semantic memory** with evidence reconciliation.

### reconcile_evidence() Function

```python
# reconciliation.py:81-96
def reconcile_evidence(
    memory_manager: MemoryManager,
    taxonomy_id: int,
    section: str,
    new_value: str,
    new_evidence_strength: float,
    email_id: str,
    category_path: str,
    tier_1: str,
    tier_2: str = "",
    tier_3: str = "",
    tier_4: str = "",
    tier_5: str = "",
    reasoning: str = "",
    purchase_intent_flag: str = None
) -> Dict[str, Any]:
```

### Example Storage Call

```python
reconcile_evidence(
    memory_manager=memory_manager,
    taxonomy_id=342,
    section="interests",
    new_value="Cryptocurrency",
    new_evidence_strength=0.85,
    email_id="19989c11387876ec",
    category_path="Interest | Careers | Remote Working",  # ✅ REAL from lookup
    tier_1="Interest",                                     # ✅ REAL from lookup
    tier_2="Careers",                                      # ✅ REAL from lookup
    tier_3="Remote Working",                               # ✅ REAL from lookup
    tier_4="",
    tier_5="",
    reasoning="Email from Messari about crypto VC funding",
    purchase_intent_flag=None
)
```

### Reconciliation Logic

**First evidence** (no existing memory):
- Create new semantic memory
- Initialize confidence = new_evidence_strength (0.85)
- Store with memory_id: `semantic_interests_342_cryptocurrency`

**Confirming evidence** (same value):
- Update confidence using Bayesian formula (increases confidence)
- Increment evidence_count
- Update last_validated timestamp

**Contradicting evidence** (different value):
- Decrease confidence using penalty formula
- Add to contradicting_evidence list
- May invalidate memory if confidence drops too low

### Database Storage

Stored in `data/email_parser_memory.db`:

```sql
INSERT INTO semantic_memories (
    memory_id,
    user_id,
    taxonomy_id,
    section,
    value,
    confidence,
    tier_1,
    tier_2,
    tier_3,
    tier_4,
    tier_5,
    category_path,
    evidence_count,
    last_validated
) VALUES (
    'semantic_interests_342_cryptocurrency',
    'user_123',
    342,
    'interests',
    'Cryptocurrency',
    0.85,
    'Interest',
    'Careers',
    'Remote Working',
    '',
    '',
    'Interest | Careers | Remote Working',
    1,
    '2025-10-06T14:53:35.726551Z'
);
```

---

## Step 8: Profile Generation

**File**: `src/email_parser/main.py`

The final IAB Consumer Profile JSON is built by aggregating all semantic memories from the database.

### Profile Structure

```json
{
  "user_id": "taxonomy_test",
  "profile_version": 1,
  "generated_at": "2025-10-06T15:53:38.945259",
  "schema_version": "1.0",
  "generator": {
    "system": "email_parser_iab_taxonomy",
    "llm_model": "openai:default",
    "workflow_version": "1.0"
  },
  "data_coverage": {
    "total_emails_analyzed": 4,
    "emails_this_run": 4,
    "date_range": "2025-10-06 to 2025-10-06"
  },
  "demographics": {
    "age_range": null,
    "gender": null,
    "education": null
  },
  "household": {
    "location": null,
    "income": null,
    "property_type": null
  },
  "interests": [
    {
      "taxonomy_id": 342,
      "tier_path": "Interest | Careers | Remote Working",  // ✅ REAL tier structure
      "value": "Cryptocurrency",
      "confidence": 0.85,
      "evidence_count": 1,
      "last_validated": "2025-10-06T14:53:35.726551Z",
      "days_since_validation": 0
    },
    {
      "taxonomy_id": 156,
      "tier_path": "Interest | Technology",  // ✅ REAL (no tier_3 in taxonomy)
      "value": "Technology",
      "confidence": 0.8,
      "evidence_count": 1,
      "last_validated": "2025-10-06T14:53:35.731221Z",
      "days_since_validation": 0
    }
  ],
  "purchase_intent": [],
  "actual_purchases": [],
  "memory_stats": {
    "total_facts_stored": 2,
    "high_confidence_facts": 2,
    "average_confidence": 0.825
  },
  "section_confidence": {
    "demographics": 0.7,
    "household": 0.7,
    "interests": 0.825,
    "purchase_intent": 0.0
  }
}
```

---

## Complete Example: Crypto Newsletter

### Input Email

From `taxonomy_fix_test.csv`:

```
ID: 199876daa93f05dd
Date: 2025-09-26T19:08:54+00:00
From: Messari Research Alerts <research@messari.io>
Subject: New Research: Crypto Venture Weekly: September 22-26, 2025
Summary: Crypto Venture Weekly highlights fundraising by Kraken and Fnality,
         treasury allocations by Strive and ETHZilla, acquisitions including
         Naver-Upbit, Archetype fund launch, and discussions on valuation and Tether
```

### Workflow Execution

**Step 2: Routing**
- Detects `"crypto"` keyword in subject
- Routes to: `["interests"]`

**Step 3: Taxonomy Context**
```
Interests Categories:
- 342: Cryptocurrency
- 156: Technology
- 343: Blockchain
- 201: Investing
```

**Step 4: LLM Prompt**
```
Analyze the following email and identify interest signals...

Email Content:
Subject: New Research: Crypto Venture Weekly: September 22-26, 2025
Body: Crypto Venture Weekly highlights fundraising by Kraken...

Relevant Taxonomy Categories:
- 342: Cryptocurrency
- 156: Technology
...
```

**Step 5: LLM Response**
```json
{
  "classifications": [
    {
      "taxonomy_id": 342,
      "value": "Cryptocurrency",
      "confidence": 0.85,
      "reasoning": "Newsletter focused on crypto venture capital funding"
    },
    {
      "taxonomy_id": 156,
      "value": "Technology",
      "confidence": 0.80,
      "reasoning": "Discusses blockchain technology and fintech platforms"
    }
  ]
}
```

**Step 6: Taxonomy Lookup**
- Lookup 342 → Returns: `{"tier_1": "Interest", "tier_2": "Careers", "tier_3": "Remote Working"}`
- Lookup 156 → Returns: `{"tier_1": "Interest", "tier_2": "Technology", "tier_3": ""}`

**Step 7: Memory Storage**
```sql
-- Memory 1
semantic_interests_342_cryptocurrency
  tier_path: "Interest | Careers | Remote Working"
  confidence: 0.85

-- Memory 2
semantic_interests_156_technology
  tier_path: "Interest | Technology"
  confidence: 0.80
```

**Step 8: Profile Output**
```json
{
  "interests": [
    {
      "taxonomy_id": 342,
      "tier_path": "Interest | Careers | Remote Working",
      "value": "Cryptocurrency",
      "confidence": 0.85
    },
    {
      "taxonomy_id": 156,
      "tier_path": "Interest | Technology",
      "value": "Technology",
      "confidence": 0.80
    }
  ]
}
```

---

## Key Insights

### Why The Fix Was Critical

**Problem**: The LLM returns a `value` field (e.g., "Cryptocurrency") but this is just a label. If we use this label to construct the tier hierarchy, we create **fabricated taxonomy data** that doesn't match the official IAB structure.

**Solution**: Always look up the `taxonomy_id` in the official IAB taxonomy Excel file to get the **real tier structure**. The LLM's `value` is stored for display purposes only.

### Tier Hierarchy vs Value Field

- **Tier Hierarchy** (`tier_1`, `tier_2`, `tier_3`, etc.): Official IAB taxonomy classification structure
- **Value Field**: Human-readable label for the specific classification (may be the same as tier_2, tier_3, or tier_4)
- **Category Path**: Concatenation of non-empty tiers: `"tier_1 | tier_2 | tier_3"`

### Example Comparison

**Taxonomy ID 342**:
- **Official Tier Structure**: Interest → Careers → Remote Working
- **Value (LLM label)**: "Cryptocurrency"
- **Category Path**: "Interest | Careers | Remote Working"

The value "Cryptocurrency" is stored in the `name` field of the taxonomy entry and is used for display, but the **tier hierarchy** is the authoritative classification.

---

## Files Modified

**Critical Fix** (Phase 4):
- `src/email_parser/workflow/nodes/analyzers.py`
  - Added `lookup_taxonomy_entry()` function (lines 30-65)
  - Updated all 4 analyzer nodes to use real taxonomy lookups (lines 121-144, 209-232, 297-320, 385-412)

**Supporting Files**:
- `src/email_parser/workflow/routing.py` - Email classification patterns
- `src/email_parser/workflow/taxonomy_context.py` - Taxonomy context for LLM prompts
- `src/email_parser/workflow/prompts/__init__.py` - LLM prompt templates
- `src/email_parser/workflow/llm_wrapper.py` - LLM client wrapper
- `src/email_parser/memory/reconciliation.py` - Evidence reconciliation logic
- `src/email_parser/utils/iab_taxonomy_loader.py` - IAB taxonomy loader

---

## Testing

**Test File**: `taxonomy_fix_test.csv`

```bash
# Test with OpenAI
LLM_PROVIDER=openai python -m src.email_parser.main \
  --iab-csv taxonomy_fix_test.csv \
  --iab-output taxonomy_fix_output.json \
  --user-id taxonomy_test

# Verify output
cat taxonomy_fix_output.json | jq '.interests[0]'
```

**Expected Output**:
```json
{
  "taxonomy_id": 342,
  "tier_path": "Interest | Careers | Remote Working",
  "value": "Cryptocurrency",
  "confidence": 0.85
}
```

**Validation**:
- No "Skipping invalid taxonomy_id" warnings in logs
- All tier_path values match official IAB taxonomy structure
- Database queries show correct tier_1, tier_2, tier_3 values from Excel file

---

## References

- **IAB Audience Taxonomy v1.1**: Official taxonomy Excel file in `data/`
- **Phase 4 Documentation**: `docs/PHASE_4_IMPLEMENTATION_GUIDE.md`
- **Memory Schema**: `docs/IAB_TAXONOMY_PROFILE_REQUIREMENTS.md`
- **Workflow Architecture**: `docs/PHASE_3_WORKFLOW_ARCHITECTURE.md`
