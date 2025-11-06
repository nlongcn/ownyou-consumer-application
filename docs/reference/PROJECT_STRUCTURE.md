# Project Structure

**Complete directory tree with descriptions, phase mapping, and organizational guidelines.**

Last Updated: 2025-01-04

---

## Overview

This document provides a comprehensive map of the OwnYou Consumer Application codebase, including what's in each directory, which phase it belongs to, and where to put new code.

**When to read this:** Before creating new files or organizing features.

---

## Root Directory Structure

```
ownyou_consumer_application/
├── src/                      # Source code
├── tests/                    # Test suite
├── dashboard/                # Web dashboard (frontend + backend)
├── docs/                     # Documentation
├── data/                     # Data files (runtime-generated)
├── logs/                     # Log files (runtime-generated)
├── _archive/                 # Historical documentation
├── reference/                # Reference documentation (this file)
├── .claude/                  # Claude Code configuration
├── .langgraph_api/           # LangGraph API cache
├── requirements.txt          # Python dependencies
├── pyproject.toml            # Python package configuration
├── .env                      # Environment variables (not in git)
├── CLAUDE.md                 # Main development guide
├── README.md                 # User-facing documentation
└── langgraph.json            # LangGraph Studio configuration
```

---

## Source Code (`src/`)

### Email Parser (Phase 0 - WORKING)

```
src/email_parser/
├── main.py                   # CLI entry point
│                            # Commands: --pull, --summarize, --classify, setup
│
├── providers/               # Email provider integrations
│   ├── base.py             # Abstract base class for providers
│   ├── gmail_provider.py   # Gmail API + OAuth2
│   └── outlook_provider.py # Microsoft Graph API + OAuth2
│
├── llm_clients/            # LLM provider integrations
│   ├── base.py             # Abstract base class for LLM clients
│   ├── openai_client.py    # OpenAI GPT-4/GPT-4o
│   ├── claude_client.py    # Anthropic Claude Sonnet-4
│   ├── google_client.py    # Google Gemini
│   └── ollama_client.py    # Local Ollama models
│
├── workflow/               # LangGraph IAB classification workflow
│   ├── graph.py            # Main workflow definition
│   ├── state.py            # Workflow state (TypedDict)
│   ├── batch_optimizer.py  # Batch size calculation
│   ├── executor.py         # Workflow executor
│   ├── studio.py           # LangGraph Studio entry point
│   ├── taxonomy_context.py # IAB Taxonomy loading
│   ├── reducers.py         # State reducers for parallel nodes
│   ├── nodes/              # Workflow nodes
│   │   ├── load_emails.py
│   │   ├── retrieve_profile.py
│   │   ├── analyzers.py    # Demographics, household, interests agents
│   │   ├── reconcile.py    # Merge classifications
│   │   └── update_memory.py # Write to SQLite + Store
│   └── prompts/            # LLM prompts for agents
│       └── __init__.py
│
├── memory/                 # Memory management (DEPRECATED - use mission_agents/memory/)
│   └── manager.py          # SQLite memory manager (backward compat)
│
├── analysis/               # Legacy analyzers (pre-LangGraph)
│   ├── categories/         # Category-specific analyzers
│   │   ├── base_category_analyzer.py
│   │   └── travel_analyzer_sophisticated.py
│   ├── marketing_analyzer.py  # Marketing intelligence
│   ├── authentic_ikigai_analyzer.py  # Ikigai analysis
│   ├── holistic_ikigai_analyzer.py
│   └── recommendation_category.py
│
├── models/                 # Pydantic data models
│   ├── email.py            # Email data model
│   ├── classification.py   # IAB classification model
│   └── cross_category_context.py  # Cross-category context
│
├── utils/                  # Utilities
│   ├── config.py           # Environment variable loading
│   └── logger.py           # Logging setup
│
├── setup/                  # Account setup wizards
│   ├── gmail_setup.py      # Gmail OAuth setup
│   └── outlook_setup.py    # Outlook OAuth setup
│
└── consumer_intelligence_system.py  # Legacy system integration
```

**Phase:** Phase 0 (Email-only IAB classification) - WORKING

**Key files:**
- Entry: `main.py`
- Workflow: `workflow/graph.py`
- Agents: `workflow/nodes/analyzers.py`
- Memory: `workflow/nodes/update_memory.py`

