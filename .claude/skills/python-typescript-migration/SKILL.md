---
name: python-typescript-migration
description: Enforce systematic Python-to-TypeScript migration with mandatory verification at every step. Use for EVERY migration task - no exceptions.
---

# Python to TypeScript Migration Skill

## CRITICAL RULE

**NEVER write TypeScript code without reading the Python source first.**

Every single line of TypeScript must be verified against the original Python implementation.

---

## Mandatory Migration Protocol

### Before Writing ANY TypeScript Code

1. **READ the Python source file(s)** using Read tool
2. **EXTRACT the exact structure** (classes, functions, types, logic)
3. **DOCUMENT what you read** in a comparison table
4. **ONLY THEN write TypeScript** as exact translation

### At Every Step

Create a verification table:

```markdown
| Python Source | Line Numbers | TypeScript Equivalent | Verified |
|---------------|--------------|----------------------|----------|
| [exact code]  | file.py:10-20| [exact code]         | ✅/❌    |
```

---

## Migration Workflow (MANDATORY)

### Step 1: Identify Python Source

```python
# Example: Migrating WorkflowState
Python file: src/email_parser/workflow/state.py
Target: src/browser/agents/iab-classifier/state.ts
```

### Step 2: Read Python Source

Use Read tool to read the ENTIRE Python file:

```
Read(file_path="src/email_parser/workflow/state.py")
```

**DO NOT proceed until you have read the Python source.**

### Step 3: Extract Structure

Document EVERY element:

```markdown
## Python Structure Extracted from state.py

### Class: WorkflowState (TypedDict)
- Line 15-196
- Fields: 24 total
  - user_id: str (line 37-38)
  - emails: NotRequired[List[Dict[str, Any]]] (line 44-56)
  ... [EVERY FIELD]

### Functions:
- create_initial_state() (line 201-256)
- get_current_email() (line 259-283)
... [EVERY FUNCTION]
```

### Step 4: Create TypeScript Translation

**BEFORE writing TypeScript:**
1. Create side-by-side comparison table
2. Map EVERY Python type to TypeScript equivalent
3. Document any differences

**TypeScript Type Mappings (MANDATORY):**

| Python | TypeScript |
|--------|------------|
| `str` | `string` |
| `int` | `number` |
| `float` | `number` |
| `bool` | `boolean` |
| `List[T]` | `Array<T>` |
| `Dict[K, V]` | `Record<K, V>` |
| `Optional[T]` | `T \| undefined` |
| `TypedDict` | `interface extends Annotation.State` (LangGraph.js) |
| `Any` | `any` |
| `NotRequired[T]` | `T?` (optional property) |

### Step 5: Write TypeScript (Line-by-Line)

For EACH Python element:

```typescript
// Python: user_id: str (state.py:37-38)
user_id: Annotation<string>  // TypeScript equivalent

// Python: emails: NotRequired[List[Dict[str, Any]]] (state.py:44-56)
emails?: Annotation<Array<Record<string, any>>>  // TypeScript equivalent
```

**VERIFICATION CHECKLIST for each line:**
- [ ] Python line number documented
- [ ] Python type extracted correctly
- [ ] TypeScript equivalent matches Python semantics
- [ ] Comments reference Python source line

### Step 6: Verify Complete Translation

Create final verification table:

```markdown
## Verification: WorkflowState Migration

| Element | Python (state.py) | TypeScript (state.ts) | Match |
|---------|-------------------|----------------------|-------|
| Class definition | line 15: class WorkflowState(TypedDict) | line 10: interface WorkflowState extends Annotation.State | ✅ |
| Field: user_id | line 37: user_id: str | line 15: user_id: Annotation<string> | ✅ |
| Field: emails | line 44: emails: NotRequired[List[Dict]] | line 20: emails?: Annotation<Array<Record<string, any>>> | ✅ |
... [EVERY ELEMENT]

**Total Elements:** 30
**Verified:** 30/30 ✅
**Divergences:** 0
```

---

## Function Migration Protocol

For EVERY function:

### Step 1: Extract Python Function

