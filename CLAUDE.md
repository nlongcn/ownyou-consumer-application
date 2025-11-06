# CLAUDE.md

**Project:** OwnYou Consumer Application - Privacy-first personal AI with dual-purpose architecture (advertising revenue + user utility)

**CRITICAL:** This is NOT just an email parser. This is a complete consumer application with IAB Taxonomy classification AND Mission Agents for personalized user missions.

---

## 🎯 Quick Start

### What You Need to Know Immediately

**Dual-Purpose Architecture:**
- **IAB Classification** → Advertising revenue via BBS+ pseudonyms
- **Mission Agents** → User utility via personalized mission cards

**Single Source of Truth:** LangGraph Store (shared between IAB and Missions)

**Development Strategy:** Horizontal layers (Phase 1-7, see Strategic Roadmap)

**Current Status:** Phase 1 (Foundation & Contracts) in progress

---

## 📚 Documentation Organization

**Understanding where documentation lives and where to add new docs:**

### `/docs/requirements/` - WHAT to Build
**The source of truth for requirements, vision, and specifications.**

Contains:
- Complete consumer app requirements
- Project vision and user experiences
- Advertising MVP specifications
- BBS+ Pseudonym specifications
- Ikigai concept documentation
- LangGraph Memory documentation
- Architecture evolution diagrams

**When to add here:**
- New feature requirements
- User story updates
- Vision refinements
- External technology research (BBS+, etc.)

**When updating requirements:**
1. Update the specific requirement document
2. Add date and version to document history
3. Check if architectural decisions need updates
4. Verify implementation plans reflect changes

### `/docs/reference/` - HOW to Build
**Technical implementation guides, patterns, and decisions.**