### Mission Agents (Phase 1-3 - IN PROGRESS)

```
src/mission_agents/
├── __init__.py
│
├── models/                 # Data models (Phase 1)
│   ├── __init__.py
│   ├── mission_card.py     # Base MissionCard + enums
│   ├── shopping_card.py    # SavingsShoppingCardData
│   ├── travel_card.py      # IkigaiTravelCardData
│   ├── utility_card.py     # SavingsUtilityCardData
│   ├── event_card.py       # IkigaiEventCardData
│   ├── restaurant_card.py  # RestaurantCardData
│   ├── recipe_card.py      # RecipeCardData
│   ├── content_card.py     # ContentCardData
│   └── health_card.py      # HealthCardData
│
├── memory/                 # Store wrapper (Phase 1)
│   ├── __init__.py
│   ├── config.py           # StoreConfig (namespace patterns)
│   ├── store.py            # MissionStore (wrapper around LangGraph Store)
│   └── store_schema.md     # Complete Store namespace documentation
│
├── agents/                 # Mission agents (Phase 3)
│   ├── base.py             # BaseAgent abstract class
│   ├── shopping/           # Shopping agent (Level 1 Simple)
│   │   ├── __init__.py
│   │   ├── shopping_agent.py
│   │   └── config.py
│   ├── travel/             # Travel agent (Level 3 Complex)
│   │   ├── __init__.py
│   │   ├── travel_agent.py
│   │   ├── supervisor.py   # Hierarchical supervisor
│   │   ├── flight_coordinator.py
│   │   ├── hotel_coordinator.py
│   │   └── activity_coordinator.py
│   ├── restaurant/         # Restaurant agent (Level 2 Coordinated)
│   ├── event/              # Event agent (Level 2 Coordinated)
│   ├── bill/               # Bill optimization agent (Level 1 Simple)
│   ├── services/           # Financial services agent (Level 1 Simple)
│   ├── cooking/            # Recipe agent (Level 1 Simple)
│   ├── content/            # Content recommendation agent (Level 1 Simple)
│   └── health/             # Health agent (Level 2 Coordinated)
│
├── triggers/               # Trigger system (Phase 3)
│   ├── __init__.py
│   ├── base.py             # TriggerEvent, TriggerType
│   ├── memory_trigger.py   # Store change triggers
│   ├── schedule_trigger.py # Cron-based triggers
│   ├── user_trigger.py     # User-initiated triggers
│   └── external_trigger.py # Webhook triggers
│
└── orchestrator.py         # Mission orchestrator (Phase 3)
                            # Routes triggers to agents
```

**Phase:** Phase 1 (Foundation), Phase 3 (Agents)

**Current status:**
- Phase 1: Data models and Store wrapper (in progress)
- Phase 3: Agents (not started yet)

**Key files:**
- Models: `models/mission_card.py`
- Store: `memory/store.py`
- Agents: `agents/{agent_type}/{agent}_agent.py`
- Orchestrator: `orchestrator.py`

### Data Sources (Phase 2 - PLANNED)

```
src/data_sources/
├── __init__.py
├── base.py                 # DataSourceConnector abstract class
│
├── email/                  # Email connector (existing - enhance)
│   ├── __init__.py
│   └── connector.py        # Wraps email_parser providers
│
├── calendar/               # Calendar connector (NEW)
│   ├── __init__.py
│   ├── google_calendar.py
│   └── outlook_calendar.py
│
├── financial/              # Financial connector (NEW)
│   ├── __init__.py
│   └── plaid_connector.py  # PLAID via Chainlink (decentralized)
│
├── photos/                 # Photos connector (NEW)
│   ├── __init__.py
│   ├── apple_photos.py
│   └── google_photos.py
│
├── location/               # Location connector (NEW)
│   ├── __init__.py
│   ├── ios_location.py
│   └── android_location.py
│
├── health/                 # Health connector (NEW)
│   ├── __init__.py
│   ├── apple_health.py
│   └── google_fit.py
│
├── social/                 # Social media connector (NEW)
│   ├── __init__.py
│   ├── facebook.py
│   ├── instagram.py
│   └── twitter.py
│
├── browsing/               # Browsing history connector (NEW)
│   ├── __init__.py
│   └── chrome_extension.py
│
└── iab_classifier.py       # Universal IAB classifier for all sources
```

