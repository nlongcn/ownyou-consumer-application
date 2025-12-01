# Storage Backends (v13 Section 8.13)

*Extracted from OwnYou_architecture_v13.md for AI assistant context loading*

LangGraph Store abstracts the persistence layer, allowing the same memory architecture across platforms:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        LANGGRAPH STORE API                               │
│         put() | get() | search() | list() | delete()                    │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
          ▼                        ▼                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   PWA/Browser   │     │  Tauri Desktop  │     │   Production    │
│                 │     │                 │     │                 │
│  IndexedDB +    │     │  SQLite +       │     │  PostgreSQL +   │
│  (vector: local │     │  LanceDB        │     │  pgvector       │
│   embeddings)   │     │  (+ Kuzu graph) │     │  (+ Neo4j opt.) │
│                 │     │                 │     │                 │
│  Sync: OrbitDB  │     │  Sync: OrbitDB  │     │  Sync: Native   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Platform Comparison

| Platform | Structured Storage | Vector Search | Graph (Optional) | Sync |
|----------|-------------------|---------------|------------------|------|
| **PWA** | IndexedDB | Local embeddings | In-memory | OrbitDB |
| **Tauri Desktop** | SQLite + SQLCipher | LanceDB | Kuzu (embedded) | OrbitDB |
| **Production** | PostgreSQL | pgvector | Neo4j | Native replication |

## Key Design Principles

1. **Same API everywhere**: All platforms use `put()`, `get()`, `search()`, `list()`, `delete()`
2. **Local-first**: Data lives on device, syncs via OrbitDB
3. **Progressive enhancement**: PWA is simplest, Desktop adds LanceDB/Kuzu
4. **Privacy by design**: Encryption before sync (wallet-derived keys)
