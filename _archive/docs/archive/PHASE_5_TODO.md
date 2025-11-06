# Phase 5: Integration & Production Deployment - TODO

**Phase Goal**: Integrate IAB Taxonomy workflow with email processing pipeline and deploy to production.

**Status**: Ready to Start
**Estimated Duration**: 3 weeks (15 days)
**Priority**: Critical (blocks production deployment)

---

## Overview

Phase 5 connects the completed IAB Taxonomy system (Phases 1-4) with the existing email processing pipeline to deliver the original requirements: **Generate JSON IAB consumer profiles from email analysis with persistent memory-based learning**.

### Critical Gap Identified

The project currently has **two disconnected systems**:
1. ✅ IAB Taxonomy workflow (LangGraph + LangMem) - complete but isolated
2. ✅ Email processing pipeline (CLI + download) - functional but doesn't use IAB

**Phase 5 bridges this gap** to create a unified, production-ready system.

---

## Phase 5 Tasks

### 🔴 **Track 1: Pipeline Integration** (Critical - Week 1)

#### ☐ Task 1.1: Create IAB Profile CLI Command
**Priority**: Critical
**Estimated Time**: 1 day
**Dependencies**: None

**Objective**: Add `--iab-profile` flag to main CLI for generating IAB consumer profiles.

**Implementation**:

```python
# src/email_parser/main.py

def add_iab_profile_args(parser):
    """Add IAB profile generation arguments."""
    parser.add_argument(
        '--iab-profile',
        action='store_true',
        help='Generate IAB Taxonomy consumer profile (JSON output)'
    )
    parser.add_argument(
        '--iab-output',
        default='iab_profile.json',
        help='IAB profile output file (default: iab_profile.json)'
    )
    parser.add_argument(
        '--memory-backend',
        choices=['memory', 'postgres', 'redis'],
        default='memory',
        help='Memory backend for profile persistence'
    )

def handle_iab_profile(args, emails):
    """Execute IAB profile generation workflow."""
    from .workflow.executor import WorkflowExecutor
    from .memory.manager import MemoryManager

    # Initialize memory backend
    memory_manager = create_memory_backend(args.memory_backend)

    # Run workflow
    executor = WorkflowExecutor(
        user_id=args.user_id or "default_user",
        memory_manager=memory_manager,
        llm_provider=os.getenv("LLM_PROVIDER", "openai")
    )

    result = executor.run(emails)

    # Export JSON profile
    profile = build_iab_profile(result, memory_manager)
    profile.export_json(args.iab_output)

    print(f"✅ IAB profile saved to {args.iab_output}")
    print_profile_summary(profile)
```

**Testing**:
```bash
# Test command
python -m src.email_parser.main --iab-profile --provider gmail --max-emails 10

# Expected output
# ✅ IAB profile saved to iab_profile.json
# Profile Summary:
#   User ID: user_12345
#   Emails Analyzed: 10
#   Demographics: 3 classifications
#   Interests: 7 classifications
#   Purchases: 2 classifications
```

**Acceptance Criteria**:
- [ ] `--iab-profile` flag available in CLI
- [ ] Triggers LangGraph workflow
- [ ] Outputs valid JSON file
- [ ] Includes summary statistics
- [ ] Works with all email providers (Gmail/Outlook)

---

#### ☐ Task 1.2: Connect Email Pipeline to Workflow
**Priority**: Critical
**Estimated Time**: 1 day
**Dependencies**: Task 1.1

**Objective**: Pass downloaded emails through IAB analyzer workflow.

**Implementation**:

```python
# src/email_parser/main.py

def prepare_emails_for_workflow(emails_df):
    """Convert CSV DataFrame to workflow email format."""
    emails = []
    for _, row in emails_df.iterrows():
        email = {
            "id": row.get('id', str(hash(row['subject']))),
            "subject": row['subject'],
            "body": row.get('body', row.get('summary', '')),
            "from": row.get('from', ''),
            "date": row.get('date', ''),
            "category": row.get('category', '')
        }
        emails.append(email)
    return emails

def process_with_iab_workflow(emails, user_id, memory_manager):
    """Process emails through IAB taxonomy workflow."""
    from .workflow.executor import WorkflowExecutor

    executor = WorkflowExecutor(
        user_id=user_id,
        memory_manager=memory_manager
    )

    # Run workflow
    result = executor.run(emails)

    return result
```

