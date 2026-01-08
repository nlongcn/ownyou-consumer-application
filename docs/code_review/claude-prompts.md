# Claude Code Review Prompts

Reusable prompts for OwnYou code review tasks. Copy and paste into Claude Code.

---

## Quick Quality Check

Fast assessment for PR reviews:

```
Review this code change for:
1. v13 architecture violations (Store namespaces, memory types)
2. Privacy violations (centralized backends, data leaks)
3. Obvious bugs or logic errors
4. Security concerns (injection, auth bypass, data exposure)
5. Missing error handling

Be concise. Only flag issues, don't explain good patterns.
Output format: severity (critical/high/medium) | file:line | issue
```

---

## v13 Architecture Compliance

For major refactors or new modules:

```
Analyze this code against OwnYou v13 architecture (docs/architecture/OwnYou_architecture_v13.md):

1. **Store Usage**
   - Is LangGraph Store the single source of truth?
   - Are STORE_NAMESPACES from shared-types used correctly?
   - Are Memory/Episode/Entity types used properly?

2. **Privacy/Self-Sovereign**
   - Is all personal data kept device-local?
   - Are wallet-derived encryption keys used?
   - Any centralized cloud backends created?
   - Any raw data sent to external APIs?

3. **Package Boundaries**
   - Are package imports going through index.ts?
   - Any circular dependencies between packages?
   - Is shared-types used for cross-package types?

4. **Dual-Purpose Architecture**
   - IAB classification flow correct?
   - Mission agents triggered by Store updates?
   - BBS+ pseudonym handling correct?

Map the data flow for IAB classification → Mission card generation.
Identify v13 compliance issues by severity.
```

---

## Sprint & Requirements Mapping

Cross-reference code against specs:

```
I have:
- Sprint specs in docs/sprints/ownyou-sprint*-spec.md
- Requirements in docs/requirements/
- Packages in packages/

For each sprint deliverable:
1. Find the implementing package(s)
2. Rate completeness (0-100%)
3. Note deviations from spec
4. Flag unimplemented deliverables

For each requirement:
1. Map to implementing packages
2. Check v13 compliance
3. Note any deferred items (should be in docs/DEFERRED.md)

Also find packages with NO matching sprint/requirement (potential scope creep).

Output as table: Sprint/Req | Package | Status | Completeness | Gaps
```

---

## Security Audit

Focused security review for self-sovereign architecture:

```
Security audit this codebase for:

Self-Sovereign Compliance:
- All personal data device-local (IndexedDB/SQLite)?
- Wallet-derived encryption keys used?
- No centralized cloud backends for personal data?
- Raw data never sent to external APIs?

Authentication:
- OAuth token handling in packages/oauth/
- Wallet-based authentication
- Session management in Tauri app

Authorization:
- Resource-level permissions
- Privilege escalation paths
- BBS+ pseudonym handling

Data Protection:
- Input validation at system boundaries
- Encryption at rest
- Sensitive data in logs/errors
- IAB profile data handling

Secrets:
- Hardcoded credentials
- API keys in code (should be in .env)
- Insecure configuration

Rate severity: Critical (privacy violation) / High (security issue) / Medium (should fix)
```

---

## Test Coverage Analysis

Evaluate testing quality:

```
Analyze the test suite for the OwnYou monorepo:

For each package in packages/:
1. Coverage estimate (not just lines)
2. Test quality assessment:
   - Are assertions meaningful?
   - Are edge cases covered?
   - Are mocks appropriate for LLM calls?
3. Missing test categories:
   - Unit tests in packages/*/src/__tests__/
   - Integration tests in packages/integration-tests/
   - Browser tests for Tauri app

Critical packages to prioritize:
- packages/memory-store/ - Store operations
- packages/iab-classifier/ - Classification accuracy
- packages/llm-client/ - Fallback chains
- packages/agents/ - Mission agent behavior

Prioritize: What tests would catch v13 architecture violations?
```

---

## Technical Debt Inventory

Find what needs paying down:

```
Catalog technical debt in the OwnYou monorepo:

Look for:
- TODO/FIXME/HACK comments in packages/
- Legacy code in src/email_parser/ that should be migrated
- Deprecated patterns or dependencies
- Copy-paste code between packages (should be in shared-types)
- Overly complex functions (cyclomatic complexity)
- Missing abstractions
- Outdated dependencies in package.json files
- Items already tracked in docs/DEFERRED.md

For each item:
- Location (package + file)
- Description
- v13 compliance impact
- Effort to fix (hours)
- Impact of fixing (high/medium/low)
- Sprint recommendation

Group by:
- Quick wins (< 1 hour)
- Sprint work (1-8 hours)
- Major refactors (> 8 hours)
- Already deferred (in docs/DEFERRED.md)
```

---

## Package API Review

For OwnYou package interfaces:

```
Review this package's public API for:

Design:
- Clear exports in index.ts
- Consistent naming with other packages
- Types exported from shared-types where appropriate
- No circular dependencies

Documentation:
- JSDoc comments on public functions
- README.md in package root
- Usage examples

Implementation:
- Validation on inputs
- Proper error handling with typed errors
- LLM fallback chains (for llm-client)
- Store operations use correct namespaces
- Async operations handle failures gracefully

Integration:
- Can be imported by other packages cleanly
- No side effects on import
- Proper tree-shaking support

List exports that need attention with specific issues.
```

---

## Dependency Audit

Review package dependencies:

```
Audit dependencies across the OwnYou monorepo:

Check root package.json and each packages/*/package.json:

1. Security vulnerabilities (npm audit)
2. Outdated packages (major versions behind)
3. Unused dependencies (declared but not imported)
4. Duplicate dependencies across packages
5. Inconsistent versions of same package
6. License concerns (GPL in MIT project, etc.)
7. Bundle size impact for apps/consumer/

Special attention:
- LLM provider SDKs (openai, anthropic, google-generativeai)
- LangGraph/LangChain versions
- Tauri/Rust dependencies in apps/consumer/src-tauri/

Recommend: Keep, Update, Remove, Consolidate for each concern.
```

---

## Sprint Completion Checklist

Sprint readiness review:

```
Sprint completion review against current sprint spec in docs/sprints/:

Functionality:
- All sprint deliverables implemented?
- Known bugs cataloged in docs/bugfixing/?
- Deferred items moved to docs/DEFERRED.md?

v13 Compliance:
- LangGraph Store as single source of truth?
- All personal data device-local?
- Correct STORE_NAMESPACES usage?
- No privacy violations?

Quality:
- Test coverage adequate for all packages touched?
- Performance acceptable?
- Error handling with LLM fallbacks?

Packages:
- All modified packages build?
- No circular dependencies introduced?
- shared-types updated if needed?

Documentation:
- Sprint spec updated with completion status?
- Package READMEs current?
- Architecture docs still accurate?

Output as checklist with status and blockers for sprint sign-off.
```

---

## Usage

### In Claude Code CLI:

```bash
# Direct prompt
claude "Review this code for v13 compliance..."

# Quick PR review
git diff main... | claude "Quick quality check for this change"

# Sprint-focused review
claude "Review packages/iab-classifier against docs/sprints/ownyou-sprint11-spec.md"
```

### In Conversation:

Simply paste the relevant prompt when starting a review conversation in Claude Code.

---

## OwnYou-Specific Quick Prompts

### IAB Classifier Review
```
Review packages/iab-classifier for:
1. Taxonomy accuracy
2. Batch processing capability
3. Store namespace usage (should use STORE_NAMESPACES.iab)
4. Evidence judge integration
```

### Mission Agent Review
```
Review packages/agents for:
1. Trigger mechanisms (Store updates → agent activation)
2. Mission card generation
3. User utility focus
4. Integration with iab-classifier output
```

### Memory Store Review
```
Review packages/memory-store for:
1. LangGraph Store as single source of truth
2. All STORE_NAMESPACES implemented
3. Memory/Episode/Entity type compliance
4. IndexedDB/SQLite backend support
```

### OAuth Flow Review
```
Review packages/oauth for:
1. Token handling security
2. Deep link handling (ownyou://)
3. Tauri app integration
4. No tokens sent to unauthorized endpoints
```
