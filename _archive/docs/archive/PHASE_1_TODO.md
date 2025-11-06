# Phase 1: Foundation & Data Infrastructure - TODO List

**Phase Goal**: Set up core dependencies, parse IAB Taxonomy data, and create data infrastructure for taxonomy lookups.

**Reference Document**: [IAB_TAXONOMY_PROFILE_REQUIREMENTS.md](./IAB_TAXONOMY_PROFILE_REQUIREMENTS.md)

---

## Tasks

### ☐ Task 1: Add Dependencies to requirements.txt
**Status**: Pending
**Estimated Time**: 15 minutes

**Subtasks**:
- [ ] Add `langgraph` for workflow orchestration
- [ ] Add `langmem` for persistent memory management
- [ ] Add `langchain-core` for LangChain foundations
- [ ] Add `langchain-openai` for OpenAI integration
- [ ] Add `langchain-anthropic` for Claude integration
- [ ] Add `openpyxl` for Excel file parsing
- [ ] Add `psycopg2-binary` for PostgreSQL support (production)

**Success Criteria**:
- All dependencies added to requirements.txt
- Dependencies install without conflicts
- No breaking changes to existing imports

**Notes**:
- Keep existing dependencies intact
- Test installation in virtual environment

---

### ☐ Task 2: Parse IAB Taxonomy Excel File
**Status**: Pending
**Estimated Time**: 1 hour

**Subtasks**:
- [ ] Create `src/email_parser/utils/iab_taxonomy_loader.py`
- [ ] Load 'Consolidated' sheet with pandas
- [ ] Extract all 1,568 rows with columns: ID, Parent ID, Condensed Name, Tiers 1-5
- [ ] Parse hierarchical structure (parent-child relationships)
- [ ] Handle empty cells and data type conversions
- [ ] Validate row counts match requirements document

**Success Criteria**:
- Successfully load Excel file
- Extract 1,568 taxonomy entries
- Hierarchical relationships preserved
- All tier levels (1-5) captured

**Key Row Ranges** (from requirements):
- Demographics: Rows 11-62
- Household Data: Rows 64-168
- Personal Attributes: Rows 169-172
- Personal Finance: Rows 175-207
- Interests: Rows 209-704
- Purchase Intent: Rows 707-1568

**Notes**:
- File path: `/Volumes/T7_new/developer_old/email_parser/IABTL-Audience-Taxonomy-1.1-Final.xlsx`
- Skip header rows (rows 0-9)
- Column mapping: A=ID, B=Parent, C=Name, E-I=Tiers

---

### ☐ Task 3: Parse Purchase Intent Classifications
**Status**: Pending
**Estimated Time**: 30 minutes

**Subtasks**:
- [ ] Load 'Purchase Intent Classification' sheet (tab 2)
- [ ] Extract PIPR codes (Past Purchase Recency): PIPR1-8
- [ ] Extract PIPF codes (Past Purchase Frequency): PIPF1-3
- [ ] Extract PIPV codes (Past Purchase Value): PIPV1-3
- [ ] Extract PIFI codes (Future Buyer Intent): PIFI1-3
- [ ] Store as dictionary: `{code: description}`

**Success Criteria**:
- 23 classification codes extracted
- All descriptions captured
- Data structure ready for LLM prompts

**Expected Structure**:
```python
{
    "PIPR1": "<1 day",
    "PIPR2": "<7 days",
    "PIPR3": "<14 days",
    # ... etc
}
```

---

### ☐ Task 4: Build Indexed Lookup Tables
**Status**: Pending
**Estimated Time**: 1 hour

**Subtasks**:
- [ ] Create lookup by taxonomy ID: `{id: taxonomy_entry}`
- [ ] Create lookup by category section: `{"demographics": [...], "interests": [...]}`
- [ ] Create lookup by row range: `{(11, 24): "age_range", ...}`
- [ ] Create parent-child relationship map
- [ ] Create tier-level indexes for hierarchical queries
- [ ] Optimize for fast O(1) lookups

**Success Criteria**:
- Sub-second lookup performance for any taxonomy ID
- Easy filtering by category section
- Hierarchical navigation working

**Data Structures**:
```python
taxonomy_by_id = {1: {...}, 2: {...}, ...}
taxonomy_by_section = {
    "demographics": {"age_range": [...], "gender": [...]},
    "interests": [...],
    "purchase_intent": [...]
}
row_range_map = {
    (11, 24): "demographics.age_range",
    (59, 62): "demographics.gender",
    # ...
}
```

---

### ☐ Task 5: Create Pydantic Data Models
**Status**: Pending
**Estimated Time**: 1 hour

**Subtasks**:
- [ ] Create `src/email_parser/models/iab_taxonomy.py`
- [ ] Define `TaxonomyEntry` model (id, parent_id, name, tiers, path)
- [ ] Define `PurchaseIntentClassification` model (code, description)
- [ ] Define `TaxonomySelection` model (taxonomy_id, value, confidence, evidence)
- [ ] Define `IABConsumerProfile` model (demographics, household, interests, purchases)
- [ ] Add validation rules and field constraints

**Success Criteria**:
- All models validate correctly with sample data
- Type hints support IDE autocomplete
- Serialization to JSON works
- Models align with requirements document JSON schema

**Key Models**:
1. `TaxonomyEntry`: Represents a single IAB taxonomy item
2. `PurchaseIntentClassification`: PIPR/PIPF/PIPV/PIFI codes
3. `TaxonomySelection`: User's classification with confidence + evidence
4. `IABConsumerProfile`: Complete user profile output

---

### ☐ Task 6: Test Taxonomy Parsing
**Status**: Pending
**Estimated Time**: 30 minutes

**Subtasks**:
- [ ] Write unit tests in `tests/unit/test_iab_taxonomy_loader.py`
- [ ] Test: Load Excel file successfully
- [ ] Test: Extract correct row counts (1,568 entries, 23 classifications)
- [ ] Test: Query taxonomy by ID (sample IDs: 5, 60, 342, 812)
- [ ] Test: Query by category section
- [ ] Test: Hierarchical navigation (parent→children)
- [ ] Manual verification: Print sample entries from each section

**Success Criteria**:
- All unit tests pass
- Sample queries return expected taxonomy entries
- Verified coverage of all major sections

**Sample Test Queries**:
```python
# Query specific IDs
taxonomy_by_id[5]  # Age Range: 25-29
taxonomy_by_id[60]  # Gender: Male
taxonomy_by_id[342]  # Interest: Cryptocurrency (example)
taxonomy_by_id[812]  # Purchase Intent: Technology | Laptops (example)

# Query by section
taxonomy_by_section["demographics"]["age_range"]
taxonomy_by_section["interests"]
```

---

## Phase 1 Completion Checklist

- [ ] All dependencies installed and verified
- [ ] IAB Taxonomy fully parsed (1,568 entries)
- [ ] Purchase Intent Classifications loaded (23 codes)
- [ ] Fast lookup tables built and indexed
- [ ] Pydantic models created and validated
- [ ] Unit tests pass with 100% success rate
- [ ] Manual verification of sample taxonomy queries
- [ ] Code reviewed against requirements document
- [ ] Ready to proceed to Phase 2: Memory System Design

---

## Phase 1 Notes & Decisions

**Date**: 2025-09-30
**Status**: Not Started

### Design Decisions
- TBD during implementation

### Challenges Encountered
- TBD during implementation

### Performance Metrics
- TBD after completion

---

**Next Phase**: [Phase 2: Memory System Design](./PHASE_2_TODO.md)
**Previous Phase**: N/A (Initial Phase)