**Data Flow**:
```
Email Download (Gmail/Outlook)
    ↓
CSV DataFrame (emails_processed.csv)
    ↓
Convert to Workflow Format (dict list)
    ↓
LangGraph Workflow Execution
    ↓
Memory Storage (semantic + episodic)
    ↓
IAB Profile Generation
    ↓
JSON Export
```

**Testing**:
- [ ] Test with 10 Gmail emails
- [ ] Test with 10 Outlook emails
- [ ] Test with existing CSV file
- [ ] Verify all email fields passed correctly
- [ ] Check memory updates after processing

**Acceptance Criteria**:
- [ ] Emails flow from download → workflow seamlessly
- [ ] No data loss in conversion
- [ ] Memory manager receives classifications
- [ ] Workflow state properly initialized
- [ ] Error handling for malformed emails

---

#### ☐ Task 1.3: Implement JSON Profile Export
**Priority**: Critical
**Estimated Time**: 1 day
**Dependencies**: Task 1.2

**Objective**: Generate valid IABConsumerProfile JSON matching requirements schema.

**Implementation**:

```python
# src/email_parser/workflow/profile_builder.py

from src.email_parser.models.iab_taxonomy import (
    IABConsumerProfile,
    DemographicsProfile,
    HouseholdProfile,
    InterestSelection,
    PurchaseIntentSelection,
    MemoryStats,
    DataCoverage,
    GeneratorMetadata,
    SectionConfidence
)

def build_iab_profile(workflow_result, memory_manager, user_id):
    """Build IABConsumerProfile from workflow results and memory."""

    # Retrieve all memories for user
    memories = memory_manager.query_memories(user_id)

    # Extract classifications by section
    demographics = extract_demographics(memories)
    household = extract_household(memories)
    interests = extract_interests(memories)
    purchases = extract_purchases(memories)

    # Calculate statistics
    memory_stats = calculate_memory_stats(memories)
    section_confidence = calculate_section_confidence(memories)

    # Build profile
    profile = IABConsumerProfile(
        user_id=user_id,
        profile_version=get_profile_version(user_id, memory_manager),
        generated_at=datetime.utcnow().isoformat() + 'Z',
        schema_version="1.0",
        generator=GeneratorMetadata(
            system="email_parser_iab_taxonomy",
            llm_model=os.getenv("LLM_PROVIDER", "openai"),
            workflow_version="1.0"
        ),
        data_coverage=DataCoverage(
            total_emails_analyzed=len(workflow_result["emails"]),
            emails_this_run=workflow_result["emails_processed"],
            date_range=get_date_range(workflow_result["emails"])
        ),
        demographics=demographics,
        household=household,
        interests=interests,
        purchase_intent=purchases,
        memory_stats=memory_stats,
        section_confidence=section_confidence
    )

    return profile
```

**JSON Schema Validation**:
```python
import jsonschema

def validate_profile(profile_json):
    """Validate IAB profile against schema."""
    schema = load_iab_schema()
    jsonschema.validate(profile_json, schema)
```

**Testing**:
- [ ] Generate profile for 10 emails
- [ ] Validate against JSON schema
- [ ] Verify all required fields present
- [ ] Check confidence scores in valid range
- [ ] Test profile.export_json()
- [ ] Test profile.load_json()

**Acceptance Criteria**:
- [ ] Generates valid JSON per requirements
- [ ] All metadata fields populated correctly
- [ ] Statistics accurate (counts, confidence)
- [ ] Schema validation passes
- [ ] File can be reloaded with load_json()

---

#### ☐ Task 1.4: Enable Incremental Processing
**Priority**: High
**Estimated Time**: 1 day
**Dependencies**: Task 1.3

