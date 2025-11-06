# Memory Backend Evaluation for Web Application Deployment

**Date**: September 30, 2025
**Context**: Choosing persistent memory backend for IAB Taxonomy Profile System in web-app environment

---

## Requirements

### Functional Requirements
1. **Persistence**: Data must survive app restarts
2. **LangMem Compatibility**: Must work with LangGraph's memory system
3. **Multi-User**: Support concurrent users with isolated data
4. **Incremental Processing**: Track processed emails per user across sessions
5. **Confidence Evolution**: Store and update confidence scores over time
6. **Query Performance**: Fast retrieval for profile generation

### Non-Functional Requirements
1. **Web-App Deployment**: Must work in browser-based or serverless environments
2. **Scalability**: Handle 100s-1000s of users
3. **Cost**: Minimize hosting costs
4. **Setup Complexity**: Easy deployment and maintenance
5. **Data Privacy**: User data isolation and security

---

## Options Comparison

### Option 1: PostgreSQL (Traditional Server)

**Architecture**:
```
Web App → API Server → PostgreSQL Database
```

**Pros**:
- ✅ Full SQL capabilities with ACID guarantees
- ✅ Excellent LangMem support (built-in `PostgresStore`)
- ✅ Industry standard, battle-tested at scale
- ✅ Strong data integrity and consistency
- ✅ Rich query capabilities for analytics
- ✅ Many managed options (AWS RDS, Heroku, Supabase, Neon)

**Cons**:
- ❌ Requires server infrastructure (not serverless)
- ❌ Always-on database = ongoing costs (~$7-50/month minimum)
- ❌ Network latency for every memory operation
- ❌ Over-engineered for simple key-value storage
- ❌ Requires connection pooling, maintenance

**Cost Estimate**:
- Managed PostgreSQL: $7-50/month (AWS RDS, Heroku)
- Serverless PostgreSQL: $0.10/GB-month + $0.05/1M requests (Neon, Supabase)

**Best For**: Traditional web apps with dedicated backend server

---

### Option 2: Redis (In-Memory Cache)

**Architecture**:
```
Web App → API Server → Redis Cache
```

**Pros**:
- ✅ Extremely fast (in-memory)
- ✅ Simple key-value operations
- ✅ Good for caching and sessions
- ✅ Many managed options (AWS ElastiCache, Redis Cloud, Upstash)

**Cons**:
- ❌ **No native LangMem support** - would need custom implementation
- ❌ Data persistence is optional (can lose data on restart)
- ❌ Memory-based = expensive for large datasets
- ❌ Not ideal for long-term storage
- ❌ Requires server infrastructure

**Cost Estimate**:
- Managed Redis: $15-100/month
- Serverless Redis (Upstash): $0.20/100K requests

**Best For**: High-throughput caching, not primary storage

---

### Option 3: SQLite (File-Based Database)

**Architecture**:
```
Web App → SQLite File (local or cloud storage)
```

**Pros**:
- ✅ Zero setup, no server required
- ✅ Portable (single file)
- ✅ Free (no hosting costs)
- ✅ Good performance for single-user
- ✅ Can be stored in cloud storage (S3, etc.)

**Cons**:
- ❌ **No native LangMem support** - would need custom implementation
- ❌ Single-writer limitation (problematic for concurrent users)
- ❌ File locking issues in web environments
- ❌ Not suitable for multi-user web apps
- ❌ Limited scalability

**Cost Estimate**:
- Free (SQLite library)
- Storage: $0.023/GB-month (S3)

**Best For**: Desktop apps, single-user tools, embedded systems

---

### Option 4: IndexedDB (Browser-Native Storage)

**Architecture**:
```
Web App (Browser) → IndexedDB (Browser Storage)
```

**Pros**:
- ✅ **Zero backend infrastructure needed**
- ✅ **Zero hosting costs**
- ✅ Built into every modern browser
- ✅ Good performance (local storage)
- ✅ Perfect for privacy (data never leaves browser)
- ✅ Works offline
- ✅ ~50MB-1GB storage per origin

**Cons**:
- ❌ **No native LangMem support** - would need custom adapter
- ❌ Data tied to browser (can be cleared by user)
- ❌ No cross-device sync by default
- ❌ Storage limits (~50MB-1GB depending on browser)
- ❌ No server-side processing

**Cost Estimate**:
- **$0 - Completely free**

**Best For**: Privacy-focused PWAs, offline-first apps, client-side processing

---

### Option 5: Cloud Document Database (MongoDB, Firestore)

**Architecture**:
```
Web App → Cloud Document DB (MongoDB Atlas, Firestore)
```

