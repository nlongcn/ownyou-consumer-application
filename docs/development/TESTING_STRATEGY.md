# IAB Taxonomy Profile System - Testing Strategy

**Purpose**: Comprehensive testing strategy for all development phases, ensuring each phase works correctly in isolation and integrates properly with the entire project.

---

## Testing Philosophy

### Core Principles

1. **Test at Every Phase**: Each phase has its own test suite
2. **Integration Testing**: Verify phase works with existing codebase
3. **Regression Testing**: Ensure new code doesn't break existing functionality
4. **End-to-End Validation**: Test complete workflow after each phase
5. **Automated + Manual**: Combine automated tests with manual verification

### Test Pyramid Structure

```
                    ┌─────────────┐
                    │   E2E Tests  │  (Few - Full workflow)
                    └─────────────┘
                ┌─────────────────────┐
                │  Integration Tests   │  (Some - Phase interactions)
                └─────────────────────┘
            ┌───────────────────────────────┐
            │       Unit Tests               │  (Many - Individual functions)
            └───────────────────────────────┘
```

---

## Phase 1: Foundation & Data Infrastructure

### Unit Tests

**Test File**: `tests/unit/test_iab_taxonomy_loader.py`

```python
import pytest
from src.email_parser.utils.iab_taxonomy_loader import (
    load_taxonomy,
    load_purchase_classifications,
    TaxonomyLoader
)

class TestTaxonomyLoading:
    """Test taxonomy Excel file loading"""

    def test_load_taxonomy_success(self):
        """Verify taxonomy loads with correct row count"""
        taxonomy = load_taxonomy()
        assert len(taxonomy) == 1568, "Should load exactly 1,568 entries"

    def test_taxonomy_structure(self):
        """Verify taxonomy entry structure"""
        taxonomy = load_taxonomy()
        entry = taxonomy[0]
        assert 'id' in entry
        assert 'parent_id' in entry
        assert 'name' in entry
        assert 'tier_1' in entry

    def test_row_ranges_demographics(self):
        """Verify demographics section (rows 11-62)"""
        loader = TaxonomyLoader()
        demographics = loader.get_by_section("demographics")
        assert len(demographics) > 0
        assert any(e['name'].startswith('Demographic | Age Range')
                   for e in demographics)

    def test_row_ranges_interests(self):
        """Verify interests section (rows 209-704)"""
        loader = TaxonomyLoader()
        interests = loader.get_by_section("interests")
        assert len(interests) == 495  # 704 - 209 + 1

    def test_row_ranges_purchase_intent(self):
        """Verify purchase intent section (rows 707-1568)"""
        loader = TaxonomyLoader()
        purchase = loader.get_by_section("purchase_intent")
        assert len(purchase) == 862  # 1568 - 707 + 1

class TestPurchaseClassifications:
    """Test purchase intent classification loading"""

    def test_load_classifications(self):
        """Verify all 23 classification codes load"""
        classifications = load_purchase_classifications()
        assert len(classifications) == 23

    def test_pipr_codes(self):
        """Verify PIPR codes (recency)"""
        classifications = load_purchase_classifications()
        pipr_codes = [k for k in classifications.keys() if k.startswith('PIPR')]
        assert len(pipr_codes) == 8  # PIPR1-8
        assert 'PIPR1' in classifications
        assert classifications['PIPR1'] == '<1 day'

    def test_pipf_codes(self):
        """Verify PIPF codes (frequency)"""
        classifications = load_purchase_classifications()
        pipf_codes = [k for k in classifications.keys() if k.startswith('PIPF')]
        assert len(pipf_codes) == 3  # PIPF1-3

    def test_pipv_codes(self):
        """Verify PIPV codes (value)"""
        classifications = load_purchase_classifications()
        pipv_codes = [k for k in classifications.keys() if k.startswith('PIPV')]
        assert len(pipv_codes) == 3  # PIPV1-3

    def test_pifi_codes(self):
        """Verify PIFI codes (future intent)"""
        classifications = load_purchase_classifications()
        pifi_codes = [k for k in classifications.keys() if k.startswith('PIFI')]
        assert len(pifi_codes) == 3  # PIFI1-3

class TestLookupTables:
    """Test indexed lookup performance and correctness"""

    def test_lookup_by_id(self):
        """Verify O(1) lookup by taxonomy ID"""
        loader = TaxonomyLoader()
        entry = loader.get_by_id(5)  # Age Range: 25-29
        assert entry is not None
        assert entry['tier_3'] == '25-29'

    def test_lookup_nonexistent_id(self):
        """Handle missing taxonomy ID gracefully"""
        loader = TaxonomyLoader()
        entry = loader.get_by_id(99999)
        assert entry is None

    def test_hierarchical_navigation(self):
        """Verify parent-child relationships"""
        loader = TaxonomyLoader()
        parent = loader.get_by_id(2)  # Age Range category
        children = loader.get_children(2)
        assert len(children) > 0
        assert all(c['parent_id'] == 2 for c in children)

class TestPydanticModels:
    """Test Pydantic model validation"""

    def test_taxonomy_entry_model(self):
        """Verify TaxonomyEntry model validation"""
        from src.email_parser.models.iab_taxonomy import TaxonomyEntry
        entry = TaxonomyEntry(
            id=5,
            parent_id=2,
            name="Demographic | Age Range | 25-29",
            tier_1="Demographic",
            tier_2="Age Range",
            tier_3="25-29"
        )
        assert entry.id == 5
        assert entry.tier_3 == "25-29"

    def test_taxonomy_selection_confidence_bounds(self):
        """Verify confidence constrained to [0, 1]"""
        from src.email_parser.models.iab_taxonomy import TaxonomySelection

        # Valid confidence
        selection = TaxonomySelection(
            taxonomy_id=5,
            value="25-29",
            confidence=0.75,
            evidence_count=5
        )
        assert selection.confidence == 0.75

        # Invalid confidence should raise ValidationError
        with pytest.raises(ValueError):
            TaxonomySelection(
                taxonomy_id=5,
                value="25-29",
                confidence=1.5,  # > 1.0
                evidence_count=5
            )
```

