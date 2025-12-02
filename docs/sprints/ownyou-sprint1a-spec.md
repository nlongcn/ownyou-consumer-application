# Sprint 1a: Desktop Infrastructure

## Reference Documents
- **Sprint Spec:** `docs/sprints/ownyou-sprint1-spec.md`
- **Architecture:** `docs/architecture/OwnYou_architecture_v13.md`
- **Storage Backends:** `docs/architecture/extracts/storage-backends-8.13.md`

---

## Sprint 0: ✅ COMPLETE (Summary)

| Package | Status |
|---------|--------|
| `@ownyou/shared-types` | ✅ Built (includes NamespaceTuple) |
| `@ownyou/memory-store` | ✅ Built + 217 tests passing |
| `@ownyou/llm-client` | ✅ Built + Tests passing |
| `@ownyou/observability` | ✅ Built + Tests passing |
| Admin Dashboard | ✅ Build succeeds (29/29 pages) |

---

## Sprint 1a: Infrastructure

**Goal:** Desktop foundation with SQLite backend
**Duration:** 1 week

### Deliverables

| # | Deliverable | Priority | Acceptance Criteria |
|---|-------------|----------|---------------------|
| 1 | Tauri scaffold | P0 | `apps/desktop/` with React frontend launches |
| 2 | SQLite backend | P0 | `@ownyou/memory-store` SQLite adapter passes tests |
| 3 | Custom protocol | P0 | `ownyou://` URLs open Tauri app |

---

## Implementation Tasks

### Task 1: Tauri Desktop Scaffold (Day 1-2)

**Create `apps/desktop/` with Tauri 2.0:**

```
apps/desktop/
├── src/                    # React frontend
│   ├── App.tsx
│   ├── main.tsx
│   └── components/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── main.rs
│       ├── oauth.rs        # Deep link handler (Sprint 1b)
│       └── keychain.rs     # OS keychain (Sprint 1b)
├── package.json
└── vite.config.ts
```

**Steps:**
1. Add `apps/` to `pnpm-workspace.yaml`
2. Run `pnpm create tauri-app` in apps/desktop/
3. Configure Tauri 2.0 with React + TypeScript
4. Add deep-link plugin for `ownyou://` protocol
5. Connect to Sprint 0 packages (`@ownyou/memory-store`, `@ownyou/shared-types`)

**Tauri Configuration (tauri.conf.json):**
```json
{
  "plugins": {
    "deep-link": {
      "desktop": {
        "schemes": ["ownyou"]
      }
    }
  }
}
```

---

### Task 2: SQLite Backend for memory-store (Day 3-4)

**Add `packages/memory-store/src/backends/sqlite.ts`:**

The SQLiteBackend must implement the existing `StorageBackend` interface:

```typescript
interface StorageBackend {
  put<T>(namespace: string, userId: string, key: string, value: T): Promise<void>;
  get<T>(namespace: string, userId: string, key: string): Promise<T | null>;
  delete(namespace: string, userId: string, key: string): Promise<boolean>;
  list<T>(namespace: string, userId: string, limit: number, offset: number): Promise<T[]>;
  exists(namespace: string, userId: string, key: string): Promise<boolean>;
  getStats(namespace: string, userId: string): Promise<StoreStats>;
  clear(namespace?: string, userId?: string): Promise<void>;
  close?(): Promise<void>;
}
```

**Implementation approach:**
- Use `better-sqlite3` for Node.js testing
- Use `@tauri-apps/plugin-sql` for Tauri runtime
- Single table schema mirroring IndexedDB structure:

```sql
CREATE TABLE memories (
  composite_key TEXT PRIMARY KEY,  -- namespace::userId::key
  namespace TEXT NOT NULL,
  user_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,             -- JSON serialized
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_namespace_user ON memories(namespace, user_id);
CREATE INDEX idx_namespace ON memories(namespace);
CREATE INDEX idx_user ON memories(user_id);
```

**Testing:**
- Run existing IndexedDB test suite against SQLite backend
- Both backends should pass identical tests

---

### Task 3: Custom Protocol Handler (Day 5-7)

**Configure `ownyou://` URL scheme:**

1. **Tauri deep-link plugin** (already in tauri.conf.json)
2. **Rust handler** in `src-tauri/src/oauth.rs`:

```rust
pub fn setup_deep_link_handler(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    app.deep_link().on_open_url(move |event| {
        // Handle ownyou://oauth/callback/microsoft
        // Handle ownyou://oauth/callback/google
        // Handle ownyou://test (for verification)
    });
    Ok(())
}
```

3. **Platform registration:**
   - macOS: Info.plist URL scheme
   - Windows: Registry entry (Tauri handles this)
   - Linux: .desktop file

---

## Critical Files

| File | Purpose |
|------|---------|
| `pnpm-workspace.yaml` | Add `apps/*` to workspace |
| `apps/desktop/package.json` | Tauri app config |
| `apps/desktop/src-tauri/tauri.conf.json` | Tauri + deep-link config |
| `apps/desktop/src-tauri/src/main.rs` | Rust entry point |
| `packages/memory-store/src/backends/sqlite.ts` | **NEW** SQLite backend |
| `packages/memory-store/src/backends/types.ts` | StorageBackend interface (existing) |
| `packages/memory-store/src/backends/indexeddb.ts` | Reference implementation |

---

## Success Criteria

- [ ] `pnpm tauri dev` launches desktop app with React UI
- [ ] SQLite backend passes **same test suite** as IndexedDB backend
- [ ] `ownyou://test` opens the Tauri app
- [ ] Desktop app can read/write to SQLite via memory-store
- [ ] Code committed and pushed to feature branch

---

## Dependencies & Prerequisites

**Required tools:**
- Rust toolchain (`rustup`)
- Tauri CLI (`cargo install tauri-cli`)
- Node.js 18+, pnpm

**Sprint 0 packages (already complete):**
- `@ownyou/shared-types`
- `@ownyou/memory-store` (IndexedDB backend)

---

## Next: Sprint 1b

After Sprint 1a, proceed to Sprint 1b:
- Unified OAuth package (browser + desktop)
- Microsoft/Google OAuth with long-lived tokens
- IAB classifier migration to `packages/iab-classifier/`
- Email fetch + classification pipeline

See `docs/sprints/ownyou-sprint1-spec.md` for full Sprint 1b details.
