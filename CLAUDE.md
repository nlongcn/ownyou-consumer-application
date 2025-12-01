# CLAUDE.md

**Project:** OwnYou Consumer Application - Privacy-first personal AI with dual-purpose architecture

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

**Last Updated:** 2025-12-01
**Current Sprint:** Sprint 0 (Foundation)
