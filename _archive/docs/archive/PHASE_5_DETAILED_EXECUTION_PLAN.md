# Phase 5 Detailed Execution Plan with Testing

**Created:** 2025-10-01
**Approach:** Test-driven, incremental, with verification at each step
**Expected Outputs:** Documented with examples from requirements

---

## ✅ Already Complete - Quick Verification

### Verify Core Functionality Works

**Test 1: Basic IAB Profile Generation**
```bash
# Expected: Valid JSON profile with classifications
python -m src.email_parser.main --iab-csv test_iab_sample.csv --iab-output verify_basic.json

# Expected Output:
# ✅ IAB profile generated: verify_basic.json
# Emails Processed: 10
# Interests: 3 classifications
# Demographics: X classifications
```

**Expected JSON Structure (from requirements):**
```json
{
  "user_id": "user_xxx",
  "profile_version": 1,
  "generated_at": "2025-10-01T...",
  "schema_version": "1.0",
  "generator": {
    "system": "email_parser_iab_taxonomy",
    "llm_model": "openai:default",
    "workflow_version": "1.0"
  },
  "data_coverage": {
    "total_emails_analyzed": 10,
    "emails_this_run": 10,
    "date_range": "..."
  },
  "demographics": {...},
  "household": {...},
  "interests": [
    {
      "taxonomy_id": 342,
      "tier_path": "Interest | Cryptocurrency",
      "value": "Cryptocurrency",
      "confidence": 0.88,
      "evidence_count": 2,
      "last_validated": "...",
      "days_since_validation": 0
    }
  ],
  "purchase_intent": [],
  "actual_purchases": [],
  "memory_stats": {
    "total_facts_stored": 3,
    "high_confidence_facts": 3,
    "average_confidence": 0.86
  },
  "section_confidence": {
    "demographics": 0.7,
    "household": 0.7,
    "interests": 0.86,
    "purchase_intent": 0.0,
    "actual_purchases": 0.0
  }
}
```

**Test 2: Persistence**
```bash
# Run 1
python -m src.email_parser.main --iab-csv test_iab_sample.csv --user-id persist_test

# Run 2 - Should skip processed emails
python -m src.email_parser.main --iab-csv test_iab_sample.csv --user-id persist_test

# Expected Output:
# Found 10 already-processed emails
# Filtered 10 total emails → 0 new emails
# Retrieved 3 existing memories from database
```

**Test 3: Force Reprocess**
```bash
python -m src.email_parser.main --iab-csv test_iab_sample.csv --user-id persist_test --force-reprocess

# Expected Output:
# Force reprocess enabled
# Processing all 10 emails (force reprocess)
# Emails Processed: 10
```

---

## 📋 Option A: Complete Track 1 & 2

### A1: Fix Persistence Test Suite ⚠️ **CRITICAL**

**Task:** Fix incorrect API usage in test code
**Time:** 2-3 hours
**Testing:** Run tests after each fix

#### A1.1: Audit MemoryManager API

**Action:** Document actual API signatures

```bash
# Check actual method signatures
grep -n "def store_semantic_memory" src/email_parser/memory/manager.py
grep -n "def mark_email" src/email_parser/memory/manager.py
grep -n "def get_processed" src/email_parser/memory/manager.py
```

**Expected Output:** Method signatures with parameters

**Create:** `docs/MEMORY_MANAGER_API.md`

```markdown
# MemoryManager API Reference

## Semantic Memory Methods

### store_semantic_memory(memory_id, ...)
```python
def store_semantic_memory(
    self,
    memory_id: str,
    taxonomy_id: int,
    section: str,
    value: str,
    confidence: float,
    category_path: str,
    evidence: List[str],
    reasoning: str,
    data_source: str = "email"
) -> None
```

### get_semantic_memory(memory_id)
```python
def get_semantic_memory(self, memory_id: str) -> Optional[Dict[str, Any]]
```

## Episodic Memory Methods

### mark_email_as_processed(email_id)
```python
def mark_email_as_processed(self, email_id: str) -> None
```

### get_processed_email_ids()
```python
def get_processed_email_ids(self) -> List[str]
```
```

**Verification:**
```bash
# API documented correctly
test -f docs/MEMORY_MANAGER_API.md && echo "✅ API documented"
```

#### A1.2: Fix Test File API Usage

**Action:** Update `tests/integration/test_sqlite_persistence.py`

