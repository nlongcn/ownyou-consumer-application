/**
 * OwnYou Consumer Application Entry Point
 *
 * Sprint 11a: Added complete provider composition for real data flows.
 *
 * Provider Order (dependencies flow downward):
 * 1. QueryClient - React Query for data fetching
 * 2. Router - Navigation
 * 3. Theme - UI theming
 * 4. Auth - Wallet-based authentication
 * 5. Store - LangGraph memory store
 * 6. Resilience - Circuit breakers and LLM fallback (Sprint 5)
 * 7. Memory - Memory tools and reflection (Sprint 4)
 * 8. Ikigai - Well-being inference (Sprint 6)
 * 9. DataSource - Data connectors (Sprint 8)
 * 10. Trigger - Agent coordination (Sprint 5)
 * 11. Sync - Cross-device sync (Sprint 10)
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@ownyou/ui-design-system';
import { App } from './App';
// Core contexts
import { AuthProvider } from './contexts/AuthContext';
import { StoreProvider } from './contexts/StoreContext';
import { SyncProvider } from './contexts/SyncContext';
// Sprint 11a: New integration contexts
import { ResilienceProvider } from './contexts/ResilienceContext';
import { MemoryProvider } from './contexts/MemoryContext';
import { IkigaiProvider } from './contexts/IkigaiContext';
import { DataSourceProvider } from './contexts/DataSourceContext';
import { TriggerProvider } from './contexts/TriggerContext';
// Sprint 11 UX Overhaul Phase 4: Toast notifications
import { ToastProvider } from './contexts/ToastContext';
import './styles/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

/**
 * Provider composition following dependency order:
 *
 * QueryClient → Router → Theme → Auth → Store → Resilience → Memory →
 * Ikigai → DataSource → Trigger → Sync → App
 *
 * Why this order:
 * - Store needs Auth (wallet address for namespace)
 * - Resilience is standalone (no dependencies)
 * - Memory needs Store
 * - Ikigai needs Store and Memory
 * - DataSource needs Store and Resilience
 * - Trigger needs Store, Memory, and access to agents
 * - Sync needs Store
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <StoreProvider>
                <ResilienceProvider>
                  <MemoryProvider>
                    <IkigaiProvider>
                      <DataSourceProvider>
                        <TriggerProvider>
                          <SyncProvider>
                            <App />
                          </SyncProvider>
                        </TriggerProvider>
                      </DataSourceProvider>
                    </IkigaiProvider>
                  </MemoryProvider>
                </ResilienceProvider>
              </StoreProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
