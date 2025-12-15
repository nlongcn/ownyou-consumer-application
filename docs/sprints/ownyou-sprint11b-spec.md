# Sprint 11b: WASM Embeddings & Performance Optimization

**Duration:** 2 weeks
**Status:** PLANNED
**Goal:** Complete the "3W" architecture by implementing WASM embeddings, validating worker performance, and optimizing the Rust HTTP client for high-concurrency scenarios.
**Success Criteria:** Real semantic search with local ONNX embeddings, UI remains responsive (60fps) during 100-email classification, HTTP pooling reduces connection overhead.
**Depends On:** Sprint 11 (Consumer UI) ✅, Sprint 11a (Worker Architecture) ✅
**v13 Coverage:** Section 6.6 (Local/Browser-Based Inference), Section 8.5.3 (Platform-Specific Embedding)
**Target Tests:** 50+ new tests (embeddings: 25, performance: 15, HTTP: 10)

---

## Previous Sprint Summary

### Sprint 11a: Web Worker Architecture (COMPLETE)

**Files Created:**
- `apps/consumer/src/workers/agent.worker.ts` - Background worker with TriggerEngine, 6 agents, IndexedDB
- `apps/consumer/src/hooks/useAgentWorker.ts` - React hook for worker communication
- `docs/architecture/GAP_ANALYSIS_V13_SPRINT11A.md` - Architecture analysis and remaining work

**Files Modified:**
- `apps/consumer/src/contexts/TriggerContext.tsx` - Rewritten as thin proxy to worker
- `apps/consumer/src-tauri/src/lib.rs` - Added `http_request` Tauri command

**Current State:**
- ✅ TriggerEngine runs in Web Worker (not main thread)
- ✅ All 6 agents registered and executing in worker
- ✅ IndexedDB initialized inside worker
- ✅ Tauri HTTP proxy exists
- 🔴 Embeddings still use `MockEmbeddingService` (deterministic hash, not real vectors)
- ⚠️ HTTP client creates new instance per request (no pooling)
- ⚠️ Performance not verified at scale (100+ emails)

---

## Sprint 11b Overview

```
+------------------------------------------------------------------+
|                     SPRINT 11b END STATE                          |
+------------------------------------------------------------------+
|                                                                   |
|  WEEK 1: WASM EMBEDDINGS                                          |
|  +----------------------------------------------------------+     |
|  | [Add onnxruntime-web to packages/memory-store]           |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Download all-MiniLM-L6-v2.onnx model (~23MB)]           |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Implement OnnxEmbeddingService class]                   |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Wire to agent.worker.ts replacing MockEmbeddingService] |     |
|  +----------------------------------------------------------+     |
|                                                                   |
|  WEEK 2: PERFORMANCE & HTTP OPTIMIZATION                          |
|  +----------------------------------------------------------+     |
|  | [Run 100-email classification benchmark]                 |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Verify UI remains responsive (60fps)]                   |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Optimize Rust HTTP client with connection pooling]      |     |
|  |     |                                                    |     |
|  |     v                                                    |     |
|  | [Mobile PWA verification]                                |     |
|  +----------------------------------------------------------+     |
|                                                                   |
|  REAL SEMANTIC SEARCH + VALIDATED PERFORMANCE                     |
|  COMPLETE "3W" ARCHITECTURE (Web Workers + WASM + WebLLM)         |
|                                                                   |
+------------------------------------------------------------------+
```

---

## v13 Architecture Compliance

### Target Sections

| v13 Section | Requirement | Sprint 11b Implementation | Priority |
|-------------|-------------|--------------------------|----------|
| **6.6** | Local/Browser-Based Inference | WASM embeddings via onnxruntime-web | P0 |
| **8.5.3** | Platform-Specific Embedding | OnnxEmbeddingService for PWA/Tauri | P0 |
| **3.2.1** | "3W" Runtime Architecture | Complete WASM component | P0 |
| **5.1.1** | Agent Execution Runtime | Performance verification | P0 |

### Already Complete (from Sprint 11a)

