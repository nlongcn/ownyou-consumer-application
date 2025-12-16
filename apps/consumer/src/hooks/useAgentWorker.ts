import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { TriggerEngineStats, TriggerResult } from '@ownyou/triggers';

// Define message types locally to avoid import issues with worker files
type _WorkerMessage =
  | { type: 'INIT'; payload: { userId: string; walletAddress?: string } }
  | { type: 'START' }
  | { type: 'STOP' }
  | { type: 'HANDLE_REQUEST'; payload: { request: string; requestId: string } }
  | { type: 'GET_STATS' };
// Export type alias to use in worker communication (prevents TS6196)
export type { _WorkerMessage as WorkerMessage };

type WorkerResponse =
  | { type: 'INIT_COMPLETE' }
  | { type: 'STARTED' }
  | { type: 'STOPPED' }
  | { type: 'REQUEST_COMPLETE'; payload: { requestId: string; result: TriggerResult } }
  | { type: 'STATS_UPDATE'; payload: TriggerEngineStats }
  | { type: 'ERROR'; payload: { error: string } };

export function useAgentWorker() {
  const { wallet, isAuthenticated } = useAuth();
  const userId = wallet?.address ?? 'anonymous';
  
  const workerRef = useRef<Worker | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState<TriggerEngineStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Request promise map for request-response pattern
  const requestMapRef = useRef<Map<string, (result: TriggerResult) => void>>(new Map());

  useEffect(() => {
    if (!isAuthenticated) return;

    // Initialize worker
    // Vite syntax for worker import
    const worker = new Worker(new URL('../workers/agent.worker.ts', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const { type, payload } = event.data as any;

      switch (type) {
        case 'INIT_COMPLETE':
          setIsReady(true);
          // Auto-start after init
          worker.postMessage({ type: 'START' });
          break;
        
        case 'STARTED':
          setIsRunning(true);
          break;
        
        case 'STOPPED':
          setIsRunning(false);
          break;
        
        case 'STATS_UPDATE':
          setStats(payload);
          break;
        
        case 'REQUEST_COMPLETE':
          const resolver = requestMapRef.current.get(payload.requestId);
          if (resolver) {
            resolver(payload.result);
            requestMapRef.current.delete(payload.requestId);
          }
          break;
        
        case 'ERROR':
          console.error('[AgentWorker Error]', payload.error);
          setError(payload.error);
          break;
      }
    };

    workerRef.current = worker;

    // Send INIT
    worker.postMessage({
      type: 'INIT',
      payload: { userId, walletAddress: wallet?.address }
    });

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [isAuthenticated, userId, wallet]);

  const handleUserRequest = useCallback((request: string): Promise<TriggerResult> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const requestId = crypto.randomUUID();
      requestMapRef.current.set(requestId, resolve);

      workerRef.current.postMessage({
        type: 'HANDLE_REQUEST',
        payload: { request, requestId }
      });

      // Timeout safety
      setTimeout(() => {
        if (requestMapRef.current.has(requestId)) {
          requestMapRef.current.delete(requestId);
          reject(new Error('Request timed out'));
        }
      }, 30000);
    });
  }, []);

  const start = useCallback(() => {
    workerRef.current?.postMessage({ type: 'START' });
  }, []);

  const stop = useCallback(() => {
    workerRef.current?.postMessage({ type: 'STOP' });
  }, []);

  return {
    isReady,
    isRunning,
    stats,
    error,
    handleUserRequest,
    start,
    stop
  };
}
