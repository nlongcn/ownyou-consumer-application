---
name: v13-compliance-check
description: Verify implementation compliance with OwnYou v13 architecture. Use BEFORE marking any implementation complete, especially for Store operations, memory types, and namespace usage.
---

# V13 Compliance Check

**MANDATORY verification before marking ANY implementation complete.**

## When to Use This Skill

- **Before marking a package complete**
- **After implementing Store operations**
- **After defining memory types or interfaces**
- **When adding new namespaces**
- **Before creating a PR**

## The 6 Critical Decisions

**Every implementation MUST comply with these:**

1. **LangGraph Store = Single Source of Truth** - No separate databases
2. **IAB Classifications Trigger Mission Agents** - Store updates trigger missions
3. **Horizontal Layer Development** - Complete each layer across all features
4. **Multi-Source IAB Classification** - Same workflow for all data sources
5. **Self-Sovereign Authentication** - Wallet-based, no email/password
6. **Privacy-First by Design** - No raw data to external APIs without encryption

## Compliance Checklist

### 1. Store API Compliance (Section 8.13)

**Verify implementation uses LangGraph Store API:**

```typescript
// ✅ CORRECT - Uses Store API
await store.put(namespace, key, value);
await store.get(namespace, key);
await store.search({ namespace, query });
await store.list(namespace);
await store.delete(namespace, key);

// ❌ WRONG - Direct database access
await db.query('INSERT INTO memories...');
await indexedDB.put('memories', value);
```

**Checklist:**
- [ ] Uses `put()` for writes
- [ ] Uses `get()` for single reads
- [ ] Uses `search()` for vector/semantic search
- [ ] Uses `list()` for namespace enumeration
- [ ] Uses `delete()` for removals
- [ ] NO direct database queries

### 2. Namespace Compliance (Section 8.12)

**Verify correct namespace usage:**

```typescript
// ✅ CORRECT - Uses STORE_NAMESPACES
import { STORE_NAMESPACES } from '@ownyou/shared-types';

await store.put(
  STORE_NAMESPACES.semantic_memory(userId),
  memoryId,
  memory
);

// ❌ WRONG - Hardcoded namespace
await store.put(['memories', 'user123'], memoryId, memory);
await store.put('semantic_memory', memoryId, memory);
```

**Required Namespaces (from v13 Section 8.12):**

| Category | Namespace Factory |
|----------|-------------------|
| Semantic | `semantic_memory(userId)` |
| Episodic | `episodic_memory(userId)` |
| Procedural | `procedural_memory(userId, agentType)` |
| Entities | `entities(userId)` |
| Relationships | `relationships(userId)` |
| IAB | `iab_classifications(userId)`, `iab_evidence(userId)` |
| Ikigai | `ikigai_profile(userId)`, `ikigai_dimensions(userId)` |
| Mission | `mission_cards(userId)`, `mission_feedback(userId, missionId)` |
| Identity | `pseudonyms(userId)`, `disclosure_history(userId)`, `earnings(userId)` |

**Checklist:**
- [ ] Uses `STORE_NAMESPACES` constant
- [ ] No hardcoded namespace strings
- [ ] Correct namespace for data type
- [ ] User ID included in namespace

### 3. Memory Type Compliance (Section 8.4)

**Verify memory structures match v13 schema:**

```typescript
// ✅ CORRECT - Matches v13 Memory interface
const memory: Memory = {
  id: generateId(),
  content: "User prefers direct flights",
  context: "travel",

  // Bi-temporal
  valid_at: new Date(),
  created_at: new Date(),

  // Strength & decay
  strength: 1.0,
  last_accessed: new Date(),
  access_count: 0,

  // Provenance
  sources: ["episode_123"],
  confidence: 0.85,

  // Privacy
  privacy_tier: "sensitive"
};

// ❌ WRONG - Missing required fields
const memory = {
  id: "123",
  content: "User prefers direct flights"
  // Missing: valid_at, created_at, strength, privacy_tier, etc.
};
```

**Required Memory Fields:**
- [ ] `id: string`
- [ ] `content: string`
- [ ] `context: string`
- [ ] `valid_at: timestamp`
- [ ] `created_at: timestamp`
- [ ] `strength: number`
- [ ] `last_accessed: timestamp`
- [ ] `access_count: number`
- [ ] `sources: string[]`
- [ ] `confidence: number`
- [ ] `privacy_tier: "public" | "sensitive" | "private"`

### 4. Privacy Tier Compliance (Section 8.4)

**Verify privacy tiers are respected:**

