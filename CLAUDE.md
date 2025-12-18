# CLAUDE.md

**Project:** OwnYou Consumer Application - Privacy-first personal AI with dual-purpose architecture

---

## ⛔ MANDATORY FIRST ACTION - READ THIS FIRST

**Before responding to ANY user message, you MUST:**

1. **List available skills** - Check `.claude/skills/` and plugin skills
2. **Identify relevant skills** - Does this task match any skill description?
3. **Use the Skill tool** - `Skill(skill-name)` BEFORE any other action
4. **Announce usage** - "I'm using [skill] to [task]"
5. **Follow the skill exactly** - Do not skip steps or rationalize shortcuts

### If You Skip This Protocol:

```
❌ FAILURE: You responded without checking/using skills
→ User will say: "You skipped skills. Start over."
→ You must restart and follow the protocol
```

### Common Rationalizations That Mean You're Failing:

- "This is just a simple question" → **WRONG.** Check for skills.
- "Let me gather information first" → **WRONG.** Skills tell you HOW.
- "The skill is overkill" → **WRONG.** Skills exist because simple becomes complex.
- "I'll just do this one thing first" → **WRONG.** Skills BEFORE actions.

### Required Skills by Task Type:

| Task Type | Required Skill |
|-----------|----------------|
| Sprint work | `sprint-mode` |
| Implementation | `implement-package` |
| Testing | `testing-discipline` |
| Debugging | `superpowers:systematic-debugging` |
| Before completion | `v13-compliance-check` |
| Git operations | `git-workflow-discipline` |
| Design/planning | `superpowers:brainstorming` |

**Hooks are active:** The system will BLOCK Edit/Write tools if skills weren't used.

---

## 🎯 Quick Start

**Dual-Purpose Architecture:**
- **IAB Classification** → Advertising revenue via BBS+ pseudonyms
- **Mission Agents** → User utility via personalized mission cards

**Single Source of Truth:** LangGraph Store (shared between IAB and Missions)

**Development Strategy:** Horizontal layers (Phase 1-7)

**Current Phase:** Sprint 0 (Foundation) - See `docs/sprints/ownyou-sprint0-spec.md`

---

## 📚 Essential Documentation

| Priority | Document | Purpose |
|----------|----------|---------|
| **1** | `docs/sprints/ownyou-sprint0-spec.md` | Current sprint specification |
| **2** | `docs/architecture/OwnYou_architecture_v13.md` | Full system architecture |
| **3** | `docs/architecture/extracts/` | Focused architecture sections for context loading |
| **4** | `docs/plans/2025-01-04-ownyou-strategic-roadmap.md` | 7-phase roadmap |

### Architecture Extracts (Load as needed)
- `extracts/memory-types-8.4.md` - Memory/Episode/Entity types
- `extracts/namespaces-8.12.md` - STORE_NAMESPACES constant
- `extracts/storage-backends-8.13.md` - Platform backends
- `extracts/llm-cost-6.10.md` - Budget enforcement
- `extracts/sync-8.14.md` - OrbitDB sync

---

## 🏗️ 6 Critical Architectural Decisions

1. **LangGraph Store = Single Source of Truth** - No separate databases
2. **IAB Classifications Trigger Mission Agents** - Store updates trigger missions
3. **Horizontal Layer Development** - Complete each layer across all features
4. **Multi-Source IAB Classification** - Same workflow for all data sources
5. **Self-Sovereign Authentication** - Wallet-based, no email/password
6. **Privacy-First by Design** - No raw data to external APIs without encryption

---

## ⚠️ Critical Constraints

**Self-Sovereign Architecture:**
- ✅ ALL personal data on user's device (IndexedDB or SQLite)
- ✅ Wallet-derived encryption keys
- ❌ NEVER centralized cloud backend for personal data
- ❌ NEVER create separate databases (use LangGraph Store)

---

## 🔧 Development Workflows

**Use these skills (in `.claude/skills/`):**

| Skill | Use When |
|-------|----------|
| `sprint-mode` | Starting ANY sprint task |
| `implement-package` | Implementing a sprint package |
| `v13-compliance-check` | Before marking implementation complete |
| `git-workflow-discipline` | ALL development (branch, test, commit, push) |
| `testing-discipline` | ALL code (RED-GREEN-REFACTOR) |
| `tauri-build-discipline` | Before testing OAuth/deep links in Tauri app |

**Slash Commands:**
- `/start-sprint` - Load sprint context and begin work

---

## 🚀 Quick Commands

```bash
# Sprint 0 - Browser PWA
cd src/admin-dashboard && npm run dev    # Dev server
npm test                                  # Tests

# Python (legacy email_parser)
pytest tests/integration/                 # Integration tests
langgraph dev                             # LangGraph Studio
```

### Tauri Desktop App (apps/consumer/)

**CRITICAL:** After making ANY code changes to `apps/consumer/`:

```bash
cd apps/consumer
pnpm tauri:build    # Builds + deploys to /Applications/OwnYou.app
```

**Why this matters:**
- macOS routes `ownyou://` deep links to the INSTALLED app (`/Applications/OwnYou.app`)
- Deep links do NOT go to the dev server
- OAuth callbacks use deep links → testing requires rebuilt app
- `pnpm tauri:dev` does hot reload for UI but deep links still go to installed version

| Scenario | Command | Notes |
|----------|---------|-------|
| OAuth/deep link testing | `pnpm tauri:build` | REQUIRED - rebuilds + deploys |
| General UI development | `pnpm tauri:dev` | Hot reload, but deep links broken |
| After ANY code changes | `pnpm tauri:build` | Before testing OAuth flow |

---

## 📁 Key Directories

```
ownyou_consumer_application/
├── CLAUDE.md                 # This file - navigation hub
├── docs/
│   ├── sprints/              # Sprint specifications ⭐
│   ├── architecture/         # v13 + extracts ⭐
│   ├── plans/                # Strategic roadmap
│   ├── requirements/         # What to build
│   └── reference/            # How to build
├── .claude/skills/           # Development skills ⭐
├── src/
│   ├── browser/              # JavaScript PWA (Sprint 0+)
│   └── email_parser/         # Python (legacy, working)
└── tests/
```

---

## 📖 Detailed Guidance

For detailed workflows, migration protocols, and comprehensive instructions:
- **See:** `docs/reference/AI_ASSISTANT_GUIDE.md`

---

**Last Updated:** 2025-12-18
**Current Sprint:** Sprint 11c (A/B Testing) - COMPLETE
