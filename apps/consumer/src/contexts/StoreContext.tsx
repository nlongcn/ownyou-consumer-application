/**
 * StoreContext - Provides memory store access to consumer app
 * v13 Section 8.7 - LangGraph Store Pattern
 *
 * Uses IndexedDBBackend for real persistence in browser.
 * Data persists across page refreshes and is tied to wallet address.
 */

import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import {
  MemoryStore,
  IndexedDBBackend,
  InMemoryBackend,
  MockEmbeddingService,
  type StorageBackend,
} from '@ownyou/memory-store';
import { useAuth } from './AuthContext';
import { getPlatform } from '../utils/platform';

interface StoreContextValue {
  store: MemoryStore | null;
  isReady: boolean;
  error: Error | null;
  /** Backend type for debugging */
  backendType: 'indexeddb' | 'memory' | null;
}

const StoreContext = createContext<StoreContextValue | null>(null);

interface StoreProviderProps {
  children: ReactNode;
  /** Force in-memory backend (for testing) */
  forceInMemory?: boolean;
}

/**
 * Check if IndexedDB is available and functional
 */
async function isIndexedDBAvailable(): Promise<boolean> {
  if (typeof indexedDB === 'undefined') {
    return false;
  }

  // Test that IndexedDB actually works (some browsers block it in private mode)
  try {
    const testDB = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('__ownyou_idb_test__', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    testDB.close();
    await new Promise<void>((resolve, reject) => {
      const deleteRequest = indexedDB.deleteDatabase('__ownyou_idb_test__');
      deleteRequest.onerror = () => reject(deleteRequest.error);
      deleteRequest.onsuccess = () => resolve();
    });
    return true;
  } catch {
    return false;
  }
}

export function StoreProvider({ children, forceInMemory = false }: StoreProviderProps) {
  const { wallet, isAuthenticated } = useAuth();
  const [store, setStore] = useState<MemoryStore | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [backendType, setBackendType] = useState<'indexeddb' | 'memory' | null>(null);
  const storeRef = useRef<MemoryStore | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !wallet) {
      // Cleanup existing store when logging out
      if (storeRef.current) {
        storeRef.current = null;
      }
      setStore(null);
      setIsReady(false);
      setBackendType(null);
      return;
    }

    const initStore = async () => {
      try {
        let backend: StorageBackend;
        let type: 'indexeddb' | 'memory';

        const platform = getPlatform();

        // Determine backend based on platform and availability
        if (forceInMemory) {
          // Testing mode - use in-memory
          backend = new InMemoryBackend();
          type = 'memory';
        } else if (platform === 'tauri') {
          // Tauri: Use IndexedDB for now (SQLite requires Tauri plugin)
          // TODO: Implement SQLiteBackend with tauri-plugin-sql
          const idbAvailable = await isIndexedDBAvailable();
          if (idbAvailable) {
            backend = new IndexedDBBackend({
              dbName: `ownyou_${wallet.address.slice(0, 8)}`,
            });
            type = 'indexeddb';
          } else {
            console.warn('IndexedDB not available in Tauri, falling back to memory');
            backend = new InMemoryBackend();
            type = 'memory';
          }
        } else {
          // Browser/PWA: Use IndexedDB for persistence
          const idbAvailable = await isIndexedDBAvailable();
          if (idbAvailable) {
            backend = new IndexedDBBackend({
              dbName: `ownyou_${wallet.address.slice(0, 8)}`,
            });
            type = 'indexeddb';
          } else {
            // Private browsing or IndexedDB blocked
            console.warn('IndexedDB not available, data will not persist across sessions');
            backend = new InMemoryBackend();
            type = 'memory';
          }
        }

        const memoryStore = new MemoryStore({
          backend,
          embeddingService: new MockEmbeddingService(), // TODO: Real embedding service
        });

        storeRef.current = memoryStore;
        setStore(memoryStore);
        setBackendType(type);
        setIsReady(true);
        setError(null);

        if (type === 'indexeddb') {
          console.log(`Store initialized with IndexedDB: ownyou_${wallet.address.slice(0, 8)}`);
        }
      } catch (err) {
        console.error('Failed to initialize store:', err);
        setError(err instanceof Error ? err : new Error('Failed to initialize store'));
        setIsReady(false);
        setBackendType(null);
      }
    };

    initStore();

    // Cleanup on unmount or wallet change
    return () => {
      if (storeRef.current) {
        // Close IndexedDB connection if applicable
        storeRef.current = null;
      }
    };
  }, [isAuthenticated, wallet, forceInMemory]);

  return (
    <StoreContext.Provider value={{ store, isReady, error, backendType }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
}

/**
 * Hook to ensure store is ready before operations
 */
export function useStoreReady() {
  const { store, isReady, error } = useStore();

  if (error) {
    throw error;
  }

  if (!isReady || !store) {
    return null;
  }

  return store;
}