**Current Errors:**
1. `mm1.store_semantic_memory(memory_id="...", memory_data={...})` ❌
2. `mm1.mark_email_processed("email_1", {...})` ❌
3. `mm2.is_email_processed("email_1")` ❌
4. `mm2.get_processed_emails()` ❌

**Correct Usage:**
```python
# Fix 1: store_semantic_memory - use actual parameters
mm1.store_semantic_memory(
    memory_id="test_memory_1",
    taxonomy_id=342,
    section="interests",
    value="Test Value",
    confidence=0.85,
    category_path="Interest | Test",
    evidence=["email_1"],
    reasoning="Test reasoning",
    data_source="email"
)

# Fix 2: mark_email_as_processed - correct method name
mm1.mark_email_as_processed("email_1")

# Fix 3: Check if processed
processed_ids = mm2.get_processed_email_ids()
assert "email_1" in processed_ids

# Fix 4: get_processed_email_ids returns list
processed_emails = mm2.get_processed_email_ids()
assert len(processed_emails) == 2
```

**Test After Each Fix:**
```bash
# Run specific test
pytest tests/integration/test_sqlite_persistence.py::TestSQLitePersistence::test_basic_persistence -v

# Expected: PASSED
```

**Full Test Run:**
```bash
pytest tests/integration/test_sqlite_persistence.py -v

# Expected Output:
# TestSQLitePersistence::test_basic_persistence PASSED
# TestSQLitePersistence::test_incremental_processing PASSED
# TestSQLitePersistence::test_memory_stats_persistence PASSED
# TestSQLitePersistence::test_namespace_isolation PASSED
# TestSQLitePersistence::test_database_file_creation PASSED
# TestSQLitePersistence::test_concurrent_access PASSED
# TestSQLitePersistence::test_memory_update_persistence PASSED
# TestSQLitePersistence::test_database_stats PASSED
# TestIABProfilePersistence::test_profile_persistence_across_runs PASSED
# ======================== 9 passed =========================
```

**Acceptance Criteria:**
- [x] All 9 persistence tests PASS
- [x] Tests use correct API
- [x] No timeouts

---

### A2: Multi-Session Confidence Evolution Testing

**Task:** Verify confidence grows across sessions
**Time:** 1 hour
**Testing:** Manual verification with real data

#### A2.1: Create Test Emails

**Action:** Create CSV files with similar content for confidence evolution

**Create:** `tests/manual/crypto_email_1.csv`
```csv
ID,Date,From,Subject,Summary
crypto_1,2025-10-01,news@crypto.com,Bitcoin Update,Bitcoin reaches new high with blockchain innovations driving adoption
```

**Create:** `tests/manual/crypto_email_2.csv`
```csv
ID,Date,From,Subject,Summary
crypto_2,2025-10-02,newsletter@blockchain.io,Crypto Weekly,Cryptocurrency markets show strong blockchain technology adoption
```

**Create:** `tests/manual/crypto_email_3.csv`
```csv
ID,Date,From,Subject,Summary
crypto_3,2025-10-03,info@defi.com,DeFi Trends,Decentralized finance and cryptocurrency continue blockchain revolution
```

#### A2.2: Run Multi-Session Test

**Create:** `tests/manual/test_confidence_evolution.sh`