**Pros**:
- ✅ Flexible schema (JSON documents)
- ✅ Good for nested data structures
- ✅ Managed service with auto-scaling
- ✅ Built-in multi-user support
- ✅ Real-time sync capabilities (Firestore)

**Cons**:
- ❌ **No native LangMem support** - would need custom implementation
- ❌ Not optimized for LangMem's namespace/key-value pattern
- ❌ Can be expensive at scale
- ❌ Vendor lock-in

**Cost Estimate**:
- MongoDB Atlas: Free tier → $57/month for production
- Firestore: $0.18/GB-month + $0.06-0.18/100K operations

**Best For**: Apps with complex document structures, real-time features

---

### Option 6: Serverless Key-Value Store (AWS DynamoDB, Cloudflare KV)

**Architecture**:
```
Web App → Serverless KV Store (DynamoDB, Cloudflare KV)
```

**Pros**:
- ✅ Pay-per-use pricing (can be very cheap)
- ✅ Automatic scaling
- ✅ No server management
- ✅ Global distribution options
- ✅ Good for key-value workloads

**Cons**:
- ❌ **No native LangMem support** - would need custom implementation
- ❌ Complex pricing models
- ❌ Can get expensive with high throughput
- ❌ Less flexible than SQL

**Cost Estimate**:
- DynamoDB: $1.25/GB-month + $0.25/1M reads
- Cloudflare KV: $0.50/GB-month + $0.50/1M reads

**Best For**: Globally distributed apps, serverless architectures

---

### Option 7: Hybrid - IndexedDB + Cloud Sync (Recommended for Web App)

**Architecture**:
```
Web App (Browser) → IndexedDB (Local)
                  → Cloud Storage (Optional Sync/Backup)
```

**Strategy**:
1. **Primary Storage**: IndexedDB in browser (fast, free, private)
2. **Optional Backup**: Encrypt and sync to S3/Cloud Storage
3. **Cross-Device**: User exports encrypted profile, imports on other device
4. **Server**: Only for LLM API calls, no memory storage

**Pros**:
- ✅ **Zero database hosting costs**
- ✅ **Maximum privacy** (data never leaves browser)
- ✅ Fast (local storage)
- ✅ Works offline
- ✅ Simple architecture
- ✅ Easy to implement custom LangMem adapter

**Cons**:
- ❌ Requires custom LangMem adapter implementation
- ❌ Data per-device by default (need export/import for cross-device)
- ❌ Storage limits (~50MB-1GB)

**Cost Estimate**:
- **$0 - Completely free** (except optional S3 backup: ~$0.10/month)

**Best For**: Privacy-focused web apps, PWAs, client-side processing

---

## Recommendation Matrix

| Scenario | Best Choice | Reasoning |
|----------|-------------|-----------|
| **Privacy-First PWA** | IndexedDB + Cloud Sync | Zero cost, maximum privacy, no backend |
| **Traditional Web App** | PostgreSQL | LangMem support, proven at scale |
| **Serverless API** | DynamoDB or Firestore | Pay-per-use, auto-scaling |
| **High-Throughput** | Redis + PostgreSQL | Fast cache + durable storage |
| **Desktop App** | SQLite | Zero setup, portable |

---

## Decision for This Project

### Context
Based on `developer_docs/architecture.md`, this project is designed as:
- **Local-first web frontend** (React/Next.js PWA)
- **Privacy-by-design** (no server-side content storage)
- **Client-side processing** using WebWorkers
- **Developer-managed LLM API keys** (proof of concept)

### Recommended Approach: **IndexedDB with Custom LangMem Adapter**

**Rationale**:
1. **Aligns with privacy-first architecture** - data never leaves browser
2. **Zero backend costs** - no database hosting needed
3. **Local-first design** - matches PWA architecture
4. **Simple deployment** - just static hosting (Vercel, Netlify, GitHub Pages)
5. **Works offline** - full functionality without internet

### Implementation Plan

#### Phase 1: Custom IndexedDB Adapter for LangMem

```javascript
// src/memory/IndexedDBStore.ts

import { BaseStore } from '@langchain/langgraph';

export class IndexedDBStore extends BaseStore {
  private db: IDBDatabase;
  private dbName = 'email_parser_memory';

  async initialize() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;

        // Create object stores
        if (!db.objectStoreNames.contains('memories')) {
          const store = db.createObjectStore('memories', { keyPath: 'id' });
          store.createIndex('namespace', 'namespace', { unique: false });
          store.createIndex('key', 'key', { unique: false });
        }
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  async put(namespace: string[], key: string, value: any) {
    const tx = this.db.transaction('memories', 'readwrite');
    const store = tx.objectStore('memories');

    const memory = {
      id: `${namespace.join('/')}_${key}`,
      namespace: namespace.join('/'),
      key,
      value,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await store.put(memory);
  }

  async get(namespace: string[], key: string) {
    const tx = this.db.transaction('memories', 'readonly');
    const store = tx.objectStore('memories');

    const id = `${namespace.join('/')}_${key}`;
    return await store.get(id);
  }

  async search(namespace: string[]) {
    const tx = this.db.transaction('memories', 'readonly');
    const store = tx.objectStore('memories');
    const index = store.index('namespace');

    const results = [];
    const request = index.openCursor(IDBKeyRange.only(namespace.join('/')));

    return new Promise((resolve) => {
      request.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
    });
  }
}
```

