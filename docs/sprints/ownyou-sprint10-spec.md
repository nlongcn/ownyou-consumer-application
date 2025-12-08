# Sprint 10: Cross-Device Sync

**Duration:** 3 weeks
**Status:** PLANNED
**Goal:** Implement cross-device synchronization using OrbitDB v3 + Helia with E2EE encryption, enabling users to seamlessly access their data across multiple devices
**Success Criteria:** Data syncs between devices, conflicts resolved automatically (CRDT), all sync data encrypted, E2EE backup working, key recovery tested
**Depends On:** Sprint 9 complete (Observability & Debugging)
**v13 Coverage:** Section 5 (Complete), Section 8.14 (Memory-Sync Integration)

---

## Previous Sprint Summary

### Sprint 9: Observability & Debugging (COMPLETE)

- `@ownyou/observability` — Enhanced with agent tracing, sync logging infrastructure, LLM metrics, GDPR export (154 tests)
- `@ownyou/debug-ui` — Agent Inspector, Cost Dashboard, Sync Monitor placeholder, Data Export UI (75 tests)
- Total: 229 tests

**Current State:**

- 6 agents operational (Shopping, Content, Restaurant, Events, Travel, Diagnostic)
- 4 data sources operational (Email, Financial, Calendar, Browser)
- Memory system with hybrid retrieval and reflection
- 4-mode trigger system with agent coordinator
- Ikigai intelligence layer for personalization
- Production-ready observability and debugging
- GDPR-compliant data export
- **Single-device only** — No cross-device sync
- **No data backup** — Data loss risk if device lost

---

## Sprint 10 Overview

```
+------------------------------------------------------------------+
|                     SPRINT 10 END STATE                           |
+------------------------------------------------------------------+
|                                                                   |
|  WEEK 1: ORBITDB + HELIA INTEGRATION                              |
|  +----------------------------------------------------------+     |
|  | [Setup OrbitDB v3 with Helia (IPFS)]                     |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Implement SyncLayer abstraction over Store]             |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Configure CRDT types per namespace (G-Counter,          |     |
|  |  OR-Set, LWW-Register)]                                  |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Implement offline queue with vector clocks]             |     |
|  +----------------------------------------------------------+     |
|                                                                   |
|  WEEK 2: ENCRYPTION & DEVICE DISCOVERY                            |
|  +----------------------------------------------------------+     |
|  | [Evaluate OrbitDB v3 native encryption]                  |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Implement wallet-derived encryption (Privy)]            |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Build device discovery via wallet identity]             |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Setup signaling server for NAT traversal]               |     |
|  +----------------------------------------------------------+     |
|                                                                   |
|  WEEK 3: E2EE BACKUP & RECOVERY                                   |
|  +----------------------------------------------------------+     |
|  | [Implement E2EE cloud backup (Signal-style)]             |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Build recovery flow: wallet → backup → restore]         |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Memory-Sync integration (namespace scope rules)]        |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Connect SyncMonitor UI to real sync status]             |     |
|  +----------------------------------------------------------+     |
|                                                                   |
|  MULTI-DEVICE SYNC WITH E2EE BACKUP                               |
|  ZERO DATA LOSS ON DEVICE LOSS                                    |
|                                                                   |
+------------------------------------------------------------------+
```

---

## v13 Architecture Compliance

### Target Sections: v13 Section 5 (Data Source Sync)

| v13 Section | Requirement | Sprint 10 Implementation | Priority |
|-------------|-------------|-------------------------|----------|
| **5.1** | Platform Tier Architecture | Tauri full node, PWA light client | P0 |
| **5.2** | OrbitDB v3 + Helia | Core sync infrastructure | P0 |
| **5.2.1** | Offline Handling | Offline queue with vector clocks | P0 |
| **5.2.2** | CRDT Conflict Resolution | G-Counter, OR-Set, LWW per namespace | P0 |
| **5.2.3** | Device Discovery | Privy wallet-based auto-discovery | P0 |
| **5.2.4** | Encryption Policy | OrbitDB native + fallback custom AES-GCM | P0 |
| **5.3** | Key Recovery | Privy recovery + mnemonic backup | P0 |
| **5.4** | E2EE Cloud Backup | Signal-style zero-knowledge backup | P0 |
| **8.14** | Memory-Sync Integration | Sync scope rules per namespace | P0 |
| **10.3** | Sync Debugging | Connect SyncMonitor UI to real data | P1 |

### Already Complete (from previous sprints)