| v13 Section | Requirement | Status |
|-------------|-------------|--------|
| **3.2.1** | Web Workers | ✅ `agent.worker.ts` |
| **5.1.1** | TriggerEngine in Worker | ✅ Implemented |
| **5.1.1** | IndexedDB in Worker | ✅ Implemented |
| **5.2** | Tauri HTTP Proxy | ✅ `http_request` command |

---

## Implementation Requirements

These mandatory patterns from previous sprints MUST be followed:

### C1: Namespace Usage

```typescript
// NEVER do this
await store.put('ownyou.embeddings.vectors', key, value);

// ALWAYS use NS.* factory functions
import { NS } from '@ownyou/shared-types';
await store.put(NS.embeddingCache(userId), key, value);
```

### C2: Unconditional Data Writes

```typescript
// NEVER do this
if (embeddings.length > 0) {
  await store.put(namespace, key, embeddings);
}

// ALWAYS write, even when empty
await store.put(namespace, key, {
  embeddings: embeddings,
  isEmpty: embeddings.length === 0,
  updatedAt: Date.now(),
});
```

### I2: Extract Magic Numbers to Config

```typescript
// NEVER do this
const modelPath = '/models/all-MiniLM-L6-v2.onnx';
const dimensions = 384;

// ALWAYS extract to typed config objects
export interface EmbeddingConfig {
  modelPath: string;
  dimensions: number;
  useWebGPU: boolean;
}

export const DEFAULT_EMBEDDING_CONFIG: EmbeddingConfig = {
  modelPath: '/models/all-MiniLM-L6-v2.onnx',
  dimensions: 384,
  useWebGPU: false,
};
```

### I3: Integration Tests for Main Flow

Every embedding feature MUST have integration tests validating:
1. Model loads successfully in worker context
2. Embed produces correct dimensionality
3. Semantic search returns meaningful results
4. Fallback to MockEmbeddingService works

---

## Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **ONNX Runtime over TensorFlow.js** | Smaller bundle size (~4MB vs ~20MB), better WASM performance, consistent model format |
| **all-MiniLM-L6-v2 model** | 384 dimensions, good balance of quality vs size (~23MB), widely tested |
| **WASM over WebGPU default** | WebGPU not available on all browsers; WASM provides broader compatibility |
| **Singleton HTTP client in Rust** | Connection pooling reduces handshake overhead, matches browser connection limits |
| **once_cell::Lazy for client** | Thread-safe lazy initialization, standard Rust pattern for global singletons |
| **Fallback to MockEmbeddingService** | Graceful degradation if ONNX fails to load (memory constraints, network issues) |

---

## Package 1: `@ownyou/memory-store` - WASM Embeddings

**Purpose:** Replace MockEmbeddingService with real ONNX-based embeddings

### 1.1 Dependencies

```json
// packages/memory-store/package.json
{
  "dependencies": {
    "onnxruntime-web": "^1.17.0"
  }
}
```

### 1.2 OnnxEmbeddingService Implementation