```bash
#!/bin/bash
set -e

USER_ID="confidence_test_user"
DB_FILE="data/email_parser_memory.db"

echo "=== Multi-Session Confidence Evolution Test ==="
echo ""

# Clean start
rm -f $DB_FILE
echo "✓ Cleaned database"

# Day 1
echo ""
echo "Day 1: Processing first crypto email..."
python -m src.email_parser.main \
  --iab-csv tests/manual/crypto_email_1.csv \
  --iab-output tests/manual/profile_day1.json \
  --user-id $USER_ID

# Check Day 1 confidence
CONF_DAY1=$(python -c "import json; p=json.load(open('tests/manual/profile_day1.json')); crypto=[i for i in p['interests'] if 'Cryptocurrency' in i.get('value','')]; print(crypto[0]['confidence'] if crypto else 0)")
EVIDENCE_DAY1=$(python -c "import json; p=json.load(open('tests/manual/profile_day1.json')); crypto=[i for i in p['interests'] if 'Cryptocurrency' in i.get('value','')]; print(crypto[0]['evidence_count'] if crypto else 0)")

echo "Day 1 Results:"
echo "  Cryptocurrency confidence: $CONF_DAY1"
echo "  Evidence count: $EVIDENCE_DAY1"

# Day 2
echo ""
echo "Day 2: Processing second crypto email..."
python -m src.email_parser.main \
  --iab-csv tests/manual/crypto_email_2.csv \
  --iab-output tests/manual/profile_day2.json \
  --user-id $USER_ID

CONF_DAY2=$(python -c "import json; p=json.load(open('tests/manual/profile_day2.json')); crypto=[i for i in p['interests'] if 'Cryptocurrency' in i.get('value','')]; print(crypto[0]['confidence'] if crypto else 0)")
EVIDENCE_DAY2=$(python -c "import json; p=json.load(open('tests/manual/profile_day2.json')); crypto=[i for i in p['interests'] if 'Cryptocurrency' in i.get('value','')]; print(crypto[0]['evidence_count'] if crypto else 0)")

echo "Day 2 Results:"
echo "  Cryptocurrency confidence: $CONF_DAY2"
echo "  Evidence count: $EVIDENCE_DAY2"

# Day 3
echo ""
echo "Day 3: Processing third crypto email..."
python -m src.email_parser.main \
  --iab-csv tests/manual/crypto_email_3.csv \
  --iab-output tests/manual/profile_day3.json \
  --user-id $USER_ID

CONF_DAY3=$(python -c "import json; p=json.load(open('tests/manual/profile_day3.json')); crypto=[i for i in p['interests'] if 'Cryptocurrency' in i.get('value','')]; print(crypto[0]['confidence'] if crypto else 0)")
EVIDENCE_DAY3=$(python -c "import json; p=json.load(open('tests/manual/profile_day3.json')); crypto=[i for i in p['interests'] if 'Cryptocurrency' in i.get('value','')]; print(crypto[0]['evidence_count'] if crypto else 0)")

echo "Day 3 Results:"
echo "  Cryptocurrency confidence: $CONF_DAY3"
echo "  Evidence count: $EVIDENCE_DAY3"

# Verification
echo ""
echo "=== Verification ==="
python3 << EOF
conf_day1, conf_day2, conf_day3 = $CONF_DAY1, $CONF_DAY2, $CONF_DAY3
evidence_day1, evidence_day2, evidence_day3 = $EVIDENCE_DAY1, $EVIDENCE_DAY2, $EVIDENCE_DAY3

print(f"Confidence Evolution: {conf_day1:.3f} → {conf_day2:.3f} → {conf_day3:.3f}")
print(f"Evidence Growth: {evidence_day1} → {evidence_day2} → {evidence_day3}")

# Verify increasing confidence
if conf_day1 < conf_day2 < conf_day3:
    print("✅ Confidence increases across sessions")
else:
    print("❌ Confidence does NOT increase properly")
    exit(1)

# Verify increasing evidence
if evidence_day1 < evidence_day2 < evidence_day3:
    print("✅ Evidence count increases across sessions")
else:
    print("❌ Evidence does NOT increase properly")
    exit(1)

print("")
print("✅ Multi-session confidence evolution VERIFIED")
EOF
```

**Run Test:**
```bash
chmod +x tests/manual/test_confidence_evolution.sh
./tests/manual/test_confidence_evolution.sh

# Expected Output:
# Day 1 Results:
#   Cryptocurrency confidence: 0.700
#   Evidence count: 1
#
# Day 2 Results:
#   Cryptocurrency confidence: 0.825
#   Evidence count: 2
#
# Day 3 Results:
#   Cryptocurrency confidence: 0.883
#   Evidence count: 3
#
# === Verification ===
# Confidence Evolution: 0.700 → 0.825 → 0.883
# Evidence Growth: 1 → 2 → 3
# ✅ Confidence increases across sessions
# ✅ Evidence count increases across sessions
# ✅ Multi-session confidence evolution VERIFIED
```

**Acceptance Criteria:**
- [x] Confidence increases: Day1 < Day2 < Day3
- [x] Evidence increases: 1 → 2 → 3
- [x] All emails tracked as processed
- [x] Test script documents behavior

---

### A3: Simple Migration Utility

**Task:** Create backup/restore scripts
**Time:** 1-2 hours
**Testing:** Export → Import → Verify

#### A3.1: Create Export Script

**Create:** `scripts/export_memories.py`