| v13 Section | Requirement | Status |
|-------------|-------------|--------|
| **3.6.1** | All 6 mission agents | ✅ Sprint 3-8 |
| **2.1-2.9** | Complete Ikigai Intelligence | ✅ Sprint 6 |
| **8.1-8.11** | Memory system with retrieval and reflection | ✅ Sprint 4 |
| **Phase 2A** | Financial + Calendar data sources | ✅ Sprint 8 |
| **10.1-10.6** | Observability & Debugging | ✅ Sprint 9 |

---

## Package Specifications

### Package 1: `@ownyou/sync`

**Purpose:** Core sync infrastructure using OrbitDB v3 + Helia

**Dependencies:**
- `@orbitdb/core` (v3) — P2P database
- `helia` — Modern IPFS implementation
- `@orbitdb/simple-encryption` — Encryption module
- `libp2p` — P2P networking
- `blockstore-level` — Storage backend
- `@ownyou/shared-types` (namespaces)
- `@ownyou/store` (local store interface)
- `@ownyou/observability` (sync logging)

**Directory Structure:**
```
packages/sync/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── types.ts
│   ├── core/
│   │   ├── sync-layer.ts          # SyncLayer abstraction
│   │   ├── orbitdb-client.ts      # OrbitDB v3 wrapper
│   │   ├── helia-node.ts          # Helia IPFS node
│   │   └── offline-queue.ts       # Offline mutation queue
│   ├── crdt/
│   │   ├── index.ts
│   │   ├── g-counter.ts           # Grow-only counter
│   │   ├── pn-counter.ts          # Increment/decrement counter
│   │   ├── or-set.ts              # Observed-remove set
│   │   ├── lww-register.ts        # Last-write-wins register
│   │   ├── lww-map.ts             # Last-write-wins map
│   │   └── conflict-resolver.ts   # Namespace → CRDT routing
│   ├── encryption/
│   │   ├── index.ts
│   │   ├── wallet-encryption.ts   # Privy wallet key derivation
│   │   ├── native-encryption.ts   # OrbitDB native wrapper
│   │   └── custom-encryption.ts   # AES-GCM fallback
│   ├── discovery/
│   │   ├── index.ts
│   │   ├── device-manager.ts      # Device registration
│   │   ├── wallet-discovery.ts    # Privy-based discovery
│   │   └── signaling-client.ts    # WebRTC signaling
│   └── config/
│       ├── libp2p.ts              # libp2p configuration
│       ├── sync-scope.ts          # Namespace sync rules
│       └── crdt-mapping.ts        # Namespace → CRDT type
└── __tests__/
    ├── sync-layer.test.ts
    ├── crdt/
    │   ├── g-counter.test.ts
    │   ├── or-set.test.ts
    │   └── conflict-resolver.test.ts
    ├── encryption/
    │   └── wallet-encryption.test.ts
    ├── discovery/
    │   └── device-manager.test.ts
    └── integration/
        └── sync-flow.test.ts
```

#### Core Types (from v13 Section 5.2)

```typescript
// src/types.ts
import type { Store } from '@ownyou/store';

export interface SyncLayerConfig {
  // Platform-specific mode
  platform: 'tauri' | 'pwa';

  // Privy wallet for encryption key derivation
  walletProvider: WalletProvider;

  // Signaling server for device discovery
  signalingServer: string;

  // STUN/TURN for NAT traversal
  stunServers: string[];
  turnServer?: TurnConfig;

  // Encryption mode preference
  encryptionMode: 'orbitdb-native' | 'custom-aes-gcm';
}

export interface SyncLayer {
  // Initialize sync with local store
  initialize(store: Store): Promise<void>;

  // Start syncing (call after initialize)
  start(): Promise<void>;

  // Stop syncing (cleanup)
  stop(): Promise<void>;

  // Get sync status
  getStatus(): SyncStatus;

  // Force sync now
  forceSync(): Promise<void>;

  // Get connected peers
  getPeers(): PeerDevice[];
}

export interface SyncStatus {
  isOnline: boolean;
  lastSyncTime: number | null;
  pendingMutations: number;
  connectedPeers: number;
  syncState: 'idle' | 'syncing' | 'offline' | 'error';
  error?: string;
}

export interface PeerDevice {
  deviceId: string;
  walletAddress: string;
  platform: 'tauri' | 'pwa';
  lastSeen: number;
  connectionType: 'direct_p2p' | 'relayed' | 'cloud_backup';
}

// Offline queue entry with vector clock
export interface OfflineQueueEntry {
  id: string;
  operation: 'put' | 'delete';
  namespace: string;
  key: string;
  value: unknown;
  timestamp: number;
  vectorClock: VectorClock;
  synced: boolean;
}

export interface VectorClock {
  // deviceId → logical timestamp
  [deviceId: string]: number;
}
```

