# Python IAB Classifier Implementation Specification

**Purpose:** Complete documentation of the Python email_parser IAB classification system for exact TypeScript migration.

**Date:** 2025-01-07
**Source:** `src/email_parser/` Python implementation
**Target:** TypeScript PWA migration with 100% feature parity

---

## Overview

The Python IAB classifier uses a **LangGraph StateGraph workflow** with 4 specialized analyzer agents (Demographics, Household, Interests, Purchase) that classify email content into the full IAB Audience Taxonomy 1.1 (1,558 entries).

### Key Features

1. **Full IAB Taxonomy 1.1** - 1,558 entry hierarchical classification (5 tiers)
2. **Batch Processing** - 20-30x performance optimization (multiple emails per LLM call)
3. **Evidence Judge** - LLM-as-Judge validation of evidence quality
4. **Temporal Decay** - Confidence score aging over time
5. **Multi-Analyzer System** - 4 separate ReAct agents with taxonomy search tools
6. **Evidence Reconciliation** - Multi-source conflict resolution
7. **Taxonomy Validation** - Prevents ID/value mismatches from LLM errors
8. **Provenance Tracking** - Links classifications to source emails

---

## 1. Architecture: LangGraph StateGraph Workflow

### Graph Structure

```
START
  ↓
load_emails (filter new emails)
  ↓
[conditional: has_emails?]
  ↓ yes
retrieve_profile (apply temporal decay)
  ↓
analyze_all (runs all 4 analyzers sequentially)
  ├── demographics_analyzer_node
  ├── household_analyzer_node
  ├── interests_analyzer_node
  └── purchase_analyzer_node
  ↓
reconcile (update confidence scores)
  ↓
update_memory (store to LangGraph Store)
  ↓
[conditional: has_more_emails?]
  ↓ yes → advance_email → retrieve_profile (loop)
  ↓ no → END
```

**Source:** `src/email_parser/workflow/graph.py:build_workflow_graph()`

### Node Definitions

1. **load_emails** - Loads new emails, filters already-processed
2. **retrieve_profile** - Gets existing taxonomy profile from Store
3. **analyze_all** - Runs all 4 analyzers in sequence
4. **reconcile** - Resolves conflicts, updates confidence scores
5. **update_memory** - Persists to LangGraph Store
6. **advance_email** - Moves to next email/batch

---

## 2. State Structure

### WorkflowState Schema

**Source:** `src/email_parser/workflow/state.py:WorkflowState`

```python
class WorkflowState(TypedDict):
    # User Context
    user_id: str  # Required from start

    # Email Data (Added by load_emails)
    emails: List[Dict[str, Any]]
    processed_email_ids: List[str]
    current_email_index: int  # DEPRECATED
    total_emails: int

    # Batch Processing Fields
    current_batch_start: int
    batch_size: int
    model_context_window: int
    force_reprocess: bool

    # LLM Config
    cost_tracker: Any  # CostTracker instance
    tracker: Any  # WorkflowTracker instance
    llm_model: str
    llm_provider: str  # 'openai', 'anthropic', 'gemini', 'ollama' (dynamically added, not in TypedDict)

    # Profile Data (Added by retrieve_profile)
    existing_profile: Dict[str, Any]  # Structure: {demographics: [], household: [], interests: [], purchase_intent: []}

    # Analysis Results (Added by analyzer nodes)
    demographics_results: List[Dict[str, Any]]
    household_results: List[Dict[str, Any]]
    interests_results: List[Dict[str, Any]]
    purchase_results: List[Dict[str, Any]]

    # Reconciliation (Added by reconcile node)
    reconciliation_data: List[Dict[str, Any]]

    # Output (Added by update_memory)
    updated_profile: Dict[str, Any]

    # Error Tracking
    errors: List[str]
    warnings: List[str]
    workflow_started_at: str  # ISO 8601
    workflow_completed_at: str  # ISO 8601

    # Routing Metadata
    next_analyzers: List[str]
    completed_analyzers: List[str]
```

### Taxonomy Classification Structure

Each analyzer produces classifications with this exact structure:

**Source:** `src/email_parser/workflow/nodes/analyzers.py:299-314`

