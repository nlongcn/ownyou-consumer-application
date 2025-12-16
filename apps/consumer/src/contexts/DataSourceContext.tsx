/**
 * DataSourceContext - Manages data source connections and fetching
 *
 * Sprint 11a: Wires data packages to consumer app
 * v13 Section 5 - Data Source Sync Architecture
 *
 * PACKAGES USED:
 * - @ownyou/email: EmailPipeline for email sync
 * - @ownyou/iab-classifier: createIABClassifier for classification
 *
 * NOTE: @ownyou/data-calendar and @ownyou/data-financial packages
 * need to be built before they can be used. Calendar/financial sync
 * currently uses placeholder implementation.
 *
 * Responsibilities:
 * 1. Track connected data sources (email, calendar, financial)
 * 2. Store OAuth tokens in secure storage
 * 3. Trigger data fetching when sources connect
 * 4. Run IAB classification on fetched data
 * 5. Store classified data in LangGraph Store
 */

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { NS } from '@ownyou/shared-types';
import { useStore } from './StoreContext';
import { useAuth } from './AuthContext';

// Types for data source management
export type DataSourceId = 'gmail' | 'outlook' | 'google-calendar' | 'microsoft-calendar' | 'plaid';
export type DataSourceProvider = 'google' | 'microsoft' | 'plaid';
export type DataSourceType = 'email' | 'calendar' | 'financial';
export type DataSourceStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'syncing';

export interface DataSource {
  id: DataSourceId;
  provider: DataSourceProvider;
  type: DataSourceType;
  status: DataSourceStatus;
  lastSync?: Date;
  itemCount?: number;
  error?: string;
}

export interface SyncResult {
  success: boolean;
  itemCount: number;
  error?: string;
}

interface DataSourceContextValue {
  /** All available data sources with their connection status */
  dataSources: DataSource[];

  /** Connect a data source with OAuth token */
  connectSource: (sourceId: DataSourceId, accessToken: string) => Promise<void>;

  /** Disconnect a data source */
  disconnectSource: (sourceId: DataSourceId) => Promise<void>;

  /** Sync a specific data source (fetch + classify + store) */
  syncSource: (sourceId: DataSourceId) => Promise<SyncResult>;

  /** Sync all connected data sources */
  syncAll: () => Promise<void>;

  /** Whether any source is currently syncing */
  isSyncing: boolean;

  /** Get connected sources */
  getConnectedSources: () => DataSource[];

  /** Check if a specific source is connected */
  isSourceConnected: (sourceId: DataSourceId) => boolean;
}

const DataSourceContext = createContext<DataSourceContextValue | null>(null);

const INITIAL_DATA_SOURCES: DataSource[] = [
  { id: 'gmail', provider: 'google', type: 'email', status: 'disconnected' },
  { id: 'outlook', provider: 'microsoft', type: 'email', status: 'disconnected' },
  { id: 'google-calendar', provider: 'google', type: 'calendar', status: 'disconnected' },
  { id: 'microsoft-calendar', provider: 'microsoft', type: 'calendar', status: 'disconnected' },
  { id: 'plaid', provider: 'plaid', type: 'financial', status: 'disconnected' },
];

interface DataSourceProviderProps {
  children: ReactNode;
}