### Integration Tests

**Test File**: `tests/integration/test_phase1_integration.py`

```python
import pytest
from src.email_parser.utils.iab_taxonomy_loader import TaxonomyLoader
from src.email_parser.models.iab_taxonomy import IABConsumerProfile

class TestPhase1Integration:
    """Integration tests for Phase 1 with existing codebase"""

    def test_taxonomy_loader_with_existing_analyzers(self):
        """Verify taxonomy loader doesn't conflict with existing analyzers"""
        from src.email_parser.analysis.marketing_analyzer import UnbiasedMarketingAnalyzer
        from src.email_parser.utils.config import load_config

        # Initialize taxonomy loader
        loader = TaxonomyLoader()

        # Initialize existing analyzer
        config = load_config()
        analyzer = UnbiasedMarketingAnalyzer(config)

        # Both should coexist
        assert loader is not None
        assert analyzer is not None

    def test_models_json_serialization(self):
        """Verify models serialize to JSON correctly"""
        from src.email_parser.models.iab_taxonomy import TaxonomySelection
        import json

        selection = TaxonomySelection(
            taxonomy_id=5,
            value="25-29",
            confidence=0.75,
            evidence_count=5,
            last_validated="2025-09-30"
        )

        # Serialize
        json_str = selection.model_dump_json()
        data = json.loads(json_str)

        assert data['taxonomy_id'] == 5
        assert data['confidence'] == 0.75
```

### Manual Verification Checklist

**Phase 1 Manual Tests**:

- [ ] Open Excel file manually, verify row 5 is "25-29" age range
- [ ] Check taxonomy lookup returns correct hierarchy for sample IDs
- [ ] Print 5 entries from each major section (demographics, interests, purchase)
- [ ] Verify purchase classification codes match Excel tab 2
- [ ] Confirm all dependencies install without conflicts
- [ ] Run existing test suite - ensure no regressions

### Performance Benchmarks

**Phase 1 Performance Tests**:

```python
def test_lookup_performance():
    """Verify lookup tables perform in <1ms"""
    import time
    loader = TaxonomyLoader()

    start = time.perf_counter()
    for i in range(1000):
        entry = loader.get_by_id(5)
    elapsed = time.perf_counter() - start

    assert elapsed < 0.1, "1000 lookups should complete in <100ms"
```

---

## Phase 2: Memory System Design

### Unit Tests

**Test File**: `tests/unit/test_memory_system.py`

