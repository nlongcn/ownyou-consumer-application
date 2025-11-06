# MemoryManager API Reference

**File:** `src/email_parser/memory/manager.py`
**Version:** 1.0
**Last Updated:** 2025-10-01

---

## Semantic Memory Methods

### store_semantic_memory(memory_id, data)

Store a semantic memory (IAB taxonomy classification).

**Signature:**
```python
def store_semantic_memory(
    self,
    memory_id: str,
    data: Dict[str, Any]
) -> None
```

**Parameters:**
- `memory_id` (str): Unique identifier (e.g., "semantic_interests_342_cryptocurrency")
- `data` (Dict): Memory data matching SemanticMemory schema

**Example:**
```python
manager.store_semantic_memory(
    "semantic_interests_342_cryptocurrency",
    {
        "memory_id": "semantic_interests_342_cryptocurrency",
        "taxonomy_id": 342,
        "category_path": "Interest | Cryptocurrency",
        "tier_1": "Interest",
        "tier_2": "Cryptocurrency",
        "tier_3": "",
        "tier_4": "",
        "tier_5": "",
        "value": "Cryptocurrency",
        "confidence": 0.85,
        "evidence_count": 2,
        "supporting_evidence": ["email_1", "email_2"],
        "contradicting_evidence": [],
        "first_observed": "2025-10-01T00:00:00Z",
        "last_validated": "2025-10-01T00:00:00Z",
        "last_updated": "2025-10-01T00:00:00Z",
        "days_since_validation": 0,
        "data_source": "email",
        "source_ids": ["email_1", "email_2"],
        "section": "interests",
        "reasoning": "User receives crypto newsletters"
    }
)
```

---

### get_semantic_memory(memory_id)

Retrieve a semantic memory by ID.

**Signature:**
```python
def get_semantic_memory(self, memory_id: str) -> Optional[Dict[str, Any]]
```

**Returns:** Dictionary with memory data, or None if not found

**Example:**
```python
memory = manager.get_semantic_memory("semantic_interests_342_cryptocurrency")
if memory:
    print(f"Confidence: {memory['confidence']}")
```

---

### get_all_semantic_memories()

Get all semantic memories for this user.

**Signature:**
```python
def get_all_semantic_memories(self) -> List[Dict[str, Any]]
```

**Returns:** List of memory dictionaries

**Example:**
```python
memories = manager.get_all_semantic_memories()
print(f"Total memories: {len(memories)}")
```

---

## Episodic Memory Methods

### store_episodic_memory(episode_id, email_data, taxonomy_selections, reasoning)

Store an episodic memory (processed email record).

**Signature:**
```python
def store_episodic_memory(
    self,
    episode_id: str,
    email_data: Dict[str, Any],
    taxonomy_selections: List[int],
    reasoning: str,
    llm_model: str = "unknown"
) -> None
```

**Example:**
```python
manager.store_episodic_memory(
    "episodic_email_email_123",
    email_data={"subject": "...", "date": "..."},
    taxonomy_selections=[342, 156],
    reasoning="Crypto and tech content",
    llm_model="openai:gpt-4o-mini"
)
```

---

### get_episodic_memory(episode_id)

Retrieve an episodic memory.

**Signature:**
```python
def get_episodic_memory(self, episode_id: str) -> Optional[Dict[str, Any]]
```

---

## Processed Email Tracking

### mark_email_as_processed(email_id)

Mark an email as processed.

**Signature:**
```python
def mark_email_as_processed(self, email_id: str) -> None
```

**Example:**
```python
manager.mark_email_as_processed("email_123")
```

---

### get_processed_email_ids()

Get list of processed email IDs.

**Signature:**
```python
def get_processed_email_ids(self) -> List[str]
```

**Returns:** List of email ID strings

**Example:**
```python
processed = manager.get_processed_email_ids()
print(f"Already processed: {len(processed)} emails")
```

---

## Query Methods

### get_memories_by_section(section)

Get all memories for a specific section.

**Signature:**
```python
def get_memories_by_section(self, section: str) -> List[Dict[str, Any]]
```

**Parameters:**
- `section`: One of "demographics", "household", "interests", "purchase_intent", "actual_purchases"

**Example:**
```python
interests = manager.get_memories_by_section("interests")
for interest in interests:
    print(f"{interest['value']}: {interest['confidence']}")
```

---

## Common Pitfalls

### ❌ WRONG: Passing memory_data parameter
```python
# This will fail
manager.store_semantic_memory(
    memory_id="test",
    memory_data={...}  # Wrong parameter name
)
```

### ✅ CORRECT: Pass data dictionary
```python
# This works
manager.store_semantic_memory(
    memory_id="test",
    data={...}  # Correct parameter name
)
```

---

### ❌ WRONG: Using mark_email_processed
```python
# This method doesn't exist
manager.mark_email_processed("email_1")
```

### ✅ CORRECT: Use mark_email_as_processed
```python
# Correct method name
manager.mark_email_as_processed("email_1")
```

---

### ❌ WRONG: Using is_email_processed
```python
# This method doesn't exist
if manager.is_email_processed("email_1"):
    ...
```

### ✅ CORRECT: Check in get_processed_email_ids
```python
# Get list and check membership
processed = manager.get_processed_email_ids()
if "email_1" in processed:
    ...
```

---

## See Also

- `src/email_parser/memory/schemas.py` - Memory data schemas
- `src/email_parser/memory/backends/sqlite_store.py` - SQLite backend
- `tests/integration/test_sqlite_persistence.py` - API usage examples