**Objective**: Support daily runs that only process new emails (avoid reprocessing).

**Implementation**:

```python
# src/email_parser/workflow/nodes/load_emails.py (enhancement)

def filter_already_processed_emails(emails, memory_manager, user_id):
    """Filter out emails already processed in previous runs."""

    # Get list of processed email IDs from memory
    processed_ids = memory_manager.get_processed_email_ids(user_id)

    # Filter new emails
    new_emails = [
        email for email in emails
        if email['id'] not in processed_ids
    ]

    logger.info(
        f"Filtered {len(emails)} emails → {len(new_emails)} new emails"
        f" ({len(processed_ids)} already processed)"
    )

    return new_emails

# src/email_parser/memory/manager.py (enhancement)

def get_processed_email_ids(self, user_id):
    """Retrieve list of processed email IDs from memory."""
    # Query episodic memories for processed emails
    namespace = ("users", user_id)
    memories = self.store.search(namespace)

    processed_ids = set()
    for memory in memories:
        if memory.key.startswith("episodic_email_"):
            email_id = memory.key.replace("episodic_email_", "")
            processed_ids.add(email_id)

    return processed_ids
```

**CLI Enhancement**:
```bash
# Day 1: Process 50 emails
python -m src.email_parser.main --iab-profile --max-emails 50

# Day 2: Process only new emails (incremental)
python -m src.email_parser.main --iab-profile --max-emails 50 --incremental

# Day 3: Force reprocess all
python -m src.email_parser.main --iab-profile --max-emails 50 --force-reprocess
```

**Testing**:
- [ ] Run 1: Process 10 emails, verify all processed
- [ ] Run 2: Same 10 emails, verify 0 processed (skipped)
- [ ] Run 3: 10 old + 5 new, verify 5 processed
- [ ] Verify memory correctly tracks processed IDs
- [ ] Test --force-reprocess flag

**Acceptance Criteria**:
- [ ] Incremental mode skips processed emails
- [ ] Processed email IDs persisted in memory
- [ ] Daily runs are fast (only new emails)
- [ ] Force reprocess option available
- [ ] Logging shows filtered counts

---

### 🟡 **Track 2: Persistent Memory** (High Priority - Week 2)

#### ☐ Task 2.1: Choose Memory Backend
**Priority**: High
**Estimated Time**: 0.5 days
**Dependencies**: None

**Objective**: Evaluate and select production memory backend.

**Options Evaluation**:

| Backend | Pros | Cons | Recommendation |
|---------|------|------|----------------|
| **PostgreSQL** | Full SQL, ACID, LangMem support, scales well | Heavier setup, requires server | ⭐ **Recommended** for production |
| **Redis** | Fast, simple, good for caching | No ACID, data persistence optional | Good for high-throughput |
| **SQLite** | Zero setup, file-based, portable | Single-writer, limited scale | Good for development/testing |

**Decision Criteria**:
- LangMem compatibility (required)
- Data persistence guarantees (required)
- Concurrent access support (nice to have)
- Deployment complexity (low preferred)
- Cost (free/cheap preferred)

**Recommendation**: **PostgreSQL**
- Best balance of features and stability
- LangMem has built-in PostgreSQL support
- Industry standard for production
- Easy to deploy (Docker, managed services)

**Next Steps**:
- [ ] Document decision in ADR (Architecture Decision Record)
- [ ] Set up PostgreSQL development instance
- [ ] Test LangMem PostgreSQL integration
- [ ] Create schema migration scripts

---

#### ☐ Task 2.2: Implement PostgreSQL Backend
**Priority**: High
**Estimated Time**: 1.5 days
**Dependencies**: Task 2.1

**Objective**: Replace InMemoryStore with PostgreSQL backend for persistence.

**Implementation**:

