import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useAuth } from './AuthContext';

type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

interface SyncState {
  status: SyncStatus;
  lastSynced: Date | null;
  pendingChanges: number;
  connectedDevices: number;
  error: string | null;
}

interface SyncContextValue extends SyncState {
  sync: () => Promise<void>;
  pauseSync: () => void;
  resumeSync: () => void;
}

const SyncContext = createContext<SyncContextValue | null>(null);

interface SyncProviderProps {
  children: ReactNode;
}

export function SyncProvider({ children }: SyncProviderProps) {
  const { isAuthenticated, wallet } = useAuth();

  const [state, setState] = useState<SyncState>({
    status: 'idle',
    lastSynced: null,
    pendingChanges: 0,
    connectedDevices: 1,
    error: null,
  });

  const [isPaused, setIsPaused] = useState(false);

  // Initialize sync when authenticated
  useEffect(() => {
    if (!isAuthenticated || !wallet) {
      setState(prev => ({
        ...prev,
        status: 'idle',
        connectedDevices: 0,
      }));
      return;
    }

    // In production, this would:
    // 1. Initialize OrbitDB with wallet-derived keys
    // 2. Connect to peer discovery
    // 3. Start replication

    // Mock: Simulate successful connection
    setState(prev => ({
      ...prev,
      status: 'idle',
      connectedDevices: 1,
      lastSynced: new Date(),
    }));

    // Setup periodic sync (every 30 seconds)
    const syncInterval = setInterval(() => {
      if (!isPaused) {
        performSync();
      }
    }, 30000);

    return () => clearInterval(syncInterval);
  }, [isAuthenticated, wallet, isPaused]);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setState(prev => ({
        ...prev,
        status: prev.status === 'offline' ? 'idle' : prev.status,
      }));
    };

    const handleOffline = () => {
      setState(prev => ({
        ...prev,
        status: 'offline',
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial state
    if (!navigator.onLine) {
      setState(prev => ({ ...prev, status: 'offline' }));
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const performSync = useCallback(async () => {
    if (!isAuthenticated || isPaused) return;

    setState(prev => ({ ...prev, status: 'syncing', error: null }));

    try {
      // In production, this would:
      // 1. Push local changes to OrbitDB
      // 2. Pull remote changes
      // 3. Resolve any CRDT conflicts

      // Mock: Simulate sync delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      setState(prev => ({
        ...prev,
        status: 'idle',
        lastSynced: new Date(),
        pendingChanges: 0,
      }));
    } catch (error) {
      console.error('Sync failed:', error);
      setState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Sync failed',
      }));
    }
  }, [isAuthenticated, isPaused]);

  const sync = useCallback(async () => {
    await performSync();
  }, [performSync]);

  const pauseSync = useCallback(() => {
    setIsPaused(true);
  }, []);

  const resumeSync = useCallback(() => {
    setIsPaused(false);
    // Trigger immediate sync after resume
    performSync();
  }, [performSync]);

  const value: SyncContextValue = {
    ...state,
    sync,
    pauseSync,
    resumeSync,
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}