#### CRDT Type Mapping (from v13 Section 5.2.2)

```typescript
// src/config/crdt-mapping.ts
export type CRDTType = 'g-counter' | 'pn-counter' | 'or-set' | 'lww-register' | 'lww-map';

export const CRDT_TYPE_BY_NAMESPACE: Record<string, CRDTType> = {
  // G-Counter: Values that only increment
  'ownyou.earnings': 'g-counter',
  'ownyou.ikigai.points': 'g-counter',
  'ownyou.missions.completionCount': 'g-counter',

  // PN-Counter: Values that can increment/decrement
  'ownyou.token.balance': 'pn-counter',

  // OR-Set: Collections with add/remove
  'ownyou.iab.classifications': 'or-set',
  'ownyou.missions.tags': 'or-set',
  'ownyou.sync.trustedPeers': 'or-set',
  'ownyou.missions.dismissed': 'or-set',

  // LWW-Register: Atomic fields where latest wins
  'ownyou.preferences': 'lww-register',
  'ownyou.user.name': 'lww-register',
  'ownyou.notifications.settings': 'lww-register',
  'ownyou.sync.lastTimestamp': 'lww-register',

  // LWW-Map: Maps where each key is independent LWW
  'ownyou.missions.states': 'lww-map',
  'ownyou.dataSources.configs': 'lww-map',
};

export function getCRDTType(namespace: string): CRDTType {
  return CRDT_TYPE_BY_NAMESPACE[namespace] || 'lww-register';
}
```

#### Sync Scope Configuration (from v13 Section 8.14)

```typescript
// src/config/sync-scope.ts
export interface SyncScopeConfig {
  shouldSync: boolean;
  syncStrategy?: 'full' | 'selective' | 'archive';
  selectiveRules?: SelectiveRule[];
}

export const SYNC_SCOPE_BY_NAMESPACE: Record<string, SyncScopeConfig> = {
  // ✅ Full sync
  'ownyou.semantic': { shouldSync: true, syncStrategy: 'full' },
  'ownyou.procedural': { shouldSync: true, syncStrategy: 'full' },
  'ownyou.entities': { shouldSync: true, syncStrategy: 'full' },
  'ownyou.relationships': { shouldSync: true, syncStrategy: 'full' },
  'ownyou.community.summaries': { shouldSync: true, syncStrategy: 'full' },
  'ownyou.iab.classifications': { shouldSync: true, syncStrategy: 'full' },
  'ownyou.ikigai.profile': { shouldSync: true, syncStrategy: 'full' },
  'ownyou.missions': { shouldSync: true, syncStrategy: 'full' },
  'ownyou.missions.feedback': { shouldSync: true, syncStrategy: 'full' },
  'ownyou.earnings': { shouldSync: true, syncStrategy: 'full' },

  // ⚠️ Selective sync (episodic memory)
  'ownyou.episodic': {
    shouldSync: true,
    syncStrategy: 'selective',
    selectiveRules: [
      { condition: 'age_days_less_than', value: 30 },
      { condition: 'outcome_equals', value: 'negative' },
      { condition: 'has_user_feedback', value: true },
      { condition: 'led_to_procedural_rule', value: true },
    ],
  },

  // ❌ Device-local only
  'ownyou.embedding.queue': { shouldSync: false },
  'ownyou.sync.metadata': { shouldSync: false },
  'ownyou.temp': { shouldSync: false },
  'ownyou.debug.traces': { shouldSync: false },
  'ownyou.debug.sync': { shouldSync: false },
};

export function shouldSyncNamespace(namespace: string): boolean {
  const config = SYNC_SCOPE_BY_NAMESPACE[namespace];
  return config?.shouldSync ?? true; // Default: sync
}
```

#### OrbitDB + Helia Setup (from context7 docs)