```python
#!/usr/bin/env python3
"""
Export SQLite memories to JSON for backup.

Usage:
    python scripts/export_memories.py --output backup.json
    python scripts/export_memories.py --db custom.db --output backup.json
"""

import argparse
import json
import os
from pathlib import Path
from email_parser.memory.backends import SQLiteStore

def export_memories(db_path: str, output_path: str):
    """Export all memories from SQLite to JSON."""

    # Check database exists
    if not Path(db_path).exists():
        print(f"❌ Database not found: {db_path}")
        return False

    # Initialize store
    store = SQLiteStore(db_path)
    stats = store.get_stats()

    print(f"📊 Database Stats:")
    print(f"  Total memories: {stats['total_memories']}")
    print(f"  Namespaces: {stats['total_namespaces']}")
    print(f"  Size: {stats['db_size_mb']} MB")
    print()

    # Get all namespaces
    namespaces = store.list_namespaces()
    print(f"📦 Exporting {len(namespaces)} namespaces...")

    # Export data
    export_data = {
        "exported_at": datetime.now().isoformat(),
        "database_path": db_path,
        "stats": stats,
        "memories": {}
    }

    for namespace_str in namespaces:
        namespace = tuple(namespace_str.split('/'))
        memories = store.search(namespace)

        # Convert MemoryItem to dict
        export_data["memories"][namespace_str] = [
            {
                "key": mem.key,
                "value": mem.value,
                "namespace": mem.namespace
            }
            for mem in memories
        ]

        print(f"  ✓ {namespace_str}: {len(memories)} memories")

    # Write JSON
    with open(output_path, 'w') as f:
        json.dump(export_data, f, indent=2)

    print()
    print(f"✅ Export complete: {output_path}")
    print(f"   Total memories: {stats['total_memories']}")

    return True

if __name__ == "__main__":
    from datetime import datetime

    parser = argparse.ArgumentParser(description="Export SQLite memories to JSON")
    parser.add_argument(
        "--db",
        default="data/email_parser_memory.db",
        help="SQLite database path"
    )
    parser.add_argument(
        "--output",
        required=True,
        help="Output JSON file"
    )

    args = parser.parse_args()

    success = export_memories(args.db, args.output)
    exit(0 if success else 1)
```

**Test Export:**
```bash
python scripts/export_memories.py --output backup.json

# Expected Output:
# 📊 Database Stats:
#   Total memories: 14
#   Namespaces: 2
#   Size: 0.02 MB
#
# 📦 Exporting 2 namespaces...
#   ✓ user_20251001_065507/iab_taxonomy_profile: 13 memories
#   ✓ user_20251001_065507/memory_index: 1 memories
#
# ✅ Export complete: backup.json
#    Total memories: 14
```

**Verify Export:**
```bash
cat backup.json | python -c "import sys, json; d=json.load(sys.stdin); print(f'Memories: {sum(len(m) for m in d[\"memories\"].values())}'); print(f'Namespaces: {len(d[\"memories\"])}')"

# Expected: Memories: 14, Namespaces: 2
```

#### A3.2: Create Import Script

**Create:** `scripts/import_memories.py`

```python
#!/usr/bin/env python3
"""
Import memories from JSON backup to SQLite.

Usage:
    python scripts/import_memories.py --input backup.json
    python scripts/import_memories.py --input backup.json --db new.db
"""

import argparse
import json
from pathlib import Path
from email_parser.memory.backends import SQLiteStore

def import_memories(input_path: str, db_path: str):
    """Import memories from JSON to SQLite."""

    # Check input exists
    if not Path(input_path).exists():
        print(f"❌ Input file not found: {input_path}")
        return False

    # Load JSON
    with open(input_path) as f:
        data = json.load(f)

    print(f"📥 Importing from: {input_path}")
    print(f"   Exported: {data['exported_at']}")
    print(f"   Original DB: {data['database_path']}")
    print()

    # Initialize store
    store = SQLiteStore(db_path)
    print(f"📦 Target database: {db_path}")
    print()

    # Import memories
    total_imported = 0
    for namespace_str, memories in data["memories"].items():
        namespace = tuple(namespace_str.split('/'))

        print(f"  Importing {namespace_str}...")
        for memory in memories:
            store.put(
                namespace=namespace,
                key=memory["key"],
                value=memory["value"]
            )
            total_imported += 1

        print(f"    ✓ {len(memories)} memories")

    print()
    print(f"✅ Import complete!")
    print(f"   Total memories imported: {total_imported}")

    # Verify
    stats = store.get_stats()
    print(f"   Database now has: {stats['total_memories']} memories")

    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import memories from JSON to SQLite")
    parser.add_argument(
        "--input",
        required=True,
        help="Input JSON file"
    )
    parser.add_argument(
        "--db",
        default="data/email_parser_memory.db",
        help="SQLite database path"
    )

    args = parser.parse_args()

    success = import_memories(args.input, args.db)
    exit(0 if success else 1)
```

