# AI Assistant Development Guide

**Purpose:** Comprehensive development workflows for AI assistants working on OwnYou.

**Note:** This document contains detailed protocols moved from CLAUDE.md. The main CLAUDE.md is kept minimal (~120 lines) for efficient context loading.

---

## Table of Contents

1. [Documentation Organization](#documentation-organization)
2. [Working with Legacy Code](#working-with-legacy-code)
3. [Git Workflow Discipline](#git-workflow-discipline)
4. [Python to TypeScript Migration](#python-to-typescript-migration)
5. [Testing Discipline (TDD)](#testing-discipline-tdd)
6. [Self-Sovereign Architecture](#self-sovereign-architecture)
7. [Repository Structure](#repository-structure)
8. [Keeping Documentation Current](#keeping-documentation-current)

---

## Documentation Organization

### `/docs/requirements/` - WHAT to Build
The source of truth for requirements, vision, and specifications.

**Contains:**
- Complete consumer app requirements
- Project vision and user experiences
- Advertising MVP specifications
- BBS+ Pseudonym specifications
- Ikigai concept documentation

**When to add here:**
- New feature requirements
- User story updates
- Vision refinements
- External technology research (BBS+, etc.)

### `/docs/reference/` - HOW to Build
Technical implementation guides, patterns, and decisions.

**Contains:**
- Architectural decisions (6 critical decisions)
- Development guidelines (before-coding checklist)
- Current system documentation
- Project structure

**When to add here:**
- New architectural decision made
- Development pattern established
- Technical reference needed

### `/docs/plans/` - WHEN to Build
Roadmaps, implementation plans, and phase-by-phase designs.

**Contains:**
- Strategic roadmap (7 phases)
- Mission Agents architecture
- Integration plans
- Phase-specific implementation plans

### `/docs/sprints/` - Current Work
Sprint specifications with packages and acceptance criteria.

---

## Working with Legacy Code

**Email Parser (`src/email_parser/`) is WORKING production code. Respect it.**

The email_parser system is already in production, processing emails for IAB classification.

### CRITICAL: Python-First Debugging Protocol

**"Every time you hit a bug, EVERY TIME, you need to check the Python code."**

When encountering ANY bug in migrated TypeScript code:

1. **STOP** - Do not attempt to fix the bug immediately
2. **Check Python source** - Find the corresponding Python implementation
3. **Compare behavior** - How does Python handle this scenario?
4. **Verify the port** - Is the TypeScript a faithful 1:1 port?
5. **Fix based on Python** - Fix TypeScript to match Python

**Use:** `migration-verification` skill BEFORE fixing ANY bug in migrated code

### When to Use vs. When to Change

✅ **Use existing patterns for:**
- IAB classification workflows
- Batch processing
- LangGraph workflows
- Store integration
- Multi-provider LLM

⚠️ **Change carefully when:**
- Fixing production bugs (full testing required)
- Adding multi-source support
- Optimizing performance (benchmark before/after)

❌ **Never change:**
- Working batch optimizer without benchmarks
- Production OAuth flows
- LangGraph Studio integration

---

## Git Workflow Discipline

**MANDATORY 5-step workflow:**

1. **Branch**: `git checkout -b feature/name` (never work on master)
2. **Test**: Test at EVERY checkpoint (not just before commit)
3. **Commit**: After each logical unit (`git commit -m "feat: message"`)
4. **Push**: Regularly (`git push origin feature/name`)
5. **Merge**: After full verification (tests, type check, lint, review)

**For AI Assistants - Include git steps in TodoWrite:**
```python
todos = [
    {"content": "Create feature branch", "status": "completed", "activeForm": "Creating feature branch"},
    {"content": "Implement X + test", "status": "in_progress", "activeForm": "Implementing X"},
    {"content": "Commit", "status": "pending", "activeForm": "Committing"},
    {"content": "Push", "status": "pending", "activeForm": "Pushing"},
    {"content": "Full verification", "status": "pending", "activeForm": "Verifying"},
    {"content": "Create PR", "status": "pending", "activeForm": "Creating PR"},
]
```

**Skills:** `git-workflow-discipline`

---

## Python to TypeScript Migration

### The Iron Law

**NEVER claim migration complete without line-by-line source verification documented in writing.**

### Non-Negotiable Rules

1. **Always Full Port** - Never simplified implementations
2. **Line-by-Line Verification BEFORE Claiming Success**
3. **Document Review Findings** - Create `/tmp/migration_review.md` with EVIDENCE
4. **Use Migration Skill** - At EVERY step
5. **No Trade-offs** - ALL parameters ported (even if unused)
6. **Port Dependencies First** - All dependencies before the component

### Migration Protocol (Mandatory)

For EVERY component being migrated:

1. **Read Python source** - Complete file(s), ALL lines
2. **Extract structure** - All classes, functions, parameters in tables
3. **Write TypeScript** - With `// Python line N` comments
4. **Create verification table** - Parameter-by-parameter comparison
5. **Document findings** - Record in `/tmp/migration_review.md`
6. **Fix ALL issues** - Even "unused" parameters
7. **VERIFY COMPILATION** - `npx tsc --noEmit` MUST have zero errors
8. **Show user evidence** - Review document BEFORE claiming completion

### Two-Phase Verification (MANDATORY)

**Phase 1: Source Verification**
- Line-by-line comparison against Python source
- Parameter-by-parameter function signature verification
- ALL constants, helpers, exports verified

**Phase 2: Build Verification**
```bash
npx tsc --noEmit    # MUST output zero errors
npm test            # Tests pass
```

### Red Flags = STOP IMMEDIATELY

- ❌ "This parameter isn't needed in TypeScript" → **PORT IT ANYWAY**
- ❌ "Tests pass, so port is correct" → **VERIFY SOURCE FIRST**
- ❌ "I remember the Python code" → **RE-READ IT**

**Skills:** `python-typescript-migration`, `typescript-verification`

---

## Testing Discipline (TDD)

**MANDATORY RED-GREEN-REFACTOR for ALL code:**

1. **RED**: Write test first → Must FAIL
2. **GREEN**: Minimal code → Test PASSES
3. **REFACTOR**: Improve code → Test still PASSES

**Test at checkpoints:**
- After writing test (FAILS)
- After implementation (PASSES)
- Before committing (full suite)
- Before PR (coverage >70%)

**Frontend:** Use Playwright MCP tools (`mcp__playwright__browser_*`)
- Navigate, click, type, wait, snapshot, check console
- ALL UI testing via MCP

**For AI Assistants:**
- NEVER mark complete without running test
- NEVER skip RED phase
- ALWAYS show test results

**Skills:** `testing-discipline`

---

## Self-Sovereign Architecture

**CRITICAL:** OwnYou follows a **self-sovereign, local-first architecture**.

**Deployment Models (ALL are self-sovereign):**
- ✅ **Browser-Based PWA** - Data in IndexedDB, processing in browser
- ✅ **Tauri Desktop** - SQLite + SQLCipher, local processing
- ✅ **Hybrid** - Python agent (localhost) + browser UI

**What Violates Self-Sovereignty:**
- ❌ Centralized cloud backend storing user personal data
- ❌ SaaS model with PostgreSQL containing OAuth tokens, emails

### Never Do This ❌
- Build centralized cloud backend for personal data
- Send user data to OwnYou-controlled servers
- Create separate databases (use LangGraph Store)
- Send raw personal data to external APIs without encryption

### Always Do This ✅
- Keep ALL personal data on user's device
- Use LangGraph Store (IndexedDB or SQLite)
- Use wallet-derived encryption keys
- Get explicit user consent before data sharing

---

## Repository Structure

```
ownyou_consumer_application/
│
├── CLAUDE.md                          # Navigation hub (~120 lines)
│
├── docs/
│   ├── sprints/                       # Sprint specifications ⭐
│   │   └── ownyou-sprint0-spec.md     # Current sprint
│   │
│   ├── architecture/                  # Architecture docs
│   │   ├── OwnYou_architecture_v13.md # Full architecture (~7000 lines)
│   │   └── extracts/                  # Loadable sections ⭐
│   │       ├── memory-types-8.4.md
│   │       ├── namespaces-8.12.md
│   │       ├── storage-backends-8.13.md
│   │       ├── llm-cost-6.10.md
│   │       └── sync-8.14.md
│   │
│   ├── requirements/                  # WHAT to build
│   ├── reference/                     # HOW to build
│   │   └── AI_ASSISTANT_GUIDE.md      # This file
│   └── plans/                         # WHEN to build
│
├── .claude/
│   ├── skills/                        # Development skills
│   │   ├── sprint-mode/
│   │   ├── implement-package/
│   │   ├── v13-compliance-check/
│   │   ├── git-workflow-discipline/
│   │   ├── testing-discipline/
│   │   └── python-typescript-migration/
│   │
│   └── commands/                      # Slash commands
│       └── start-sprint.md
│
├── src/
│   ├── browser/                       # JavaScript PWA
│   │   ├── store/                     # IndexedDBStore
│   │   ├── agents/iab-classifier/     # IAB agents
│   │   └── llm/                       # LLM clients
│   └── email_parser/                  # Python (legacy, working)
│
└── tests/
```

---

## Keeping Documentation Current

### When Requirements Change
1. Update relevant file in `/docs/requirements/`
2. Add date/version to document history
3. Check if architectural decisions need updates
4. Update implementation plans

### When Architecture Evolves
1. Update relevant file in `/docs/architecture/`
2. Update extracts if affected sections change
3. Update skills if patterns change

### When Sprint Changes
1. Update sprint spec in `/docs/sprints/`
2. Update CLAUDE.md "Current Sprint" section

### When Code Implementation Completes
1. Update sprint status
2. Mark package as complete
3. Document new patterns in reference/

---

## Quick Reference

### Before Writing Code Checklist

1. **Read current sprint spec** - `docs/sprints/ownyou-sprint0-spec.md`
2. **Load relevant architecture extracts** - `docs/architecture/extracts/`
3. **Use sprint-mode skill** - Enforces workflow
4. **Check for existing code** - Don't reinvent

### Commands

```bash
# Browser PWA development
cd src/admin-dashboard && npm run dev
npm test
npx tsc --noEmit

# Python (legacy)
pytest tests/integration/
langgraph dev
```

### Key Skills

| Skill | Purpose |
|-------|---------|
| `sprint-mode` | Sprint workflow enforcement |
| `implement-package` | Package implementation guide |
| `v13-compliance-check` | Architecture compliance |
| `git-workflow-discipline` | Git workflow |
| `testing-discipline` | TDD enforcement |
| `python-typescript-migration` | Migration protocol |

---

**Last Updated:** 2025-12-01