```python
# src/email_parser/memory/backends.py

from langgraph.store.postgres import PostgresStore

def create_postgres_store(connection_string=None):
    """Create PostgreSQL backend for LangMem."""
    if connection_string is None:
        connection_string = os.getenv(
            "MEMORY_DATABASE_URL",
            "postgresql://user:pass@localhost:5432/email_parser"
        )

    store = PostgresStore(conn=connection_string)

    # Initialize schema if needed
    store.setup()

    return store

# src/email_parser/memory/manager.py (update)

class MemoryManager:
    def __init__(self, user_id, store=None):
        """Initialize memory manager with optional store backend."""
        if store is None:
            # Use PostgreSQL by default in production
            if os.getenv("MEMORY_BACKEND", "postgres") == "postgres":
                store = create_postgres_store()
            else:
                store = InMemoryStore()  # Fallback for testing

        self.user_id = user_id
        self.store = store
        # ... rest of init
```

**Database Schema**:
```sql
-- LangMem schema (handled by library)
CREATE TABLE IF NOT EXISTS langmem_memories (
    id UUID PRIMARY KEY,
    namespace TEXT[],
    key TEXT,
    value JSONB,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX idx_namespace ON langmem_memories(namespace);
CREATE INDEX idx_key ON langmem_memories(key);
```

**Configuration**:
```bash
# .env
MEMORY_BACKEND=postgres
MEMORY_DATABASE_URL=postgresql://user:pass@localhost:5432/email_parser

# Development
docker run -d --name email_parser_db \
    -e POSTGRES_PASSWORD=dev_password \
    -e POSTGRES_DB=email_parser \
    -p 5432:5432 \
    postgres:15
```

**Testing**:
- [ ] Test memory persistence across restarts
- [ ] Test concurrent access (multiple users)
- [ ] Verify confidence evolution persists
- [ ] Test backup and restore
- [ ] Performance test (1000+ memories)

**Acceptance Criteria**:
- [ ] PostgreSQL backend working
- [ ] Data persists across app restarts
- [ ] All memory operations functional
- [ ] Connection pooling working
- [ ] Error handling for DB failures

---

#### ☐ Task 2.3: Migration Scripts
**Priority**: Medium
**Estimated Time**: 0.5 days
**Dependencies**: Task 2.2

**Objective**: Create scripts to migrate data between backends.

**Implementation**:

```python
# scripts/migrate_memory.py

def migrate_inmemory_to_postgres(inmem_store, postgres_store):
    """Migrate memories from InMemory to PostgreSQL."""
    # Export all memories
    memories = inmem_store.list()

    # Import to PostgreSQL
    for memory in memories:
        postgres_store.put(
            namespace=memory.namespace,
            key=memory.key,
            value=memory.value
        )

    print(f"✅ Migrated {len(memories)} memories")

# CLI command
python scripts/migrate_memory.py --from inmemory --to postgres
```

**Testing**:
- [ ] Migrate test data successfully
- [ ] Verify data integrity after migration
- [ ] Test rollback on failure

**Acceptance Criteria**:
- [ ] Migration script works
- [ ] Data integrity verified
- [ ] Rollback mechanism available

---

#### ☐ Task 2.4: Test Persistence
**Priority**: High
**Estimated Time**: 0.5 days
**Dependencies**: Task 2.2

**Objective**: Validate multi-session confidence evolution with persistent backend.

**Test Scenarios**:

```python
# Test 1: Persistence across restarts
def test_memory_persists_across_restarts():
    # Session 1: Process emails, store memories
    session1 = run_workflow(emails_day1)
    assert len(get_memories("user_1")) == 10

    # Restart application (disconnect and reconnect)
    restart_application()

    # Session 2: Verify memories still exist
    memories = get_memories("user_1")
    assert len(memories) == 10
    assert memories[0].confidence == 0.75

# Test 2: Confidence evolution over multiple days
def test_confidence_evolution_multiday():
    # Day 1: Initial classification
    day1_result = run_workflow(crypto_newsletter)
    crypto_memory = get_memory("Interest: Cryptocurrency")
    assert crypto_memory.confidence == 0.70

    # Day 2: Confirming evidence
    day2_result = run_workflow(crypto_newsletter2)
    crypto_memory = get_memory("Interest: Cryptocurrency")
    assert crypto_memory.confidence > 0.75  # Increased

    # Day 3: More confirming evidence
    day3_result = run_workflow(crypto_newsletter3)
    crypto_memory = get_memory("Interest: Cryptocurrency")
    assert crypto_memory.confidence > 0.80  # Increased again

# Test 3: Temporal decay
def test_temporal_decay_over_time():
    # Day 1: Initial classification
    run_workflow(newsletter)
    memory = get_memory("Interest: Technology")
    initial_confidence = memory.confidence

    # Simulate 30 days passing
    simulate_time_passage(days=30)

    # Verify confidence decayed
    memory = get_memory("Interest: Technology")
    assert memory.confidence < initial_confidence
```