```typescript
// packages/memory-store/src/search/onnx-embeddings.ts
/**
 * OnnxEmbeddingService - Local WASM-based embeddings using ONNX Runtime
 *
 * Uses all-MiniLM-L6-v2 model for 384-dimensional embeddings.
 * Runs entirely in browser/worker via WebAssembly.
 *
 * Reference: https://blog.mozilla.ai/3w-for-in-browser-ai-webllm-wasm-webworkers/
 */

import * as ort from 'onnxruntime-web';
import { EmbeddingService } from './embeddings';

export interface OnnxEmbeddingConfig {
  /** Path to ONNX model file (relative to public/) */
  modelPath: string;
  /** Number of dimensions in output embeddings (default: 384 for MiniLM) */
  dimensions?: number;
  /** Whether to use WebGPU backend if available (default: false, uses WASM) */
  useWebGPU?: boolean;
  /** Fallback embedding service if ONNX fails */
  fallback?: EmbeddingService;
}

export class OnnxEmbeddingService implements EmbeddingService {
  private config: Required<OnnxEmbeddingConfig>;
  private session: ort.InferenceSession | null = null;
  private tokenizer: SimpleTokenizer | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  constructor(config: OnnxEmbeddingConfig) {
    this.config = {
      modelPath: config.modelPath,
      dimensions: config.dimensions ?? 384,
      useWebGPU: config.useWebGPU ?? false,
      fallback: config.fallback ?? null,
    };
  }

  /**
   * Initialize ONNX Runtime session
   * Called lazily on first embed() call
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInitialize();
    await this.initPromise;
  }

  private async _doInitialize(): Promise<void> {
    try {
      // Configure ONNX Runtime
      const executionProviders: ort.InferenceSession.ExecutionProviderConfig[] = [];

      if (this.config.useWebGPU && typeof navigator !== 'undefined' && 'gpu' in navigator) {
        executionProviders.push('webgpu');
      }
      executionProviders.push('wasm'); // Fallback to WASM

      // Create inference session
      this.session = await ort.InferenceSession.create(this.config.modelPath, {
        executionProviders,
        graphOptimizationLevel: 'all',
      });

      // Initialize simple tokenizer (word-level for MiniLM)
      this.tokenizer = new SimpleTokenizer();

      this.isInitialized = true;
      console.log('[OnnxEmbedding] Initialized with model:', this.config.modelPath);
    } catch (error) {
      console.error('[OnnxEmbedding] Initialization failed:', error);
      if (this.config.fallback) {
        console.warn('[OnnxEmbedding] Using fallback embedding service');
      }
      throw error;
    }
  }

  /**
   * Generate embedding for a single text
   */
  async embed(text: string): Promise<number[]> {
    try {
      await this.initialize();

      if (!this.session || !this.tokenizer) {
        if (this.config.fallback) {
          return this.config.fallback.embed(text);
        }
        throw new Error('ONNX session not initialized');
      }

      // Tokenize input
      const { inputIds, attentionMask } = this.tokenizer.encode(text, 512);

      // Create tensors
      const inputIdsTensor = new ort.Tensor('int64', BigInt64Array.from(inputIds.map(BigInt)), [1, inputIds.length]);
      const attentionMaskTensor = new ort.Tensor('int64', BigInt64Array.from(attentionMask.map(BigInt)), [1, attentionMask.length]);

      // Run inference
      const feeds = {
        input_ids: inputIdsTensor,
        attention_mask: attentionMaskTensor,
      };

      const results = await this.session.run(feeds);

      // Extract embeddings (mean pooling over token dimension)
      const embeddings = results['last_hidden_state'] ?? results['sentence_embedding'];
      if (!embeddings) {
        throw new Error('No embedding output found');
      }

      // Mean pooling
      const data = embeddings.data as Float32Array;
      const embedding = this.meanPool(data, inputIds.length, this.config.dimensions);

      // Normalize to unit vector
      return this.normalize(embedding);
    } catch (error) {
      console.error('[OnnxEmbedding] embed() failed:', error);
      if (this.config.fallback) {
        return this.config.fallback.embed(text);
      }
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts (batched)
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    // For simplicity, process sequentially
    // TODO: Implement true batching for better performance
    const results: number[][] = [];
    for (const text of texts) {
      results.push(await this.embed(text));
    }
    return results;
  }

  /**
   * Get the dimensionality of embeddings
   */
  getDimensions(): number {
    return this.config.dimensions;
  }

  /**
   * Mean pooling over sequence dimension
   */
  private meanPool(data: Float32Array, seqLen: number, hiddenSize: number): number[] {
    const embedding = new Array(hiddenSize).fill(0);

    for (let i = 0; i < seqLen; i++) {
      for (let j = 0; j < hiddenSize; j++) {
        embedding[j] += data[i * hiddenSize + j];
      }
    }

    for (let j = 0; j < hiddenSize; j++) {
      embedding[j] /= seqLen;
    }

    return embedding;
  }

  /**
   * Normalize vector to unit length
   */
  private normalize(vector: number[]): number[] {
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (norm === 0) return vector;
    return vector.map(v => v / norm);
  }
}

/**
 * Simple word-level tokenizer for MiniLM
 *
 * NOTE: For production, consider using @xenova/transformers tokenizer
 * This is a simplified implementation for MVP.
 */
class SimpleTokenizer {
  private vocab: Map<string, number> = new Map();
  private unkTokenId = 100;
  private clsTokenId = 101;
  private sepTokenId = 102;
  private padTokenId = 0;

  constructor() {
    // Basic vocabulary - in production, load from vocab.json
    // This is a placeholder - real implementation needs full vocab
    this.initVocab();
  }

  private initVocab(): void {
    // Initialize with common tokens
    // In production, load from model's vocab.json
    const commonWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to'];

    commonWords.forEach((word, i) => {
      this.vocab.set(word.toLowerCase(), 1000 + i);
    });
  }

  encode(text: string, maxLength: number): { inputIds: number[]; attentionMask: number[] } {
    // Tokenize by whitespace and lowercase
    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);

    // Convert to token IDs
    const tokens: number[] = [this.clsTokenId];
    for (const word of words.slice(0, maxLength - 2)) {
      tokens.push(this.vocab.get(word) ?? this.unkTokenId);
    }
    tokens.push(this.sepTokenId);

    // Pad to maxLength
    const inputIds = [...tokens];
    const attentionMask = new Array(tokens.length).fill(1);

    while (inputIds.length < maxLength) {
      inputIds.push(this.padTokenId);
      attentionMask.push(0);
    }

    return {
      inputIds: inputIds.slice(0, maxLength),
      attentionMask: attentionMask.slice(0, maxLength),
    };
  }
}
```