```python
{
    "taxonomy_id": int,  # IAB Taxonomy unique ID (1-1568)
    "section": str,  # "demographics", "household", "interests", "purchase_intent"
    "value": str,  # Actual classification value (e.g., "Male", "25-29", "Bachelor's Degree")
    "confidence": float,  # 0.0-1.0
    "category_path": str,  # "Demographic | Gender | Male"
    "tier_1": str,  # "Demographic"
    "tier_2": str,  # "Gender"
    "tier_3": str,  # "Male"
    "tier_4": str,  # ""
    "tier_5": str,  # ""
    "grouping_tier_key": str,  # "tier_2" or "tier_3" (for reconciliation)
    "grouping_value": str,  # "Gender" (used for grouping conflicts)
    "reasoning": str,  # "Agent analysis" or LLM reasoning
    "email_id": str,  # (Optional) Source email ID for provenance

    # Purchase-specific fields
    "purchase_intent_flag": str  # (Only for purchase_results) "PIPR_HIGH", "PIPR_MEDIUM", "PIPR_LOW", "ACTUAL_PURCHASE"
}
```

---

## 3. Taxonomy Models

### TaxonomyEntry

**Source:** `src/email_parser/models/iab_taxonomy.py:20-31`

```python
class TaxonomyEntry(BaseModel):
    id: int  # Unique IAB Taxonomy ID
    parent_id: Optional[int]  # Parent taxonomy ID for hierarchy
    name: str  # Full condensed name with pipe separation
    tier_1: str  # Tier 1 category
    tier_2: str  # Tier 2 category
    tier_3: str  # Tier 3 category
    tier_4: str  # Tier 4 category
    tier_5: str  # Tier 5 category
    excel_row: int  # Excel row number (1-indexed)
```

### Grouping Metadata

**Source:** `src/email_parser/utils/iab_taxonomy_loader.py:187-258`

Python's taxonomy loader computes grouping metadata for each entry:

```python
entry['grouping_tier_key']  # 'tier_2' or 'tier_3'
entry['grouping_value']  # Value to group by for reconciliation
entry['is_grouping_root']  # True if this is a root-level entry
```

**Logic:**
- If parent has no `tier_3`: use `tier_2` as grouping key
- If parent has `tier_3`: use `tier_3` as grouping key

**Examples:**
- Gender (ID 48): `Demographic | Gender` (no tier_3) → group by `tier_2="Gender"`
- Female (ID 49): `Demographic | Gender | Female` → grouped by `tier_2="Gender"`
- Education (ID 12): `Demographic | Education & Occupation | Education (Highest Level)` → group by `tier_3`
- College (ID 20): grouped by `tier_3="Education (Highest Level)"`

---

## 4. Classification Flow (Analyzer Nodes)

All 4 analyzers follow the **exact same pattern**:

### Demographics Analyzer

**Source:** `src/email_parser/workflow/nodes/analyzers.py:165-342`

