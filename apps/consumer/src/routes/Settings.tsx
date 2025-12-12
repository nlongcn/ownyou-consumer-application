import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Header } from '@ownyou/ui-components';
import { Card } from '@ownyou/ui-design-system';
import { useAuth } from '../contexts/AuthContext';
import { useSync } from '../contexts/SyncContext';
import { useDataSource, type DataSourceId, type DataSource } from '../contexts/DataSourceContext';
import { useGDPR } from '../hooks/useGDPR';
import { SyncStatusDetails } from '../components/SyncStatusIndicator';
import { getPlatform } from '../utils/platform';
import { startTauriOAuth, initOAuthListener } from '../utils/tauri-oauth';

type SettingsSection = 'privacy' | 'data' | 'wallet' | 'sync' | 'about';

export function Settings() {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as SettingsSection | null;
  const [activeSection, setActiveSection] = useState<SettingsSection>(tabParam || 'privacy');
  const { isAuthenticated, wallet } = useAuth();
  const { status: syncStatus, lastSynced } = useSync();

  // Update active section when URL param changes
  useEffect(() => {
    if (tabParam && ['privacy', 'data', 'wallet', 'sync', 'about'].includes(tabParam)) {
      setActiveSection(tabParam);
    }
  }, [tabParam]);

  return (
    <div className="flex flex-col min-h-screen">
      <Header showLogo={false} title="Settings" />

      <div className="flex-1 px-4 py-6">
        {/* Settings Navigation */}
        <nav className="flex overflow-x-auto gap-2 mb-6 hide-scrollbar">
          {(['privacy', 'data', 'wallet', 'sync', 'about'] as SettingsSection[]).map((section) => (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                activeSection === section
                  ? 'bg-ownyou-secondary text-white'
                  : 'bg-white text-black'
              }`}
            >
              {section.charAt(0).toUpperCase() + section.slice(1)}
            </button>
          ))}
        </nav>

        {/* Settings Content */}
        <div className="space-y-4">
          {activeSection === 'privacy' && <PrivacySettings />}
          {activeSection === 'data' && <DataSettings />}
          {activeSection === 'wallet' && <WalletSettings wallet={wallet} isAuthenticated={isAuthenticated} />}
          {activeSection === 'sync' && <SyncSettings syncStatus={syncStatus} lastSynced={lastSynced} />}
          {activeSection === 'about' && <AboutSettings />}
        </div>
      </div>
    </div>
  );
}

function PrivacySettings() {
  const [localProcessing, setLocalProcessing] = useState(true);
  const [shareAnonymized, setShareAnonymized] = useState(false);

  return (
    <Card className="p-6 space-y-4">
      <h3 className="text-lg font-bold">Privacy Controls</h3>

      <SettingToggle
        label="Local Processing Only"
        description="All data stays on your device"
        checked={localProcessing}
        onChange={setLocalProcessing}
      />

      <SettingToggle
        label="Share Anonymized Insights"
        description="Help improve OwnYou with anonymous data"
        checked={shareAnonymized}
        onChange={setShareAnonymized}
      />

      <div className="pt-4 border-t">
        <h4 className="font-bold mb-2">Data Retention</h4>
        <p className="text-sm text-gray-600 mb-4">
          Choose how long to keep your data on this device
        </p>
        <select className="w-full p-2 rounded-lg border">
          <option value="forever">Keep forever</option>
          <option value="1year">1 year</option>
          <option value="6months">6 months</option>
          <option value="3months">3 months</option>
        </select>
      </div>
    </Card>
  );
}

function DataSettings() {
  const { dataSources, connectSource, disconnectSource, syncSource } = useDataSource();
  const { downloadExport, deleteAllDataAndLogout, isExporting, isDeleting, isReady: gdprReady } = useGDPR();
  const [isConnecting, setIsConnecting] = useState<DataSourceId | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [showOutlookChoice, setShowOutlookChoice] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const navigate = useNavigate();

  /**
   * Initialize OAuth deep link listener for Tauri mode
   * This must be called once when the component mounts to handle OAuth callbacks
   */
  useEffect(() => {
    const platform = getPlatform();
    if (platform === 'tauri') {
      console.log('[DataSettings] Initializing Tauri OAuth deep link listener');
      initOAuthListener();
    }
  }, []);

  /**
   * Check for pending OAuth token from redirect flow on component mount
   * This handles the case where OAuth redirects back (no popup) and stores token in sessionStorage
   */
  useEffect(() => {
    const pendingToken = sessionStorage.getItem('oauth_token');
    const pendingProvider = sessionStorage.getItem('oauth_provider') as DataSourceId | null;

    if (pendingToken && pendingProvider) {
      console.log('[DataSettings] Found pending OAuth token for:', pendingProvider);
      // Clear the stored values first to prevent loops
      sessionStorage.removeItem('oauth_token');
      sessionStorage.removeItem('oauth_provider');

      // Connect with the stored token
      setIsConnecting(pendingProvider);
      connectSource(pendingProvider, pendingToken)
        .then(() => {
          console.log('[DataSettings] Connected via redirect flow:', pendingProvider);
        })
        .catch((error) => {
          console.error('[DataSettings] Failed to connect via redirect flow:', error);
        })
        .finally(() => {
          setIsConnecting(null);
        });
    }
  }, [connectSource]);

  /**
   * Perform the actual OAuth connection for a data source
   * - Tauri mode: Uses standalone PKCE OAuth with deep links (no backend required)
   * - PWA mode: Uses popup flow with PKCE
   */
  const performOAuthConnect = useCallback(async (sourceId: DataSourceId) => {
    const platform = getPlatform();
    console.log(`[DataSettings] performOAuthConnect called for: ${sourceId}`);
    console.log(`[DataSettings] Current platform: ${platform}`);

    setIsConnecting(sourceId);
    try {
      // In Tauri mode, use standalone OAuth with deep links (no backend required)
      if (platform === 'tauri') {
        console.log(`[DataSettings] TAURI MODE - using standalone OAuth with deep links`);
        try {
          // Use standalone Tauri OAuth flow with PKCE
          // This opens system browser, user authenticates, callback comes via deep link
          const accessToken = await startTauriOAuth(sourceId);

          if (accessToken) {
            console.log(`[DataSettings] Tauri OAuth successful, connecting source...`);
            await connectSource(sourceId, accessToken);
            console.log(`[DataSettings] Connected ${sourceId} successfully`);
          } else {
            console.log(`[DataSettings] Tauri OAuth returned null (user cancelled or error)`);
          }
        } catch (tauriError: any) {
          console.error(`[DataSettings] Tauri OAuth failed:`, tauriError);
          alert(`OAuth error: ${tauriError?.message || tauriError}`);
        }
      } else {
        // PWA mode - use popup flow
        console.log(`[DataSettings] PWA MODE - using popup flow`);
        const oauthUrl = getOAuthUrl(sourceId);
        if (!oauthUrl) {
          console.error(`[DataSettings] Failed to build OAuth URL for: ${sourceId}`);
          alert(`OAuth not configured for ${sourceId}. Check console for details.`);
          setIsConnecting(null);
          return;
        }

        const accessToken = await openOAuthPopup(oauthUrl, sourceId);
        console.log(`[DataSettings] openOAuthPopup returned, accessToken:`, accessToken ? 'RECEIVED' : 'NULL');

        if (accessToken) {
          console.log(`[DataSettings] Calling connectSource for ${sourceId}...`);
          await connectSource(sourceId, accessToken);
          console.log(`[DataSettings] Connected ${sourceId} successfully`);
        } else {
          console.log(`[DataSettings] No access token received for ${sourceId}`);
        }
      }
    } catch (error) {
      console.error(`[DataSettings] Failed to connect ${sourceId}:`, error);
    } finally {
      console.log(`[DataSettings] performOAuthConnect finished for ${sourceId}`);
      setIsConnecting(null);
    }
  }, [connectSource]);

  /**
   * Handle OAuth connection for a data source
   * For Outlook in PWA mode, shows choice dialog first
   */
  const handleConnect = useCallback(async (sourceId: DataSourceId) => {
    console.log(`[DataSettings] ========== handleConnect START ==========`);
    console.log(`[DataSettings] handleConnect called for: ${sourceId}`);
    const platform = getPlatform();
    console.log(`[DataSettings] Platform detected: ${platform}`);
    console.log(`[DataSettings] window.__TAURI__ exists:`, typeof window !== 'undefined' ? '__TAURI__' in window : false);
    console.log(`[DataSettings] window.__TAURI__ value:`, typeof window !== 'undefined' ? (window as any).__TAURI__ : 'N/A');

    // For Outlook in PWA mode, show the choice dialog first
    if (sourceId === 'outlook' && platform === 'pwa') {
      console.log(`[DataSettings] Showing Outlook choice dialog (PWA mode)`);
      setShowOutlookChoice(true);
      return;
    }
    // Otherwise, proceed directly with OAuth
    console.log(`[DataSettings] Proceeding directly to OAuth for ${sourceId} (${platform} mode)`);
    await performOAuthConnect(sourceId);
  }, [performOAuthConnect]);

  /**
   * Handle disconnecting a data source
   */
  const handleDisconnect = useCallback(async (sourceId: DataSourceId) => {
    try {
      await disconnectSource(sourceId);
      console.log(`[DataSettings] Disconnected ${sourceId}`);
    } catch (error) {
      console.error(`[DataSettings] Failed to disconnect ${sourceId}:`, error);
    }
  }, [disconnectSource]);

  /**
   * Handle re-syncing a data source
   */
  const handleSync = useCallback(async (sourceId: DataSourceId) => {
    try {
      const result = await syncSource(sourceId);
      console.log(`[DataSettings] Synced ${sourceId}:`, result);
    } catch (error) {
      console.error(`[DataSettings] Failed to sync ${sourceId}:`, error);
    }
  }, [syncSource]);

  // Map DataSource to display config
  const getSourceDisplayInfo = (source: DataSource) => {
    const displayMap: Record<DataSourceId, { name: string; provider: string }> = {
      'gmail': { name: 'Gmail', provider: 'Google' },
      'outlook': { name: 'Outlook', provider: 'Microsoft' },
      'google-calendar': { name: 'Calendar', provider: 'Google Calendar' },
      'microsoft-calendar': { name: 'Calendar', provider: 'Microsoft Calendar' },
      'plaid': { name: 'Financial', provider: 'Plaid' },
    };
    return displayMap[source.id] ?? { name: source.id, provider: source.provider };
  };

  // Filter to main sources we want to show (gmail, outlook, google-calendar)
  const visibleSources = dataSources.filter(ds =>
    ['gmail', 'outlook', 'google-calendar'].includes(ds.id)
  );

  return (
    <Card className="p-6 space-y-4">
      <h3 className="text-lg font-bold">Data Sources</h3>

      {visibleSources.map(source => {
        const displayInfo = getSourceDisplayInfo(source);
        const isConnected = source.status === 'connected';
        const isThisConnecting = isConnecting === source.id;
        const isSyncingThis = source.status === 'syncing';

        return (
          <DataSourceCard
            key={source.id}
            name={displayInfo.name}
            provider={displayInfo.provider}
            connected={isConnected}
            lastSync={source.lastSync ? formatRelativeTime(source.lastSync) : undefined}
            status={source.status}
            isLoading={isThisConnecting || isSyncingThis}
            onConnect={() => handleConnect(source.id)}
            onDisconnect={() => handleDisconnect(source.id)}
            onSync={() => handleSync(source.id)}
          />
        );
      })}

      {/* Outlook PWA limitation notice - only show in browser, not Tauri */}
      {getPlatform() === 'pwa' && dataSources.find(ds => ds.id === 'outlook')?.status === 'connected' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
          <p className="text-amber-800 font-medium">Outlook sync expires daily</p>
          <p className="text-amber-700 mt-1">
            Browser-based Outlook connections require daily re-authentication.
            For continuous sync, use the <button
              onClick={() => window.location.href = 'ownyou://connect/outlook'}
              className="underline font-medium hover:text-amber-900"
            >desktop app</button>.
          </p>
        </div>
      )}

      {/* Outlook pre-connect choice dialog - Sprint 11b: Desktop app recommendation */}
      {showOutlookChoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Connect Outlook</h3>
            <p className="text-gray-600 text-sm mb-4">
              Browser-based Outlook connections expire daily and require re-authentication.
              For uninterrupted sync, we recommend the desktop app.
            </p>

            <div className="space-y-3">
              {/* Download Desktop App - synchronous for browser compatibility */}
              {(() => {
                const { url, platform, filename } = getDesktopDownloadUrl();
                return (
                  <>
                    <button
                      onClick={() => {
                        // MUST be synchronous to preserve user gesture for download
                        // Any async operation before the download triggers popup blocker
                        setDownloadError(null);
                        downloadDesktopApp(
                          url,
                          filename,
                          (percent) => setDownloadProgress(percent),
                          (error) => setDownloadError(error)
                        );
                        // Don't close dialog - let user see the download started
                        // The page will navigate but browser will handle as download
                      }}
                      className="w-full py-3 px-4 text-white rounded-lg transition-colors flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download Desktop App
                      <span className="text-xs bg-white/20 px-2 py-0.5 rounded">{platform}</span>
                    </button>
                    {downloadError && (
                      <p className="text-red-500 text-sm text-center">{downloadError}</p>
                    )}
                  </>
                );
              })()}

              {/* Open Desktop App - for users who already have it installed */}
              <button
                onClick={() => {
                  setShowOutlookChoice(false);
                  window.location.href = 'ownyou://connect/outlook';
                }}
                className="w-full py-3 px-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Already Installed? Open App
              </button>

              {/* Continue in Browser */}
              <button
                onClick={() => {
                  setShowOutlookChoice(false);
                  performOAuthConnect('outlook');
                }}
                className="w-full py-3 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Continue in Browser
                <span className="block text-xs text-gray-500 mt-0.5">Requires daily re-authentication</span>
              </button>

              {/* Cancel */}
              <button
                onClick={() => setShowOutlookChoice(false)}
                className="w-full py-2 text-gray-500 text-sm hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Data Section - Sprint 11b Bugfix 10 */}
      <div className="pt-4 border-t">
        <h4 className="font-bold mb-3">View Your Data</h4>
        <p className="text-sm text-gray-600 mb-3">
          See what data OwnYou has imported from your connected sources.
        </p>
        <div className="space-y-2">
          <button
            onClick={() => navigate('/data/emails')}
            className="w-full py-2 px-4 text-left bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <span>📧</span> Emails
            </span>
            <span className="text-gray-400">→</span>
          </button>
          <button
            onClick={() => navigate('/data/transactions')}
            className="w-full py-2 px-4 text-left bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <span>💳</span> Transactions
            </span>
            <span className="text-gray-400">→</span>
          </button>
          <button
            onClick={() => navigate('/data/calendar')}
            className="w-full py-2 px-4 text-left bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <span>📅</span> Calendar Events
            </span>
            <span className="text-gray-400">→</span>
          </button>
        </div>
      </div>

      {/* GDPR Actions - Sprint 11b Bugfix 11 */}
      <div className="pt-4 border-t space-y-2">
        <h4 className="font-bold mb-3">Your Data Rights</h4>
        <p className="text-sm text-gray-600 mb-3">
          Export or delete all your data. This is permanent and cannot be undone.
        </p>

        {/* Export success message */}
        {exportSuccess && (
          <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm mb-2">
            Data exported successfully! Check your downloads folder.
          </div>
        )}

        {/* Delete error message */}
        {deleteError && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-2">
            {deleteError}
          </div>
        )}

        <button
          onClick={async () => {
            try {
              await downloadExport();
              setExportSuccess(true);
              setTimeout(() => setExportSuccess(false), 5000);
            } catch (err) {
              console.error('[GDPR] Export failed:', err);
            }
          }}
          disabled={!gdprReady || isExporting}
          className="w-full py-3 text-center text-blue-500 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isExporting ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Exporting...
            </>
          ) : (
            '📥 Export All Data'
          )}
        </button>

        {/* Delete confirmation dialog */}
        {showDeleteConfirm ? (
          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <p className="text-red-700 font-medium mb-2">Are you absolutely sure?</p>
            <p className="text-red-600 text-sm mb-4">
              This will permanently delete ALL your data including emails, classifications, missions, and preferences. This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  try {
                    setDeleteError(null);
                    await deleteAllDataAndLogout();
                    navigate('/');
                  } catch (err) {
                    setDeleteError('Failed to delete data. Please try again.');
                    console.error('[GDPR] Delete failed:', err);
                  }
                }}
                disabled={isDeleting}
                className="flex-1 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Deleting...
                  </>
                ) : (
                  'Yes, Delete Everything'
                )}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={!gdprReady || isDeleting}
            className="w-full py-3 text-center text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🗑️ Delete All Data
          </button>
        )}
      </div>
    </Card>
  );
}

/**
 * Get desktop app download URL based on user's operating system
 * Auto-detects macOS vs Windows and returns appropriate installer URL
 */
function getDesktopDownloadUrl(): { url: string; platform: string; filename: string } {
  const DOWNLOAD_URLS = {
    mac_arm: {
      url: 'https://github.com/nlongcn/ownyou-consumer-application/releases/download/v0.1.0/OwnYou_0.1.0_aarch64.dmg',
      filename: 'OwnYou_0.1.0_aarch64.dmg',
    },
    windows: {
      url: 'https://github.com/nlongcn/ownyou-consumer-application/releases/download/v0.1.0/OwnYou_0.1.0_x64-setup.exe',
      filename: 'OwnYou_0.1.0_x64-setup.exe',
    },
  };

  const ua = navigator.userAgent.toLowerCase();

  if (ua.includes('win')) {
    return { url: DOWNLOAD_URLS.windows.url, platform: 'Windows', filename: DOWNLOAD_URLS.windows.filename };
  }
  if (ua.includes('mac')) {
    return { url: DOWNLOAD_URLS.mac_arm.url, platform: 'macOS', filename: DOWNLOAD_URLS.mac_arm.filename };
  }
  // Default to Windows for unknown platforms
  return { url: DOWNLOAD_URLS.windows.url, platform: 'Windows', filename: DOWNLOAD_URLS.windows.filename };
}

/**
 * Download desktop app - synchronous approach for browser compatibility
 *
 * IMPORTANT: This function must be called synchronously from a click handler.
 * Using async operations (like fetch) before window.location.href will cause
 * the browser to block the download as a popup (user gesture expires).
 *
 * GitHub releases respond with Content-Disposition: attachment header,
 * so the browser will download the file instead of navigating away.
 */
function downloadDesktopApp(
  url: string,
  _filename: string, // unused - browser uses Content-Disposition header
  onProgress?: (percent: number) => void,
  _onError?: (error: string) => void // unused - redirect always works
): void {
  console.log('[Download] Starting download via anchor tag click');
  onProgress?.(0);

  // Use a temporary anchor tag to trigger download
  // This is preferred over window.open as it avoids popup blockers
  // and stays in the same context while still triggering download
  const link = document.createElement('a');
  link.href = url;
  // Note: 'download' attribute is ignored for cross-origin URLs,
  // but we include it as a hint for same-origin scenarios or if behaviors change
  link.download = _filename; 
  link.target = '_blank'; // Open in new tab/window to be safe for cross-origin redirects
  link.rel = 'noopener noreferrer'; // Security best practice
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Mark as complete immediately (actual download happens in background)
  onProgress?.(100);
}

/**
 * Generate PKCE code verifier and challenge for OAuth 2.0 PKCE flow
 * Required for SPAs without a backend to securely exchange auth codes
 */
function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  // Generate code verifier (43-128 characters, base64url encoded)
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const codeVerifier = btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  // For S256 method, we need to hash the verifier
  // Using SHA-256 would require async, so for simplicity we use 'plain' method
  // In production, use S256 with SubtleCrypto
  const codeChallenge = codeVerifier;

  return { codeVerifier, codeChallenge };
}

/**
 * Get OAuth URL for a data source - builds proper OAuth authorization URLs
 * Uses Authorization Code flow with PKCE for secure SPA OAuth
 */
function getOAuthUrl(sourceId: DataSourceId): string | null {
  // Generate and store PKCE verifier for token exchange
  const { codeVerifier, codeChallenge } = generatePKCE();
  sessionStorage.setItem(`oauth_code_verifier_${sourceId}`, codeVerifier);

  // Use provider-specific redirect URIs (must match Azure/Google app registrations)
  const googleRedirectUri = encodeURIComponent(
    import.meta.env.VITE_GOOGLE_REDIRECT_URI || `${window.location.origin}/oauth/callback`
  );
  const microsoftRedirectUri = encodeURIComponent(
    import.meta.env.VITE_MICROSOFT_REDIRECT_URI || `${window.location.origin}/auth/callback`
  );

  if (sourceId === 'gmail') {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.error('[OAuth] VITE_GOOGLE_CLIENT_ID not configured');
      return null;
    }
    // Google OAuth 2.0 with PKCE - authorization code flow
    const scopes = encodeURIComponent('https://www.googleapis.com/auth/gmail.readonly');
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${googleRedirectUri}&response_type=code&scope=${scopes}&state=gmail&code_challenge=${codeChallenge}&code_challenge_method=plain&access_type=offline&prompt=consent`;
  }

  if (sourceId === 'outlook') {
    const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID;
    if (!clientId) {
      console.error('[OAuth] VITE_MICROSOFT_CLIENT_ID not configured');
      return null;
    }
    // Microsoft OAuth 2.0 with PKCE - authorization code flow
    const scopes = encodeURIComponent('https://graph.microsoft.com/Mail.Read offline_access');
    return `https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?client_id=${clientId}&redirect_uri=${microsoftRedirectUri}&response_type=code&scope=${scopes}&state=outlook&code_challenge=${codeChallenge}&code_challenge_method=plain`;
  }

  if (sourceId === 'google-calendar') {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) return null;
    const scopes = encodeURIComponent('https://www.googleapis.com/auth/calendar.readonly');
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${googleRedirectUri}&response_type=code&scope=${scopes}&state=google-calendar&code_challenge=${codeChallenge}&code_challenge_method=plain&access_type=offline&prompt=consent`;
  }

  if (sourceId === 'microsoft-calendar') {
    const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID;
    if (!clientId) return null;
    const scopes = encodeURIComponent('https://graph.microsoft.com/Calendars.Read offline_access');
    return `https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?client_id=${clientId}&redirect_uri=${microsoftRedirectUri}&response_type=code&scope=${scopes}&state=microsoft-calendar&code_challenge=${codeChallenge}&code_challenge_method=plain`;
  }

  return null;
}

/**
 * Open OAuth popup and wait for token callback
 */
async function openOAuthPopup(oauthUrl: string, sourceId: DataSourceId): Promise<string | null> {
  console.log(`[OAuth] openOAuthPopup called for ${sourceId}`);
  console.log(`[OAuth] URL:`, oauthUrl.substring(0, 100) + '...');

  return new Promise((resolve) => {
    // Calculate popup position
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    console.log(`[OAuth] Opening popup window at position (${left}, ${top}), size ${width}x${height}`);

    // Open popup
    const popup = window.open(
      oauthUrl,
      `oauth_${sourceId}`,
      `width=${width},height=${height},left=${left},top=${top},popup=yes`
    );

    console.log(`[OAuth] window.open result:`, popup ? 'WINDOW OPENED' : 'NULL (blocked)');

    if (!popup) {
      console.error('[OAuth] Popup blocked or failed to open');
      console.error('[OAuth] This is likely because:');
      console.error('[OAuth]   1. Popup was blocked by browser/Tauri');
      console.error('[OAuth]   2. window.open is not supported in this context');
      resolve(null);
      return;
    }

    console.log(`[OAuth] Popup opened successfully, setting up message listener`);

    // Listen for message from popup
    const handleMessage = (event: MessageEvent) => {
      console.log(`[OAuth] Received message event:`, event.data);
      // Verify origin in production
      if (event.data?.type === 'oauth_callback' && event.data?.sourceId === sourceId) {
        console.log(`[OAuth] Valid OAuth callback received for ${sourceId}`);
        window.removeEventListener('message', handleMessage);
        popup.close();
        resolve(event.data.accessToken ?? null);
      }
    };

    window.addEventListener('message', handleMessage);
    console.log(`[OAuth] Message listener registered`);

    // Also poll for popup close (user cancelled)
    const pollTimer = setInterval(() => {
      if (popup.closed) {
        console.log(`[OAuth] Popup was closed (user cancelled or completed)`);
        clearInterval(pollTimer);
        window.removeEventListener('message', handleMessage);
        resolve(null);
      }
    }, 500);

    // Timeout after 5 minutes
    setTimeout(() => {
      console.log(`[OAuth] Timeout reached (5 minutes)`);
      clearInterval(pollTimer);
      window.removeEventListener('message', handleMessage);
      if (!popup.closed) popup.close();
      resolve(null);
    }, 5 * 60 * 1000);
  });
}


interface WalletSettingsProps {
  wallet?: { address: string } | null;
  isAuthenticated: boolean;
}

function WalletSettings({ wallet, isAuthenticated }: WalletSettingsProps) {
  return (
    <Card className="p-6 space-y-4">
      <h3 className="text-lg font-bold">Wallet</h3>

      {isAuthenticated && wallet ? (
        <>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Wallet Address</p>
            <p className="font-mono text-sm break-all">{wallet.address}</p>
          </div>

          <div className="text-center py-4">
            <p className="text-3xl font-bold">0.00 OWN</p>
            <p className="text-sm text-gray-600">Lifetime Earnings</p>
          </div>
        </>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-600 mb-4">Connect your wallet to earn OWN tokens</p>
          <button className="bg-ownyou-secondary text-white px-6 py-3 rounded-full">
            Connect Wallet
          </button>
        </div>
      )}
    </Card>
  );
}

interface SyncSettingsProps {
  syncStatus: 'idle' | 'syncing' | 'error' | 'offline';
  lastSynced: Date | null;
}

/**
 * SyncSettings - Sprint 11b Bugfix 14: Enhanced sync status display
 */
function SyncSettings(_props: SyncSettingsProps) {
  return (
    <Card className="p-6 space-y-4">
      <h3 className="text-lg font-bold">Cross-Device Sync</h3>

      <p className="text-sm text-gray-600">
        Your data is encrypted end-to-end and synced across your devices using OrbitDB.
      </p>

      {/* Detailed sync status - Sprint 11b Bugfix 14 */}
      <SyncStatusDetails />

      <div className="pt-4 border-t">
        <button className="w-full py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
          View Paired Devices
        </button>
      </div>
    </Card>
  );
}

function AboutSettings() {
  return (
    <Card className="p-6 space-y-4">
      <h3 className="text-lg font-bold">About OwnYou</h3>

      <div className="text-center py-4">
        <p className="text-2xl font-bold mb-1">OwnYou</p>
        <p className="text-sm text-gray-600">Version 0.1.0</p>
      </div>

      <p className="text-sm text-gray-600">
        OwnYou is a privacy-first personal AI that helps you understand yourself
        better and earn from your data on your terms.
      </p>

      <div className="space-y-2 pt-4 border-t">
        <a href="#" className="block py-2 text-blue-500">Privacy Policy</a>
        <a href="#" className="block py-2 text-blue-500">Terms of Service</a>
        <a href="#" className="block py-2 text-blue-500">Open Source Licenses</a>
      </div>
    </Card>
  );
}

interface SettingToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function SettingToggle({ label, description, checked, onChange }: SettingToggleProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`w-12 h-6 rounded-full transition-colors ${
          checked ? 'bg-ownyou-secondary' : 'bg-gray-300'
        }`}
      >
        <div
          className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

interface DataSourceCardProps {
  name: string;
  provider: string;
  connected: boolean;
  lastSync?: string;
  status?: string;
  isLoading?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onSync?: () => void;
}

function DataSourceCard({
  name,
  provider,
  connected,
  lastSync,
  status,
  isLoading,
  onConnect,
  onDisconnect,
  onSync,
}: DataSourceCardProps) {
  const handleButtonClick = () => {
    console.log(`[DataSourceCard] Button clicked for: ${name}`);
    console.log(`[DataSourceCard] Connected: ${connected}, isLoading: ${isLoading}`);
    if (connected) {
      console.log(`[DataSourceCard] Calling onDisconnect`);
      onDisconnect?.();
    } else {
      console.log(`[DataSourceCard] Calling onConnect`);
      onConnect?.();
    }
  };

  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium">{name}</p>
          {status === 'syncing' && (
            <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
          )}
          {status === 'error' && (
            <span className="w-2 h-2 bg-red-500 rounded-full" />
          )}
          {connected && status !== 'syncing' && status !== 'error' && (
            <span className="w-2 h-2 bg-green-500 rounded-full" />
          )}
        </div>
        <p className="text-sm text-gray-600">{provider}</p>
        {connected && lastSync && (
          <p className="text-xs text-gray-400">Synced {lastSync}</p>
        )}
        {status === 'error' && (
          <p className="text-xs text-red-500">Connection error</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {connected && onSync && (
          <button
            onClick={onSync}
            disabled={isLoading}
            className="p-2 text-gray-500 hover:bg-gray-200 rounded-full disabled:opacity-50"
            title="Refresh"
          >
            <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}
        <button
          onClick={handleButtonClick}
          disabled={isLoading}
          className={`px-4 py-1 rounded-full text-sm transition-colors disabled:opacity-50 ${
            connected
              ? 'bg-red-100 text-red-600 hover:bg-red-200'
              : 'bg-ownyou-secondary text-white hover:bg-ownyou-secondary/90'
          }`}
        >
          {isLoading ? (
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {connected ? 'Disconnecting...' : 'Connecting...'}
            </span>
          ) : (
            connected ? 'Disconnect' : 'Connect'
          )}
        </button>
      </div>
    </div>
  );
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minutes ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hours ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} days ago`;
}
