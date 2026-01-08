# AI Code Review Process

A dual-AI code review system using **Claude Code** and **Gemini CLI** to perform comprehensive codebase analysis against requirements and roadmap documentation.

## Quick Start: Use the Skill

If you're already in Claude Code, the easiest way to run a review is:

```
/code-review
```

This invokes the `code-review` skill which performs a comprehensive review using Claude's native capabilities. See `.claude/skills/code-review/SKILL.md` for details.

## Shell Scripts (CI/CD or External Use)

For running reviews outside of Claude Code (CI pipelines, cron jobs, or Gemini integration), use the shell scripts below.

## Quick Start (OwnYou)

```bash
# From project root
cd /Volumes/T7_new/developer_old/ownyou_consumer_application

# Make scripts executable
chmod +x docs/code_review/*.sh

# Run the full review
./docs/code_review/full-review.sh
```

### OwnYou Project Structure

```
ownyou_consumer_application/
├── docs/
│   ├── requirements/           # Feature specs, technical requirements
│   ├── sprints/                # Sprint specifications (current work)
│   ├── roadmap/                # Strategic roadmap
│   └── architecture/           # v13 architecture (critical)
├── packages/                   # Monorepo packages (24+)
│   ├── iab-classifier/         # IAB taxonomy classification
│   ├── memory-store/           # LangGraph Store implementation
│   ├── llm-client/             # Multi-provider LLM client
│   ├── agents/                 # Mission agents
│   └── ...                     # See full list below
├── apps/
│   └── consumer/               # Tauri desktop app
├── src/
│   ├── email_parser/           # Python email processing (legacy)
│   ├── admin-dashboard/        # Next.js dashboard
│   └── browser/                # Browser PWA code
├── tests/                      # Test suites
├── browser-extension/          # Chrome extension
└── .claude/skills/             # Claude Code skills
```

## What It Reviews

| Category | Claude Code | Gemini CLI |
|----------|-------------|------------|
| **A. Code Quality** | Architecture, standards, security, testing | - |
| **B. Redundancy** | - | Duplicates, dead code, orphans |
| **C. Work Needed** | Requirements gaps | Roadmap gaps |
| **D. Specifications** | - | Ambiguity, conflicts, missing criteria |

## Output

After running, find results in `.review-output/`:

```
.review-output/
├── CODE_REVIEW_REPORT.md    # Human-readable report
├── claude-quality.json      # Detailed quality findings
├── claude-requirements.json # Requirements mapping
├── claude-architecture.json # Architecture analysis (v13 compliance)
├── claude-sprints.json      # Sprint progress tracking
├── gemini-redundancy.json   # Duplicate/dead code
├── gemini-gaps.json         # Roadmap gaps
├── gemini-specification.json # Spec quality issues
└── merged-report.json       # Combined metadata
```

## Options

```bash
# Run specific analyses only
./docs/code_review/full-review.sh --claude-only
./docs/code_review/full-review.sh --gemini-only

# Parallel execution (faster)
./docs/code_review/full-review.sh --parallel

# Include sprint specs in review (recommended for OwnYou)
./docs/code_review/full-review.sh \
  --requirements-dir docs/requirements \
  --roadmap-dir docs/sprints \
  --architecture-dir docs/architecture \
  --output-dir .review-output

# Review specific package
./docs/code_review/full-review.sh --package packages/iab-classifier

# Skip context prep (reuse previous)
./docs/code_review/full-review.sh --skip-context
```

## Prerequisites

Install one or both AI CLI tools:

```bash
# Claude Code
npm install -g @anthropic-ai/claude-code

# Gemini CLI
npm install -g @google/gemini-cli
# or
pip install gemini-cli
```

## Documentation

- [Full Process Guide](CODE_REVIEW_PROCESS.md) - Detailed methodology
- [Claude Prompts](claude-prompts.md) - Reusable prompt templates
- [Customization Guide](CODE_REVIEW_PROCESS.md#customization) - Adapt to your project

## OwnYou-Specific Review Areas

| Area | Key Concerns |
|------|--------------|
| **v13 Architecture Compliance** | Store namespaces, memory types, single source of truth |
| **Privacy/Self-Sovereign** | No centralized backends, wallet-based auth, device-local data |
| **IAB Classification** | Taxonomy accuracy, BBS+ pseudonym handling |
| **Mission Agents** | Trigger mechanisms, card generation, user utility |
| **Monorepo Structure** | Package boundaries, shared-types usage, circular deps |

## Workflow Integration

### PR Reviews
```bash
# Quick review on changes
git diff main... | claude "Review these changes for v13 compliance and OwnYou patterns"

# Sprint-focused review
git diff main... | claude "Review against docs/sprints/ownyou-sprint11-spec.md"
```

### CI Integration
```yaml
# .github/workflows/review.yml
- name: AI Code Review
  run: ./docs/code_review/full-review.sh --parallel

- name: Upload Report
  uses: actions/upload-artifact@v3
  with:
    name: code-review
    path: .review-output/
```

### Scheduled Reviews
```yaml
# Weekly comprehensive review
schedule:
  - cron: '0 9 * * 1'  # Monday 9am
```

### Sprint Completion Review
```bash
# Before marking sprint complete
./docs/code_review/full-review.sh --roadmap-dir docs/sprints --claude-only
```

## Best Practices

1. **Review against sprint specs** - OwnYou uses sprint-based development, so always include `docs/sprints/`
2. **Check v13 compliance** - Use the architecture extracts in `docs/architecture/extracts/`
3. **Per-package reviews** - For focused work, review individual packages
4. **Human validation** - AI identifies issues, humans prioritize based on sprint goals
5. **Track trends** - Compare reports over time for improvement
6. **Update specs** - Use "poorly specified" findings to improve sprint docs

## Key OwnYou Packages

```
packages/
├── memory-store/       # LangGraph Store - CRITICAL (single source of truth)
├── iab-classifier/     # IAB taxonomy - revenue generation
├── llm-client/         # Multi-provider LLM - cost management
├── agents/             # Mission agents - user utility
├── shared-types/       # Type definitions - consistency
├── oauth/              # OAuth flows - authentication
├── email/              # Email processing
├── triggers/           # Event triggers
├── reflection/         # Self-reflection
├── resilience/         # Fault tolerance
├── ui-components/      # React components
└── ui-design-system/   # Design tokens
```