**Phase:** Phase 2 (Data Layer)

**Status:** Planned (not started)

**Key pattern:** All connectors implement `DataSourceConnector` abstract class

### Authentication (Phase 1 - IN PROGRESS)

```
src/auth/
├── __init__.py
├── wallet.py               # Wallet-based authentication
├── jwt.py                  # JWT token generation/validation
├── session.py              # Session management
└── providers/              # Wallet providers
    ├── metamask.py
    ├── walletconnect.py
    └── privy.py
```

**Phase:** Phase 1 (Foundation)

**Status:** In progress (use skill: `decentralized-consumer-app-authentication`)

### API Layer (Phase 4 - PLANNED)

```
src/api/
├── __init__.py
├── app.py                  # FastAPI or Flask main app
├── routes/
│   ├── missions.py         # Mission CRUD endpoints
│   ├── feedback.py         # Mission feedback processing
│   ├── wallet.py           # Wallet/token management
│   ├── notifications.py    # Notifications
│   ├── connections.py      # Data source connections
│   ├── settings.py         # User settings
│   └── profile.py          # User profile
├── models/                 # API request/response models
└── middleware/             # Auth, CORS, rate limiting
```

**Phase:** Phase 4 (API Layer)

**Status:** Planned (not started)

### SSO Integration (Phase 6 - PLANNED)

```
src/sso/
├── __init__.py
├── bbs_plus.py             # BBS+ pseudonym generation
├── selective_disclosure.py # Selective disclosure protocol
├── publisher_sdk.py        # Publisher SSO SDK integration
└── header_bidding.py       # Header bidding integration
```

**Phase:** Phase 6 (SSO Integration)

**Status:** Planned (not started)

---

## Tests (`tests/`)

```
tests/
├── __init__.py
│
├── unit/                   # Unit tests
│   ├── test_batch_optimizer.py
│   ├── test_memory_manager.py
│   └── test_taxonomy_loading.py
│
├── integration/            # Integration tests
│   ├── test_complete_system.py      # Master end-to-end test
│   ├── test_iab_store_integration.py  # IAB → Store integration
│   └── test_email_to_mission_flow.py  # Email → Mission card flow
│
├── mission_agents/         # Mission agent unit tests (Phase 1-3)
│   ├── models/
│   │   └── test_mission_card.py
│   ├── memory/
│   │   └── test_store.py
│   └── agents/
│       ├── test_shopping_agent.py
│       ├── test_travel_agent.py
│       └── test_restaurant_agent.py
│
├── data_sources/           # Data source tests (Phase 2)
│   ├── test_calendar_connector.py
│   ├── test_financial_connector.py
│   └── test_iab_classifier.py
│
├── auth/                   # Authentication tests (Phase 1)
│   ├── test_wallet_auth.py
│   └── test_jwt.py
│
└── dashboard/              # Dashboard API tests
    └── test_api.py
```

**Test organization:**
- `unit/`: Single component in isolation
- `integration/`: Multiple components interacting
- Component folders match `src/` structure

**Critical test:**
- `tests/integration/test_complete_system.py` - Run before every commit

---

## Dashboard (`dashboard/`)

### Backend (Flask)

```
dashboard/backend/
├── app.py                  # Flask app entry point
├── run.py                  # Development server runner
├── config.py               # Flask configuration
│
├── api/                    # API route handlers
│   ├── analyze.py          # Analysis triggers, model selection
│   ├── profile.py          # User profile retrieval
│   ├── evidence.py         # Evidence retrieval
│   ├── studio.py           # LangGraph Studio integration
│   └── categories.py       # IAB category browsing
│
├── db/                     # Database queries
│   └── queries.py          # SQLite query functions
│
└── flask_session/          # Flask session storage (runtime)
```

**Entry points:**
- Development: `python app.py`
- Production: `gunicorn -w 4 -b 0.0.0.0:5001 wsgi:app`

**Port:** 5001

### Frontend (Next.js)

