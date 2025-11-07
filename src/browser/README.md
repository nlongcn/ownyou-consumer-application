# Browser Module

**Purpose:** Browser-specific implementations for OwnYou PWA

## Structure

- `store/` - IndexedDBStore implementation (long-term cross-agent memory)
- `checkpointer/` - PGlite checkpointer integration (short-term thread state)
- `agents/` - LangGraph agent implementations
  - `iab-classifier/` - IAB Taxonomy classification agent
  - `mission-agent/` - Mission card generation agent

## Dependencies

- `@langchain/langgraph` - Agent workflow orchestration
- `@steerprotocol/langgraph-checkpoint-pglite` - IndexedDB checkpointing
- IndexedDB API (browser native)

## Design Principles

- **Self-Sovereign:** All data stays in browser (IndexedDB)
- **Offline-First:** Works without network connection
- **Privacy-First:** No raw personal data sent to external APIs