### 1.3 Export from Package

```typescript
// packages/memory-store/src/search/index.ts
export { EmbeddingService, MockEmbeddingService } from './embeddings';
export { OnnxEmbeddingService, type OnnxEmbeddingConfig } from './onnx-embeddings';
export { SemanticSearch } from './semantic';
export { BM25Search } from './bm25';
export { rrfFusion } from './rrf';
```

### 1.4 Model Download Instructions

```bash
# Download all-MiniLM-L6-v2 ONNX model
# Place in apps/consumer/public/models/

mkdir -p apps/consumer/public/models
cd apps/consumer/public/models

# Option 1: From Hugging Face
curl -L -o all-MiniLM-L6-v2.onnx \
  "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/onnx/model.onnx"

# Option 2: Use @xenova/transformers quantized version (smaller)
# See: https://huggingface.co/Xenova/all-MiniLM-L6-v2
```

---

## Package 2: Worker Integration

**Purpose:** Wire OnnxEmbeddingService into the agent worker

### 2.1 Update agent.worker.ts

```typescript
// apps/consumer/src/workers/agent.worker.ts
// CHANGE: Import and use OnnxEmbeddingService instead of MockEmbeddingService

import { OnnxEmbeddingService } from '@ownyou/memory-store';

// In initialize():
async function initialize(uid: string) {
  userId = uid;

  try {
    // 1. Initialize Embedding Service (WASM-based)
    const embeddingService = new OnnxEmbeddingService({
      modelPath: '/models/all-MiniLM-L6-v2.onnx',
      dimensions: 384,
      useWebGPU: false, // Use WASM for broader compatibility
      fallback: new MockEmbeddingService(384), // Fallback if ONNX fails
    });

    // 2. Initialize Store with real embedding service
    store = new IndexedDBStore({
      dbName: 'ownyou_store',
      embeddingService, // <-- NEW: Real embeddings
    });

    // ... rest of initialization
  }
}
```

### 2.2 Pre-warm Embeddings on Init

```typescript
// In agent.worker.ts, after store initialization:

// Pre-warm the embedding model (load into memory)
// This prevents delay on first search
const warmupText = "Initialize embedding model";
try {
  await embeddingService.embed(warmupText);
  console.log('[AgentWorker] Embedding model warmed up');
} catch (err) {
  console.warn('[AgentWorker] Embedding warmup failed, using fallback:', err);
}
```

---

## Package 3: HTTP Client Optimization

**Purpose:** Optimize Rust HTTP client with connection pooling

### 3.1 Singleton Client in lib.rs