```python
def demographics_analyzer_node(state: WorkflowState) -> WorkflowState:
    # 1. Get current batch of emails
    emails = get_current_batch(state)

    # 2. Initialize LLM client
    llm_client = AnalyzerLLMClient(
        provider=state.get("llm_provider"),
        model=state.get("llm_model"),
        cost_tracker=state.get("cost_tracker"),
        workflow_tracker=state.get("tracker")
    )

    # 3. Run ReAct agent with taxonomy search tools
    agent_result = extract_demographics_with_agent(
        emails=emails,  # Pass entire batch
        llm_client=llm_client,
        max_iterations=3
    )

    # 4. Evidence Quality Validation (LLM-as-Judge)
    classifications = agent_result.get("classifications", [])
    email_context = "\n\n".join([...])  # Build full batch context

    validated_classifications = []
    for classification in classifications:
        evidence_eval = evaluate_evidence_quality(
            classification=classification,
            email_context=email_context,
            section_guidelines=DEMOGRAPHICS_EVIDENCE_GUIDELINES,
            llm_client=llm_client
        )

        classification = adjust_confidence_with_evidence_quality(
            classification, evidence_eval
        )

        if should_block_classification(evidence_eval["quality_score"]):
            continue  # Skip inappropriate inferences

        validated_classifications.append(classification)

    # 5. Taxonomy Validation (ID/value matching)
    for classification in validated_classifications:
        taxonomy_id = classification.get("taxonomy_id")
        llm_value = classification.get("value", "").strip()

        # Look up actual taxonomy entry
        taxonomy_entry = lookup_taxonomy_entry(taxonomy_id)
        if not taxonomy_entry:
            continue

        # Validate ID matches value
        if not validate_taxonomy_classification(taxonomy_id, llm_value, taxonomy_entry):
            continue  # Skip mismatched classifications

        # Determine final value (handle asterisk placeholders)
        taxonomy_value = get_taxonomy_value(taxonomy_entry)
        final_value = llm_value if taxonomy_value.startswith("*") else taxonomy_value

        # 6. Build final selection with all tier information
        selection = {
            "taxonomy_id": taxonomy_id,
            "section": "demographics",
            "value": final_value,
            "confidence": classification.get("confidence", 0.7),
            "category_path": taxonomy_entry["category_path"],
            "tier_1": taxonomy_entry["tier_1"],
            "tier_2": taxonomy_entry["tier_2"],
            "tier_3": taxonomy_entry["tier_3"],
            "tier_4": taxonomy_entry["tier_4"],
            "tier_5": taxonomy_entry["tier_5"],
            "grouping_tier_key": taxonomy_entry["grouping_tier_key"],
            "grouping_value": taxonomy_entry["grouping_value"],
            "reasoning": classification.get("reasoning", "Agent analysis")
        }
        state["demographics_results"].append(selection)

    return state
```

### Household, Interests, Purchase Analyzers

**Exact same structure** as demographics, only differences:

1. Different section name: `"household"`, `"interests"`, `"purchase_intent"`
2. Different agent function: `extract_household_with_agent()`, `extract_interests_with_agent()`, `extract_purchase_with_agent()`
3. Different evidence guidelines: `HOUSEHOLD_EVIDENCE_GUIDELINES`, `INTERESTS_EVIDENCE_GUIDELINES`, `PURCHASE_EVIDENCE_GUIDELINES`
4. Purchase analyzer adds `purchase_intent_flag` field

---

## 5. Helper Functions

### lookup_taxonomy_entry()

**Source:** `src/email_parser/workflow/nodes/analyzers.py:30-67`

```python
def lookup_taxonomy_entry(taxonomy_id: int) -> Optional[Dict[str, Any]]:
    loader = _get_taxonomy_loader()  # Singleton IABTaxonomyLoader
    entry = loader.taxonomy_by_id.get(taxonomy_id)

    if not entry:
        return None

    # Build category_path from tiers
    tiers = [entry['tier_1'], entry['tier_2'], entry['tier_3'], entry['tier_4'], entry['tier_5']]
    non_empty_tiers = [t for t in tiers if t]
    category_path = " | ".join(non_empty_tiers)

    return {
        "tier_1": entry['tier_1'],
        "tier_2": entry['tier_2'],
        "tier_3": entry['tier_3'],
        "tier_4": entry['tier_4'],
        "tier_5": entry['tier_5'],
        "category_path": category_path,
        "name": entry['name'],
        "grouping_tier_key": entry.get('grouping_tier_key', 'tier_2'),
        "grouping_value": entry.get('grouping_value', entry['tier_2'])
    }
```

### get_taxonomy_value()

**Source:** `src/email_parser/workflow/nodes/analyzers.py:70-100`

```python
def get_taxonomy_value(taxonomy_entry: Dict[str, Any]) -> str:
    """Extract the actual classification value from a taxonomy entry.

    The value is the deepest non-empty tier (tier_5 > tier_4 > tier_3).

    Examples:
        ID 50: Demographic | Gender | Male → "Male" (tier_3)
        ID 21: Demographic | ... | College Education | Professional School → "Professional School" (tier_5)
    """
    for tier_key in ['tier_5', 'tier_4', 'tier_3']:
        value = taxonomy_entry.get(tier_key, "").strip()
        if value:
            return value

    return taxonomy_entry.get('tier_2', "").strip()
```

### validate_taxonomy_classification()

**Source:** `src/email_parser/workflow/nodes/analyzers.py:103-162`