```typescript
// ✅ CORRECT - Privacy tier assigned
const memory: Memory = {
  // ...
  privacy_tier: "sensitive"  // Financial data
};

// Before external API calls
if (memory.privacy_tier === "private") {
  throw new Error("Private data cannot be sent externally");
}

// ❌ WRONG - No privacy consideration
await externalApi.send(memory);  // Sends without checking privacy
```

**Privacy Tier Rules:**
| Tier | Description | External API |
|------|-------------|--------------|
| `public` | Non-sensitive | ✅ Allowed |
| `sensitive` | PII, financial | ⚠️ Encrypted only |
| `private` | Health, beliefs | ❌ Never external |

**Checklist:**
- [ ] All memories have privacy_tier
- [ ] External calls check privacy tier
- [ ] Private data never leaves device
- [ ] Sensitive data encrypted before external

### 5. Self-Sovereign Compliance

**Verify no centralized data storage:**

```typescript
// ✅ CORRECT - Local storage only
const store = new IndexedDBStore('ownyou_store');  // Browser
const store = new SQLiteStore('./data/ownyou.db'); // Desktop

// ❌ WRONG - Centralized backend
await fetch('https://api.ownyou.com/memories', {
  method: 'POST',
  body: JSON.stringify(memory)  // Sends to OwnYou servers
});
```

**Checklist:**
- [ ] Data stored locally (IndexedDB or SQLite)
- [ ] No calls to OwnYou cloud backend
- [ ] User data never leaves device (except encrypted sync)
- [ ] Encryption keys derived from user wallet

### 6. No Separate Databases

**Verify single Store usage:**

```typescript
// ✅ CORRECT - Single Store instance
const store = new MemoryStore(config);
await store.put(STORE_NAMESPACES.semantic_memory(userId), id, memory);
await store.put(STORE_NAMESPACES.iab_classifications(userId), id, classification);

// ❌ WRONG - Multiple databases
const memoryDb = new Database('memories.db');
const iabDb = new Database('iab.db');
const missionDb = new Database('missions.db');
```

**Checklist:**
- [ ] Single Store instance
- [ ] All data types in same Store
- [ ] Namespaces used for separation (not databases)
- [ ] No database creation for new features

## Running Compliance Check

### Step 1: Load Architecture Extracts

```
Read: docs/architecture/extracts/namespaces-8.12.md
Read: docs/architecture/extracts/memory-types-8.4.md
Read: docs/architecture/extracts/storage-backends-8.13.md
```

### Step 2: Review Implementation

For each file in the implementation:

1. Search for Store operations
2. Verify namespace usage
3. Check memory type compliance
4. Verify privacy tier handling
5. Check for external API calls

### Step 3: Document Findings

Create compliance report:

```markdown
## V13 Compliance Report

**Package:** memory-store
**Date:** 2025-12-01

### Store API Compliance
- [x] Uses put/get/search/list/delete
- [x] No direct database queries

### Namespace Compliance
- [x] Uses STORE_NAMESPACES
- [x] No hardcoded namespaces

### Memory Type Compliance
- [x] All required fields present
- [x] Privacy tier assigned

### Self-Sovereign Compliance
- [x] Local storage only
- [x] No external data leaks

### Issues Found
None.

### Status: COMPLIANT ✅
```

## Decision Tree

```
Implementation complete?
│
├─ Store API compliant?
│   ├─ NO → Fix to use put/get/search/list/delete
│   └─ YES → Continue
│
├─ Namespace compliant?
│   ├─ NO → Fix to use STORE_NAMESPACES
│   └─ YES → Continue
│
├─ Memory types compliant?
│   ├─ NO → Add missing required fields
│   └─ YES → Continue
│
├─ Privacy tiers handled?
│   ├─ NO → Add privacy_tier to all memories
│   └─ YES → Continue
│
├─ Self-sovereign compliant?
│   ├─ NO → Remove external data storage
│   └─ YES → Continue
│
└─ COMPLIANT - Can mark complete ✅
```

## Common Violations

| Violation | Fix |
|-----------|-----|
| Hardcoded namespace string | Use `STORE_NAMESPACES.xxx(userId)` |
| Missing privacy_tier | Add to Memory interface |
| Direct IndexedDB access | Use Store wrapper |
| External API without encryption | Add encryption or remove call |
| Multiple database instances | Consolidate to single Store |
| Missing bi-temporal fields | Add valid_at, created_at |

## AI Assistant Protocol

**Before marking ANY implementation complete:**

1. **Announce:** "Running v13 compliance check..."
2. **Load extracts:** namespaces, memory-types, storage-backends
3. **Check each compliance category**
4. **Report findings**
5. **Fix any violations**
6. **Mark complete only if fully compliant**
