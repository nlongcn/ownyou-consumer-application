---
name: bugfix-specification-discipline
description: Enforce source-code verification when writing bugfix specifications or analyzing broken code. This skill prevents writing fixes for non-existent problems by requiring actual file reads, grep searches, and code path tracing before claiming anything is missing or broken. Use when writing bugfix reports, analyzing what's broken, or planning fixes for existing code.
---

# Bugfix Specification Discipline

This skill enforces rigorous source-code verification when analyzing broken code or writing bugfix specifications. It prevents the common failure mode of writing solutions for problems that don't exist.

## Why This Skill Exists

Without this discipline, bugfix specifications fail in predictable ways:

| Failure Mode | Example | Prevention |
|--------------|---------|------------|
| Claiming components missing | "IkigaiWheel doesn't exist" when it's imported on line 1 | Read the file first |
| Proposing new implementations | "Create AgentRegistry" when package already exports one | Grep packages first |
| Misdiagnosing symptoms | "No data connection UI" when buttons exist but have no onClick | Trace code paths |
| Trusting conversation summaries | Accepting "Profile shows placeholder" without verification | Always verify claims |

## Mandatory Verification Protocol

Before writing ANY claim about what's broken or missing, complete this checklist:

### For "Component X is missing" claims:

```
1. Glob for the component name:
   Glob: **/*{ComponentName}*.tsx

2. Grep for imports of the component:
   Grep: import.*ComponentName

3. If found, READ the file that uses it to understand actual state
```

### For "Need to create new X" claims:

```
1. Search existing packages for similar functionality:
   Grep: export.*{ClassName}|export.*{functionName}

2. Read package index.ts files:
   Read: packages/*/src/index.ts

3. If it exists, document how to USE it instead of creating new
```

### For "Feature Y doesn't work" claims:

```
1. Find the UI component that should trigger it:
   Glob: **/*.tsx matching feature area

2. Read the component and trace the onClick/onChange handlers:
   - Does the button have an onClick?
   - Does onClick call the context method?
   - Does the context method do the right thing?

3. Document the EXACT line where the chain breaks
```

### For "Data shows wrong values" claims:

```
1. Find the hook/context that provides the data:
   Grep: use{FeatureName}|{Feature}Context

2. Read the data flow:
   - Where does data come from? (store.get, API, hardcoded?)
   - Is sample/mock data being seeded?
   - Is the real data source ever called?

3. Document whether it's a data SOURCE problem or DISPLAY problem
```

## Bugfix Specification Template

Every bugfix spec MUST include:

### 1. Problem Statement with Evidence

```markdown
**Problem:** [One sentence description]

**Verified By:**
- File: `path/to/file.tsx`
- Line: [exact line number]
- Current Code:
\`\`\`typescript
// Paste the actual broken code
\`\`\`

**Why This Is Wrong:**
[Explain what should happen vs what does happen]
```

### 2. Root Cause (Not Symptom)

```markdown
**Symptom:** [What user sees]
**Root Cause:** [What code does wrong]
**Evidence:** [File:line showing the break]
```

### 3. Fix with Before/After

```markdown
**Current Code (BROKEN):**
\`\`\`typescript
// path/to/file.tsx:123
<button className="...">Connect</button>  // No onClick!
\`\`\`

**Fixed Code:**
\`\`\`typescript
// path/to/file.tsx:123
<button onClick={() => connectSource(sourceId)} className="...">Connect</button>
\`\`\`
```

## Anti-Patterns to Avoid

### NEVER do these:

1. **Claim something is missing without searching for it**
   - Wrong: "There's no IkigaiWheel component"
   - Right: `Glob **/*Ikigai*.tsx` then Found in ui-components, imported in Profile.tsx

2. **Propose creating something without checking if it exists**
   - Wrong: "Create a new AgentRegistry class"
   - Right: `Grep export.*AgentRegistry` then Found in @ownyou/triggers

3. **Trust conversation summaries over source code**
   - Wrong: "The summary says Profile shows placeholder, so..."
   - Right: `Read Profile.tsx` then Actually imports real IkigaiWheel component

4. **Diagnose UI problems without reading the UI code**
   - Wrong: "Users can't connect data sources, need to add UI"
   - Right: `Read Settings.tsx` then DataSourceCard exists, button on line 269 has no onClick

5. **Write fixes for symptoms instead of root causes**
   - Wrong: "Mission feed is empty, need to add sample missions"
   - Right: "agentFactory returns null (TriggerContext.tsx:95), so agents never run"

## Verification Checklist (Use Before Finalizing Any Spec)

Before submitting a bugfix specification, verify:

- [ ] Every "missing" claim verified with Glob search
- [ ] Every "create new" proposal checked against existing packages
- [ ] Every broken feature traced to exact file:line
- [ ] Current broken code shown (not paraphrased)
- [ ] Fix shows exact code change needed
- [ ] No solutions for problems that don't exist

## Example: Correct vs Incorrect Specification

### INCORRECT (What Happens Without This Discipline):

```markdown
### Bugfix: IkigaiWheel Missing

**Problem:** Profile page shows placeholder instead of Ikigai wheel.

**Solution:** Create new IkigaiWheel component in src/components/
```

### CORRECT (After Verification):

```markdown
### Bugfix: Profile Shows Fake Data

**Problem:** Profile shows SAMPLE_IKIGAI data instead of real inference results.

**Verified By:**
- File: `apps/consumer/src/hooks/useProfile.ts`
- Line: 96
- Current Code:
\`\`\`typescript
await store.put(ikigaiNamespace, 'scores', SAMPLE_IKIGAI);
\`\`\`

**Root Cause:** seedSampleProfile() on line 86-121 populates fake data on first load.

**Note:** IkigaiWheel component ALREADY EXISTS in @ownyou/ui-components and is
correctly imported in Profile.tsx line 1. The component is fine - the DATA is fake.

**Fix:** Remove seedSampleProfile(), add hasRealData flag, show empty state for new users.
```

## When To Use This Skill

Invoke this skill when:
- Writing any bugfix specification document
- Analyzing what's broken in a codebase
- Planning fixes for existing features
- Reviewing someone else's bugfix claims
- Any time about to claim something is "missing" or "broken"

The discipline is simple: **Read the code before writing about it.**