#### Phase 2: Python Bridge (for current CLI)

For the **current Python CLI implementation**, we have two paths:

**Path A: Use PostgreSQL for Python CLI** (recommended for now)
- CLI uses PostgreSQL (for development/testing)
- Web app uses IndexedDB (for production)
- Both implementations compatible via shared JSON schema

**Path B: Use SQLite for Python CLI**
- CLI uses SQLite file (simplest for development)
- Custom adapter to match LangMem interface
- Migrate to IndexedDB for web app later

### Recommended Next Steps

**For Current Python CLI (immediate)**:
1. Implement **SQLite backend** (simplest, no server setup)
2. Create custom adapter matching LangMem interface
3. Test persistence and incremental processing
4. Deploy as working CLI tool

**For Future Web App (when building frontend)**:
1. Implement IndexedDB adapter in TypeScript
2. Reuse same memory schema/logic
3. Deploy as static PWA with zero backend costs

---

## Final Recommendation

### For Phase 5 Track 2 (Now): **SQLite with Custom Adapter**

**Why**:
- ✅ Zero setup (no PostgreSQL installation needed)
- ✅ Free (no hosting costs)
- ✅ Portable (single file)
- ✅ Good for CLI tool
- ✅ Can migrate to IndexedDB for web app later
- ✅ Same memory interface as LangMem

**Implementation**:
```python
# src/email_parser/memory/backends/sqlite_store.py

import sqlite3
import json
from typing import List, Dict, Any, Optional

class SQLiteStore:
    """SQLite-based store compatible with LangMem interface."""

    def __init__(self, db_path: str = "data/email_parser_memory.db"):
        self.db_path = db_path
        self._setup_database()

    def _setup_database(self):
        """Initialize database schema."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS memories (
                id TEXT PRIMARY KEY,
                namespace TEXT NOT NULL,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("CREATE INDEX IF NOT EXISTS idx_namespace ON memories(namespace)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_key ON memories(key)")

        conn.commit()
        conn.close()

    def put(self, namespace: tuple, key: str, value: Dict[str, Any]):
        """Store a memory."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        namespace_str = "/".join(namespace)
        memory_id = f"{namespace_str}_{key}"
        value_json = json.dumps(value)

        cursor.execute("""
            INSERT OR REPLACE INTO memories (id, namespace, key, value, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        """, (memory_id, namespace_str, key, value_json))

        conn.commit()
        conn.close()

    def get(self, namespace: tuple, key: str) -> Optional[Dict[str, Any]]:
        """Retrieve a memory."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        namespace_str = "/".join(namespace)
        memory_id = f"{namespace_str}_{key}"

        cursor.execute("SELECT value FROM memories WHERE id = ?", (memory_id,))
        row = cursor.fetchone()
        conn.close()

        if row:
            return json.loads(row[0])
        return None

    def search(self, namespace: tuple) -> List[Dict[str, Any]]:
        """Search memories by namespace."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        namespace_str = "/".join(namespace)

        cursor.execute(
            "SELECT key, value FROM memories WHERE namespace = ?",
            (namespace_str,)
        )

        results = []
        for row in cursor.fetchall():
            memory = json.loads(row[1])
            memory['key'] = row[0]
            results.append(memory)

        conn.close()
        return results
```

**Configuration**:
```bash
# .env
MEMORY_BACKEND=sqlite
MEMORY_DATABASE_PATH=data/email_parser_memory.db
```

**Advantages**:
1. No external database setup required
2. Data stored in single file (`data/email_parser_memory.db`)
3. Easy to backup (just copy the file)
4. Easy to reset (delete the file)
5. Perfect for development and testing
6. Can transition to PostgreSQL later if needed for production CLI

---

## Conclusion

**For immediate implementation (Phase 5 Track 2)**:
→ **Use SQLite** for Python CLI

**For future web app**:
→ **Use IndexedDB** for browser-based PWA

Both align with the project's privacy-first, local-first architecture while minimizing costs and complexity.
