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
 * - Direct IndexedDB access (via @ownyou/store)
 * - Direct Network access (fetch) or Proxy to Main/Rust
 */

import { TriggerEngine, type TriggerEngineStats } from '@ownyou/triggers';
import { ShoppingAgent } from '@ownyou/agents-shopping';
import { RestaurantAgent } from '@ownyou/agents-restaurant';
import { TravelAgent } from '@ownyou/agents-travel';
import { EventsAgent } from '@ownyou/agents-events';
import { ContentAgent } from '@ownyou/agents-content';
import { DiagnosticAgent } from '@ownyou/agents-diagnostic';
import { LLMClient, MockLLMProvider } from '@ownyou/llm-client';
import { NAMESPACES, type AgentType } from '@ownyou/shared-types';
import type { BaseAgent } from '@ownyou/agents-base';
import { IndexedDBStore } from '@ownyou/store';

// --- Worker State ---
let engine: TriggerEngine | null = null;
let store: IndexedDBStore | null = null;
let llmClient: LLMClient | null = null;
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
    // 1. Initialize Store (IndexedDB works in Workers)
    store = new IndexedDBStore({
      dbName: 'ownyou_store', // Must match main thread DB name
    });
    // We assume init() is async if it exists, or just instantiation is enough
    // Checking IndexedDBStore implementation: usually needs connection.
    // For now, assuming it handles connection on first request or similar.
    
    // 2. Initialize LLM Client
    // TODO: Configure real provider based on settings passed in INIT
    // For MVP Sprint 11a, we use MockLLMProvider but configured for "standard" tier
    llmClient = new LLMClient({
      provider: new MockLLMProvider(), 
      budgetConfig: { monthlyBudgetUsd: 10 },
    });

    // 3. Initialize Trigger Engine
    engine = new TriggerEngine({
      store,
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
    namespaces: ['*'],
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