```python
class TestMemoryInitialization:
    """Test LangMem store initialization"""

    def test_create_memory_store(self):
        """Verify memory store initializes correctly"""
        from src.email_parser.memory.store import initialize_memory_store
        store = initialize_memory_store(storage_type="sqlite")
        assert store is not None

    def test_namespace_creation(self):
        """Verify namespace structure"""
        namespace = ("user_12345", "iab_taxonomy_profile")
        assert namespace[0] == "user_12345"
        assert namespace[1] == "iab_taxonomy_profile"

class TestMemoryOperations:
    """Test memory CRUD operations"""

    def test_store_semantic_memory(self):
        """Store a semantic memory (fact)"""
        from src.email_parser.memory.store import MemoryManager
        manager = MemoryManager(user_id="test_user")

        memory = {
            "taxonomy_id": 5,
            "confidence": 0.75,
            "evidence_count": 3
        }

        manager.store_semantic_memory("age_range_25_29", memory)
        result = manager.get_semantic_memory("age_range_25_29")

        assert result['taxonomy_id'] == 5
        assert result['confidence'] == 0.75

    def test_store_episodic_memory(self):
        """Store an episodic memory (event)"""
        from src.email_parser.memory.store import MemoryManager
        manager = MemoryManager(user_id="test_user")

        episode = {
            "email_id": "test_email_1",
            "taxonomy_selections": [5, 342],
            "date": "2025-09-30"
        }

        manager.store_episodic_memory("episode_1", episode)
        result = manager.get_episodic_memory("episode_1")

        assert result['email_id'] == "test_email_1"

class TestConfidenceScoring:
    """Test confidence update logic"""

    def test_confirming_evidence_update(self):
        """Confidence increases with confirming evidence"""
        from src.email_parser.memory.confidence import update_confidence

        current_conf = 0.7
        new_evidence_conf = 0.8
        updated = update_confidence(current_conf, new_evidence_conf, "confirming")

        assert updated > current_conf, "Confirming evidence should increase confidence"
        assert updated <= 1.0, "Confidence should not exceed 1.0"

    def test_contradicting_evidence_update(self):
        """Confidence decreases with contradicting evidence"""
        from src.email_parser.memory.confidence import update_confidence

        current_conf = 0.7
        contradiction_conf = 0.8
        updated = update_confidence(current_conf, contradiction_conf, "contradicting")

        assert updated < current_conf, "Contradicting evidence should decrease confidence"
        assert updated >= 0.0, "Confidence should not go below 0.0"

    def test_temporal_decay(self):
        """Confidence decays over time without validation"""
        from src.email_parser.memory.confidence import apply_temporal_decay

        current_conf = 0.8
        days_since_last = 14  # 2 weeks
        decayed = apply_temporal_decay(current_conf, days_since_last)

        assert decayed < current_conf, "Confidence should decay over time"
        assert decayed > 0.7, "2-week decay should be ~2%"
```

### Integration Tests

**Test File**: `tests/integration/test_phase2_integration.py`

```python
class TestPhase2Integration:
    """Integration tests for Phase 2 with Phase 1"""

    def test_memory_with_taxonomy_loader(self):
        """Verify memory system works with taxonomy lookups"""
        from src.email_parser.utils.iab_taxonomy_loader import TaxonomyLoader
        from src.email_parser.memory.store import MemoryManager

        loader = TaxonomyLoader()
        manager = MemoryManager(user_id="test_user")

        # Get taxonomy entry
        entry = loader.get_by_id(5)

        # Store in memory
        memory = {
            "taxonomy_id": entry['id'],
            "value": entry['tier_3'],
            "confidence": 0.75
        }
        manager.store_semantic_memory("age_range", memory)

        # Retrieve
        result = manager.get_semantic_memory("age_range")
        assert result['taxonomy_id'] == 5
```

---

## Phase 3: LangGraph Workflow Design

### Unit Tests

**Test File**: `tests/unit/test_langgraph_workflow.py`

```python
class TestGraphStructure:
    """Test LangGraph state and nodes"""

    def test_state_schema(self):
        """Verify state schema definition"""
        from src.email_parser.workflow.graph import WorkflowState

        state = WorkflowState(
            emails=[],
            taxonomy_selections=[],
            profile_version=1
        )
        assert state['emails'] == []

    def test_load_emails_node(self):
        """Test email loading node"""
        from src.email_parser.workflow.nodes import load_emails_node

        state = {"emails": [], "processed_ids": []}
        result = load_emails_node(state)

        assert 'emails' in result

    def test_conditional_routing(self):
        """Test conditional edge logic"""
        from src.email_parser.workflow.routing import route_email

        email = {
            "subject": "Order Confirmation",
            "category": "Purchase"
        }

        next_node = route_email(email)
        assert next_node == "purchase_agent"
```

### Integration Tests

**Test File**: `tests/integration/test_phase3_integration.py`