**Acceptance Criteria**:
- [ ] Memories persist across restarts
- [ ] Confidence evolution works over multiple sessions
- [ ] Temporal decay applies correctly
- [ ] No data loss on crashes

---

### 🟢 **Track 3: Testing & Quality** (High Priority - Week 3)

#### ☐ Task 3.1: Fix All Failing Tests
**Priority**: High
**Estimated Time**: 0.5 days
**Dependencies**: None

**Objective**: Achieve 211/211 tests passing (100% success rate).

**Current Status**: 203/211 passing (8 failures)

**Remaining Failures**:
1. ✅ ANTHROPIC_MODEL env var errors (fixed in claude_client.py)
2. ⚠️ Some workflow integration tests expect stub behavior vs LLM responses

**Fix Strategy**:
```python
# Update tests to handle real LLM responses
@patch('src.email_parser.workflow.nodes.analyzers.AnalyzerLLMClient')
def test_demographics_analyzer(mock_llm):
    # Mock LLM to return predictable response
    mock_llm.return_value.analyze_email.return_value = {
        "classifications": [...]
    }
    # Run test
    result = demographics_analyzer_node(state)
    # Verify
    assert len(result["demographics_results"]) > 0
```

**Testing**:
- [ ] Run full test suite: `pytest tests/`
- [ ] Fix each failing test individually
- [ ] Verify no regressions
- [ ] Run in CI environment

**Acceptance Criteria**:
- [ ] 211/211 tests passing (100%)
- [ ] All tests run in < 30 seconds
- [ ] Tests are deterministic (no flakiness)
- [ ] CI pipeline green

---

#### ☐ Task 3.2: End-to-End Integration Tests
**Priority**: High
**Estimated Time**: 1 day
**Dependencies**: Tasks 1.1-1.4, 2.2

**Objective**: Test complete flow: email download → IAB profile → JSON.

**Test Suite**:

```python
# tests/integration/test_e2e_iab_profile.py

class TestEndToEndIABProfile:
    """End-to-end tests for IAB profile generation."""

    def test_gmail_to_iab_profile(self):
        """Test: Gmail download → IAB workflow → JSON profile."""
        # 1. Download 10 emails from Gmail
        emails = download_gmail_emails(max_emails=10)
        assert len(emails) == 10

        # 2. Run IAB workflow
        result = run_iab_workflow(emails, user_id="test_user")
        assert result["emails_processed"] == 10

        # 3. Generate profile
        profile = build_iab_profile(result)

        # 4. Validate profile
        assert profile.data_coverage.total_emails_analyzed == 10
        assert len(profile.interests) > 0

        # 5. Export JSON
        profile.export_json("test_profile.json")

        # 6. Reload and verify
        loaded = IABConsumerProfile.load_json("test_profile.json")
        assert loaded.user_id == profile.user_id

    def test_incremental_processing_two_sessions(self):
        """Test: Two sessions with incremental processing."""
        # Session 1: Process 10 emails
        emails_day1 = download_emails(max_emails=10)
        result1 = run_iab_workflow(emails_day1, user_id="test_user")
        assert result1["emails_processed"] == 10

        # Session 2: Same 10 + 5 new emails (should only process 5)
        emails_day2 = download_emails(max_emails=15)
        result2 = run_iab_workflow(
            emails_day2,
            user_id="test_user",
            incremental=True
        )
        assert result2["emails_processed"] == 5  # Only new ones

    def test_confidence_evolution_multi_session(self):
        """Test: Confidence grows across multiple sessions."""
        user_id = "test_user_confidence"

        # Day 1: First crypto newsletter
        crypto_email_1 = create_crypto_newsletter()
        run_iab_workflow([crypto_email_1], user_id)

        memory = get_memory(user_id, "Interest: Cryptocurrency")
        confidence_day1 = memory.confidence

        # Day 2: Second crypto newsletter
        crypto_email_2 = create_crypto_newsletter()
        run_iab_workflow([crypto_email_2], user_id)

        memory = get_memory(user_id, "Interest: Cryptocurrency")
        confidence_day2 = memory.confidence

        # Verify confidence increased
        assert confidence_day2 > confidence_day1
        assert confidence_day2 < 0.95  # Not perfect
```

