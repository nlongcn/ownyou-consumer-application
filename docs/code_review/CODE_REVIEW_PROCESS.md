# AI-Powered Code Review Process

A comprehensive code review methodology leveraging **Claude Code** and **Gemini CLI** to evaluate codebases against requirements and roadmap specifications.

## Overview

This process uses two AI assistants in complementary roles:
- **Claude Code**: Deep architectural analysis, requirements mapping, and code quality assessment
- **Gemini CLI**: Rapid file scanning, redundancy detection, and cross-referencing

By combining both tools, we get diverse perspectives and reduce blind spots in the review.

---

## Prerequisites

### Tool Installation

```bash
# Claude Code (via npm)
npm install -g @anthropic-ai/claude-code

# Gemini CLI (via npm)
npm install -g @anthropic-ai/gemini-cli
# OR via pip
pip install gemini-cli
```

### OwnYou Project Structure

```
ownyou_consumer_application/
├── docs/
│   ├── requirements/      # Feature specs, technical requirements
│   │   ├── IAB_*.md       # IAB classification requirements
│   │   ├── *_REQUIREMENTS.md
│   │   └── *_SPEC.md
│   ├── sprints/           # Sprint specifications (primary work tracking)
│   │   ├── ownyou-sprint0-spec.md
│   │   ├── ownyou-sprint1-spec.md
│   │   └── ...
│   ├── architecture/      # v13 architecture (critical)
│   │   ├── OwnYou_architecture_v13.md
│   │   └── extracts/      # Focused sections for context loading
│   └── roadmap/           # Strategic roadmap
├── packages/              # Monorepo packages (TypeScript)
│   ├── memory-store/      # LangGraph Store implementation
│   ├── iab-classifier/    # IAB taxonomy classification
│   ├── llm-client/        # Multi-provider LLM client
│   ├── agents/            # Mission agents
│   ├── shared-types/      # Type definitions
│   └── ...                # 24+ packages
├── apps/
│   └── consumer/          # Tauri desktop app (Rust + React)
├── src/
│   ├── email_parser/      # Python email processing (legacy)
│   ├── admin-dashboard/   # Next.js dashboard
│   └── browser/           # Browser PWA code
├── tests/                 # Test suites
├── browser-extension/     # Chrome extension
└── .claude/skills/        # Claude Code skills
```

---

## The Four-Phase Review Process

### Phase 1: Context Ingestion
Load requirements and roadmap into both tools for context-aware analysis.

### Phase 2: Parallel Analysis
Run Claude Code and Gemini CLI simultaneously on different aspects.

### Phase 3: Cross-Validation
Compare findings, identify agreements and discrepancies.

### Phase 4: Report Synthesis
Combine insights into actionable review report.

---

## Phase 1: Context Ingestion

### Step 1.1: Generate Context Summary

First, create a consolidated context file that both tools can reference:

```bash
# Run the context preparation script
./docs/code_review/prepare-context.sh
```

This creates `.review-context/` with:
- `requirements-summary.md` - Consolidated requirements from `docs/requirements/`
- `sprints-summary.md` - Current sprint specs from `docs/sprints/`
- `architecture-summary.md` - v13 architecture key points
- `roadmap-summary.md` - Strategic priorities and milestones
- `package-manifest.json` - All packages with their status
- `file-manifest.json` - Complete file listing with metadata

### OwnYou-Specific Context

The context preparation also extracts:
- **STORE_NAMESPACES** from `packages/shared-types/src/namespaces.ts`
- **Memory types** from `docs/architecture/extracts/memory-types-8.4.md`
- **Sprint deliverables** from current sprint spec

---

## Phase 2: Parallel Analysis

### Claude Code Tasks

Run Claude Code with the following prompts in sequence:

#### 2A: Code Quality Assessment

```bash
claude --context .review-context/ << 'EOF'
Analyze this codebase for code quality. Reference:
- Requirements in docs/requirements/
- Current sprint spec in docs/sprints/
- v13 architecture in docs/architecture/

Evaluate:
1. **v13 Architecture Compliance**
   - LangGraph Store as single source of truth
   - Correct STORE_NAMESPACES usage
   - Memory/Episode/Entity type compliance
   - No separate databases created

2. **Privacy/Self-Sovereign**
   - All personal data device-local
   - Wallet-derived encryption
   - No centralized cloud backends
   - No raw data to external APIs

3. **Code Standards**
   - TypeScript strict mode compliance
   - Package boundary respect (no circular deps)
   - shared-types usage consistency
   - Proper exports in index.ts files

4. **Error Handling**
   - LLM fallback chains
   - Network resilience
   - Graceful degradation

5. **Testing Coverage**
   - Unit test presence per package
   - Integration test coverage
   - Test quality and assertions

6. **Security Practices**
   - Input validation at system boundaries
   - OAuth token handling
   - Sensitive data handling

Output a structured JSON report with severity ratings (critical/high/medium/low) for each finding.
EOF
```