export function DataSourceProvider({ children }: DataSourceProviderProps) {
  const { store, isReady } = useStore();
  const { wallet, isAuthenticated } = useAuth();
  const userId = wallet?.address ?? 'anonymous';

  const [dataSources, setDataSources] = useState<DataSource[]>(INITIAL_DATA_SOURCES);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load saved tokens on mount
  useEffect(() => {
    if (!isReady || !isAuthenticated || !store) return;
    loadSavedTokens();
  }, [isReady, isAuthenticated, store, userId]);

  /**
   * Load OAuth tokens from secure storage and restore connection states
   */
  const loadSavedTokens = async () => {
    if (!store) return;

    try {
      // Check for saved tokens for each source
      const updatedSources = await Promise.all(
        INITIAL_DATA_SOURCES.map(async (source) => {
          try {
            const tokenKey = `oauth_${source.id}`;
            const tokenData = await store.get<{ accessToken: string; savedAt: number }>(
              NS.uiPreferences(userId),
              tokenKey
            );

            if (tokenData?.accessToken) {
              return { ...source, status: 'connected' as DataSourceStatus };
            }
          } catch {
            // Token not found or error, keep disconnected
          }
          return source;
        })
      );

      setDataSources(updatedSources);
    } catch (error) {
      console.error('[DataSourceContext] Failed to load saved tokens:', error);
    }
  };

  /**
   * Sync a data source - fetch data, classify, and store
   *
   * Email sync uses @ownyou/email package
   * Calendar/Financial sync are placeholders until packages are built
   *
   * NOTE: This function is defined BEFORE connectSource because connectSource
   * depends on it in its useCallback dependency array.
   */
  const syncSource = useCallback(async (sourceId: DataSourceId): Promise<SyncResult> => {
    console.log('[DataSourceContext] syncSource called for:', sourceId);
    if (!store || !isReady) {
      console.error('[DataSourceContext] Store not ready');
      throw new Error('Store not ready');
    }

    const source = dataSources.find(ds => ds.id === sourceId);
    console.log('[DataSourceContext] Source found:', source?.id, 'status:', source?.status);
    if (!source || source.status === 'disconnected') {
      console.log('[DataSourceContext] Source not connected, skipping sync');
      return { success: false, itemCount: 0, error: 'Source not connected' };
    }

    // Update status to syncing
    setDataSources(prev => prev.map(ds =>
      ds.id === sourceId ? { ...ds, status: 'syncing' as DataSourceStatus } : ds
    ));

    try {
      // Get the saved token
      console.log('[DataSourceContext] Getting saved token for', sourceId);
      const tokenData = await store.get<{ accessToken: string }>(
        NS.uiPreferences(userId),
        `oauth_${sourceId}`
      );
      console.log('[DataSourceContext] Token data:', tokenData ? 'found' : 'not found');
      if (!tokenData?.accessToken) {
        throw new Error('No access token found');
      }
      console.log('[DataSourceContext] Access token present, length:', tokenData.accessToken.length);

      let itemCount = 0;

      if (source.type === 'email') {
        // ========================================
        // EMAIL SYNC - Uses @ownyou/email package
        // Sprint 11b Deviation 1 Fix: Read fetchOptions from Store
        // ========================================
        console.log('[DataSourceContext] Starting email sync for', sourceId);
        try {
          console.log('[DataSourceContext] Importing @ownyou/email...');
          const { EmailPipeline } = await import('@ownyou/email');
          console.log('[DataSourceContext] Importing @ownyou/iab-classifier...');
          const { createIABClassifier } = await import('@ownyou/iab-classifier');
          console.log('[DataSourceContext] Imports successful');

          // Create IAB classifier from iab-classifier package
          const iabClassifier = createIABClassifier({ store: store as unknown as Parameters<typeof createIABClassifier>[0]['store'] });

          // Fetch user-configurable fetchOptions from Store (Sprint 11b Deviation 1 fix)
          // Falls back to defaults if not configured
          const DEFAULT_FETCH_OPTIONS = { maxResults: 100, daysBack: 30 };
          let userFetchOptions = DEFAULT_FETCH_OPTIONS;
          try {
            const configData = await store.get<{ fetchOptions?: { maxResults?: number; daysBack?: number } }>(
              NS.dataSourceConfigs(userId),
              sourceId
            );
            if (configData?.fetchOptions) {
              userFetchOptions = { ...DEFAULT_FETCH_OPTIONS, ...configData.fetchOptions };
              console.log('[DataSourceContext] Using user-configured fetchOptions:', userFetchOptions);
            }
          } catch (configError) {
            console.log('[DataSourceContext] No user fetchOptions config, using defaults');
          }

          // Create email pipeline with PipelineConfig (userId is required)
          console.log('[DataSourceContext] Creating EmailPipeline for provider:', source.provider);
          const pipeline = new EmailPipeline({
            userId,
            provider: source.provider as 'google' | 'microsoft',
            runClassification: true,
            fetchOptions: {
              maxResults: userFetchOptions.maxResults,
            },
          });

          // Run pipeline with classifier callback
          console.log('[DataSourceContext] Running email pipeline...');
          // The callback receives emails and must return IABClassification[] (@ownyou/email type)
          // We map from @ownyou/iab-classifier output to @ownyou/email IABClassification format
          const result = await pipeline.run(tokenData.accessToken, async (emails) => {
            const results: Array<{
              emailId: string;
              tier1Category: string;
              tier1Id: string;
              tier2Category?: string;
              tier2Id?: string;
              confidence: number;
              reasoning?: string;
              classifiedAt: Date;
            }> = [];

            // CRITICAL FIX: Store raw email data for RawData.tsx to display
            // Store each email's summary to NS.iabClassifications namespace
            console.log(`[DataSourceContext] Storing ${emails.length} emails to Store...`);
            for (const email of emails) {
              try {
                // Store email summary for the RawData viewer
                await store.put(
                  NS.iabClassifications(userId),
                  `email_${email.id}`,
                  {
                    id: email.id,
                    summary: email.subject || 'No subject',
                    content: email.body?.substring(0, 500) || '',
                    sourceType: 'email',
                    from: email.from,
                    to: email.to,
                    date: email.date instanceof Date ? email.date.toISOString() : email.date,
                    timestamp: new Date().toISOString(),
                    metadata: {
                      provider: source.provider,
                      hasAttachments: email.metadata?.hasAttachments || false,
                    },
                  }
                );
              } catch (storeErr) {
                console.warn('[DataSourceContext] Failed to store email:', email.id, storeErr);
              }
            }
            console.log('[DataSourceContext] Emails stored to namespace');

            // Helper to process a single email
            const processEmail = async (email: any) => {
              try {
                const classResult = await iabClassifier.invoke({
                  userId,
                  source: 'email',
                  sourceItemId: email.id,
                  text: `${email.subject} ${email.body ?? ''}`,
                });
                if (classResult.success && classResult.classification) {
                  // Map @ownyou/iab-classifier output to @ownyou/email IABClassification format
                  // iab-classifier returns: { userId, source, sourceItemId, category (string), confidence (number), reasoning, textPreview, timestamp }
                  const c = classResult.classification;

                  // CRITICAL FIX: Also store classification to the Store for Profile page
                  try {
                    await store.put(
                      NS.iabClassifications(userId),
                      `classification_${email.id}`,
                      {
                        emailId: email.id,
                        category: c.category,
                        confidence: c.confidence,
                        reasoning: c.reasoning,
                        textPreview: c.textPreview,
                        classifiedAt: new Date().toISOString(),
                      }
                    );
                  } catch (classStoreErr) {
                    console.warn('[DataSourceContext] Failed to store classification:', email.id, classStoreErr);
                  }

                  return {
                    emailId: email.id,
                    tier1Category: typeof c.category === 'string' ? c.category : 'Unknown',
                    tier1Id: 'IAB0', // iab-classifier doesn't return IAB IDs in this format
                    tier2Category: undefined,
                    tier2Id: undefined,
                    confidence: typeof c.confidence === 'number' ? c.confidence : 0.5,
                    reasoning: c.reasoning,
                    classifiedAt: new Date(),
                  };
                }
              } catch (err) {
                console.warn('[DataSourceContext] Classification failed for email:', err);
              }
              return null;
            };

            // Process emails in batches of 5 to avoid rate limits but improve speed
            const BATCH_SIZE = 5;
            for (let i = 0; i < emails.length; i += BATCH_SIZE) {
              const batch = emails.slice(i, i + BATCH_SIZE);
              console.log(`[DataSourceContext] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(emails.length / BATCH_SIZE)} (${batch.length} emails)`);

              const batchResults = await Promise.all(batch.map(processEmail));

              // Filter out nulls (failed classifications) and add to results
              batchResults.forEach(res => {
                if (res) results.push(res);
              });
            }

            return results;
          });

          // PipelineResult has emailsFetched, not emailCount
          console.log('[DataSourceContext] Pipeline completed:', result);
          itemCount = result.emailsFetched ?? 0;
          console.log('[DataSourceContext] Emails fetched:', itemCount);
        } catch (err) {
          console.error('[DataSourceContext] Email sync failed:', err);
          throw err;
        }

      } else if (source.type === 'calendar') {
        // ========================================
        // CALENDAR SYNC - Placeholder
        // TODO: Build @ownyou/data-calendar package
        // ========================================
        console.warn('[DataSourceContext] Calendar sync not yet implemented - @ownyou/data-calendar needs to be built');
        itemCount = 0;

      } else if (source.type === 'financial') {
        // ========================================
        // FINANCIAL SYNC - Placeholder
        // TODO: Build @ownyou/data-financial package
        // ========================================
        console.warn('[DataSourceContext] Financial sync not yet implemented - @ownyou/data-financial needs to be built');
        itemCount = 0;
      }

      // Update to connected with sync info
      setDataSources(prev => prev.map(ds =>
        ds.id === sourceId ? {
          ...ds,
          status: 'connected' as DataSourceStatus,
          lastSync: new Date(),
          itemCount,
          error: undefined,
        } : ds
      ));

      return { success: true, itemCount };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sync failed';

      setDataSources(prev => prev.map(ds =>
        ds.id === sourceId ? {
          ...ds,
          status: 'error' as DataSourceStatus,
          error: errorMessage,
        } : ds
      ));

      return { success: false, itemCount: 0, error: errorMessage };
    }
  }, [store, isReady, userId, dataSources]);

  /**
   * Connect a data source with OAuth token
   */
  const connectSource = useCallback(async (sourceId: DataSourceId, accessToken: string) => {
    if (!store || !isReady) throw new Error('Store not ready');

    // Update status to connecting
    setDataSources(prev => prev.map(ds =>
      ds.id === sourceId ? { ...ds, status: 'connecting' as DataSourceStatus } : ds
    ));

    try {
      // Store the access token securely
      await store.put(NS.uiPreferences(userId), `oauth_${sourceId}`, {
        accessToken,
        savedAt: Date.now(),
      });

      // Update to connected
      setDataSources(prev => prev.map(ds =>
        ds.id === sourceId ? { ...ds, status: 'connected' as DataSourceStatus } : ds
      ));

      // Immediately sync after connecting
      await syncSource(sourceId);
    } catch (error) {
      setDataSources(prev => prev.map(ds =>
        ds.id === sourceId ? {
          ...ds,
          status: 'error' as DataSourceStatus,
          error: error instanceof Error ? error.message : 'Connection failed'
        } : ds
      ));
      throw error;
    }
  }, [store, isReady, userId, syncSource]);

  /**
   * Disconnect a data source
   */
  const disconnectSource = useCallback(async (sourceId: DataSourceId) => {
    if (!store || !isReady) throw new Error('Store not ready');

    try {
      // Remove the saved token
      await store.delete(NS.uiPreferences(userId), `oauth_${sourceId}`);

      // Update to disconnected
      setDataSources(prev => prev.map(ds =>
        ds.id === sourceId ? {
          ...ds,
          status: 'disconnected' as DataSourceStatus,
          lastSync: undefined,
          itemCount: undefined,
          error: undefined,
        } : ds
      ));
    } catch (error) {
      console.error('[DataSourceContext] Failed to disconnect:', error);
      throw error;
    }
  }, [store, isReady, userId]);

  /**
   * Sync all connected data sources
   */
  const syncAll = useCallback(async () => {
    setIsSyncing(true);
    try {
      const connected = dataSources.filter(ds => ds.status === 'connected');
      await Promise.all(connected.map(ds => syncSource(ds.id)));
    } finally {
      setIsSyncing(false);
    }
  }, [dataSources, syncSource]);

  /**
   * Get all connected sources
   */
  const getConnectedSources = useCallback(() => {
    return dataSources.filter(ds => ds.status === 'connected');
  }, [dataSources]);

  /**
   * Check if a specific source is connected
   */
  const isSourceConnected = useCallback((sourceId: DataSourceId): boolean => {
    const source = dataSources.find(ds => ds.id === sourceId);
    return source?.status === 'connected';
  }, [dataSources]);

  const value: DataSourceContextValue = {
    dataSources,
    connectSource,
    disconnectSource,
    syncSource,
    syncAll,
    isSyncing,
    getConnectedSources,
    isSourceConnected,
  };

  return (
    <DataSourceContext.Provider value={value}>
      {children}
    </DataSourceContext.Provider>
  );
}

export function useDataSource() {
  const context = useContext(DataSourceContext);
  if (!context) {
    throw new Error('useDataSource must be used within a DataSourceProvider');
  }
  return context;
}

/**
 * Hook for managing a specific data source
 */
export function useDataSourceConnection(sourceId: DataSourceId) {
  const { dataSources, connectSource, disconnectSource, syncSource, isSourceConnected } = useDataSource();

  const source = dataSources.find(ds => ds.id === sourceId);

  const connect = useCallback(async (accessToken: string) => {
    await connectSource(sourceId, accessToken);
  }, [sourceId, connectSource]);

  const disconnect = useCallback(async () => {
    await disconnectSource(sourceId);
  }, [sourceId, disconnectSource]);

  const sync = useCallback(async () => {
    return syncSource(sourceId);
  }, [sourceId, syncSource]);

  return {
    source,
    isConnected: isSourceConnected(sourceId),
    connect,
    disconnect,
    sync,
  };
}