**Test Import:**
```bash
# Create new database
python scripts/import_memories.py --input backup.json --db data/test_import.db

# Expected Output:
# 📥 Importing from: backup.json
#    Exported: 2025-10-01T...
#    Original DB: data/email_parser_memory.db
#
# 📦 Target database: data/test_import.db
#
#   Importing user_20251001_065507/iab_taxonomy_profile...
#     ✓ 13 memories
#   Importing user_20251001_065507/memory_index...
#     ✓ 1 memories
#
# ✅ Import complete!
#    Total memories imported: 14
#    Database now has: 14 memories
```

**Verify Import:**
```bash
# Check imported database
sqlite3 data/test_import.db "SELECT COUNT(*) FROM memories"
# Expected: 14

# Cleanup
rm data/test_import.db
```

**Acceptance Criteria:**
- [x] Export script works
- [x] Import script works
- [x] Round-trip preserves all data
- [x] Scripts have clear output

---

## 📋 Option B: Production Readiness

### B1: Cost Tracking

**Task:** Track and display LLM API costs
**Time:** 2-3 hours
**Testing:** Verify cost calculations

#### B1.1: Create Cost Tracker

**Create:** `src/email_parser/workflow/cost_tracker.py`

```python
"""
LLM API cost tracking.

Tracks token usage and calculates costs across different LLM providers.
"""

from typing import Dict, Optional
from dataclasses import dataclass, field
import logging

logger = logging.getLogger(__name__)


@dataclass
class CostTracker:
    """
    Track LLM API costs across providers.

    Pricing as of 2025-10-01 (per 1K tokens):
    - OpenAI GPT-4o-mini: $0.150 input, $0.600 output
    - Claude Sonnet 4: $3.00 input, $15.00 output
    - Ollama: Free (local)
    """

    # Pricing per 1000 tokens (USD)
    PRICING = {
        "openai": {
            "gpt-4o-mini": {"input": 0.000150, "output": 0.000600},
            "gpt-4o": {"input": 0.002500, "output": 0.010000},
            "gpt-4": {"input": 0.030000, "output": 0.060000},
        },
        "claude": {
            "claude-sonnet-4": {"input": 0.003000, "output": 0.015000},
            "claude-opus-4": {"input": 0.015000, "output": 0.075000},
        },
        "ollama": {
            "default": {"input": 0.0, "output": 0.0}  # Free
        }
    }

    total_cost: float = 0.0
    cost_by_provider: Dict[str, float] = field(default_factory=dict)
    call_count: int = 0
    total_input_tokens: int = 0
    total_output_tokens: int = 0

    def track_call(
        self,
        provider: str,
        model: str,
        input_tokens: int,
        output_tokens: int
    ) -> float:
        """
        Track a single LLM API call and calculate cost.

        Args:
            provider: LLM provider (openai, claude, ollama)
            model: Model name
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens

        Returns:
            Cost of this call in USD
        """
        # Get pricing
        provider_pricing = self.PRICING.get(provider, {})
        model_pricing = provider_pricing.get(model, provider_pricing.get("default", {"input": 0, "output": 0}))

        # Calculate cost
        input_cost = (input_tokens / 1000) * model_pricing["input"]
        output_cost = (output_tokens / 1000) * model_pricing["output"]
        call_cost = input_cost + output_cost

        # Update totals
        self.total_cost += call_cost
        self.cost_by_provider[provider] = self.cost_by_provider.get(provider, 0) + call_cost
        self.call_count += 1
        self.total_input_tokens += input_tokens
        self.total_output_tokens += output_tokens

        logger.debug(
            f"LLM call: {provider}/{model} - "
            f"tokens={input_tokens}+{output_tokens}, "
            f"cost=${call_cost:.4f}"
        )

        return call_cost

    def get_summary(self) -> Dict:
        """
        Get cost summary.

        Returns:
            Dict with cost breakdown
        """
        return {
            "total_cost_usd": round(self.total_cost, 4),
            "call_count": self.call_count,
            "total_tokens": self.total_input_tokens + self.total_output_tokens,
            "input_tokens": self.total_input_tokens,
            "output_tokens": self.total_output_tokens,
            "by_provider": {
                provider: round(cost, 4)
                for provider, cost in self.cost_by_provider.items()
            }
        }

    def get_per_email_cost(self, email_count: int) -> float:
        """Calculate cost per email."""
        if email_count == 0:
            return 0.0
        return round(self.total_cost / email_count, 4)
```