```
dashboard/frontend/
├── app/                    # Next.js 14 App Router
│   ├── page.tsx            # Home (dashboard overview)
│   ├── layout.tsx          # Root layout
│   ├── analytics/
│   │   └── page.tsx        # Analytics charts (Recharts)
│   ├── categories/
│   │   └── page.tsx        # IAB category browser
│   ├── evidence/
│   │   └── page.tsx        # Evidence viewer
│   ├── profile/
│   │   └── page.tsx        # User profile display
│   └── api/
│       └── [...path]/
│           └── route.ts    # API proxy (avoids CORS)
│
├── components/             # React components
│   ├── ClassificationCard.tsx
│   ├── AnalyticsChart.tsx
│   ├── EvidenceList.tsx
│   ├── CategoryBrowser.tsx
│   └── ui/                 # Reusable UI components
│
├── lib/                    # Frontend utilities
│   ├── api.ts              # API client (fetch wrapper)
│   └── types.ts            # TypeScript types
│
├── types/                  # TypeScript type definitions
│   ├── profile.ts
│   └── classification.ts
│
├── public/                 # Static assets
├── .env.local              # Frontend environment variables
└── next.config.js          # Next.js configuration
```

**Entry points:**
- Development: `npm run dev`
- Production: `npm run build && npm start`

**Port:** 3000

**IMPORTANT:** Set `NEXT_PUBLIC_API_URL=` (empty) in `.env.local` to use proxy

---

## Documentation (`docs/`)

```
docs/
├── README.md               # Documentation index
│
├── plans/                  # Implementation plans
│   ├── 2025-01-04-ownyou-strategic-roadmap.md  # 7-phase roadmap (READ FIRST)
│   ├── 2025-01-04-ownyou-consumer-app-integration.md  # Integration plan
│   ├── mission_agents_architecture.md  # Mission Agents detailed architecture
│   └── end-to-end-architecture.md  # System integration overview
│
├── Brainstorming/          # Requirements and vision
│   ├── brainstorming_mission_agents/
│   │   └── *OwnYou Consumer App Requirements (brainstorm copy).md  # Complete requirements
│   └── *OwnYou Advertising MVP vision, core journey and technical specification (brainstorm copy).md
│
├── development/            # Development guidelines
│   └── REPOSITORY_GUIDELINES.md  # Git/PR/commit standards
│
├── reference/              # Technical references
│   └── CHECKPOINTER_OPTIONS.md  # LangGraph checkpointer options
│
├── technical/              # Technical specifications
│   ├── IAB_PROFILE_TECHNICAL_SPEC.md
│   ├── LANGGRAPH_STUDIO_INTEGRATION.md
│   ├── LLM_PROVIDER_CONFIGURATION.md
│   └── MEMORY_MANAGER_API.md
│
├── STUDIO_QUICKSTART.md    # LangGraph Studio 5-minute guide
│
├── attachments/            # Images, diagrams, PDFs
│
└── persistent_bugs/        # Bug tracking (move to GitHub issues)
```

**Key documents for development:**
1. `plans/2025-01-04-ownyou-strategic-roadmap.md` - MUST READ FIRST
2. `plans/mission_agents_architecture.md` - Mission Agents architecture
3. `Brainstorming/brainstorming_mission_agents/*OwnYou Consumer App Requirements` - Complete requirements

---

## Reference Documentation (`reference/`)

**This folder!**

```
reference/
├── ARCHITECTURAL_DECISIONS.md   # 6 critical architectural decisions
├── DEVELOPMENT_GUIDELINES.md    # Before-coding checklist, testing, privacy, performance
├── CURRENT_SYSTEM.md            # What's working now (email parser + IAB)
└── PROJECT_STRUCTURE.md         # This file
```

**Purpose:** Progressive disclosure from CLAUDE.md

**When to read:**
- `ARCHITECTURAL_DECISIONS.md` - Before ANY implementation
- `DEVELOPMENT_GUIDELINES.md` - Before starting implementation
- `CURRENT_SYSTEM.md` - To understand what's already built
- `PROJECT_STRUCTURE.md` - When creating new files/folders

---

## Data Files (`data/`) - Runtime Generated

```
data/
├── email_parser_memory.db          # SQLite database (LangGraph Store)
├── studio_checkpoints.db           # LangGraph Studio checkpoints
│
├── emails_raw_{timestamp}.csv      # Stage 1: Raw emails
├── emails_summarized_{timestamp}.csv  # Stage 2: Summarized emails
├── profile_{user}_{timestamp}.json    # Stage 3: IAB profile export
│
└── iab_consumer_profile.json       # Latest profile (symlink)
```