```typescript
// src/core/helia-node.ts
import { createHelia } from 'helia';
import { createLibp2p } from 'libp2p';
import { LevelBlockstore } from 'blockstore-level';
import { Libp2pOptions } from '../config/libp2p';

export interface HeliaNodeConfig {
  platform: 'tauri' | 'pwa';
  storagePath: string;
}

export async function createHeliaNode(config: HeliaNodeConfig) {
  const blockstore = new LevelBlockstore(config.storagePath);

  const libp2p = await createLibp2p({
    ...Libp2pOptions,
    // PWA: Resource-constrained mode
    ...(config.platform === 'pwa' && {
      connectionManager: {
        maxConnections: 10,
        minConnections: 2,
      },
    }),
  });

  const helia = await createHelia({
    libp2p,
    blockstore,
  });

  return helia;
}
```

```typescript
// src/core/orbitdb-client.ts
import { createOrbitDB, IPFSAccessController } from '@orbitdb/core';
import { SimpleEncryption } from '@orbitdb/simple-encryption';
import type { Helia } from 'helia';

export interface OrbitDBClientConfig {
  helia: Helia;
  encryptionKey: CryptoKey;
  userId: string;
}

export async function createOrbitDBClient(config: OrbitDBClientConfig) {
  const { helia, encryptionKey, userId } = config;

  // Create OrbitDB instance
  const orbitdb = await createOrbitDB({
    ipfs: helia,
    id: userId,
  });

  return orbitdb;
}

export async function openEncryptedDatabase(
  orbitdb: OrbitDB,
  dbName: string,
  encryptionPassword: string
) {
  // Setup encryption for both data and replication
  const replicationEncryption = await SimpleEncryption({ password: encryptionPassword });
  const dataEncryption = await SimpleEncryption({ password: encryptionPassword });

  const encryption = {
    replication: replicationEncryption,
    data: dataEncryption,
  };

  const db = await orbitdb.open(dbName, {
    encryption,
    AccessController: IPFSAccessController({ write: [orbitdb.identity.id] }),
  });

  return db;
}
```

**Namespace Updates Required:**

```typescript
// Add to @ownyou/shared-types/namespaces.ts
SYNC_STATUS: 'ownyou.sync.status',
SYNC_PEERS: 'ownyou.sync.peers',
SYNC_QUEUE: 'ownyou.sync.queue',
SYNC_METADATA: 'ownyou.sync.metadata',

// Add factory functions
syncStatus: (deviceId: string) => ['ownyou.sync.status', deviceId],
syncPeers: (userId: string) => ['ownyou.sync.peers', userId],
syncQueue: (deviceId: string) => ['ownyou.sync.queue', deviceId],
syncMetadata: (deviceId: string) => ['ownyou.sync.metadata', deviceId],
```

**Success Criteria:**
- [ ] OrbitDB v3 + Helia initialized successfully
- [ ] Offline queue captures mutations when offline
- [ ] CRDT conflict resolution per namespace type
- [ ] Vector clocks maintain causal ordering
- [ ] 80%+ test coverage

---

### Package 2: `@ownyou/backup`

**Purpose:** E2EE cloud backup for disaster recovery (Signal-style)

**Dependencies:**
- `@ownyou/shared-types` (namespaces)
- `@ownyou/store` (local store)
- `@ownyou/sync` (encryption utilities)

**Directory Structure:**
```
packages/backup/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── types.ts
│   ├── backup/
│   │   ├── backup-service.ts      # Backup orchestration
│   │   ├── incremental.ts         # Delta sync
│   │   └── compression.ts         # Gzip compression
│   ├── recovery/
│   │   ├── recovery-flow.ts       # Full recovery flow
│   │   └── validation.ts          # Backup integrity
│   ├── storage/
│   │   ├── cloud-provider.ts      # Cloud storage abstraction
│   │   ├── ownyou-cloud.ts        # OwnYou managed storage
│   │   └── self-hosted.ts         # Bring-your-own S3
│   └── policy/
│       └── backup-policy.ts       # Frequency, retention
└── __tests__/
    ├── backup-service.test.ts
    ├── recovery-flow.test.ts
    └── integration/
        └── backup-restore.test.ts
```

#### Backup Types (from v13 Section 5.4)