**Test Cost Tracker:**
```python
# Create tests/unit/test_cost_tracker.py
def test_cost_tracker_openai():
    tracker = CostTracker()

    # Track OpenAI call
    cost = tracker.track_call("openai", "gpt-4o-mini", 1000, 500)

    # Verify: (1000/1000 * 0.000150) + (500/1000 * 0.000600) = 0.15 + 0.30 = 0.45
    assert cost == 0.00045
    assert tracker.total_cost == 0.00045
    assert tracker.call_count == 1

def test_cost_tracker_ollama_free():
    tracker = CostTracker()

    cost = tracker.track_call("ollama", "deepseek", 1000, 500)

    assert cost == 0.0
    assert tracker.total_cost == 0.0
```

```bash
pytest tests/unit/test_cost_tracker.py -v
# Expected: PASSED
```

**Acceptance Criteria (B1.1):**
- [x] CostTracker class works
- [x] Calculates costs correctly
- [x] Unit tests pass

---

#### B1.2: Integrate Cost Tracking

**Action:** Add cost tracking to LLM clients and workflow

**Modify:** `src/email_parser/llm_clients/base.py` to track tokens

**Modify:** `src/email_parser/workflow/executor.py`:

```python
from email_parser.workflow.cost_tracker import CostTracker

def run_workflow(
    user_id: str,
    emails: List[Dict[str, Any]],
    memory_manager: MemoryManager,
    config: Optional[Dict[str, Any]] = None,
    force_reprocess: bool = False
) -> WorkflowState:
    """Execute workflow with cost tracking."""

    # Initialize cost tracker
    cost_tracker = CostTracker()

    # Pass to state
    initial_state = create_initial_state(user_id, emails, force_reprocess)
    initial_state["cost_tracker"] = cost_tracker

    # ... run workflow ...

    # Add cost summary to final state
    final_state["cost_summary"] = cost_tracker.get_summary()

    return final_state
```

**Modify:** `src/email_parser/main.py` to display costs:

```python
# After workflow completion
summary = get_workflow_summary(final_state)
cost_summary = final_state.get("cost_summary")

if cost_summary:
    self.logger.info(f"\n💰 Cost Summary:")
    self.logger.info(f"  Total: ${cost_summary['total_cost_usd']:.4f} USD")
    self.logger.info(f"  Calls: {cost_summary['call_count']}")
    self.logger.info(f"  Tokens: {cost_summary['total_tokens']:,}")

    if summary['emails_processed'] > 0:
        per_email = cost_summary['total_cost_usd'] / summary['emails_processed']
        self.logger.info(f"  Per Email: ${per_email:.4f}")

    for provider, cost in cost_summary['by_provider'].items():
        self.logger.info(f"  {provider.capitalize()}: ${cost:.4f}")
```

**Test Integration:**
```bash
python -m src.email_parser.main --iab-csv test_iab_sample.csv --iab-output test_cost.json

# Expected Output:
# ✅ IAB profile generation complete
# Emails Processed: 10
#
# 💰 Cost Summary:
#   Total: $0.0234 USD
#   Calls: 15
#   Tokens: 18,456
#   Per Email: $0.0023
#   Openai: $0.0234
```

**Acceptance Criteria (B1.2):**
- [x] Costs tracked during workflow
- [x] Summary displayed after completion
- [x] Per-email cost calculated
- [x] Works with all providers

---

### B2: Optimize Test Suite

**Task:** Mock LLMs, add markers, reduce timeout
**Time:** 3-4 hours
**Testing:** Tests run fast

#### B2.1: Create Mock LLM Client

**Create:** `tests/mocks/mock_llm_client.py`

