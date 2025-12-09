import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { getPlatform } from '../utils/platform';

export interface Wallet {
  address: string;
  publicKey: string;
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  wallet: Wallet | null;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signMessage: (message: string) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    wallet: null,
    error: null,
  });

  // Check for existing wallet on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const platform = getPlatform();

        if (platform === 'tauri') {
          // In Tauri, check the secure store for saved wallet
          // const store = await Store.load('wallet.json');
          // const savedWallet = await store.get<Wallet>('wallet');
          // if (savedWallet) { ... }
        } else {
          // In PWA, check IndexedDB
          const savedWallet = localStorage.getItem('ownyou_wallet');
          if (savedWallet) {
            const wallet = JSON.parse(savedWallet) as Wallet;
            setState({
              isAuthenticated: true,
              isLoading: false,
              wallet,
              error: null,
            });
            return;
          }
        }

        setState(prev => ({ ...prev, isLoading: false }));
      } catch (error) {
        console.error('Auth check failed:', error);
        setState({
          isAuthenticated: false,
          isLoading: false,
          wallet: null,
          error: 'Failed to check authentication',
        });
      }
    };

    checkAuth();
  }, []);

  const connect = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // In production, this would:
      // 1. Generate or load wallet keys
      // 2. Derive encryption keys for E2EE
      // 3. Initialize the sync system

      // Mock wallet for development
      const mockWallet: Wallet = {
        address: '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
        publicKey: 'mock-public-key-' + Date.now(),
      };

      // Persist wallet
      const platform = getPlatform();
      if (platform === 'tauri') {
        // Save to Tauri secure store
        // const store = await Store.load('wallet.json');
        // await store.set('wallet', mockWallet);
        // await store.save();
      } else {
        // Save to localStorage (IndexedDB in production)
        localStorage.setItem('ownyou_wallet', JSON.stringify(mockWallet));
      }

      setState({
        isAuthenticated: true,
        isLoading: false,
        wallet: mockWallet,
        error: null,
      });
    } catch (error) {
      console.error('Connect failed:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to connect wallet',
      }));
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      const platform = getPlatform();
      if (platform === 'tauri') {
        // Clear Tauri secure store
        // const store = await Store.load('wallet.json');
        // await store.delete('wallet');
        // await store.save();
      } else {
        localStorage.removeItem('ownyou_wallet');
      }

      setState({
        isAuthenticated: false,
        isLoading: false,
        wallet: null,
        error: null,
      });
    } catch (error) {
      console.error('Disconnect failed:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to disconnect',
      }));
    }
  }, []);

  const signMessage = useCallback(async (message: string): Promise<string | null> => {
    if (!state.wallet) {
      return null;
    }

    try {
      // In production, this would use the wallet's private key to sign
      // For now, return a mock signature
      const mockSignature = 'sig_' + btoa(message).slice(0, 32);
      return mockSignature;
    } catch (error) {
      console.error('Sign message failed:', error);
      return null;
    }
  }, [state.wallet]);

  const value: AuthContextValue = {
    ...state,
    connect,
    disconnect,
    signMessage,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