```python
def validate_taxonomy_classification(
    taxonomy_id: int,
    llm_value: str,
    taxonomy_entry: Dict[str, Any]
) -> bool:
    """Validate that LLM's classification value matches the taxonomy entry.

    Prevents data corruption from LLM errors where wrong taxonomy IDs
    are paired with incorrect values.
    """
    expected_value = get_taxonomy_value(taxonomy_entry)

    # Handle asterisk placeholders (e.g., "*Country Extension", "*Language")
    # For these entries, LLM provides actual value (e.g., "United Kingdom", "English")
    if expected_value.startswith("*"):
        if not llm_value or not llm_value.strip():
            return False  # Empty value for placeholder
        return True  # Accept any non-empty value

    # Non-asterisk entries: validate exact match (case-insensitive)
    llm_normalized = llm_value.strip().lower()
    expected_normalized = expected_value.strip().lower()

    if llm_normalized != expected_normalized:
        logger.warning(f"VALIDATION FAILED: Taxonomy ID {taxonomy_id} mismatch")
        return False

    return True
```

---

## 6. Batch Processing

**Source:** `src/email_parser/workflow/batch_optimizer.py`

Python implementation processes **multiple emails per LLM call** for 20-30x performance improvement.

### Key Concepts

1. **Dynamic Batch Sizing** - Calculates batch size based on LLM context window
2. **Token Estimation** - Estimates email token count before batching
3. **State Tracking** - Uses `current_batch_start` and `batch_size` instead of `current_email_index`

### get_current_batch()

**Source:** `src/email_parser/workflow/state.py:286-301`

```python
def get_current_batch(state: WorkflowState) -> List[Dict[str, Any]]:
    """Get the current batch of emails being processed."""
    from ..workflow.batch_optimizer import get_batch_from_state
    return get_batch_from_state(state)
```

---

## 7. Evidence Judge (LLM-as-Judge Validation)

**Source:** `src/email_parser/workflow/nodes/evidence_judge.py`

### evaluate_evidence_quality()

```python
def evaluate_evidence_quality(
    classification: Dict[str, Any],
    email_context: str,
    section_guidelines: str,
    llm_client: AnalyzerLLMClient
) -> Dict[str, Any]:
    """
    Use LLM-as-Judge to evaluate evidence quality for a classification.

    Returns:
        {
            "quality_score": float,  # 0.0-1.0
            "issue": str,  # "WEAK_EVIDENCE", "INAPPROPRIATE_INFERENCE", etc.
            "explanation": str
        }
    """
```

### adjust_confidence_with_evidence_quality()

```python
def adjust_confidence_with_evidence_quality(
    classification: Dict[str, Any],
    evidence_eval: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Adjust confidence score based on evidence quality.

    - quality_score >= 0.8: No adjustment
    - quality_score 0.5-0.8: Reduce confidence by (1 - quality_score) * 0.3
    - quality_score < 0.5: Block (handled by should_block_classification)
    """
```

### should_block_classification()

```python
def should_block_classification(quality_score: float) -> bool:
    """Block classifications with quality_score < 0.5"""
    return quality_score < 0.5
```

---

## 8. Taxonomy Loader

**Source:** `src/email_parser/utils/iab_taxonomy_loader.py`

### IABTaxonomyLoader (Singleton)

```python
class IABTaxonomyLoader(metaclass=Singleton):
    # Row range mappings from requirements
    ROW_RANGES = {
        "demographics": {"age_range": (11, 24), "education_occupation": (27, 57), "gender": (59, 62)},
        "household_data": (64, 168),
        "personal_attributes": (169, 172),
        "personal_finance": (175, 207),
        "interests": (209, 704),
        "purchase_intent": (707, 1568),
    }

    def __init__(self, taxonomy_file_path: Optional[str] = None):
        # Load from Excel file
        self.taxonomy_entries: List[Dict[str, Any]] = []
        self.taxonomy_by_id: Dict[int, Dict[str, Any]] = {}
        self.taxonomy_by_section: Dict[str, List[Dict[str, Any]]] = {}
        self.purchase_classifications: Dict[str, str] = {}
        self.parent_child_map: Dict[int, List[int]] = {}

        self._load_taxonomy()
        self._load_purchase_classifications()
        self._build_indexes()
        self._compute_grouping_metadata()

    # Public API
    def get_by_id(self, taxonomy_id: int) -> Optional[Dict[str, Any]]: ...
    def get_by_section(self, section: str) -> List[Dict[str, Any]]: ...
    def get_children(self, parent_id: int) -> List[Dict[str, Any]]: ...
    def get_purchase_classification(self, code: str) -> Optional[str]: ...
    def get_all_purchase_classifications(self) -> Dict[str, str]: ...
    def search_by_name(self, search_term: str) -> List[Dict[str, Any]]: ...
```

