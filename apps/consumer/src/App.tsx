import { useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Shell, BottomNavigation, SidebarNavigation } from '@ownyou/ui-components';
import type { NavItem } from '@ownyou/ui-components';
import { Home } from './routes/Home';
import { Profile } from './routes/Profile';
import { Settings } from './routes/Settings';
import { Wallet } from './routes/Wallet';
import { MissionDetail } from './routes/MissionDetail';
import { OAuthCallback } from './routes/OAuthCallback';
import { RawData } from './routes/RawData';
import { ABTesting } from './routes/ABTesting';
import { Results } from './routes/Results';
import { useKeyboardNav } from './hooks/useKeyboardNav';
import { isMobile, getPlatform } from './utils/platform';
import { SyncStatusIndicator } from './components/SyncStatusIndicator';
import { VersionBadge } from './components/VersionBadge';
import { startTauriOAuth, handleOAuthCallbackFromApp, isOAuthInProgress } from './utils/tauri-oauth';

// Map paths to nav item ids
const pathToId: Record<string, string> = {
  '/': 'home',
  '/profile': 'profile',
  '/wallet': 'wallet',
  '/data': 'data',
  '/settings': 'settings',
  '/ab-testing': 'settings', // A/B testing is accessed via settings
  '/results': 'profile', // Results relate to profile data
};

export function App() {
  // Enable keyboard navigation
  useKeyboardNav();

  const navigate = useNavigate();
  const location = useLocation();
  const mobile = isMobile();

  // Handle deep link URLs (shared handler for both sources)
  const handleDeepLinkUrls = async (urls: string[]) => {
    console.log('[App] Processing deep link URLs:', urls);

    for (const url of urls) {
      // Handle OAuth callbacks - this is a FALLBACK handler
      // The primary handler is in startTauriOAuth() which has its own onOpenUrl listener
      // Only process here if OAuth is NOT already being handled by startTauriOAuth
      if (url.startsWith('ownyou://oauth/callback')) {
        if (isOAuthInProgress()) {
          console.log('[App] OAuth callback received but startTauriOAuth is handling it, skipping');
          continue;
        }
        console.log('[App] OAuth callback received (fallback), processing via handleOAuthCallbackFromApp');
        try {
          const tokenData = await handleOAuthCallbackFromApp(url);
          if (tokenData) {
            // Parse the state to get the source ID
            const urlObj = new URL(url);
            const sourceId = urlObj.searchParams.get('state') as 'outlook' | 'gmail' | null;
            if (sourceId) {
              console.log('[App] OAuth callback successful for:', sourceId);
              // Store serialized token data for Settings to pick up
              sessionStorage.setItem('oauth_token_data', JSON.stringify(tokenData));
              sessionStorage.setItem('oauth_provider', sourceId);
              // Navigate to settings to trigger token pickup
              navigate('/settings?tab=data');
            }
          }
        } catch (err) {
          console.error('[App] OAuth callback processing failed:', err);
        }
        continue; // Don't process this URL further
      }

      // Handle connect requests from PWA
      if (url.startsWith('ownyou://connect/')) {
        const provider = url.replace('ownyou://connect/', '').split('?')[0];
        console.log('[App] Connect request for:', provider);

        // Navigate to settings and trigger OAuth
        navigate('/settings');

        // Small delay to ensure Settings component is mounted
        setTimeout(async () => {
          if (provider === 'outlook' || provider === 'gmail') {
            try {
              const tokenData = await startTauriOAuth(provider);
              if (tokenData) {
                console.log('[App] OAuth successful for:', provider);
                // Store serialized token data for Settings to pick up
                // Settings.tsx has a useEffect that checks for these and calls connectSource()
                sessionStorage.setItem('oauth_token_data', JSON.stringify(tokenData));
                sessionStorage.setItem('oauth_provider', provider);
                // Navigate to settings data tab to trigger token pickup and show confirmation
                navigate('/settings?tab=data');
              }
            } catch (err) {
              console.error('[App] OAuth failed:', err);
            }
          }
        }, 500);
      }
    }
  };

  // Handle deep links from PWA (ownyou://connect/outlook)
  useEffect(() => {
    if (getPlatform() !== 'tauri') return;

    const setupDeepLinkHandler = async () => {
      try {
        // Import deep-link plugin functions
        const { onOpenUrl, getCurrent } = await import('@tauri-apps/plugin-deep-link');

        // CRITICAL: Check for deep links that LAUNCHED the app (cold start)
        // This handles the case where the app was started via ownyou:// URL
        // and the URL needs to be processed before onOpenUrl listener is active
        const initialUrls = await getCurrent();
        if (initialUrls && initialUrls.length > 0) {
          console.log('[App] Cold-start deep link detected:', initialUrls);
          handleDeepLinkUrls(initialUrls);
        }

        // Listen for deep links received while app is running
        const unlistenDeepLink = await onOpenUrl((urls) => {
          console.log('[App] Deep link received (deep-link plugin):', urls);
          handleDeepLinkUrls(urls);
        });

        // Also listen for deep links via the single-instance plugin (when another instance is blocked)
        const { listen } = await import('@tauri-apps/api/event');
        const unlistenSingleInstance = await listen<string[]>('deep-link-received', (event) => {
          console.log('[App] Deep link received (single-instance plugin):', event.payload);
          handleDeepLinkUrls(event.payload);
        });

        return () => {
          unlistenDeepLink();
          unlistenSingleInstance();
        };
      } catch (err) {
        console.warn('[App] Deep link setup failed (expected in PWA):', err);
      }
    };

    setupDeepLinkHandler();
  }, [navigate]);

  // Get active nav item based on current path
  const activeId = pathToId[location.pathname] || 'home';

  // Handle navigation item clicks
  const handleNavClick = (item: NavItem) => {
    navigate(item.path);
  };

  return (
    <Shell>
      <div className="flex min-h-screen">
        {/* Desktop Sidebar */}
        {!mobile && (
          <aside className="hidden md:flex">
            <SidebarNavigation
              activeId={activeId}
              onItemClick={handleNavClick}
            />
          </aside>
        )}

        {/* Main Content */}
        <main className="flex-1 pb-20 md:pb-0">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/mission/:id" element={<MissionDetail />} />
            <Route path="/oauth/callback" element={<OAuthCallback />} />
            <Route path="/auth/callback" element={<OAuthCallback />} />
            <Route path="/data/:sourceType" element={<RawData />} />
            <Route path="/data" element={<RawData />} />
            <Route path="/ab-testing" element={<ABTesting />} />
            <Route path="/results" element={<Results />} />
          </Routes>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      {mobile && (
        <nav className="fixed bottom-0 left-0 right-0 md:hidden">
          <BottomNavigation
            activeId={activeId}
            onItemClick={handleNavClick}
          />
        </nav>
      )}

      {/* Sync Status Indicator - Sprint 11b Bugfix 14 */}
      <SyncStatusIndicator />

      {/* Global Version Badge - shows on ALL pages at top */}
      <VersionBadge className="fixed top-1 right-2 z-50" />
    </Shell>
  );
}