```python
# Python: src/email_parser/workflow/nodes/analyzers.py:30-67
def lookup_taxonomy_entry(taxonomy_id: int) -> Optional[Dict[str, Any]]:
    """Look up taxonomy entry by ID."""
    global _taxonomy_loader
    if _taxonomy_loader is None:
        from ...utils.iab_taxonomy_loader import IABTaxonomyLoader
        _taxonomy_loader = IABTaxonomyLoader()
    return _taxonomy_loader

    loader = _get_taxonomy_loader()
    entry = loader.taxonomy_by_id.get(taxonomy_id)

    if not entry:
        logger.warning(f"Taxonomy ID {taxonomy_id} not found")
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

### Step 2: Map Line-by-Line to TypeScript

```typescript
// Python: analyzers.py:30-67
function lookupTaxonomyEntry(taxonomyId: number): Record<string, any> | undefined {
  // Python line 42: loader = _get_taxonomy_loader()
  const loader = getTaxonomyLoader()

  // Python line 43: entry = loader.taxonomy_by_id.get(taxonomy_id)
  const entry = loader.getById(taxonomyId)

  // Python line 45-47: if not entry: ... return None
  if (!entry) {
    logger.warning(`Taxonomy ID ${taxonomyId} not found`)
    return undefined
  }

  // Python line 50-52: Build category_path from tiers
  const tiers = [entry.tier_1, entry.tier_2, entry.tier_3, entry.tier_4, entry.tier_5]
  const nonEmptyTiers = tiers.filter(t => t)
  const categoryPath = nonEmptyTiers.join(" | ")

  // Python line 54-64: return {...}
  return {
    tier_1: entry.tier_1,
    tier_2: entry.tier_2,
    tier_3: entry.tier_3,
    tier_4: entry.tier_4,
    tier_5: entry.tier_5,
    category_path: categoryPath,
    name: entry.name,
    grouping_tier_key: entry.grouping_tier_key || 'tier_2',
    grouping_value: entry.grouping_value || entry.tier_2
  }
}
```

### Step 3: Verify Each Line

| Python Line | Python Code | TypeScript Line | TypeScript Code | Match |
|-------------|-------------|-----------------|-----------------|-------|
| 42 | `loader = _get_taxonomy_loader()` | 3 | `const loader = getTaxonomyLoader()` | ✅ |
| 43 | `entry = loader.taxonomy_by_id.get(taxonomy_id)` | 6 | `const entry = loader.getById(taxonomyId)` | ✅ |
| 45-47 | `if not entry: ... return None` | 9-12 | `if (!entry) { ... return undefined }` | ✅ |
| 50 | `tiers = [entry['tier_1'], ...]` | 15 | `const tiers = [entry.tier_1, ...]` | ✅ |
| 51 | `non_empty_tiers = [t for t in tiers if t]` | 16 | `const nonEmptyTiers = tiers.filter(t => t)` | ✅ |
| 52 | `category_path = " \| ".join(non_empty_tiers)` | 17 | `const categoryPath = nonEmptyTiers.join(" \| ")` | ✅ |
| 54-64 | `return {...}` | 20-31 | `return {...}` | ✅ |

**Result:** ✅ All 7 logic blocks verified

---

## Comparison Requirements

### For Every Migration Task:

1. **Before starting:** Read Python source
2. **During migration:** Document every line being translated
3. **After writing:** Create verification table
4. **Before marking complete:** Run side-by-side diff check

### Verification Table Template

```markdown
## Migration Verification: [Component Name]

**Python Source:** `[file path]:[line range]`
**TypeScript Target:** `[file path]:[line range]`

### Structure Comparison

| Python | TypeScript | Verified |
|--------|-----------|----------|
| [element] | [element] | ✅/❌ |

### Logic Comparison

| Step | Python Logic | TypeScript Logic | Match |
|------|-------------|------------------|-------|
| 1 | [code] | [code] | ✅/❌ |

### Field/Type Comparison

| Field | Python Type | TypeScript Type | Match |
|-------|------------|-----------------|-------|
| [name] | [type] | [type] | ✅/❌ |

### Summary

- **Total Elements:** X
- **Verified Matches:** X/X
- **Divergences:** X (with justification)
- **Status:** ✅ VERIFIED / ❌ INCOMPLETE
```

---

## Red Flags (STOP IMMEDIATELY)

If you catch yourself doing ANY of these:

❌ **"I'll write TypeScript first, then compare"** → WRONG ORDER
❌ **"The Python code is similar to X, so I'll..."** → MUST READ ACTUAL CODE
❌ **"Based on the documentation..."** → MUST READ SOURCE CODE
❌ **"This is straightforward, I don't need to compare"** → ALWAYS COMPARE
❌ **Writing TypeScript without Python line numbers in comments** → MISSING TRACEABILITY
❌ **"I remember the Python code"** → READ IT AGAIN

### Correct Thought Process:

✅ "Let me read the Python source first"
✅ "Python line 42 does X, so TypeScript line Y must do X"
✅ "I need to verify every field matches"
✅ "Let me create a comparison table before proceeding"

---

## Example: Complete Migration of a Simple Function

### Step 1: Read Python Source

```bash
Read(file_path="src/email_parser/workflow/nodes/analyzers.py", offset=70, limit=30)
```

**Python Source (analyzers.py:70-100):**
```python
def get_taxonomy_value(taxonomy_entry: Dict[str, Any]) -> str:
    """Extract the actual classification value from a taxonomy entry.

    The value is the deepest non-empty tier (tier_5 > tier_4 > tier_3).
    """
    # Check tiers from deepest to shallowest
    for tier_key in ['tier_5', 'tier_4', 'tier_3']:
        value = taxonomy_entry.get(tier_key, "").strip()
        if value:
            return value

    # Fallback to tier_2
    return taxonomy_entry.get('tier_2', "").strip()