**Note:** All `.csv`, `.db`, `.json` files are gitignored (runtime-generated)

---

## Archive (`_archive/`)

```
_archive/
├── AGENT_CONVERSION_MASTER_PLAN.md  # Historical planning docs
├── AGENT_TESTING_PLAN.md
├── DISCRETE_STEPS_PROGRESS.md
├── PHASE2_DISCRETE_STEP2_REQUIREMENTS.md
├── PHASE3_TESTING_RESULTS.md
│
├── developer_docs/              # Historical developer docs
│   ├── DEVELOPER_GUIDELINES.md
│   ├── AI_COLLABORATION_GUIDE.md
│   └── ...
│
├── old_bugfixing/               # Historical bug reports
└── old_tasks/                   # Historical task lists
```

**Purpose:** Historical reference only. Do NOT use for current development.

---

## Configuration Files (Root)

### Python Configuration

**`requirements.txt`** - Python dependencies

```txt
# Core
langgraph>=0.2.0
langchain>=0.3.0
pydantic>=2.0.0

# LLM Providers
openai>=1.0.0
anthropic>=0.25.0
google-generativeai>=0.8.0

# Email Providers
google-auth>=2.0.0
google-api-python-client>=2.0.0
msal>=1.20.0

# Database
sqlite3  # Built-in

# API
flask>=3.0.0
flask-cors>=4.0.0
gunicorn>=21.0.0  # Production server

# Testing
pytest>=7.0.0
pytest-cov>=4.0.0

# Development
black>=23.0.0
flake8>=6.0.0
mypy>=1.0.0
isort>=5.0.0
```

**`pyproject.toml`** - Package configuration

```toml
[project]
name = "ownyou-consumer-application"
version = "0.1.0"
requires-python = ">=3.11"

[project.scripts]
email-parser = "email_parser.main:main"
email-parser-setup = "email_parser.main:setup"

[project.optional-dependencies]
dev = [
    "pytest>=7.0.0",
    "pytest-cov>=4.0.0",
    "black>=23.0.0",
    "flake8>=6.0.0",
    "mypy>=1.0.0",
]

[tool.black]
line-length = 100
target-version = ['py311']

[tool.mypy]
python_version = "3.11"
disallow_untyped_defs = true
ignore_missing_imports = true
```

### Frontend Configuration

**`dashboard/frontend/package.json`** - Node.js dependencies

```json
{
  "name": "ownyou-dashboard",
  "version": "0.1.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "14.2.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "recharts": "^2.10.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "typescript": "^5.0.0"
  }
}
```

### LangGraph Configuration

**`langgraph.json`** - LangGraph Studio configuration

```json
{
  "dependencies": ["src"],
  "graphs": {
    "iab_classification": "src/email_parser/workflow/studio.py:graph"
  },
  "env": ".env"
}
```

---

## Phase Mapping

### Phase 0: Email-Only IAB (WORKING)

```
src/email_parser/           ✅ Complete
tests/unit/                 ✅ Complete
tests/integration/          ✅ Complete
dashboard/                  ✅ Complete
```

### Phase 1: Foundation & Contracts (IN PROGRESS)

```
src/mission_agents/models/      🔄 In progress
src/mission_agents/memory/      🔄 In progress
src/auth/                       🔄 In progress
docs/api/openapi.yaml           🔄 In progress
docs/plans/store_schema.md      🔄 In progress
```

### Phase 2: Data Layer (PLANNED)

```
src/data_sources/               ⏸️ Planned
tests/data_sources/             ⏸️ Planned
```

### Phase 3: Agent Layer (PLANNED)

```
src/mission_agents/agents/      ⏸️ Planned
src/mission_agents/triggers/    ⏸️ Planned
src/mission_agents/orchestrator.py  ⏸️ Planned
tests/mission_agents/agents/    ⏸️ Planned
```

### Phase 4: API Layer (PLANNED)

```
src/api/                        ⏸️ Planned
tests/api/                      ⏸️ Planned
```

### Phase 5: UI Layer (PLANNED)

```
mobile_app/                     ⏸️ Planned (new React Native app)
```

### Phase 6: SSO Integration (PLANNED)

```
src/sso/                        ⏸️ Planned
```

### Phase 7: Production (PLANNED)

```
# PostgreSQL migration
# Performance optimization
# Security audit
# Deployment configuration
```