**Testing**:
- [ ] Run all E2E tests
- [ ] Test with real Gmail API (requires auth)
- [ ] Test with real Outlook API (requires auth)
- [ ] Test with CSV input
- [ ] Verify JSON output validity

**Acceptance Criteria**:
- [ ] E2E tests pass with real emails
- [ ] Incremental processing validated
- [ ] Confidence evolution verified
- [ ] JSON profiles valid

---

#### ☐ Task 3.3: Performance Benchmarks
**Priority**: Medium
**Estimated Time**: 1 day
**Dependencies**: Tasks 1.1-1.4

**Objective**: Measure and document system performance at scale.

**Benchmark Suite**:

```python
# benchmarks/test_performance.py

def benchmark_workflow_execution():
    """Benchmark: Workflow execution time by email count."""
    test_sizes = [10, 50, 100, 500, 1000]

    results = {}
    for size in test_sizes:
        emails = generate_test_emails(size)

        start = time.time()
        result = run_iab_workflow(emails)
        elapsed = time.time() - start

        results[size] = {
            "total_time": elapsed,
            "per_email": elapsed / size,
            "emails_per_second": size / elapsed
        }

    print_benchmark_table(results)

def benchmark_memory_operations():
    """Benchmark: Memory read/write performance."""
    # Test store_semantic_memory()
    # Test query_memories()
    # Test update_confidence()

def benchmark_llm_latency():
    """Benchmark: LLM call latency by provider."""
    providers = ["openai", "claude", "ollama"]

    for provider in providers:
        latencies = []
        for _ in range(10):
            start = time.time()
            analyze_email(sample_email, provider=provider)
            latencies.append(time.time() - start)

        print(f"{provider}: {np.mean(latencies):.2f}s avg")
```

**Metrics to Track**:
- Total processing time (10, 50, 100, 500, 1000 emails)
- Per-email latency
- Memory operations latency
- LLM call latency (by provider)
- Memory usage (RAM)
- Database query performance

**Target Performance**:
- 10 emails: < 30 seconds
- 100 emails: < 5 minutes
- 1000 emails: < 50 minutes
- Memory usage: < 500MB for 1000 emails

**Acceptance Criteria**:
- [ ] Benchmarks documented
- [ ] Performance within targets
- [ ] Bottlenecks identified
- [ ] Optimization recommendations

---

#### ☐ Task 3.4: Accuracy Validation
**Priority**: Medium
**Estimated Time**: 1 day
**Dependencies**: Task 1.3

**Objective**: Validate IAB classification accuracy against human labels.

**Validation Process**:

1. **Create Gold Standard Dataset**
   - Manually label 50 diverse emails
   - Map to IAB taxonomy categories
   - Document confidence rationale

2. **Generate System Predictions**
   - Run workflow on 50 labeled emails
   - Extract system classifications

3. **Calculate Metrics**
   - Precision: % of system classifications that are correct
   - Recall: % of actual categories found by system
   - F1 Score: Harmonic mean of precision and recall
   - Per-category accuracy