```typescript
// src/types.ts
export interface BackupConfig {
  // Storage provider
  provider: 'ownyou' | 's3' | 'gcs' | 'azure';

  // OwnYou managed (default)
  ownyouCloud?: {
    endpoint: string;
  };

  // Self-hosted (power users)
  selfHosted?: {
    credentials: EncryptedCredentials;
    bucket: string;
    region: string;
  };

  // Backup policy
  policy: BackupPolicy;
}

export interface BackupPolicy {
  frequency: {
    realtime: string[];    // Namespaces backed up immediately
    hourly: string[];      // Namespaces backed up hourly
    daily: string[];       // Namespaces backed up daily
  };

  retention: {
    snapshots: number;     // Keep N daily snapshots
    maxAgeDays: number;    // Delete backups older than N days
  };

  triggers: {
    automatic: boolean;    // Background sync when online
    beforeLogout: boolean; // Force backup before signing out
    manual: boolean;       // User can trigger anytime
  };

  optimization: {
    compression: 'gzip' | 'none';
    deduplication: boolean;
    deltaSync: boolean;
  };
}

export const DEFAULT_BACKUP_POLICY: BackupPolicy = {
  frequency: {
    realtime: ['ownyou.earnings', 'ownyou.missions.completions'],
    hourly: ['ownyou.iab.classifications', 'ownyou.ikigai.profile'],
    daily: ['ownyou.preferences', 'ownyou.semantic', 'ownyou.episodic'],
  },
  retention: {
    snapshots: 7,
    maxAgeDays: 90,
  },
  triggers: {
    automatic: true,
    beforeLogout: true,
    manual: true,
  },
  optimization: {
    compression: 'gzip',
    deduplication: true,
    deltaSync: true,
  },
};

export interface BackupResult {
  backupId: string;
  timestamp: number;
  size: number;
  namespaces: string[];
  isIncremental: boolean;
  checksum: string;
}

export interface RecoveryResult {
  success: boolean;
  restoredNamespaces: string[];
  recordCount: number;
  timestamp: number;
  error?: string;
}
```

#### Backup Service Implementation

```typescript
// src/backup/backup-service.ts
import type { Store } from '@ownyou/store';
import type { BackupConfig, BackupResult, BackupPolicy } from '../types';

export class BackupService {
  private store: Store;
  private config: BackupConfig;
  private encryptionKey: CryptoKey;

  constructor(store: Store, config: BackupConfig, encryptionKey: CryptoKey) {
    this.store = store;
    this.config = config;
    this.encryptionKey = encryptionKey;
  }

  async createBackup(options: { incremental?: boolean } = {}): Promise<BackupResult> {
    const { incremental = true } = options;

    // 1. Collect data from all syncable namespaces
    const data = await this.collectBackupData(incremental);

    // 2. Compress
    const compressed = await this.compress(data);

    // 3. Encrypt with wallet-derived key
    const encrypted = await this.encrypt(compressed);

    // 4. Upload to storage provider
    const backupId = await this.upload(encrypted);

    return {
      backupId,
      timestamp: Date.now(),
      size: encrypted.byteLength,
      namespaces: Object.keys(data),
      isIncremental: incremental,
      checksum: await this.calculateChecksum(encrypted),
    };
  }

  async restore(backupId: string): Promise<RecoveryResult> {
    // 1. Download encrypted backup
    const encrypted = await this.download(backupId);

    // 2. Decrypt with wallet-derived key
    const compressed = await this.decrypt(encrypted);

    // 3. Decompress
    const data = await this.decompress(compressed);

    // 4. Validate integrity
    await this.validateBackup(data);

    // 5. Restore to local store
    const recordCount = await this.restoreToStore(data);

    return {
      success: true,
      restoredNamespaces: Object.keys(data),
      recordCount,
      timestamp: Date.now(),
    };
  }

  private async encrypt(data: Uint8Array): Promise<Uint8Array> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.encryptionKey,
      data
    );

    // Prepend IV to ciphertext
    const result = new Uint8Array(iv.length + encrypted.byteLength);
    result.set(iv);
    result.set(new Uint8Array(encrypted), iv.length);
    return result;
  }

  private async decrypt(data: Uint8Array): Promise<Uint8Array> {
    const iv = data.slice(0, 12);
    const ciphertext = data.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      this.encryptionKey,
      ciphertext
    );

    return new Uint8Array(decrypted);
  }
}
```

**Namespace Updates Required:**

```typescript
// Add to @ownyou/shared-types/namespaces.ts
BACKUP_STATUS: 'ownyou.backup.status',
BACKUP_HISTORY: 'ownyou.backup.history',

// Add factory functions
backupStatus: (userId: string) => ['ownyou.backup.status', userId],
backupHistory: (userId: string) => ['ownyou.backup.history', userId],
```

**Success Criteria:**
- [ ] E2EE backup uploads successfully
- [ ] Incremental backup only uploads changes
- [ ] Recovery restores all data from backup
- [ ] Backup integrity validated with checksums
- [ ] 80%+ test coverage

---