```

### Step 2: Create Comparison Plan

| Line | Python Logic | TypeScript Equivalent |
|------|-------------|----------------------|
| 70 | Function signature: `(taxonomy_entry: Dict[str, Any]) -> str` | `(taxonomyEntry: Record<string, any>): string` |
| 77 | `for tier_key in ['tier_5', 'tier_4', 'tier_3']` | `for (const tierKey of ['tier_5', 'tier_4', 'tier_3'])` |
| 78 | `value = taxonomy_entry.get(tier_key, "").strip()` | `const value = (taxonomyEntry[tierKey] || "").trim()` |
| 79 | `if value: return value` | `if (value) return value` |
| 82 | `return taxonomy_entry.get('tier_2', "").strip()` | `return (taxonomyEntry['tier_2'] || "").trim()` |

### Step 3: Write TypeScript with Line References

```typescript
/**
 * Extract the actual classification value from a taxonomy entry.
 *
 * The value is the deepest non-empty tier (tier_5 > tier_4 > tier_3).
 *
 * Python source: analyzers.py:70-100
 */
// Python line 70: function signature
function getTaxonomyValue(taxonomyEntry: Record<string, any>): string {
  // Python line 77: for tier_key in ['tier_5', 'tier_4', 'tier_3']
  for (const tierKey of ['tier_5', 'tier_4', 'tier_3']) {
    // Python line 78: value = taxonomy_entry.get(tier_key, "").strip()
    const value = (taxonomyEntry[tierKey] || "").trim()

    // Python line 79: if value: return value
    if (value) return value
  }

  // Python line 82: return taxonomy_entry.get('tier_2', "").strip()
  return (taxonomyEntry['tier_2'] || "").trim()
}
```

### Step 4: Verify

```markdown
## Verification: getTaxonomyValue()

| Element | Python (line) | TypeScript (line) | Match |
|---------|--------------|-------------------|-------|
| Function name | get_taxonomy_value (70) | getTaxonomyValue (8) | ✅ |
| Parameter type | Dict[str, Any] (70) | Record<string, any> (8) | ✅ |
| Return type | str (70) | string (8) | ✅ |
| Loop structure | for tier_key in [...] (77) | for (const tierKey of [...]) (10) | ✅ |
| Get with default | .get(tier_key, "") (78) | [tierKey] \|\| "" (12) | ✅ |
| String strip | .strip() (78) | .trim() (12) | ✅ |
| Conditional return | if value: return value (79) | if (value) return value (15) | ✅ |
| Fallback return | .get('tier_2', "").strip() (82) | ['tier_2'] \|\| "").trim() (18) | ✅ |

**Status:** ✅ FULLY VERIFIED - All 8 elements match
```

---

## Skill Usage

### When to Use This Skill

**MANDATORY for:**
- Every TypeScript file creation during migration
- Every function port from Python to TypeScript
- Every type/interface definition
- Every test port
- Any code that claims to match Python implementation

### How to Use

1. **Invoke skill at start of migration task:**
   ```
   I'm using the python-typescript-migration skill to ensure exact 1:1 translation
   ```

2. **Follow the protocol for EVERY component:**
   - Read Python source FIRST
   - Extract structure
   - Create comparison table
   - Write TypeScript with line references
   - Verify with table

3. **Document verification:**
   - Create verification markdown after each component
   - Include in commit message or PR description
   - Keep as migration audit trail

### Failure Modes

If you realize you've written TypeScript without following the protocol:

1. **STOP immediately**
2. **Delete the TypeScript code**
3. **Start over with Step 1: Read Python source**
4. **Follow the protocol from the beginning**

---

## Success Criteria

A migration is ONLY complete when:

✅ Every Python source file has been read
✅ Every function has line-by-line comparison table
✅ Every type has been mapped with verification
✅ Every logic block has been compared
✅ Verification tables show 100% match (or documented divergences)
✅ Tests pass with same behavior as Python tests

**NO EXCEPTIONS. NO SHORTCUTS. NO ASSUMPTIONS.**

---

## Migration Checklist Template

Use this for every migration task:

```markdown
## Migration Task: [Component Name]

### 1. Python Source Read ✅/❌
- [ ] Read file: [path]
- [ ] Extracted structure
- [ ] Documented all elements

### 2. Comparison Created ✅/❌
- [ ] Type mapping table
- [ ] Function mapping table
- [ ] Logic flow comparison

### 3. TypeScript Written ✅/❌
- [ ] Line-by-line references
- [ ] Exact logic translation
- [ ] Comments reference Python source

### 4. Verification Complete ✅/❌
- [ ] Verification table created
- [ ] All elements checked
- [ ] Divergences documented (if any)

### 5. Status
- **Python Source:** [file:line-line]
- **TypeScript Target:** [file:line-line]
- **Verification:** ✅ COMPLETE / ❌ INCOMPLETE
- **Divergences:** X (justified)
```

---

## Remember

**The Python code is the source of truth.**

**Your TypeScript code is ONLY correct if it exactly matches the Python implementation.**

**When in doubt, read the Python source again.**

**NEVER trust documentation or memory over actual source code.**