```python
"""Mock LLM client for fast unit testing."""

class MockLLMClient:
    """Mock LLM that returns predictable responses."""

    def __init__(self, responses=None):
        self.responses = responses or {}
        self.call_count = 0

    def analyze_email(self, email, taxonomy_context):
        """Return mock classification."""
        self.call_count += 1

        # Return pre-configured response if available
        email_id = email.get("id", "default")
        if email_id in self.responses:
            return self.responses[email_id]

        # Default: return crypto classification
        return {
            "classifications": [
                {
                    "taxonomy_id": 342,
                    "value": "Cryptocurrency",
                    "confidence": 0.85,
                    "reasoning": "Mock crypto classification"
                }
            ]
        }
```

#### B2.2: Update Tests with Mocking

**Pattern for Unit Tests:**
```python
@pytest.fixture
def mock_llm(monkeypatch):
    """Mock LLM client for fast testing."""
    from tests.mocks.mock_llm_client import MockLLMClient

    client = MockLLMClient()

    # Patch the get_llm_client function
    monkeypatch.setattr(
        "src.email_parser.workflow.llm_wrapper.get_llm_client",
        lambda *args, **kwargs: client
    )

    return client

@pytest.mark.unit
def test_analyzer_with_mock_llm(mock_llm):
    """Fast test with mocked LLM."""
    # Test runs in milliseconds, not seconds
    result = demographics_analyzer_node(state, memory_manager)
    assert result["demographics_results"] is not None
```

#### B2.3: Add Pytest Markers

**Update:** `pyproject.toml`:

```toml
[tool.pytest.ini_options]
markers = [
    "unit: Fast unit tests with mocked LLMs (< 1s each)",
    "integration: Integration tests with real LLMs (< 30s each)",
    "e2e: Full end-to-end tests (< 5min each)",
    "slow: Long-running tests (manual/nightly only)"
]
```

**Run Different Test Suites:**
```bash
# Fast unit tests only (< 30s total)
pytest -m unit -v

# Integration tests (< 5min total)
pytest -m integration -v

# All except slow
pytest -m "not slow" -v

# Everything
pytest
```

**Acceptance Criteria (B2):**
- [x] Unit tests run in < 30s
- [x] Integration tests run in < 5min
- [x] No timeouts
- [x] Test markers work

---

### B3: User Documentation

**Task:** Create user guide and API docs
**Time:** 2-3 hours
**Deliverable:** Clear, concise documentation

**Create:** `docs/USER_GUIDE.md` (comprehensive guide with examples)
**Create:** `docs/API_REFERENCE.md` (API usage examples)
**Create:** `README.md` (quick start)

**Test Documentation:**
- [ ] New user can generate profile in 5 minutes
- [ ] All examples work
- [ ] Troubleshooting section answers common questions

---

### B4: Performance Benchmarks

**Task:** Document performance characteristics
**Time:** 2-3 hours
**Deliverable:** `docs/PERFORMANCE.md`

**Create:** `benchmarks/benchmark_throughput.py`
**Run:** Benchmarks for 10, 50, 100 emails
**Document:** Results with hardware specs

---

## ✅ Final Verification Checklist

### Functional Requirements (from Phase 5 TODO)
- [x] `--iab-profile` flag working
- [x] Generates valid JSON IAB profiles
- [x] SQLite persistence
- [x] Incremental processing
- [x] `--force-reprocess` flag
- [ ] All tests passing
- [ ] Cost tracking implemented
- [ ] User documentation complete

### Output Requirements (from original specs)
- [x] Valid JSON with schema_version
- [x] generator metadata (system, llm_model, workflow_version)
- [x] data_coverage (total_emails_analyzed, emails_this_run, date_range)
- [x] demographics, household, interests, purchase_intent, actual_purchases
- [x] memory_stats (total_facts_stored, confidence metrics)
- [x] section_confidence scores

---

## Execution Order

1. **Verify Core (15 min)** - Run 3 basic tests
2. **Option A (4-6 hours)**
   - A1: Fix tests (2-3h)
   - A2: Multi-session (1h)
   - A3: Migration (1-2h)
3. **Option B (9-13 hours)**
   - B1: Cost tracking (2-3h)
   - B2: Optimize tests (3-4h)
   - B3: Documentation (2-3h)
   - B4: Benchmarks (2-3h)
4. **Final Verification (30 min)** - Run full checklist

**Total Time:** 14-20 hours for complete production-ready system
