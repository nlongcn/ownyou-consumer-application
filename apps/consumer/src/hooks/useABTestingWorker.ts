/**
 * useABTestingWorker - React hook for A/B testing classification worker
 *
 * Provides an interface to the classification.worker.ts for:
 * - Multi-model IAB classification
 * - Email summarization
 * - Progress tracking
 * - Cancellation support
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import type {
  Email,
  PreprocessedEmail,
  ModelConfig,
  ModelResults,
} from '@ownyou/ab-testing';
import type {
  ClassifyRequest,
  SummarizeRequest,
  ProgressMessage,
  ResultMessage,
  SummarizeResultMessage,
  ErrorMessage,
} from '../workers/classification.worker';

export interface WorkerProgress {
  modelKey: string;
  completed: number;
  total: number;
  status: string;
}

// API keys are read from import.meta.env in the worker - NOT passed as parameters

export interface UseABTestingWorkerReturn {
  /** Run classification on preprocessed emails with multiple models */
  runClassification: (
    emails: PreprocessedEmail[],
    models: ModelConfig[]
  ) => Promise<Record<string, ModelResults>>;

  /** Run summarization on raw emails */
  runSummarization: (
    emails: Email[],
    model: ModelConfig
  ) => Promise<PreprocessedEmail[]>;

  /** Current progress by model */
  progress: Map<string, WorkerProgress>;

  /** Whether any operation is running */
  isRunning: boolean;

  /** Last error message */
  error: string | null;

  /** Cancel current operation */
  cancel: () => void;
}

/**
 * Hook for communicating with the classification worker
 */
export function useABTestingWorker(): UseABTestingWorkerReturn {
  const workerRef = useRef<Worker | null>(null);
  const [progress, setProgress] = useState<Map<string, WorkerProgress>>(
    new Map()
  );
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize worker on mount
  useEffect(() => {
    workerRef.current = new Worker(
      new URL('../workers/classification.worker.ts', import.meta.url),
      { type: 'module' }
    );

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  /**
   * Run multi-model classification
   * API keys are read from import.meta.env in the worker
   */
  const runClassification = useCallback(
    async (
      emails: PreprocessedEmail[],
      models: ModelConfig[]
    ): Promise<Record<string, ModelResults>> => {
      return new Promise((resolve, reject) => {
        if (!workerRef.current) {
          reject(new Error('Worker not initialized'));
          return;
        }

        const requestId = crypto.randomUUID();
        setIsRunning(true);
        setError(null);
        setProgress(new Map());

        const handleMessage = (
          event: MessageEvent<
            ProgressMessage | ResultMessage | ErrorMessage
          >
        ) => {
          // Only handle messages for this request
          if (event.data.requestId !== requestId) return;

          switch (event.data.type) {
            case 'progress': {
              const progressData = event.data as ProgressMessage;
              setProgress((prev) => {
                const next = new Map(prev);
                next.set(progressData.modelKey, {
                  modelKey: progressData.modelKey,
                  completed: progressData.completed,
                  total: progressData.total,
                  status: progressData.status,
                });
                return next;
              });
              break;
            }

            case 'result': {
              const resultData = event.data as ResultMessage;
              workerRef.current?.removeEventListener('message', handleMessage);
              setIsRunning(false);
              resolve(resultData.results);
              break;
            }

            case 'error': {
              const errorData = event.data as ErrorMessage;
              workerRef.current?.removeEventListener('message', handleMessage);
              setIsRunning(false);
              setError(errorData.error);
              reject(new Error(errorData.error));
              break;
            }
          }
        };

        workerRef.current.addEventListener('message', handleMessage);

        // Send classification request - NO apiKeys parameter (worker reads from env)
        const request: ClassifyRequest = {
          type: 'classify',
          requestId,
          emails,
          models,
        };
        workerRef.current.postMessage(request);
      });
    },
    []
  );

  /**
   * Run email summarization
   * API keys are read from import.meta.env in the worker
   */
  const runSummarization = useCallback(
    async (
      emails: Email[],
      model: ModelConfig
    ): Promise<PreprocessedEmail[]> => {
      return new Promise((resolve, reject) => {
        if (!workerRef.current) {
          reject(new Error('Worker not initialized'));
          return;
        }

        const requestId = crypto.randomUUID();
        setIsRunning(true);
        setError(null);
        setProgress(new Map());

        const handleMessage = (
          event: MessageEvent<
            ProgressMessage | SummarizeResultMessage | ErrorMessage
          >
        ) => {
          if (event.data.requestId !== requestId) return;

          switch (event.data.type) {
            case 'progress': {
              const progressData = event.data as ProgressMessage;
              setProgress((prev) => {
                const next = new Map(prev);
                next.set(progressData.modelKey, {
                  modelKey: progressData.modelKey,
                  completed: progressData.completed,
                  total: progressData.total,
                  status: progressData.status,
                });
                return next;
              });
              break;
            }

            case 'summarize_result': {
              const resultData = event.data as SummarizeResultMessage;
              workerRef.current?.removeEventListener('message', handleMessage);
              setIsRunning(false);
              resolve(resultData.emails);
              break;
            }

            case 'error': {
              const errorData = event.data as ErrorMessage;
              workerRef.current?.removeEventListener('message', handleMessage);
              setIsRunning(false);
              setError(errorData.error);
              reject(new Error(errorData.error));
              break;
            }
          }
        };

        workerRef.current.addEventListener('message', handleMessage);

        // Send summarization request - NO apiKeys parameter (worker reads from env)
        const request: SummarizeRequest = {
          type: 'summarize',
          requestId,
          emails,
          model,
        };
        workerRef.current.postMessage(request);
      });
    },
    []
  );

  /**
   * Cancel current operation
   */
  const cancel = useCallback(() => {
    // Terminate current worker
    workerRef.current?.terminate();

    // Create new worker
    workerRef.current = new Worker(
      new URL('../workers/classification.worker.ts', import.meta.url),
      { type: 'module' }
    );

    // Reset state
    setIsRunning(false);
    setProgress(new Map());
    setError(null);
  }, []);

  return {
    runClassification,
    runSummarization,
    progress,
    isRunning,
    error,
    cancel,
  };
}

/**
 * Calculate overall progress from per-model progress
 */
export function calculateOverallProgress(
  progress: Map<string, WorkerProgress>
): { completed: number; total: number; percentage: number } {
  let completed = 0;
  let total = 0;

  progress.forEach((p) => {
    completed += p.completed;
    total += p.total;
  });

  return {
    completed,
    total,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}
