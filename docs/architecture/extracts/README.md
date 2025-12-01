# Architecture Extracts

**Purpose:** Focused, loadable sections from `OwnYou_architecture_v13.md` for AI assistant context.

The full v13 architecture is ~7000 lines - too large for per-task context loading. These extracts allow loading only relevant sections.

## Available Extracts

| File | Section | Lines | Use When |
|------|---------|-------|----------|
| `memory-types-8.4.md` | 8.4 Memory Schema | ~150 | Implementing memory storage, understanding Memory/Episode/Entity types |
| `namespaces-8.12.md` | 8.12 Namespace Schema | ~60 | Using STORE_NAMESPACES, understanding namespace organization |
| `storage-backends-8.13.md` | 8.13 Storage Backends | ~40 | Platform-specific storage, IndexedDB vs SQLite vs PostgreSQL |
| `llm-cost-6.10.md` | 6.10 LLM Cost Management | ~120 | Budget enforcement, model tier selection, throttling |
| `sync-8.14.md` | 8.14 Memory-Sync Integration | ~180 | OrbitDB sync, encryption, conflict resolution |

## Usage

Load relevant extracts based on task:

- **Implementing Store operations**: Load `namespaces-8.12.md` + `storage-backends-8.13.md`
- **Working with memories**: Load `memory-types-8.4.md`
- **Adding LLM features**: Load `llm-cost-6.10.md`
- **Adding sync support**: Load `sync-8.14.md`

## Maintenance

When v13 architecture is updated:
1. Re-extract affected sections
2. Update line counts in this README
3. Verify TypeScript interfaces match source