#### 2B: Requirements & Sprint Alignment Check

```bash
claude --context .review-context/ << 'EOF'
Cross-reference the codebase against:
- docs/requirements/*.md
- docs/sprints/ownyou-sprint*-spec.md (current and recent)

For each requirement/sprint deliverable:
1. Identify which packages implement it
2. Assess implementation completeness (0-100%)
3. Note any deviations from specification
4. Flag requirements with NO corresponding implementation

Output format:
{
  "source": "sprint11-spec" | "requirements/IAB_PROFILE_SCHEMA",
  "requirement_id": "Package: iab-classifier",
  "title": "IAB Classification Pipeline",
  "status": "partial" | "complete" | "not_started",
  "completeness": 65,
  "implementing_packages": ["packages/iab-classifier", "packages/memory-store"],
  "implementing_files": ["packages/iab-classifier/src/pipeline.ts", ...],
  "gaps": ["Missing batch processing", ...],
  "deviations": ["Uses different namespace than specified"],
  "v13_compliance": true | false
}
EOF
```

### Gemini CLI Tasks

Run Gemini CLI for complementary analysis:

#### 2C: Redundancy Detection

```bash
gemini analyze << 'EOF'
Scan the codebase and identify:

1. **Duplicate Files**
   - Exact duplicates (same content, different names/locations)
   - Near-duplicates (>80% similar content)
   - Exclude: _archive/, node_modules/, .git/

2. **Dead Code**
   - Unused exports/functions in packages/
   - Unreachable code paths
   - Commented-out code blocks
   - Legacy code in src/email_parser/ not used by packages/

3. **Redundant Dependencies**
   - Unused imports
   - Duplicate functionality across packages (e.g., multiple LLM clients)
   - Overlapping libraries in package.json files
   - Types duplicated instead of imported from shared-types

4. **Orphaned Files**
   - Files not referenced anywhere
   - Outdated migration files in docs/migration/
   - Stale configuration files
   - Packages with no imports from other packages

5. **Monorepo-Specific**
   - Packages that could be consolidated
   - Circular dependencies between packages
   - Inconsistent package.json patterns

Output as JSON with file paths and confidence scores.
EOF
```

#### 2D: Sprint & Roadmap Gap Analysis

```bash
gemini analyze --files docs/sprints/ docs/roadmap/ packages/ << 'EOF'
Compare sprint and roadmap documentation against current implementation.

Identify:
1. **Completed Sprints** - Sprint items fully implemented
2. **Current Sprint Progress** - Status of current sprint deliverables
3. **Not Started** - Sprint/roadmap items with no code presence
4. **Unplanned Code** - Implementations not in any sprint spec
5. **Deferred Items** - Items moved to docs/DEFERRED.md

For each gap, estimate:
- Complexity (low/medium/high)
- Dependencies on other packages
- Suggested priority based on sprint timeline
- v13 architecture alignment

Cross-reference with:
- docs/requirements/ for specification quality
- docs/architecture/OwnYou_architecture_v13.md for compliance
EOF
```

---

## Phase 3: Cross-Validation

### 3.1: Merge Reports

```bash
# Combine outputs from both tools
./docs/code_review/merge-reports.sh \
  --claude-output .review-output/claude-*.json \
  --gemini-output .review-output/gemini-*.json \
  --output .review-output/merged-report.json
```

### 3.2: Discrepancy Resolution

Run a final pass to resolve conflicting findings:

```bash
claude << 'EOF'
Review the merged findings in .review-output/merged-report.json

For any conflicting assessments between Claude and Gemini:
1. Analyze the specific code in question
2. Determine which assessment is more accurate
3. Provide reasoning for the resolution
4. Check v13 architecture compliance for any disputed items

Flag items needing human review if uncertainty remains high.
Prioritize based on current sprint deliverables.
EOF
```

---

## Phase 4: Report Synthesis

### Output Structure

The final report (`CODE_REVIEW_REPORT.md`) contains:

```markdown
# Code Review Report
Generated: [timestamp]
Repository: ownyou_consumer_application
Current Sprint: [sprint-number]
Reviewed by: Claude Code + Gemini CLI

## Executive Summary
- Overall Health Score: X/100
- v13 Architecture Compliance: X%
- Critical Issues: N
- High Priority Items: N
- Sprint Progress: X% complete
- Requirements Coverage: X%

## A. v13 Architecture Compliance
### Critical Violations
### Store Namespace Issues
### Memory Type Issues
### Privacy/Self-Sovereign Violations

## B. Code Quality Assessment
### Critical Issues
### High Priority
### Medium Priority
### Low Priority/Suggestions

## C. Redundant Files & Folders
### Recommended Deletions
### Package Consolidation Opportunities
### Dead Code in Legacy (src/email_parser/)
### Unused Packages

## D. Sprint & Roadmap Gaps
### Current Sprint Missing Items
### Roadmap Items Not Started
### Technical Debt Items
### Suggested Priority Order

## E. Poorly Specified Areas
### Sprint Specs Needing Clarification
### Ambiguous Requirements
### Missing Acceptance Criteria
### Recommendations for Documentation

## Appendix
### Package-by-Package Analysis
### Sprint Deliverable Matrix
### Tool Confidence Scores
```

---

## Automation Scripts

See the `docs/code_review/` folder for:
- `prepare-context.sh` - Context preparation (TODO: create)
- `run-claude-review.sh` - Claude Code analysis
- `run-gemini-review.sh` - Gemini CLI analysis
- `merge-reports.sh` - Report combination (TODO: create)
- `full-review.sh` - Complete pipeline runner

---

## Usage

### Quick Start (Full Review)

```bash
# From project root
./docs/code_review/full-review.sh

# OwnYou recommended options
./docs/code_review/full-review.sh \
  --requirements-dir docs/requirements \
  --roadmap-dir docs/sprints \
  --architecture-dir docs/architecture \
  --output-dir .review-output \
  --report-format markdown
```

### Individual Phases

```bash
# Just code quality & v13 compliance
./docs/code_review/run-claude-review.sh --mode quality

# Just redundancy check
./docs/code_review/run-gemini-review.sh --mode redundancy

# Just sprint gap analysis
./docs/code_review/run-gemini-review.sh --mode gaps
```

### Package-Specific Review

```bash
# Review single package
./docs/code_review/full-review.sh --package packages/iab-classifier

# Review multiple related packages
./docs/code_review/full-review.sh --packages "packages/memory-store,packages/shared-types"
```

---

## Customization

### Adding Custom Review Criteria

Edit `.review-config.yaml`:

```yaml
review_criteria:
  code_quality:
    - custom_check: "Verify v13 Store namespace usage"
      severity: critical
    - custom_check: "Check for centralized cloud backend usage"
      severity: critical
    - custom_check: "Verify wallet-based authentication"
      severity: high
    - custom_check: "Check for hardcoded secrets"
      severity: critical

  requirements_mapping:
    requirement_patterns:
      - "sprint*-spec.md"
      - "*_REQUIREMENTS.md"
      - "*_SPEC.md"

  redundancy:
    ignore_patterns:
      - "*.test.ts"
      - "__mocks__/*"
      - "*.stories.tsx"
      - "_archive/*"
      - "research_spike/*"

  packages:
    critical:
      - "packages/memory-store"
      - "packages/shared-types"
    high:
      - "packages/iab-classifier"
      - "packages/llm-client"
```

### Tool-Specific Prompts

Customize prompts in `docs/code_review/`:
- `claude-prompts.md` - All Claude prompts (quality, requirements, architecture)

---

## Best Practices

1. **Sprint-aligned reviews** - Run full review before marking sprint complete
2. **Package-focused PRs** - Review individual packages for focused changes
3. **v13 compliance first** - Architecture violations are blocking issues
4. **Human oversight** - AI identifies issues, humans prioritize based on sprint goals
5. **Update sprint specs** - Use "poorly specified" findings to improve next sprint
6. **Track deferred items** - Move low-priority issues to docs/DEFERRED.md

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Large codebase timeout | Use `--package` flag to analyze one package at a time |
| Missing context | Ensure docs/sprints/ and docs/architecture/ exist |
| Conflicting results | Increase cross-validation passes |
| Low confidence scores | Add more specific prompts from v13 architecture |
| Monorepo complexity | Use `--packages` to focus on related packages only |
| Legacy code noise | Add src/email_parser/ to ignore patterns |
