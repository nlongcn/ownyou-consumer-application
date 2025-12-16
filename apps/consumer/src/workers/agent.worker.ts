/// <reference lib="webworker" />

/**
 * Agent Orchestrator Worker
 * 
 * Runs the TriggerEngine, AgentScheduler, and all Mission Agents in a background thread.
 * This prevents UI freezing during heavy agent execution or IAB classification.
 * 
 * Capabilities:
 * - Runs 4-mode TriggerEngine
 * - Manages AgentScheduler
 * - Performs IAB Classification (batch processing)
 * - Executes all 6 Mission Agents
 * - Direct IndexedDB access (via @ownyou/memory-store)
 * - Direct Network access (fetch) or Proxy to Main/Rust
 */

import { TriggerEngine } from '@ownyou/triggers';
import { ShoppingAgent } from '@ownyou/agents-shopping';
import { RestaurantAgent } from '@ownyou/agents-restaurant';
import { TravelAgent } from '@ownyou/agents-travel';
import { EventsAgent } from '@ownyou/agents-events';
import { ContentAgent } from '@ownyou/agents-content';
import { DiagnosticAgent } from '@ownyou/agents-diagnostic';
import { LLMClient, WebLLMProvider } from '@ownyou/llm-client';
import { NAMESPACES, type AgentType } from '@ownyou/shared-types';
import type { BaseAgent } from '@ownyou/agents-base';
import {
  MemoryStore,
  IndexedDBBackend,
  OnnxEmbeddingService,
  type EmbeddingService,
} from '@ownyou/memory-store';

// --- Worker State ---
let engine: TriggerEngine | null = null;
let store: MemoryStore | null = null;
let llmClient: LLMClient | null = null;
let embeddingService: EmbeddingService | null = null;
let isRunning = false;
let userId: string = 'anonymous';

// --- Message Types ---
export type WorkerMessage = 
  | { type: 'INIT'; payload: { userId: string; walletAddress?: string } }
  | { type: 'START' }
  | { type: 'STOP' }
  | { type: 'HANDLE_REQUEST'; payload: { request: string; requestId: string } }
  | { type: 'GET_STATS' };

// --- Initialization ---

async function initialize(uid: string) {
  userId = uid;
  
  try {
    // 1. Initialize Embedding Service FIRST (Sprint 11b: WASM embeddings)
    // Real ONNX model - no mocks, no fallbacks
    embeddingService = new OnnxEmbeddingService({
      modelId: 'Xenova/all-MiniLM-L6-v2',
      dimensions: 384,
      logProgress: true,
    });
    console.log('[AgentWorker] Embedding service initializing (ONNX WASM)...');

    // 2. Initialize Store with real embedding service
    const backend = new IndexedDBBackend({
      dbName: `ownyou_${uid}`,
    });
    store = new MemoryStore({
      backend,
      embeddingService,
    });
    console.log('[AgentWorker] Store initialized with IndexedDB + ONNX embeddings');

    // 3. Initialize LLM Client with WebLLM (runs locally in browser)
    // WebLLM uses WebGPU for fast local inference - no external API needed
    const webllmProvider = new WebLLMProvider({
      model: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', // Small, fast model for local inference
      onProgress: (progress, status) => console.log(`[WebLLM] ${status}: ${progress}%`),
    });
    llmClient = new LLMClient({
      provider: webllmProvider,
      budgetConfig: {
        monthlyBudgetUsd: 10,
        throttling: { warnAt: 0.8, downgradeAt: 0.9, deferAt: 0.95, blockAt: 1.0 },
      },
    });
    console.log('[AgentWorker] LLM client initialized (WebLLM local inference)');

    // 4. Initialize Trigger Engine
    engine = new TriggerEngine({
      store: store as any, // Type cast - MemoryStore implements core AgentStore interface
      llm: llmClient,
      userId,
      watchNamespaces: [
        NAMESPACES.IAB_CLASSIFICATIONS,
        NAMESPACES.IKIGAI_PROFILE,
        NAMESPACES.FINANCIAL_TRANSACTIONS,
        NAMESPACES.CALENDAR_EVENTS,
        NAMESPACES.MISSION_FEEDBACK,
      ],
      schedules: {
        'daily_digest': '0 9 * * *',
        'weekly_review': '0 10 * * 0',
        'diagnostic': '0 9 * * 0',
      },
      agentFactory: createAgent,
    });

    registerAgents(engine);
    
    console.log('[AgentWorker] Initialized for user:', userId);
    postMessage({ type: 'INIT_COMPLETE' });
  } catch (error) {
    console.error('[AgentWorker] Initialization failed:', error);
    postMessage({ type: 'ERROR', payload: { error: String(error) } });
  }
}

