---
name: typescript-verification
description: MANDATORY build verification for TypeScript migrations - compilation, schema validation, type checking. Use AFTER source verification, BEFORE claiming migration complete.
---

# TypeScript Migration Verification Skill

## CRITICAL RULE

**NEVER claim TypeScript migration complete without running compilation verification.**

**This skill is MANDATORY for Phase 2 of migration (Build Verification).**

---

## When to Use This Skill

**MANDATORY after:**
1. Source verification complete (python-typescript-migration skill)
2. All code written
3. All findings documented

**BEFORE:**
1. Claiming migration complete
2. Committing code
3. Creating pull request

---

## The Two-Phase Verification Model

### Phase 1: Source Verification (python-typescript-migration skill)
✅ Functions match Python source  
✅ Parameters match Python source  
✅ Logic matches Python source  
✅ Documentation complete

### Phase 2: Build Verification (THIS SKILL)
✅ TypeScript compiles  
✅ Schema fields match interface  
✅ Types are correct  
✅ Tests pass

**NEVER skip Phase 2. Tests passing ≠ code compiles.**

---

## Mandatory Step 1: Schema Field Verification

For state objects using Annotation.Root, verify EVERY interface field exists in schema:

```typescript
// Create verification table
## Schema Verification: state.ts

| Field | Interface Line | Schema Line | Match |
|-------|---------------|-------------|-------|
| user_id | 56 | 566 | ✅ |
| force_reprocess | 137 | MISSING | ❌ |
```

**If ANY field missing from schema**: Migration INCOMPLETE

---

## Mandatory Step 2: TypeScript Compilation

```bash
npx tsc --noEmit
```

**Expected**: Zero errors

**If errors**: DO NOT claim complete, fix all errors first

---

## Mandatory Step 3: Tests

```bash
npm test
```

**Only after compilation passes**

---

## Success Criteria

Migration complete ONLY when:

- [ ] Schema fields verified (all interface fields in Annotation.Root)
- [ ] `npx tsc --noEmit` returns zero errors
- [ ] All tests pass
- [ ] Verification documented
- [ ] User shown evidence

**If ANY unchecked: Migration INCOMPLETE**

---

## Remember

**Compilation verification is NON-NEGOTIABLE.**

**Tests passing ≠ code compiles**

**Schema interface ≠ schema implementation**

**Always verify, never assume**