Contains:
- Architectural decisions (6 critical decisions)
- Development guidelines (before-coding checklist)
- Current system documentation (what's working now)
- Project structure (file organization)
- Technical references (Checkpointer options, etc.)

**When to add here:**
- New architectural decision made
- Development pattern established
- Technical reference needed
- System component documented

**When updating reference docs:**
1. Keep CLAUDE.md in sync (if navigation changes)
2. Update skills if patterns change
3. Version control major architectural changes

### `/docs/plans/` - WHEN to Build
**Roadmaps, implementation plans, and phase-by-phase designs.**

Contains:
- Strategic roadmap (7 phases)
- Mission Agents architecture
- End-to-end architecture
- Integration plans
- Phase-specific implementation plans

**When to add here:**
- New implementation plan created
- Architecture design finalized
- Phase planning completed
- Integration strategy documented

**When updating plans:**
1. Mark status (In Progress, Complete, etc.)
2. Update Strategic Roadmap if timeline changes
3. Add implementation status documents
4. Link to completed work in reference docs

### Where This File Lives
**`/CLAUDE.md`** - At repository root, navigation hub for AI assistants.

**When to update CLAUDE.md:**
- New documentation folder created
- Critical architectural decision added/changed
- Phase transitions
- Major skill added
- Success metrics change

**How to update CLAUDE.md:**
- Keep under 500 lines (progressive disclosure)
- Update "Essential Documentation" links
- Update "Current Status" section
- Keep "Quick Start" minimal and focused

---

## 📚 Essential Documentation

**Before writing ANY code, read these in order:**

### 1. Strategic Planning (READ FIRST)
- **[Strategic Roadmap](docs/plans/2025-01-04-ownyou-strategic-roadmap.md)** ⭐
  - 7-phase development plan
  - Horizontal layer approach
  - Integration points between phases
  - MUST READ before implementing any feature

### 2. Requirements & Vision (WHAT to Build)
- **[Consumer App Requirements](docs/requirements/*OwnYou%20Consumer%20App%20Requirements%20(brainstorm%20copy).md)** ⭐
  - Complete requirements for all features
  - User flows for all mission types
  - External API requirements
  - Design principles (Ikigai-driven)

- **[Project Brief](docs/requirements/*%20OwnYou%20Project-brief%20(brainstorm%20copy).md)**
  - Project overview and goals
  - Target audience
  - Value proposition

- **[Vision & User Experiences](docs/requirements/*OwnYou's%20Vision%20and%20User%20Experiences%20(brainstorm%20copy).md)**
  - User experience vision
  - Key user journeys
  - Design philosophy

- **[Advertising MVP](docs/requirements/*%20OwnYou%20Advertising%20MVP%20vision,%20core%20journey%20and%20technical%20specification%20(brainstorm%20copy).md)**
  - Advertising system requirements
  - SSO integration
  - Revenue model

### 3. Architecture Specifications (HOW to Build)
- **[Mission Agents Architecture](docs/plans/mission_agents_architecture.md)**
  - Adaptive multi-level patterns (Simple/Coordinated/Complex)
  - ReAct-based persistent threads
  - Memory architecture (Store + Checkpointer)
  - Trigger system, feedback processing

- **[End-to-End Architecture](docs/plans/end-to-end-architecture.md)**
  - System integration overview
  - Mission Card data models
  - IAB vs Mission Agents comparison

### 4. Implementation Plans (WHEN to Build)
- **[Integration Plan](docs/plans/2025-01-04-ownyou-consumer-app-integration.md)**
  - Phase 1-6 detailed tasks
  - Complete code examples
  - Integration tests

### 5. Reference Guides (Technical HOW)
- **[Architectural Decisions](docs/reference/ARCHITECTURAL_DECISIONS.md)** - 6 critical decisions affecting ALL code
- **[Development Guidelines](docs/reference/DEVELOPMENT_GUIDELINES.md)** - Before-coding checklist, constraints
- **[Current System](docs/reference/CURRENT_SYSTEM.md)** - What's working now (email parser + IAB)
- **[Project Structure](docs/reference/PROJECT_STRUCTURE.md)** - File organization and what's where
- **[Checkpointer Options](docs/reference/CHECKPOINTER_OPTIONS.md)** - LangGraph persistence options

---

## 🏗️ Critical Architectural Decisions

**These 6 decisions affect ALL code. Violating them causes rework.**

1. **LangGraph Store = Single Source of Truth** - No separate databases
2. **IAB Classifications Trigger Mission Agents** - Store updates trigger missions
3. **Horizontal Layer Development** - Complete each layer across all features
4. **Multi-Source IAB Classification** - Same workflow for all data sources
5. **Self-Sovereign Authentication** - Wallet-based, no email/password
6. **Privacy-First by Design** - No raw data to external APIs without encryption

**Details:** See [docs/reference/ARCHITECTURAL_DECISIONS.md](docs/reference/ARCHITECTURAL_DECISIONS.md)

---

## ✅ Before Writing Code Checklist

**EVERY time before implementing a feature:**

1. **Understand your phase** - Check Strategic Roadmap
2. **Check contracts (Phase 1)** - Are models/namespaces/APIs already defined?
3. **Review integration points** - What depends on your code? What does your code depend on?
4. **Check architectural decisions** - Are you using Store correctly? Using auth system?
5. **Read relevant reference docs** - Don't guess, verify

---

## 🔄 Git Workflow Discipline

**MANDATORY 5-step workflow:**

1. **Branch**: `git checkout -b feature/name` (never work on master)
2. **Test**: Test at EVERY checkpoint (not just before commit)
3. **Commit**: After each logical unit (`git commit -m "feat: message"`)
4. **Push**: Regularly (`git push origin feature/name`)
5. **Merge**: After full verification (tests, type check, lint, review)

**For AI Assistants - Include git steps in TodoWrite:**
```python
todos = [
    {"content": "Create feature branch", "status": "completed"},
    {"content": "Implement X + test", "status": "in_progress"},
    {"content": "Commit", "status": "pending"},
    {"content": "Push", "status": "pending"},
    {"content": "Full verification", "status": "pending"},
    {"content": "Create PR", "status": "pending"},
]
```

**Skills:** `git-workflow-discipline`, `superpowers:verification-before-completion`, `superpowers:finishing-a-development-branch`

**Full details:** [docs/development/REPOSITORY_GUIDELINES.md](docs/development/REPOSITORY_GUIDELINES.md)

---

## 🧪 Testing Discipline (TDD)

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
- ALL UI testing via MCP (no manual scripts)

**For AI Assistants:**
- NEVER mark complete without running test
- NEVER skip RED phase
- ALWAYS show test results
- ALWAYS use Playwright MCP for frontend

**Skills:** `testing-discipline`, `superpowers:test-driven-development`, `superpowers:verification-before-completion`

**Full plan:** [docs/development/TESTING_PLAN.md](docs/development/TESTING_PLAN.md) | **Playwright MCP:** [docs/development/PLAYWRIGHT_MCP_SETUP.md](docs/development/PLAYWRIGHT_MCP_SETUP.md)

---

## 🚀 Quick Commands

### Current Working System (Email Parser + IAB Classification)
```bash
# Setup email accounts
python -m src.email_parser.main setup

# Download and classify emails
python -m src.email_parser.main --pull 100 --model openai

# Dashboard
cd dashboard/backend && python app.py  # http://localhost:5000

# LangGraph Studio (visual debugging)
langgraph dev  # http://127.0.0.1:2024
```

### Testing
```bash
pytest                                              # All tests
pytest tests/integration/                           # Integration tests
pytest tests/integration/test_complete_system.py   # Master system test
```

### Code Quality
```bash
black .                                             # Format
flake8                                              # Linting
mypy src/                                           # Type check
```

---

## ⚠️ Critical Constraints

### Never Do This ❌
- Create separate databases (use LangGraph Store)
- Build custom auth (use Phase 1 auth system)
- Send raw personal data to external APIs without encryption
- Change Phase 1 contracts without full review
- Implement future phase features prematurely

### Always Do This ✅
- Read from Store for all memory needs
- Use defined Pydantic models from Phase 1
- Respect API contracts (OpenAPI spec)
- Follow horizontal layer approach
- Get explicit user consent before data sharing

**Details:** See [docs/reference/DEVELOPMENT_GUIDELINES.md](docs/reference/DEVELOPMENT_GUIDELINES.md)

---

## 🆘 When You're Stuck

1. **Check Strategic Roadmap** - Understand which phase you're in
2. **Run Master System Test** - `pytest tests/integration/test_complete_system.py -v`
3. **Use LangGraph Studio** - `langgraph dev` for visual workflow debugging
4. **Check Logs** - `tail -f logs/email_parser_*.log`
5. **Review Reference Docs** - See docs/reference/ folder for detailed guidance

---

## 📊 Success Metrics

**Technical:** All phases complete, all tests passing, <5s app launch, zero breaches
**User:** 8 data sources connected, >40% mission completion, >30% retention
**Business:** Ad revenue flowing, tokens distributed, privacy maintained

---

## 🎓 Key Concepts

- **Dual-Purpose:** IAB (revenue) + Missions (utility)
- **Single Source:** LangGraph Store for all memory
- **Horizontal Layers:** Complete each layer across all features
- **Clean Interfaces:** Contracts defined in Phase 1
- **Privacy-First:** Self-sovereign, selective disclosure
- **Ikigai-Driven:** Life purpose, not engagement tricks

---

## 📁 Repository Structure

```
ownyou_consumer_application/
│
├── CLAUDE.md ⭐                    # This file - navigation hub
│
├── docs/
│   ├── requirements/ ⭐            # WHAT to build
│   │   ├── *OwnYou Consumer App Requirements.md
│   │   ├── * OwnYou Project-brief.md
│   │   ├── *OwnYou's Vision and User Experiences.md
│   │   ├── * OwnYou Advertising MVP.md
│   │   ├── BBS+ Pseudonyms.md
│   │   ├── Ikigai.md
│   │   └── LangGraph Memory.md
│   │
│   ├── reference/ ⭐               # HOW to build (technical)
│   │   ├── ARCHITECTURAL_DECISIONS.md
│   │   ├── DEVELOPMENT_GUIDELINES.md
│   │   ├── CURRENT_SYSTEM.md
│   │   ├── PROJECT_STRUCTURE.md
│   │   └── CHECKPOINTER_OPTIONS.md
│   │
│   └── plans/ ⭐                   # WHEN to build (roadmap)
│       ├── 2025-01-04-ownyou-strategic-roadmap.md
│       ├── mission_agents_architecture.md
│       ├── end-to-end-architecture.md
│       └── 2025-01-04-ownyou-consumer-app-integration.md
│
├── .claude/skills/ ⭐             # Project-specific skills
│   ├── decentralized-consumer-app-authentication/  # Auth architecture & design
│   ├── git-workflow-discipline/           # Git workflow enforcement
│   ├── testing-discipline/                # TDD + Playwright MCP
│   ├── langgraph-workflow-development/    # LangGraph agent patterns
│   ├── store-schema-design/               # Store namespace design
│   └── ownyou-phase-1-contracts/          # Phase 1 deliverables
│
├── src/
│   ├── email_parser/              # Phase 0: Email-only IAB (WORKING)
│   ├── mission_agents/            # Phase 1+: Mission system (IN PROGRESS)
│   ├── data_sources/              # Phase 2: Multi-source connectors (PLANNED)
│   ├── auth/                      # Phase 1: Authentication (IN PROGRESS)
│   └── sso/                       # Phase 6: SSO Integration (PLANNED)
│
├── tests/
│   ├── mission_agents/            # Unit tests
│   ├── integration/               # Integration tests (CRITICAL)
│   └── dashboard/                 # API tests
│
└── dashboard/                     # Current Flask + React dashboard
    ├── backend/
    └── frontend/
```

**Full details:** [docs/reference/PROJECT_STRUCTURE.md](docs/reference/PROJECT_STRUCTURE.md)

---

## 🎯 Current Phase: Phase 1 (Foundation & Contracts)

**Goal:** Define ALL contracts upfront to enable parallel development without rework

**Deliverables:**
- Complete data models (all card types) - Pydantic
- Complete Store schema (all namespaces) - documented
- Complete API contracts - OpenAPI spec
- Authentication system - self-sovereign

**Next Phase:** Phase 2 (Data Layer - all sources → Store)

**See:** [Strategic Roadmap](docs/plans/2025-01-04-ownyou-strategic-roadmap.md) for full timeline

---

## 📝 Keeping Documentation Current

### When Requirements Change
1. Update relevant file in `/docs/requirements/`
2. Add date/version to document history
3. Review if architectural decisions need updates (docs/reference/ARCHITECTURAL_DECISIONS.md)
4. Check if implementation plans need updates (docs/plans/)
5. Update this file if it affects Quick Start or Critical Decisions

### When Architecture Evolves
1. Update relevant file in `/docs/reference/` or `/docs/plans/`
2. Update skills if patterns change (/.claude/skills/)
3. Update this file if critical decisions change
4. Create new implementation plan if major phase work identified

### When Code Implementation Completes
1. Update implementation status in relevant plan (docs/plans/)
2. Update "Current System" reference (docs/reference/CURRENT_SYSTEM.md)
3. Update "Current Phase" section in this file
4. Document new patterns in reference/ if reusable

### When Phase Transitions
1. Update "Current Phase" section in this file
2. Mark previous phase complete in Strategic Roadmap
3. Create new implementation status document
4. Update skills if new patterns emerge

---

**Last Updated:** 2025-01-05
**System Status:** Email Parser working, Mission Agents in progress
**Current Phase:** Phase 1 (Foundation & Contracts)

**Remember:** Every decision affects the full system. Always check the strategic roadmap and reference documentation before making changes. Keep this file updated as the source of truth for documentation organization.
