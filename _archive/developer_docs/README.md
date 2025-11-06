Ikigai + Marketing Frontend — Developer Docs

Overview

- Purpose: Local-first frontend for importing Gmail/Outlook emails, running Ikigai and Marketing analyses on-device, and surfacing image-rich recommendations via ASIN Data API, Switched (bills), and Amadeus (travel). No server stores or processes user data.
- Principles: Self-sovereign, privacy-by-default, deterministic and auditable analyses, delightful visuals, easy encrypted sharing.

Contents

## Implementation Plans
- **DEVELOPMENT_PLAN.md** — Realistic sprint-by-sprint tasks with discrete deliverables
- **TESTING_PLAN.md** — Comprehensive testing strategy with measurable outcomes  
- **AI_COLLABORATION_GUIDE.md** — Detailed guide for working with AI coding assistants
- **DEVELOPER_GUIDELINES.md** — Step-by-step instructions for using docs with AI assistants

## Product Specifications
- product_requirements.md — Product requirements and acceptance criteria.
- architecture.md — Local-first architecture, storage, workers, crypto, flows.
- data_model.md — Local stores and schemas for encrypted IndexedDB.
- api_contracts.md — Frontend-facing contracts and local job lifecycle.
- integrations.md — Specs for ASIN, Switched, Amadeus usage (developer keys).
- oauth_self_sovereign.md — OAuth PKCE for Gmail/Outlook; key handling.
- ux_ui.md — Information architecture, screens, interactions, accessibility.
- security_privacy.md — Threat model, controls, and compliance posture.

## Legacy Planning Documents
- roadmap.md — High-level delivery phases (use DEVELOPMENT_PLAN.md instead).
- tickets/backlog.md — High-level tickets (use DEVELOPMENT_PLAN.md instead).
- testing/ — Testing framework configs (use TESTING_PLAN.md for strategy).
- acceptance_criteria.md — MVP acceptance and quality gates.
- rollout_plan.md — Alpha → Beta → GA plan.

How to Use

## For Human Developers:
- **Start Here**: Begin with DEVELOPMENT_PLAN.md for realistic sprint-by-sprint implementation
- **Testing**: Follow TESTING_PLAN.md for comprehensive validation strategy with measurable outcomes
- **AI Collaboration**: Use AI_COLLABORATION_GUIDE.md for effective AI-assisted development

## For AI-Assisted Development:
- **Start Here**: Use DEVELOPER_GUIDELINES.md for step-by-step AI instruction templates
- **Context First**: Always begin with session context templates from DEVELOPER_GUIDELINES.md
- **Requirements**: Reference DEVELOPMENT_PLAN.md task requirements and acceptance criteria  
- **Testing**: Generate tests per TESTING_PLAN.md alongside all feature implementation
- **Architecture**: Follow constraints in architecture.md and security_privacy.md

## General Guidelines:
- Reference architecture.md for implementation patterns and constraints
- Use product_requirements.md and acceptance_criteria.md to validate MVP goals
- Track progress with discrete tasks in DEVELOPMENT_PLAN.md rather than high-level roadmap.md
- **When you scaffold the frontend, adopt the testing/tools configs and enable CI frontend jobs by adding package.json**