```python
class TestPhase3Integration:
    """Integration tests for Phase 3 with Phases 1-2"""

    def test_workflow_with_taxonomy_and_memory(self):
        """Full workflow integration test"""
        from src.email_parser.workflow.graph import build_workflow
        from src.email_parser.memory.store import MemoryManager

        manager = MemoryManager(user_id="test_user")
        workflow = build_workflow(manager)

        # Execute workflow with test emails
        result = workflow.invoke({
            "emails": [{"id": "test1", "subject": "Crypto Newsletter"}],
            "user_id": "test_user"
        })

        assert result is not None
        assert 'taxonomy_selections' in result
```

---

## Phase 4: Analyzer Implementation

### Unit Tests

**Test File**: `tests/unit/test_iab_taxonomy_analyzer.py`

```python
class TestDemographicsAnalyzer:
    """Test demographics extraction"""

    def test_age_range_extraction(self):
        """Extract age range from email content"""
        from src.email_parser.analysis.iab_taxonomy_analyzer import IABTaxonomyAnalyzer

        analyzer = IABTaxonomyAnalyzer(llm_client=mock_llm)
        emails = [
            {"summary": "Newsletter about career advice for young professionals"}
        ]

        result = analyzer.extract_demographics(emails)
        assert 'age_range' in result

    def test_only_taxonomy_values_returned(self):
        """Verify only IAB taxonomy values returned (no custom values)"""
        analyzer = IABTaxonomyAnalyzer(llm_client=mock_llm)
        result = analyzer.extract_demographics(emails)

        # Verify all returned values exist in taxonomy
        loader = TaxonomyLoader()
        for selection in result['age_range']:
            taxonomy_entry = loader.get_by_id(selection['taxonomy_id'])
            assert taxonomy_entry is not None

class TestPurchaseAnalyzer:
    """Test purchase intent and actual purchase extraction"""

    def test_purchase_classification_codes(self):
        """Verify PIPR/PIPF/PIPV/PIFI codes assigned"""
        analyzer = IABTaxonomyAnalyzer(llm_client=mock_llm)
        emails = [
            {"subject": "Order Confirmation - Laptop", "date": "2025-09-30"}
        ]

        result = analyzer.extract_purchases(emails)
        purchase = result[0]

        assert 'classifications' in purchase
        assert 'PIPR3' in purchase['classifications']  # Recency
        assert 'PIPV3' in purchase['classifications']  # Value (laptop)
```

### Integration Tests

**Test File**: `tests/integration/test_phase4_integration.py`

```python
class TestPhase4Integration:
    """Integration tests for Phase 4 with previous phases"""

    def test_analyzer_with_memory_updates(self):
        """Verify analyzer updates memory correctly"""
        from src.email_parser.analysis.iab_taxonomy_analyzer import IABTaxonomyAnalyzer
        from src.email_parser.memory.store import MemoryManager

        manager = MemoryManager(user_id="test_user")
        analyzer = IABTaxonomyAnalyzer(llm_client=mock_llm, memory_manager=manager)

        # Analyze emails
        result = analyzer.analyze_emails(test_emails)

        # Verify memory updated
        stored = manager.get_semantic_memory("demographics")
        assert stored is not None
```

---

## Phase 5: Incremental Processing System

### Unit Tests

**Test File**: `tests/unit/test_incremental_processing.py`

```python
class TestEmailTracking:
    """Test processed email tracking"""

    def test_identify_new_emails(self):
        """Filter for only new emails"""
        from src.email_parser.processing.incremental import identify_new_emails

        all_emails = [
            {"id": "email1"}, {"id": "email2"}, {"id": "email3"}
        ]
        processed_ids = ["email1"]

        new_emails = identify_new_emails(all_emails, processed_ids)

        assert len(new_emails) == 2
        assert all(e['id'] != "email1" for e in new_emails)

    def test_mark_as_processed(self):
        """Mark emails as processed"""
        from src.email_parser.processing.incremental import mark_as_processed
        from src.email_parser.memory.store import MemoryManager

        manager = MemoryManager(user_id="test_user")
        mark_as_processed(manager, ["email1", "email2"])

        processed = manager.get_processed_email_ids()
        assert "email1" in processed
        assert "email2" in processed

class TestMemoryReconciliation:
    """Test evidence reconciliation logic"""

    def test_confirming_evidence_reconciliation(self):
        """Handle confirming evidence correctly"""
        from src.email_parser.processing.reconciliation import reconcile_evidence

        existing = {"taxonomy_id": 5, "confidence": 0.7, "evidence_count": 3}
        new = {"taxonomy_id": 5, "confidence": 0.8, "evidence_count": 1}

        reconciled = reconcile_evidence(existing, new, "confirming")

        assert reconciled['confidence'] > 0.7
        assert reconciled['evidence_count'] == 4
```