---

## Where to Put New Code

### Adding a New Mission Agent (Phase 3)

```
1. Create agent directory:
   src/mission_agents/agents/{agent_name}/

2. Create agent files:
   src/mission_agents/agents/{agent_name}/
   ├── __init__.py
   ├── {agent_name}_agent.py
   └── config.py

3. Create tests:
   tests/mission_agents/agents/
   └── test_{agent_name}_agent.py

4. Register in orchestrator:
   src/mission_agents/orchestrator.py
```

### Adding a New Data Source (Phase 2)

```
1. Create connector directory:
   src/data_sources/{source_name}/

2. Create connector files:
   src/data_sources/{source_name}/
   ├── __init__.py
   └── connector.py  (implements DataSourceConnector)

3. Create tests:
   tests/data_sources/
   └── test_{source_name}_connector.py

4. Register in main:
   src/email_parser/main.py
```

### Adding a New Card Type (Phase 1)

```
1. Define card data model:
   src/mission_agents/models/{card_type}_card.py

2. Register in card type registry:
   src/mission_agents/models/mission_card.py
   CARD_TYPE_SCHEMAS = {
       "{card_type}": {CardType}CardData,
       ...
   }

3. Create tests:
   tests/mission_agents/models/
   └── test_{card_type}_card.py
```

### Adding a New API Endpoint (Phase 4)

```
1. Create route handler:
   src/api/routes/{endpoint_name}.py

2. Register in main app:
   src/api/app.py

3. Create tests:
   tests/api/
   └── test_{endpoint_name}.py

4. Update OpenAPI spec:
   docs/api/openapi.yaml
```

---

## Naming Conventions

### Files and Directories

```python
# Modules (files)
snake_case.py                 # shopping_agent.py

# Directories
snake_case/                   # mission_agents/

# Test files
test_{module_name}.py         # test_shopping_agent.py

# Configuration files
lowercase.json                # langgraph.json
UPPERCASE.md                  # README.md (convention)
```

### Code

```python
# Classes
CapWords                      # ShoppingAgent, MissionCard

# Functions
snake_case                    # evaluate_shopping_mission()

# Constants
UPPER_CASE                    # MIN_CONFIDENCE, MAX_BATCH_SIZE

# Private
_leading_underscore           # _internal_helper()

# Type variables
CapWordsWithT                 # TState, TConfig
```

---

## File Organization Best Practices

### Module Structure

```python
# Standard order within a Python file:

# 1. Module docstring
"""
Module description.

Usage example.
"""

# 2. Imports (grouped)
# Standard library
import os
from typing import List, Dict

# Third-party
from pydantic import BaseModel
from langgraph.store import Store

# Local
from src.mission_agents.models import MissionCard

# 3. Constants
MIN_CONFIDENCE = 0.75
MAX_BATCH_SIZE = 25

# 4. Type definitions
TriggerEvent = Dict[str, Any]

# 5. Classes
class ShoppingAgent(BaseAgent):
    """Agent implementation"""
    pass

# 6. Functions
def evaluate_shopping_mission(...):
    """Function implementation"""
    pass

# 7. Main block (if executable)
if __name__ == "__main__":
    main()
```

### Directory Structure

```
# Group by feature, not by type
✅ GOOD:
src/mission_agents/agents/shopping/
├── __init__.py
├── shopping_agent.py
├── config.py
└── helpers.py

❌ BAD:
src/mission_agents/
├── agents/
│   └── shopping_agent.py
├── configs/
│   └── shopping_config.py
└── helpers/
    └── shopping_helpers.py
```

---

## Related Documentation

- **CLAUDE.md**: Main development guide (progressive disclosure entry point)
- **README.md**: User-facing installation and usage guide
- **Strategic Roadmap**: `docs/plans/2025-01-04-ownyou-strategic-roadmap.md`
- **Architectural Decisions**: `reference/ARCHITECTURAL_DECISIONS.md`
- **Development Guidelines**: `reference/DEVELOPMENT_GUIDELINES.md`
- **Current System**: `reference/CURRENT_SYSTEM.md`
- **Repository Guidelines**: `docs/development/REPOSITORY_GUIDELINES.md`

---

**Remember:** This structure is designed for the 7-phase horizontal layer approach. When creating new files, follow the phase mapping and existing patterns.