4. **Analyze Errors**
   - False positives (incorrect classifications)
   - False negatives (missed classifications)
   - Identify problematic taxonomy categories

**Target Accuracy**:
- Overall F1 Score: > 85%
- Demographics: > 80%
- Interests: > 85%
- Purchases: > 90% (high signal clarity)

**Acceptance Criteria**:
- [ ] 50 emails manually labeled
- [ ] Accuracy metrics calculated
- [ ] Achieves > 85% F1 score
- [ ] Error analysis documented
- [ ] Improvement recommendations

---

### 🟡 **Track 4: Production Features** (Medium Priority - Ongoing)

#### ☐ Task 4.1: Cost Tracking
**Priority**: Medium
**Estimated Time**: 0.5 days
**Dependencies**: None

**Objective**: Track and report LLM API costs per email and session.

**Implementation**:

```python
# src/email_parser/workflow/cost_tracker.py

class CostTracker:
    """Track LLM API costs."""

    PRICING = {
        "openai": {
            "gpt-4": {"input": 0.03 / 1000, "output": 0.06 / 1000},
            "gpt-3.5-turbo": {"input": 0.0005 / 1000, "output": 0.0015 / 1000}
        },
        "claude": {
            "claude-sonnet-4": {"input": 0.003 / 1000, "output": 0.015 / 1000}
        },
        "ollama": {
            "default": {"input": 0, "output": 0}  # Free
        }
    }

    def __init__(self):
        self.total_cost = 0.0
        self.cost_by_provider = {}

    def track_call(self, provider, model, prompt_tokens, response_tokens):
        """Track cost of single LLM call."""
        pricing = self.PRICING.get(provider, {}).get(model, {"input": 0, "output": 0})
        cost = (prompt_tokens * pricing["input"]) + (response_tokens * pricing["output"])

        self.total_cost += cost
        self.cost_by_provider[provider] = self.cost_by_provider.get(provider, 0) + cost

        return cost

    def get_summary(self):
        """Get cost summary."""
        return {
            "total_cost_usd": round(self.total_cost, 4),
            "by_provider": {k: round(v, 4) for k, v in self.cost_by_provider.items()}
        }
```

**CLI Output**:
```bash
✅ IAB profile saved to iab_profile.json

Profile Summary:
  Emails Analyzed: 50
  Demographics: 15 classifications
  Interests: 23 classifications
  Purchases: 8 classifications

Cost Summary:
  Total Cost: $0.42 USD
  OpenAI (GPT-4): $0.35
  Claude (Sonnet-4): $0.07
  Per Email: $0.0084
```

**Acceptance Criteria**:
- [ ] Costs tracked per LLM call
- [ ] Summary included in output
- [ ] Per-email cost calculated
- [ ] Budget alerts (optional)

---

#### ☐ Task 4.2: Error Monitoring
**Priority**: Medium
**Estimated Time**: 0.5 days
**Dependencies**: None

**Objective**: Production-grade error logging and monitoring.

**Implementation**:

```python
# src/email_parser/utils/monitoring.py

import structlog

logger = structlog.get_logger()

def log_workflow_error(error, context):
    """Log workflow error with context."""
    logger.error(
        "workflow_error",
        error_type=type(error).__name__,
        error_message=str(error),
        email_id=context.get("email_id"),
        user_id=context.get("user_id"),
        analyzer=context.get("analyzer"),
        traceback=traceback.format_exc()
    )

def log_llm_failure(provider, error, retry_count):
    """Log LLM API failure."""
    logger.warning(
        "llm_api_failure",
        provider=provider,
        error=str(error),
        retry_count=retry_count
    )

# Integration with Sentry (optional)
import sentry_sdk

sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN"),
    environment=os.getenv("ENV", "development")
)
```

**Acceptance Criteria**:
- [ ] Structured logging throughout
- [ ] Error aggregation (Sentry optional)
- [ ] Alerts for critical errors
- [ ] Error rate tracking

---

#### ☐ Task 4.3: Performance Optimization
**Priority**: Low
**Estimated Time**: 1 day
**Dependencies**: Task 3.3 (benchmarks)