function createAgent(type: AgentType): BaseAgent | null {
  switch (type) {
    case 'shopping': return new ShoppingAgent();
    case 'restaurant': return new RestaurantAgent();
    case 'travel': return new TravelAgent();
    case 'events': return new EventsAgent();
    case 'content': return new ContentAgent();
    case 'diagnostic': return new DiagnosticAgent();
    default: return null;
  }
}

function registerAgents(engine: TriggerEngine) {
  engine.registerAgent({
    type: 'shopping',
    namespaces: [NAMESPACES.IAB_CLASSIFICATIONS, NAMESPACES.IKIGAI_PROFILE],
    intents: ['buy', 'purchase', 'shopping', 'deal', 'save money'],
    description: 'Shopping deals and product recommendations',
    enabled: true,
  });
  
  engine.registerAgent({
    type: 'restaurant',
    namespaces: [NAMESPACES.IAB_CLASSIFICATIONS, NAMESPACES.CALENDAR],
    intents: ['eat', 'restaurant', 'dinner', 'lunch', 'food'],
    description: 'Restaurant recommendations and reservations',
    enabled: true,
  });

  engine.registerAgent({
    type: 'travel',
    namespaces: [NAMESPACES.IAB_CLASSIFICATIONS, NAMESPACES.CALENDAR],
    intents: ['travel', 'trip', 'vacation', 'flight', 'hotel'],
    description: 'Travel planning and booking',
    enabled: true,
  });

  engine.registerAgent({
    type: 'events',
    namespaces: [NAMESPACES.IAB_CLASSIFICATIONS, NAMESPACES.CALENDAR, NAMESPACES.INTERESTS],
    intents: ['event', 'concert', 'show', 'entertainment', 'tickets'],
    description: 'Event discovery and tickets',
    enabled: true,
  });

  engine.registerAgent({
    type: 'content',
    namespaces: [NAMESPACES.IAB_CLASSIFICATIONS, NAMESPACES.IKIGAI_PROFILE],
    intents: ['read', 'watch', 'listen', 'learn', 'podcast', 'article'],
    description: 'Content recommendations',
    enabled: true,
  });

  engine.registerAgent({
    type: 'diagnostic',
    namespaces: [NAMESPACES.IAB_CLASSIFICATIONS, NAMESPACES.IKIGAI_PROFILE] as any, // All namespaces for diagnostic
    intents: ['analyze', 'profile', 'insights', 'patterns'],
    description: 'Profile analysis and insights',
    enabled: true,
  });
}

// --- Message Handler ---

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data as any; // Type assertion to handle generic payload access

  try {
    switch (type) {
      case 'INIT':
        await initialize(payload.userId);
        break;

      case 'START':
        if (engine) {
          engine.start();
          isRunning = true;
          postMessage({ type: 'STARTED' });
        }
        break;

      case 'STOP':
        if (engine) {
          engine.stop();
          isRunning = false;
          postMessage({ type: 'STOPPED' });
        }
        break;

      case 'HANDLE_REQUEST':
        if (engine) {
          const result = await engine.handleUserRequest(payload.request);
          postMessage({ type: 'REQUEST_COMPLETE', payload: { requestId: payload.requestId, result } });
        }
        break;
        
      case 'GET_STATS':
        if (engine) {
          const stats = engine.getStats();
          postMessage({ type: 'STATS_UPDATE', payload: stats });
        }
        break;
    }
  } catch (error) {
    console.error('[AgentWorker] Error:', error);
    postMessage({ type: 'ERROR', payload: { error: String(error) } });
  }
};

// Periodic Stats
setInterval(() => {
  if (isRunning && engine) {
    postMessage({ type: 'STATS_UPDATE', payload: engine.getStats() });
  }
}, 5000);