### Package 3: `@ownyou/discovery`

**Purpose:** Device discovery and registration via Privy wallet identity

**Dependencies:**
- `@ownyou/shared-types` (namespaces)
- Privy SDK (wallet provider)

**Directory Structure:**
```
packages/discovery/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── types.ts
│   ├── device/
│   │   ├── device-id.ts           # Unique device ID generation
│   │   └── device-registration.ts # Register device with wallet
│   ├── wallet/
│   │   ├── key-derivation.ts      # Derive encryption key from wallet
│   │   └── privy-integration.ts   # Privy wallet wrapper
│   ├── signaling/
│   │   ├── signaling-client.ts    # WebSocket signaling
│   │   └── ice-candidates.ts      # STUN/TURN handling
│   └── nat/
│       ├── nat-traversal.ts       # NAT type detection
│       └── turn-client.ts         # TURN relay fallback
└── __tests__/
    ├── device-registration.test.ts
    ├── key-derivation.test.ts
    └── signaling-client.test.ts
```

#### Device Discovery Types (from v13 Section 5.2.3)

```typescript
// src/types.ts
export interface DeviceRegistration {
  deviceId: string;
  walletAddress: string;
  platform: 'tauri' | 'pwa';
  timestamp: number;
  signature: string;
}

export interface SignalingConfig {
  server: string;
  stunServers: string[];
  turnServer?: {
    url: string;
    username: string;
    credential: string;
  };
}

export const DEFAULT_SIGNALING_CONFIG: SignalingConfig = {
  server: 'wss://signal.ownyou.app',
  stunServers: ['stun:stun.l.google.com:19302'],
  turnServer: {
    url: 'turn:turn.ownyou.app:443',
    username: 'derived-from-wallet',
    credential: 'derived-from-wallet',
  },
};
```

#### Key Derivation (from v13 Section 5.2.4)

```typescript
// src/wallet/key-derivation.ts
import { sha256 } from '@noble/hashes/sha256';

export interface WalletProvider {
  getWalletAddress(): Promise<string>;
  signMessage(message: string): Promise<string>;
}

export async function deriveEncryptionKey(
  wallet: WalletProvider,
  purpose: 'sync' | 'backup'
): Promise<CryptoKey> {
  // Sign a deterministic message for key derivation
  const message = `ownyou-${purpose}-key-v1`;
  const signature = await wallet.signMessage(message);

  // Hash signature to get seed
  const seed = sha256(new TextEncoder().encode(signature));

  // Import as AES-GCM key
  const key = await crypto.subtle.importKey(
    'raw',
    seed,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );

  return key;
}

export async function deriveDeviceCredentials(
  wallet: WalletProvider,
  deviceId: string
): Promise<{ username: string; credential: string }> {
  const signature = await wallet.signMessage(`ownyou-turn-${deviceId}`);
  const hash = sha256(new TextEncoder().encode(signature));

  return {
    username: deviceId,
    credential: Buffer.from(hash).toString('base64'),
  };
}
```

**Success Criteria:**
- [ ] Device registration via wallet signature
- [ ] Encryption key derived deterministically from wallet
- [ ] Peer discovery finds devices with same wallet
- [ ] STUN/TURN NAT traversal working
- [ ] 80%+ test coverage

---

## Implementation Requirements

### From Previous Sprint Lessons Learned (MANDATORY)

#### C1: Namespace Usage
```typescript
// ❌ NEVER do this
await orbitdb.open('ownyou.sync.status');

// ✅ ALWAYS use NS.* factory functions
import { NS } from '@ownyou/shared-types';
await orbitdb.open(NS.syncStatus(deviceId).join('/'));
```

#### C2: Unconditional Data Writes
```typescript
// ❌ NEVER do this
if (peers.length > 0) {
  await store.put(NS.syncPeers(userId), 'active', {...});
}

// ✅ ALWAYS write, even when empty
await store.put(NS.syncPeers(userId), 'active', {
  peers: peers,
  isEmpty: peers.length === 0,
  updatedAt: Date.now(),
});
```

#### I1: Configurable Model Selection (N/A for sync - no LLM calls)

#### I2: Extract Magic Numbers to Config
```typescript
// ❌ NEVER do this
const maxPeers = 50;
const syncInterval = 30000;

// ✅ Extract to typed config objects
export interface SyncConfig {
  maxPeers: number;
  syncIntervalMs: number;
  offlineQueueLimit: number;
  backupRetentionDays: number;
}

export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  maxPeers: 50,
  syncIntervalMs: 30000,
  offlineQueueLimit: 1000,
  backupRetentionDays: 90,
};
```