```rust
// apps/consumer/src-tauri/src/lib.rs

use once_cell::sync::Lazy;
use reqwest::Client;
use std::time::Duration;

/// Global HTTP client with connection pooling
///
/// Configuration:
/// - pool_idle_timeout: 90 seconds (keep connections warm)
/// - pool_max_idle_per_host: 10 (allow parallel requests to same host)
/// - connect_timeout: 10 seconds
/// - timeout: 30 seconds (total request timeout)
static HTTP_CLIENT: Lazy<Client> = Lazy::new(|| {
    Client::builder()
        .pool_idle_timeout(Duration::from_secs(90))
        .pool_max_idle_per_host(10)
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(30))
        .user_agent("OwnYou/1.0")
        .build()
        .expect("Failed to create HTTP client")
});

/// Proxy HTTP request via Rust backend to bypass browser limits
///
/// Uses singleton HTTP client with connection pooling for better performance.
#[tauri::command]
async fn http_request(
    method: String,
    url: String,
    headers: Option<HashMap<String, String>>,
    body: Option<String>,
) -> Result<String, String> {
    // Use the global client instead of creating a new one
    let client = &*HTTP_CLIENT;

    let method = match method.to_uppercase().as_str() {
        "GET" => reqwest::Method::GET,
        "POST" => reqwest::Method::POST,
        "PUT" => reqwest::Method::PUT,
        "DELETE" => reqwest::Method::DELETE,
        "PATCH" => reqwest::Method::PATCH,
        "HEAD" => reqwest::Method::HEAD,
        "OPTIONS" => reqwest::Method::OPTIONS,
        _ => return Err(format!("Unsupported method: {}", method)),
    };

    let mut request = client.request(method, &url);

    if let Some(h) = headers {
        for (k, v) in h {
            request = request.header(&k, &v);
        }
    }

    if let Some(b) = body {
        request = request.body(b);
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    if status.is_success() {
        Ok(body)
    } else {
        Err(format!("HTTP {}: {}", status.as_u16(), body))
    }
}
```

### 3.2 Add Cargo Dependency

```toml
# apps/consumer/src-tauri/Cargo.toml
[dependencies]
once_cell = "1.19"
```

---

## Package 4: Performance Verification

**Purpose:** Validate worker architecture at scale

### 4.1 Performance Test Script

```typescript
// apps/consumer/scripts/performance-test.ts
/**
 * Performance test: 100-email IAB classification
 *
 * Targets:
 * - UI remains responsive (60fps)
 * - Total processing time < 15 minutes
 * - Memory stays under 500MB
 */

import { performance } from 'perf_hooks';

interface PerformanceResult {
  totalTimeMs: number;
  emailsProcessed: number;
  averageTimePerEmail: number;
  peakMemoryMB: number;
  uiFrameDrops: number;
}

async function runPerformanceTest(): Promise<PerformanceResult> {
  const startTime = performance.now();
  const startMemory = process.memoryUsage().heapUsed;

  // TODO: Implement actual test
  // 1. Generate 100 test emails
  // 2. Run IAB classification in worker
  // 3. Monitor UI responsiveness
  // 4. Track memory usage

  const endTime = performance.now();
  const endMemory = process.memoryUsage().heapUsed;

  return {
    totalTimeMs: endTime - startTime,
    emailsProcessed: 100,
    averageTimePerEmail: (endTime - startTime) / 100,
    peakMemoryMB: (endMemory - startMemory) / 1024 / 1024,
    uiFrameDrops: 0, // TODO: Measure actual frame drops
  };
}

// Run and report
runPerformanceTest().then(result => {
  console.log('=== Performance Test Results ===');
  console.log(`Total time: ${(result.totalTimeMs / 1000 / 60).toFixed(2)} minutes`);
  console.log(`Emails processed: ${result.emailsProcessed}`);
  console.log(`Average time per email: ${result.averageTimePerEmail.toFixed(2)}ms`);
  console.log(`Peak memory: ${result.peakMemoryMB.toFixed(2)}MB`);
  console.log(`UI frame drops: ${result.uiFrameDrops}`);

  // Pass/fail criteria
  const passed = result.totalTimeMs < 15 * 60 * 1000 && result.uiFrameDrops < 10;
  console.log(`\nResult: ${passed ? 'PASS ✅' : 'FAIL ❌'}`);
});
```

### 4.2 UI Responsiveness Monitor