### Integration Tests

**Test File**: `tests/integration/test_phase5_integration.py`

```python
class TestPhase5Integration:
    """Integration tests for incremental processing"""

    def test_daily_run_workflow(self):
        """Simulate daily incremental run"""
        from src.email_parser.workflow.graph import build_workflow
        from src.email_parser.memory.store import MemoryManager

        manager = MemoryManager(user_id="test_user")
        workflow = build_workflow(manager)

        # Day 1: Process 200 emails
        result_day1 = workflow.invoke({
            "emails": load_emails("emails_processed.csv"),
            "user_id": "test_user"
        })

        profile_v1 = result_day1['profile']
        assert profile_v1['profile_version'] == 1

        # Day 2: Process 10 new emails
        result_day2 = workflow.invoke({
            "emails": load_emails("emails_processed_day2.csv"),
            "user_id": "test_user"
        })

        profile_v2 = result_day2['profile']
        assert profile_v2['profile_version'] == 2
        assert profile_v2['data_coverage']['emails_this_run'] == 10
```

---

## Phase 6: Output & Integration

### Unit Tests

**Test File**: `tests/unit/test_json_output.py`

```python
class TestJSONReportGeneration:
    """Test JSON output formatting"""

    def test_json_schema_compliance(self):
        """Verify JSON output matches requirements schema"""
        from src.email_parser.output.json_generator import generate_report
        import jsonschema

        profile = generate_report(test_data)

        # Validate against schema
        schema = load_json_schema("docs/json_schema.json")
        jsonschema.validate(profile, schema)

    def test_all_sections_present(self):
        """Verify all required sections in output"""
        profile = generate_report(test_data)

        assert 'demographics' in profile
        assert 'household' in profile
        assert 'interests' in profile
        assert 'purchase_intent' in profile
        assert 'actual_purchases' in profile
        assert 'memory_stats' in profile
```

### Integration Tests

**Test File**: `tests/integration/test_phase6_integration.py`

```python
class TestPhase6Integration:
    """Integration tests for complete system"""

    def test_cli_command_execution(self):
        """Test CLI command end-to-end"""
        import subprocess

        result = subprocess.run([
            "python", "-m", "src.email_parser.main",
            "--iab-profile", "emails_processed.csv",
            "--user-id", "test_user",
            "--dry-run"
        ], capture_output=True)

        assert result.returncode == 0
```

---

## Phase 7: Testing & Validation

### End-to-End Tests

**Test File**: `tests/e2e/test_complete_workflow.py`

```python
class TestCompleteWorkflow:
    """End-to-end workflow tests"""

    def test_full_workflow_200_emails(self):
        """Process 200 emails from scratch"""
        # Complete workflow test
        pass

    def test_incremental_updates(self):
        """Test daily incremental updates"""
        # Day 1, Day 2, Day 3 simulation
        pass

    def test_confidence_evolution(self):
        """Verify confidence scores evolve correctly"""
        # Track confidence changes over multiple runs
        pass
```

---

## Continuous Testing Strategy

### After Every Phase

**Regression Test Suite**:
```bash
# Run all tests
pytest tests/ -v

# Run specific phase tests
pytest tests/unit/test_phase1_*.py -v
pytest tests/integration/test_phase1_*.py -v

# Run with coverage
pytest tests/ --cov=src/email_parser --cov-report=html
```

**Manual Validation**:
1. Review phase TODO.md checklist
2. Verify success criteria met
3. Test with real emails_processed.csv
4. Check JSON output manually
5. Verify no regressions in existing features

---

## GitHub Repository Testing Integration

### Pre-Commit Hooks
```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: pytest
        name: pytest
        entry: pytest
        language: system
        pass_filenames: false
        always_run: true
```

### GitHub Actions CI/CD
```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.10'
      - name: Install dependencies
        run: pip install -r requirements.txt
      - name: Run tests
        run: pytest tests/ -v --cov=src/email_parser
```

---

## Success Criteria Summary

### Phase Completion Requires

✅ All unit tests passing (100%)
✅ All integration tests passing (100%)
✅ Manual verification checklist completed
✅ No regressions in existing test suite
✅ Performance benchmarks met
✅ Code coverage >80% for new code
✅ Documentation updated
✅ GitHub repository updated with tests

---

**Document Version**: 1.0
**Created**: 2025-09-30
**Review**: Before completing each phase