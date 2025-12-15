# Bugfix Verification Checklist

Use this checklist before finalizing any bugfix specification. Each claim type requires specific verification steps.

## Quick Reference Table

| Claim Type | Required Verification | Tool to Use |
|------------|----------------------|-------------|
| "X is missing" | Search for X | Glob, Grep |
| "Need to create X" | Check if X exists | Grep packages |
| "Feature Y broken" | Trace code path | Read files |
| "Data shows wrong Z" | Find data source | Grep hooks/contexts |

---

## Detailed Verification Procedures

### 1. Missing Component Claims

**Claim pattern:** "Component X doesn't exist" / "Need to create X component"

**Verification steps:**

```bash
# Step 1: Search for component file
Glob: **/*{ComponentName}*.tsx
Glob: **/*{ComponentName}*.ts

# Step 2: Search for component in imports
Grep: import.*{ComponentName}
Grep: from.*{ComponentName}

# Step 3: Search in package exports
Grep: export.*{ComponentName}

# Step 4: If found, READ the file to understand current state
```

**Before claiming missing, must have:**
- [ ] Zero results from component file glob
- [ ] Zero results from import grep
- [ ] Zero results from export grep

---

### 2. New Implementation Claims

**Claim pattern:** "Need to create new X class/function" / "Implement X from scratch"

**Verification steps:**

```bash
# Step 1: Search for class/function exports
Grep: export.*class.*{ClassName}
Grep: export.*function.*{functionName}
Grep: export \{ {Name}

# Step 2: Check package index files
Read: packages/*/src/index.ts
Read: packages/*/index.ts

# Step 3: Check if similar functionality exists
Grep: {relatedKeyword}Registry
Grep: {relatedKeyword}Manager
Grep: {relatedKeyword}Factory
```

**Before proposing new implementation, must have:**
- [ ] Confirmed no existing export with same name
- [ ] Confirmed no existing export with similar functionality
- [ ] Documented why existing alternatives don't work (if any exist)

---

### 3. Broken Feature Claims

**Claim pattern:** "Feature X doesn't work" / "Users can't do Y"

**Verification steps:**

```bash
# Step 1: Find the UI that should trigger the feature
Glob: **/*{FeatureName}*.tsx
Glob: **/routes/*.tsx  # If it's a page-level feature

# Step 2: Read the component
Read: [component file]

# Step 3: Trace the interaction chain
- Locate button/input/trigger element
- Check onClick/onChange/onSubmit handler
- Follow handler to context/hook call
- Follow context to actual implementation
```

**Document the exact break point:**
- [ ] File path where chain breaks
- [ ] Line number of broken code
- [ ] What the code does (or doesn't do)
- [ ] What it should do instead

---

### 4. Wrong Data Claims

**Claim pattern:** "Shows wrong data" / "Data is fake/placeholder" / "Values are hardcoded"

**Verification steps:**

```bash
# Step 1: Find data source hook/context
Grep: use{FeatureName}
Grep: {Feature}Context
Grep: {Feature}Provider

# Step 2: Read the hook/context
Read: [hook/context file]

# Step 3: Trace data origin
- Where is data fetched from? (store.get, API, constant?)
- Is there sample/seed data?
- When is real data loaded?
- What conditions trigger real vs fake data?
```

**Classify the problem:**
- [ ] **Source problem:** Real data never fetched
- [ ] **Seed problem:** Fake data populated incorrectly
- [ ] **Display problem:** Real data exists but not shown
- [ ] **Timing problem:** Real data loaded too late

---

## Common Verification Patterns

### Pattern: UI Button Does Nothing

```
Symptom: User clicks button, nothing happens

Verification:
1. Read the component with the button
2. Look for onClick handler
3. If no onClick → FOUND: Button has no handler
4. If onClick exists → Trace what it calls
5. Continue tracing until you find the break
```

### Pattern: Context Method Never Called

```
Symptom: Context has method but feature doesn't work

Verification:
1. Grep for context method usage: Grep: {methodName}\(
2. If no results → FOUND: Method never called from UI
3. If results exist → Read each usage site
4. Check if the call is conditional and condition is never met
```

### Pattern: Package Export Not Used

```
Symptom: Package has feature but app doesn't use it

Verification:
1. Read package index.ts to confirm export exists
2. Grep for import of that export in consumer app
3. If no import → FOUND: Export not imported
4. If imported → Trace usage to find where it breaks
```

---

## Final Spec Validation

Before submitting any bugfix specification, validate:

### Evidence Requirements
- [ ] **Problem file identified:** Exact path provided
- [ ] **Problem line identified:** Exact line number provided
- [ ] **Current code shown:** Actual code copied, not paraphrased
- [ ] **Break point explained:** Clear statement of what's wrong

### Solution Requirements
- [ ] **Uses existing packages:** Checked for existing implementations first
- [ ] **Minimal change:** Fix is smallest change that solves problem
- [ ] **Before/after shown:** Both broken and fixed code provided
- [ ] **No phantom fixes:** Not fixing things that aren't broken

### Anti-Pattern Check
- [ ] Not claiming "missing" without searching
- [ ] Not proposing "create new" without checking packages
- [ ] Not trusting summaries over source code
- [ ] Not fixing symptoms instead of root causes
