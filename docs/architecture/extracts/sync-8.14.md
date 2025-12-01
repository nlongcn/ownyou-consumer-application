# Memory-Sync Integration (v13 Section 8.14)

*Extracted from OwnYou_architecture_v13.md for AI assistant context loading*

Memory must synchronize across devices while respecting privacy and handling offline scenarios.

## Sync Scope by Namespace

| Namespace | Sync? | Rationale |
|-----------|-------|-----------|
| `semantic_memory` | ✅ Yes | User preferences should be consistent across devices |
| `episodic_memory` | ⚠️ Selective | Recent episodes sync; old episodes archived locally |
| `procedural_memory` | ✅ Yes | Agent rules must be consistent (critical for UX) |
| `entities` | ✅ Yes | Entity knowledge should be shared |
| `relationships` | ✅ Yes | Relationship context should be shared |
| `community_summaries` | ✅ Yes | Summaries are derived; sync for efficiency |
| `iab_classifications` | ✅ Yes | Advertising profile must be consistent |
| `ikigai_profile` | ✅ Yes | Core user understanding shared |
| `mission_cards` | ✅ Yes | Active missions visible everywhere |
| `mission_feedback` | ✅ Yes | Feedback informs all devices |
| `earnings` | ✅ Yes | Financial data must be accurate everywhere |
| **Device-local only:** | | |
| `embedding_queue` | ❌ No | Device-specific processing queue |
| `sync_metadata` | ❌ No | Per-device sync state |
| `temp_*` | ❌ No | Temporary processing data |

## Sync Architecture with OrbitDB

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           LANGGRAPH STORE                                │
│                    (Local IndexedDB or SQLite)                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Store operations
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         MEMORY SYNC LAYER                                │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    SYNC DECISION ENGINE                           │  │
│  │  • Checks namespace against sync scope table                      │  │
│  │  • Applies freshness rules for episodic memory                    │  │
│  │  • Adds encryption before sync                                    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                    │                                     │
│                                    ▼                                     │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                     ORBITDB CRDT LAYER                            │  │
│  │  • Encrypted operations only                                      │  │
│  │  • CRDT merge semantics for conflict-free sync                    │  │
│  │  • P2P + optional cloud relay                                     │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                     ┌──────────────┼──────────────┐
                     ▼              ▼              ▼
              ┌──────────┐  ┌──────────┐  ┌──────────┐
              │ Device A │  │ Device B │  │ Device C │
              │  (Phone) │  │ (Desktop)│  │ (Tablet) │
              └──────────┘  └──────────┘  └──────────┘
```

## Encryption Requirements

All synced data is encrypted before leaving the device:

```typescript
interface SyncPayload {
  ciphertext: Uint8Array;         // Encrypted content (AES-256-GCM)
  iv: Uint8Array;                 // Random IV per operation
  key_derivation_salt: string;    // For wallet-derived key
  namespace: string;
  operation: "put" | "update" | "delete";
  timestamp: number;
  device_id: string;
}

const encryptForSync = async (
  memory: Memory,
  namespace: string,
  walletKey: CryptoKey
): Promise<SyncPayload> => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = JSON.stringify(memory);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    walletKey,
    new TextEncoder().encode(plaintext)
  );

  return {
    ciphertext: new Uint8Array(ciphertext),
    iv,
    key_derivation_salt: currentSalt,
    namespace,
    operation: "put",
    timestamp: Date.now(),
    device_id: getDeviceId()
  };
};
```

**Key management:** Encryption key is derived from user's wallet (deterministic derivation). All devices with access to the wallet can decrypt synced memories.

## Conflict Resolution by Namespace

| Namespace | Conflict Strategy | Rationale |
|-----------|-------------------|-----------|
| **semantic_memory** | Latest-write-wins | Preferences evolve; newest is most accurate |
| **episodic_memory** | Merge (append) | Episodes are immutable records; both valid |
| **procedural_memory** | Latest-write-wins + reconcile | Rules must be consistent; trigger Reflection |
| **entities** | Merge properties | Combine entity properties from both versions |
| **relationships** | Latest-write-wins | Relationship state should be newest |
| **mission_cards** | Custom merge | Active missions merge; completed use newest |
| **earnings** | Sum (financial reconcile) | Never lose earnings; reconcile with ledger |

## Episodic Memory Sync Rules

```typescript
const EPISODIC_SYNC_RULES = {
  recent_threshold_days: 30,

  always_sync_if: {
    outcome: "negative",           // Learning opportunities
    has_user_feedback: true,       // Explicit user input
    led_to_procedural_rule: true,  // Contributed to learning
  },

  archive_after_days: 90,
  max_synced_per_agent: 50,
};

const shouldSyncEpisode = (episode: Episode): boolean => {
  const age = daysBetween(episode.timestamp, now());

  if (age < EPISODIC_SYNC_RULES.recent_threshold_days) return true;
  if (episode.outcome === "negative") return true;
  if (episode.user_feedback) return true;
  if (episode.led_to_procedural_rule) return true;

  return false;
};
```