### Loading Process

1. **_load_taxonomy()** - Loads 'Consolidated' sheet from Excel (columns 1-8, rows 10+)
2. **_load_purchase_classifications()** - Loads 'Purchase Intent Classification ' sheet
3. **_build_indexes()** - Creates `taxonomy_by_id`, `parent_child_map`, `taxonomy_by_section`
4. **_compute_grouping_metadata()** - Calculates `grouping_tier_key`, `grouping_value`, `is_grouping_root`

---

## 9. TypeScript Migration Requirements

### Must Port Exactly

1. **StateGraph workflow structure** - Same nodes, same edges, same conditional routing
2. **WorkflowState schema** - All fields with exact TypeScript equivalents
3. **Taxonomy classification structure** - Exact field names and types
4. **Analyzer node pattern** - All 6 steps (batch → agent → evidence judge → taxonomy validation → selection build → append)
5. **Helper functions** - `lookup_taxonomy_entry()`, `get_taxonomy_value()`, `validate_taxonomy_classification()`
6. **Batch processing** - Same batching logic
7. **Evidence judge** - Same 3 functions (evaluate, adjust, block)
8. **Grouping metadata** - Same calculation logic

### TypeScript Equivalents

```typescript
// Python TypedDict → TypeScript interface
WorkflowState (Python) → interface WorkflowState extends Annotation.State (TypeScript)

// Python @dataclass → TypeScript interface
TaxonomyEntry (Python) → interface IABTaxonomyEntry (TypeScript)

// Python Dict[str, Any] → TypeScript Record<string, any>
Dict[str, Any] (Python) → Record<string, any> (TypeScript)

// Python List[Dict] → TypeScript Array<Record>
List[Dict[str, Any]] (Python) → Array<Record<string, any>> (TypeScript)

// Python Optional[T] → TypeScript T | undefined
Optional[str] (Python) → string | undefined (TypeScript)

// Python Singleton metaclass → TypeScript static instance
class IABTaxonomyLoader(metaclass=Singleton) (Python) → private static instance: IABTaxonomyLoader | null (TypeScript)
```

### Files to Create/Modify

1. **`src/shared/types/iab.ts`** - Update `IABClassification` interface with full taxonomy fields
2. **`src/browser/agents/iab-classifier/index.ts`** - Port exact StateGraph workflow
3. **`src/browser/agents/iab-classifier/state.ts`** - Port WorkflowState schema
4. **`src/browser/agents/iab-classifier/nodes/analyzers.ts`** - Port all 4 analyzer nodes
5. **`src/browser/agents/iab-classifier/nodes/evidence-judge.ts`** - Port evidence validation
6. **`src/browser/agents/iab-classifier/helpers.ts`** - Port helper functions
7. **`tests/browser/agents/iab-classifier/IABClassifier.test.ts`** - Port Python tests exactly

---

## 10. Testing Requirements

### Unit Tests

Port Python tests from `tests/email_parser/` with **exact assertions**:

1. Test taxonomy lookup functions
2. Test validation functions
3. Test each analyzer with mock LLM responses
4. Test batch processing logic
5. Test evidence judge functions
6. Test state management functions

### Integration Tests

1. End-to-end classification workflow
2. Multi-email batch processing
3. Store persistence and retrieval
4. Error handling and recovery

---

## Summary

The Python IAB classifier is a **production-tested, feature-rich system** with:
- Full IAB Taxonomy 1.1 (1,558 entries)
- Batch processing (20-30x faster)
- Evidence quality validation
- Taxonomy ID/value validation
- 4 specialized ReAct agents
- Comprehensive error handling

**Migration approach:** Translate Python → TypeScript **line-by-line**, maintaining exact structure, field names, and logic flow. No simplifications, no new approaches, no divergence without explicit approval.