```typescript
// apps/consumer/src/utils/performance-monitor.ts
/**
 * Monitor UI responsiveness during heavy operations
 */

export class PerformanceMonitor {
  private frameDrops = 0;
  private lastFrameTime = 0;
  private isMonitoring = false;
  private rafId: number | null = null;

  start(): void {
    this.frameDrops = 0;
    this.lastFrameTime = performance.now();
    this.isMonitoring = true;
    this.tick();
  }

  stop(): { frameDrops: number; averageFps: number } {
    this.isMonitoring = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
    return {
      frameDrops: this.frameDrops,
      averageFps: 60 - this.frameDrops, // Simplified
    };
  }

  private tick(): void {
    if (!this.isMonitoring) return;

    const now = performance.now();
    const delta = now - this.lastFrameTime;

    // Frame drop = more than 2x expected frame time (16.67ms * 2 = 33ms)
    if (delta > 33) {
      this.frameDrops++;
      console.warn(`[Performance] Frame drop detected: ${delta.toFixed(2)}ms`);
    }

    this.lastFrameTime = now;
    this.rafId = requestAnimationFrame(() => this.tick());
  }
}
```

---

## Week-by-Week Breakdown (2 Weeks)

### Week 1: WASM Embeddings (Days 1-5)

**Day 1: Setup & Dependencies**
- [ ] Add `onnxruntime-web` to `packages/memory-store/package.json`
- [ ] Download `all-MiniLM-L6-v2.onnx` model to `apps/consumer/public/models/`
- [ ] Verify ONNX model loads in browser console
- [ ] Add `once_cell` to Tauri Cargo.toml

**Day 2: OnnxEmbeddingService Implementation**
- [ ] Create `packages/memory-store/src/search/onnx-embeddings.ts`
- [ ] Implement `embed()` with ONNX Runtime
- [ ] Implement `embedBatch()` for multiple texts
- [ ] Implement simple tokenizer (word-level)
- [ ] Tests: Verify embedding dimensions and normalization

**Day 3: Tokenizer Improvements**
- [ ] Research proper tokenizer for MiniLM
- [ ] Consider using `@xenova/transformers` tokenizer
- [ ] Implement subword tokenization if needed
- [ ] Tests: Verify tokenization matches expected format

**Day 4: Worker Integration**
- [ ] Update `agent.worker.ts` to use `OnnxEmbeddingService`
- [ ] Add embedding model pre-warming on init
- [ ] Add fallback to `MockEmbeddingService` if ONNX fails
- [ ] Tests: Verify embeddings work in worker context

**Day 5: Semantic Search Validation**
- [ ] Test semantic search with real embeddings
- [ ] Compare results vs MockEmbeddingService
- [ ] Verify cosine similarity produces meaningful rankings
- [ ] Integration tests: Query → Embedding → Search → Results

### Week 2: Performance & HTTP Optimization (Days 6-10)

**Day 6: HTTP Client Optimization**
- [ ] Update `lib.rs` with singleton `HTTP_CLIENT`
- [ ] Configure connection pooling parameters
- [ ] Add timeouts and retry logic
- [ ] Tests: Verify pooling works with concurrent requests

**Day 7: Performance Test Infrastructure**
- [ ] Create `scripts/performance-test.ts`
- [ ] Create `PerformanceMonitor` utility
- [ ] Generate 100 test emails for benchmarking
- [ ] Setup performance measurement tooling

**Day 8: 100-Email Classification Test**
- [ ] Run full IAB classification on 100 emails
- [ ] Monitor UI responsiveness during processing
- [ ] Measure total processing time
- [ ] Record memory usage

**Day 9: Optimization & Fixes**
- [ ] Address any performance bottlenecks found
- [ ] Optimize batch sizes if needed
- [ ] Fix any memory leaks
- [ ] Re-run benchmarks to verify improvements

**Day 10: Mobile PWA Verification**
- [ ] Test in Mobile Safari (iOS)
- [ ] Test in Mobile Chrome (Android)
- [ ] Verify basic functionality works
- [ ] Document any mobile-specific limitations

---

## Test Targets

| Area | Target Tests | Focus |
|------|--------------|-------|
| OnnxEmbeddingService | 15 | Initialization, embed(), embedBatch(), error handling |
| SimpleTokenizer | 10 | Tokenization, padding, special tokens |
| Worker Integration | 10 | Embedding in worker context, fallback behavior |
| HTTP Pooling | 10 | Connection reuse, concurrent requests, timeouts |
| Performance | 5 | 100-email benchmark, UI responsiveness, memory |
| **Total** | **50** | |