**Objective**: Optimize performance based on benchmark findings.

**Optimization Strategies**:

1. **Response Caching**
   ```python
   # Cache LLM responses for duplicate emails
   from functools import lru_cache

   @lru_cache(maxsize=1000)
   def analyze_email_cached(email_hash, provider):
       return analyze_email(email_hash, provider)
   ```

2. **Batch LLM Calls**
   ```python
   # Process multiple emails in single API call
   def batch_analyze(emails, provider):
       batch_prompt = create_batch_prompt(emails)
       response = llm.generate(batch_prompt)
       return parse_batch_response(response)
   ```

3. **Optimize Prompts**
   - Reduce token count in taxonomy context
   - Use abbreviations where possible
   - Dynamic context based on email type

4. **Database Query Optimization**
   - Add indexes on frequently queried fields
   - Use connection pooling
   - Batch memory queries

**Acceptance Criteria**:
- [ ] 20%+ improvement in throughput
- [ ] Reduced API costs
- [ ] Lower memory usage
- [ ] Optimizations documented

---

#### ☐ Task 4.4: Documentation
**Priority**: Medium
**Estimated Time**: 1 day
**Dependencies**: All tasks

**Objective**: Complete user and developer documentation.

**Documentation Deliverables**:

1. **User Guide** (`docs/USER_GUIDE.md`)
   - How to generate IAB profiles
   - CLI command reference
   - Configuration options
   - Troubleshooting

2. **Architecture Guide** (`docs/ARCHITECTURE.md`)
   - System architecture diagrams
   - Data flow diagrams
   - Component interactions
   - Design decisions

3. **API Documentation** (`docs/API.md`)
   - WorkflowExecutor API
   - MemoryManager API
   - Profile builder API
   - Examples

4. **Deployment Guide** (`docs/DEPLOYMENT.md`)
   - Installation instructions
   - Database setup
   - Environment configuration
   - Production checklist

**Acceptance Criteria**:
- [ ] User guide complete
- [ ] Architecture documented
- [ ] API reference available
- [ ] Deployment guide written

---

## Phase 5 Success Criteria

### Must Have (MVP) ✅
- [ ] CLI command: `--iab-profile` working
- [ ] Generates valid JSON IAB profiles
- [ ] PostgreSQL persistence
- [ ] Incremental processing
- [ ] All 211 tests passing
- [ ] End-to-end test passing

### Should Have 🎯
- [ ] Cost tracking
- [ ] Performance benchmarks
- [ ] Accuracy > 85%
- [ ] Error monitoring
- [ ] User documentation

### Nice to Have 🌟
- [ ] Response caching
- [ ] Batch optimization
- [ ] CI/CD pipeline
- [ ] Dashboard UI

---

## Timeline Summary

| Week | Focus | Tasks | Deliverable |
|------|-------|-------|-------------|
| **Week 1** | Integration | 1.1-1.4 | Working IAB CLI command |
| **Week 2** | Persistence | 2.1-2.4 | PostgreSQL backend |
| **Week 3** | Testing | 3.1-3.4 | 100% tests, benchmarks |
| **Ongoing** | Production | 4.1-4.4 | Monitoring, docs |

**Total Duration**: 3 weeks (15 days)

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| PostgreSQL integration issues | Medium | High | Start with SQLite fallback |
| LLM accuracy below target | Medium | Medium | Iterate on prompts, use ensemble |
| Performance at scale | Medium | Medium | Implement caching early |
| Integration complexity | Low | High | Incremental integration, test each step |

---

## Next Steps

1. ✅ Review Phase 5 plan
2. 🔲 Set up PostgreSQL development instance
3. 🔲 Begin Task 1.1: IAB CLI command
4. 🔲 Daily standups to track progress
5. 🔲 Weekly demos of working features

---

**Phase 5 Status**: 📋 Ready to Start
**Estimated Completion**: 3 weeks from start
**Dependencies**: All resolved (Phases 1-4 complete)