#### I3: Integration Tests for Main Flow
```typescript
describe('Sync Integration', () => {
  it('should sync data between two devices', async () => {
    // Device A writes
    const deviceA = await createSyncLayer(configA);
    await deviceA.store.put(NS.preferences('user1'), 'theme', { dark: true });

    // Device B reads after sync
    const deviceB = await createSyncLayer(configB);
    await deviceB.forceSync();

    const result = await deviceB.store.get(NS.preferences('user1'), 'theme');
    expect(result).toEqual({ dark: true });
  });
});
```

### From Roadmap Agent Architecture Conformance

Sprint 10 has no new agents, but sync components must:
- Follow v13 patterns for namespace management
- Integrate with existing Store abstraction
- Use SyncLogger from @ownyou/observability for debugging
- Maintain privacy-first approach (all sync data encrypted)

---

## Week-by-Week Breakdown

### Week 1: OrbitDB + Helia Integration

**Day 1-2: Core Setup**
- [ ] Create `@ownyou/sync` package
- [ ] Setup Helia node configuration (Tauri full / PWA light)
- [ ] Setup OrbitDB v3 client wrapper
- [ ] Define sync types and interfaces

**Day 3-4: CRDT Implementation**
- [ ] Implement G-Counter for earnings/points
- [ ] Implement OR-Set for classifications/tags
- [ ] Implement LWW-Register for preferences
- [ ] Implement LWW-Map for mission states
- [ ] Build conflict resolver with namespace routing

**Day 5: Offline Queue**
- [ ] Implement offline mutation queue
- [ ] Implement vector clocks for causal ordering
- [ ] Implement queue flush on reconnect
- [ ] Write unit tests (target: 40+ tests)

### Week 2: Encryption & Device Discovery

**Day 1-2: Encryption**
- [ ] Evaluate OrbitDB v3 native encryption
- [ ] Implement wallet-derived key derivation (Privy)
- [ ] Implement custom AES-GCM fallback
- [ ] Configure encryption per namespace

**Day 3-4: Device Discovery**
- [ ] Create `@ownyou/discovery` package
- [ ] Implement device ID generation
- [ ] Implement device registration with wallet signature
- [ ] Implement peer discovery via signaling server

**Day 5: NAT Traversal**
- [ ] Setup signaling WebSocket client
- [ ] Implement STUN for direct P2P
- [ ] Implement TURN fallback for symmetric NAT
- [ ] Write unit tests (target: 35+ tests)

### Week 3: E2EE Backup & Recovery

**Day 1-2: Backup Service**
- [ ] Create `@ownyou/backup` package
- [ ] Implement incremental backup
- [ ] Implement gzip compression
- [ ] Implement E2EE encryption for backup

**Day 3-4: Recovery Flow**
- [ ] Implement wallet recovery → backup fetch
- [ ] Implement backup decryption → local restore
- [ ] Implement backup integrity validation
- [ ] Add retry logic with exponential backoff

**Day 5: Integration**
- [ ] Connect SyncMonitor UI to real sync data
- [ ] Implement sync scope rules per namespace
- [ ] Write integration tests (target: 25+ tests)
- [ ] Update documentation

---

## Test Targets

| Package | Target Tests | Focus Areas |
|---------|-------------|-------------|
| `@ownyou/sync` | 60+ | CRDT merging, offline queue, OrbitDB integration |
| `@ownyou/backup` | 30+ | E2EE, compression, recovery flow |
| `@ownyou/discovery` | 30+ | Key derivation, signaling, NAT traversal |
| Integration tests | 20+ | Multi-device sync, backup/restore |
| **Total** | **140+** | |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Test coverage | >80% for all packages |
| Sync latency | <5s between devices on same network |
| Offline queue capacity | 1000+ mutations |
| CRDT merge correctness | 100% (no data loss) |
| Backup encryption | AES-256-GCM verified |
| Recovery time | <2 minutes for full restore |

---

## Dependencies and External Services

### NPM Packages (from context7 lookup)

| Package | Version | Purpose |
|---------|---------|---------|
| `@orbitdb/core` | ^3.x | P2P database with CRDT |
| `@orbitdb/simple-encryption` | ^1.x | OrbitDB encryption module |
| `helia` | ^4.x | Modern IPFS implementation |
| `libp2p` | ^1.x | P2P networking |
| `blockstore-level` | ^1.x | LevelDB storage backend |
| `@noble/hashes` | ^1.x | SHA256 for key derivation |