---

## Success Criteria

### Priority 1: WASM Embeddings Working
- [ ] `OnnxEmbeddingService` loads ONNX model successfully
- [ ] `embed()` produces 384-dimensional normalized vectors
- [ ] Semantic search returns meaningful results (not hash-based)
- [ ] Fallback to MockEmbeddingService works if ONNX fails

### Priority 2: Performance Targets Met
- [ ] 100-email classification completes in < 15 minutes
- [ ] UI remains responsive (< 10 frame drops during processing)
- [ ] Memory usage stays under 500MB
- [ ] No memory leaks during long-running operations

### Priority 3: HTTP Optimization
- [ ] Singleton HTTP client with connection pooling
- [ ] Concurrent requests reuse connections
- [ ] Proper timeouts configured

### Priority 4: Mobile Compatibility
- [ ] Basic functionality works in Mobile Safari
- [ ] Basic functionality works in Mobile Chrome
- [ ] Known limitations documented

---

## Files to Create

| File | Purpose |
|------|---------|
| `packages/memory-store/src/search/onnx-embeddings.ts` | ONNX embedding service |
| `apps/consumer/public/models/all-MiniLM-L6-v2.onnx` | ONNX model file |
| `apps/consumer/scripts/performance-test.ts` | Performance benchmark |
| `apps/consumer/src/utils/performance-monitor.ts` | UI responsiveness monitor |

## Files to Modify

| File | Change |
|------|--------|
| `packages/memory-store/package.json` | Add onnxruntime-web dependency |
| `packages/memory-store/src/search/index.ts` | Export OnnxEmbeddingService |
| `apps/consumer/src/workers/agent.worker.ts` | Use OnnxEmbeddingService |
| `apps/consumer/src-tauri/src/lib.rs` | Singleton HTTP client |
| `apps/consumer/src-tauri/Cargo.toml` | Add once_cell dependency |

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| ONNX model too large for browser | Medium | High | Use quantized model, lazy load |
| Tokenizer mismatch with model | Medium | High | Use model's original tokenizer |
| WebGPU not available | High | Low | Default to WASM backend |
| Mobile memory constraints | High | Medium | Use smaller model for mobile |
| CORS issues loading model | Low | Medium | Bundle model in app |

---

## Definition of Done

Sprint 11b is complete when:

### Embeddings
1. [ ] `OnnxEmbeddingService` implemented and tested
2. [ ] ONNX model bundled in `public/models/`
3. [ ] `agent.worker.ts` uses real embeddings
4. [ ] Semantic search produces meaningful results (verified)

### Performance
5. [ ] 100-email classification < 15 minutes (verified)
6. [ ] UI remains responsive during heavy processing (verified)
7. [ ] Memory usage < 500MB (verified)

### HTTP
8. [ ] Singleton `HTTP_CLIENT` with pooling (verified)
9. [ ] Connection reuse working (verified)

### Quality
10. [ ] 50+ new tests passing
11. [ ] All existing tests still passing
12. [ ] Mobile Safari/Chrome basic functionality working
13. [ ] Gap analysis document updated to reflect completion

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-15 | Claude Code Agent | Initial specification (incorrectly named Sprint 12) |
| 1.1 | 2025-12-15 | Claude Code Agent | Renamed to Sprint 11b per roadmap (Sprint 12 = BBS+ & SDKs), added Implementation Requirements, Key Decisions |

---

**Document Status:** Sprint 11b Specification v1.1 - PLANNED
**Date:** 2025-12-15
**Author:** Claude Code Agent
**Validates Against:** OwnYou_architecture_v13.md, GAP_ANALYSIS_V13_SPRINT11A.md
**v13 Sections Covered:**
- Section 6.6: Local/Browser-Based Inference
- Section 8.5.3: Platform-Specific Embedding
- Section 3.2.1: "3W" Runtime Architecture
**Previous Sprint:** Sprint 11a (Web Worker Architecture) ✅ COMPLETE
**Next Sprint:** Sprint 12 (BBS+ & Publisher/Advertiser SDK)