### Infrastructure Requirements

| Service | Purpose | Phase |
|---------|---------|-------|
| **Signaling Server** | Device discovery, WebRTC signaling | Sprint 10 |
| **TURN Server** | Relay for symmetric NAT (~30% of users) | Sprint 10 |
| **Backup Storage** | E2EE cloud backup (1GB free tier) | Sprint 10 |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| OrbitDB v3 encryption insufficient | Medium | High | Custom AES-GCM fallback ready |
| P2P fails for ~30% of users (symmetric NAT) | High | Medium | TURN server required; E2EE backup as fallback |
| Single device users lose data | High | Critical | E2EE Cloud Backup (MUST HAVE) |
| Helia performance in PWA | Medium | Medium | Resource-constrained config, aggressive caching |
| Privy service outage | Low | High | Key export enables migration; backup mnemonic |

---

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `packages/sync/package.json` | Package config |
| `packages/sync/src/index.ts` | Public exports |
| `packages/sync/src/types.ts` | Sync types |
| `packages/sync/src/core/sync-layer.ts` | Main sync abstraction |
| `packages/sync/src/core/orbitdb-client.ts` | OrbitDB wrapper |
| `packages/sync/src/core/helia-node.ts` | Helia IPFS node |
| `packages/sync/src/core/offline-queue.ts` | Offline mutation queue |
| `packages/sync/src/crdt/*.ts` | CRDT implementations |
| `packages/sync/src/encryption/*.ts` | Encryption modules |
| `packages/sync/src/config/*.ts` | Configuration files |
| `packages/backup/package.json` | Package config |
| `packages/backup/src/backup/backup-service.ts` | Backup orchestration |
| `packages/backup/src/recovery/recovery-flow.ts` | Recovery implementation |
| `packages/discovery/package.json` | Package config |
| `packages/discovery/src/wallet/key-derivation.ts` | Key derivation |
| `packages/discovery/src/signaling/signaling-client.ts` | WebSocket signaling |

### Modified Files

| File | Change |
|------|--------|
| `packages/shared-types/src/namespaces.ts` | Add SYNC_*, BACKUP_* namespaces |
| `packages/shared-types/src/index.ts` | Export new types |
| `packages/debug-ui/src/components/SyncMonitor/*.tsx` | Connect to real sync data |
| `packages/observability/src/sync/sync-logger.ts` | Add real sync logging |

---

## Key Architectural Decisions

### 1. OrbitDB v3 + Helia (Not deprecated orbit-db + js-ipfs)

**Decision:** Use `@orbitdb/core` v3 with Helia, not the deprecated packages.

**Rationale:**
- `orbit-db` and `js-ipfs` are deprecated
- OrbitDB v3 has modular encryption support
- Helia is the modern, maintained IPFS implementation

### 2. Wallet-Based Device Discovery (No QR Pairing)

**Decision:** Devices auto-discover via Privy wallet identity.

**Rationale:**
- Same wallet = same user = automatically trusted
- No manual pairing step required
- Simpler UX than QR code scanning

### 3. E2EE Cloud Backup (Not IPFS Pinning)

**Decision:** Use Signal-style E2EE cloud backup over IPFS pinning.

**Rationale:**
- Same privacy (zero-knowledge)
- Higher reliability (S3 SLA vs IPFS pinning)
- Faster recovery (direct download vs DHT lookup)
- Lower cost (~$0.02/GB vs ~$0.40/GB)

### 4. CRDT Type Per Namespace (Not Universal LWW)

**Decision:** Use appropriate CRDT type per namespace semantics.

**Rationale:**
- G-Counter for earnings prevents data loss
- OR-Set for classifications handles add/remove correctly
- LWW only for atomic fields where latest truly wins

---

## Post-Sprint Action Items

After Sprint 10 completion:

- [ ] **Complete Plaid Registration** - Privy wallet auth enables "phishing-resistant MFA" answer
  - Screenshot wallet connection flow for Q4 documentation
  - See: `docs/architecture/PLAID/PLAID_application.md`

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| v1 | 2025-12-08 | Initial Sprint 10 specification |

---

**Document Status:** Sprint 10 Specification v1 - PLANNED
**Date:** 2025-12-08
**Validates Against:** OwnYou_architecture_v13.md (Section 5, Section 8.14)
**Next Sprint:** Sprint 11 (Consumer UI Full Implementation)
