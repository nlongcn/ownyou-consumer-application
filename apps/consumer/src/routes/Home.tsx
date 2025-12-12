import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header, MissionFeed } from '@ownyou/ui-components';
import type { HeartState, FilterTab } from '@ownyou/ui-components';
import { cardDimensions, radius, Card } from '@ownyou/ui-design-system';
import { useMissions, useUpdateMission } from '../hooks/useMissions';
import { useFeedback } from '../hooks/useFeedback';
import { useAuth } from '../contexts/AuthContext';
import { useDataSource } from '../contexts/DataSourceContext';
import { useTrigger } from '../contexts/TriggerContext';
import { useToast } from '../contexts/ToastContext';
import { ChatInput } from '../components/ChatInput';

export function Home() {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const navigate = useNavigate();
  const { isAuthenticated, connect, isLoading: isConnecting } = useAuth();
  const { getConnectedSources, isSyncing, dataSources } = useDataSource();
  const { isExecuting: isAgentExecuting } = useTrigger();
  const { showFeedbackToast, showToast } = useToast();

  const { missions, isLoading, error, hasMissions } = useMissions(activeFilter);
  const { updateFeedback } = useFeedback();
  const { snoozeMission, dismissMission } = useUpdateMission();

  const handleMissionClick = useCallback((missionId: string) => {
    navigate(`/mission/${missionId}`);
  }, [navigate]);

  const handleFeedbackChange = useCallback((missionId: string, state: HeartState) => {
    updateFeedback(missionId, state);
    // Show contextual toast for feedback - Phase 4 UX improvement
    showFeedbackToast(state);
  }, [updateFeedback, showFeedbackToast]);

  const handleFilterChange = useCallback((filter: FilterTab) => {
    setActiveFilter(filter);
  }, []);

  const handleSnooze = useCallback(async (missionId: string) => {
    try {
      await snoozeMission(missionId);
      console.log('[Home] Mission snoozed:', missionId);
      showToast('Mission snoozed - will show again later', 'info', 2000);
    } catch (error) {
      console.error('[Home] Snooze failed:', error);
    }
  }, [snoozeMission, showToast]);

  const handleDismiss = useCallback(async (missionId: string) => {
    try {
      await dismissMission(missionId);
      console.log('[Home] Mission dismissed:', missionId);
      showToast('Mission dismissed', 'info', 2000);
    } catch (error) {
      console.error('[Home] Dismiss failed:', error);
    }
  }, [dismissMission, showToast]);

  const handleCallToAction = useCallback((missionId: string) => {
    // Find the mission and open its action URL
    const mission = missions.find(m => m.id === missionId);
    if (mission?.actionUrl) {
      window.open(mission.actionUrl, '_blank');
    } else {
      // Navigate to detail page if no action URL
      navigate(`/mission/${missionId}`);
    }
  }, [missions, navigate]);

  // Check if any data sources are connected
  const connectedSources = getConnectedSources();
  const hasConnectedSources = connectedSources.length > 0;

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center p-4">
          <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
          <p className="text-gray-600">{error.message}</p>
        </div>
      </div>
    );
  }

  // Show onboarding when not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header showFilters={false} />
        <div className="flex-1 flex items-center justify-center px-4">
          <Card className="p-8 text-center max-w-md">
            {/* OwnYou Logo */}
            <div className="mx-auto mb-6">
              <img
                src="/assets/ownyou-logo.png"
                alt="OwnYou"
                className="w-20 h-20 mx-auto rounded-full shadow-lg"
              />
            </div>
            <h1 className="text-2xl font-bold mb-3">Personal AI, Private by Design</h1>
            {/* Specific value props from Vision doc */}
            <div className="text-left space-y-3 mb-6">
              <div className="flex items-start gap-3">
                <span className="text-xl">🔒</span>
                <p className="text-gray-600 text-sm">
                  <strong>Your data never leaves your device.</strong> No cloud uploads, no third-party access.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-xl">💰</span>
                <p className="text-gray-600 text-sm">
                  <strong>Smart shopping, bill management, savings.</strong> Personal finance insights that actually help.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-xl">🎁</span>
                <p className="text-gray-600 text-sm">
                  <strong>Get paid when advertisers want your attention.</strong> You control who sees your profile.
                </p>
              </div>
            </div>
            <button
              onClick={connect}
              disabled={isConnecting}
              className="w-full py-3 rounded-full font-bold disabled:opacity-50"
              style={{ backgroundColor: '#70DF82', color: '#FFFFFF' }}
            >
              {isConnecting ? 'Creating secure wallet...' : 'Get Started'}
            </button>
            <p className="text-xs text-gray-500 mt-4">
              No account needed. Your wallet is created locally.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  // Show onboarding screen when authenticated but no data sources connected
  if (!hasConnectedSources) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header showFilters={false} />
        <div className="flex-1 px-4 py-6 overflow-y-auto">
          {/* Video Placeholder */}
          <div className="mb-6">
            <div
              className="w-full aspect-video bg-gray-900 rounded-2xl flex items-center justify-center relative overflow-hidden"
              style={{ maxHeight: '240px' }}
            >
              {/* Gradient background */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500 opacity-80" />

              {/* Play button */}
              <div className="relative z-10 w-16 h-16 bg-white/90 rounded-full flex items-center justify-center shadow-lg cursor-pointer hover:bg-white transition-colors">
                <svg className="w-8 h-8 text-gray-900 ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>

              {/* Video label */}
              <div className="absolute bottom-3 left-3 bg-black/50 text-white text-xs px-2 py-1 rounded">
                1:30 · How OwnYou Works
              </div>
            </div>
          </div>

          {/* Tagline */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-2">Unlock Your Personal AI</h1>
            <p className="text-gray-600">
              Connect your data to get personalized savings, recommendations, and insights that actually matter to you.
            </p>
          </div>

          {/* Connect Data Sources Card */}
          <Card className="p-6 mb-6">
            <h2 className="text-lg font-bold mb-4">Connect Your Data</h2>
            <p className="text-sm text-gray-600 mb-4">
              Your data stays on your device. We analyze it locally to understand your interests and find opportunities for you.
            </p>

            {/* Data source buttons */}
            <div className="space-y-3">
              <button
                onClick={() => navigate('/settings?tab=data')}
                className="w-full flex items-center gap-3 p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors"
              >
                <span className="text-2xl">📧</span>
                <div className="text-left">
                  <p className="font-medium">Connect Email</p>
                  <p className="text-xs text-gray-500">Gmail or Outlook</p>
                </div>
                <svg className="w-5 h-5 ml-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <button
                onClick={() => navigate('/settings?tab=data')}
                className="w-full flex items-center gap-3 p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-green-400 hover:bg-green-50 transition-colors"
              >
                <span className="text-2xl">📅</span>
                <div className="text-left">
                  <p className="font-medium">Connect Calendar</p>
                  <p className="text-xs text-gray-500">Google or Microsoft Calendar</p>
                </div>
                <svg className="w-5 h-5 ml-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <button
                onClick={() => window.open('https://chrome.google.com/webstore', '_blank')}
                className="w-full flex items-center gap-3 p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition-colors"
              >
                <span className="text-2xl">🧩</span>
                <div className="text-left">
                  <p className="font-medium">Browser Extension</p>
                  <p className="text-xs text-gray-500">Learn from your browsing to find better deals</p>
                </div>
                <svg className="w-5 h-5 ml-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <button
                onClick={() => window.open('https://ownyou.ai/download', '_blank')}
                className="w-full flex items-center gap-3 p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
              >
                <span className="text-2xl">💻</span>
                <div className="text-left">
                  <p className="font-medium">Desktop App</p>
                  <p className="text-xs text-gray-500">Sync across devices with enhanced privacy</p>
                </div>
                <svg className="w-5 h-5 ml-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </Card>

          {/* What you'll get */}
          <div className="space-y-4">
            <h3 className="font-bold text-center">What you'll unlock:</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 p-4 rounded-xl text-center">
                <span className="text-2xl mb-2 block">💰</span>
                <p className="text-sm font-medium">Savings Missions</p>
                <p className="text-xs text-gray-500">Find deals you'll love</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-xl text-center">
                <span className="text-2xl mb-2 block">🎯</span>
                <p className="text-sm font-medium">Ikigai Profile</p>
                <p className="text-xs text-gray-500">Discover your purpose</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-xl text-center">
                <span className="text-2xl mb-2 block">🍽️</span>
                <p className="text-sm font-medium">Smart Suggestions</p>
                <p className="text-xs text-gray-500">Restaurants, travel & more</p>
              </div>
              <div className="bg-orange-50 p-4 rounded-xl text-center">
                <span className="text-2xl mb-2 block">🔒</span>
                <p className="text-sm font-medium">100% Private</p>
                <p className="text-xs text-gray-500">Data never leaves your device</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Check if we're syncing or processing
  const isProcessing = isSyncing || isAgentExecuting;
  const syncingSource = dataSources.find(ds => ds.status === 'syncing');

  // Show processing state when data connected, syncing, and no missions yet
  if (hasConnectedSources && !hasMissions && (isProcessing || isLoading)) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header showFilters={false} />
        <div className="flex-1 flex items-center justify-center px-4">
          <Card className="p-8 text-center max-w-md">
            {/* Animated processing icon */}
            <div className="w-20 h-20 mx-auto mb-6 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full animate-pulse" />
              <div className="absolute inset-2 bg-white rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            </div>

            <h2 className="text-xl font-bold mb-2">
              {syncingSource ? `Analyzing your ${syncingSource.type}...` : 'Setting up your AI...'}
            </h2>
            <p className="text-gray-600 mb-4">
              We're learning about your interests to find personalized opportunities. This usually takes about a minute.
            </p>

            {/* Progress indicator */}
            <div className="space-y-2 text-left text-sm">
              <div className="flex items-center gap-2">
                <span className={syncingSource ? 'text-blue-500 animate-pulse' : 'text-green-500'}>
                  {syncingSource ? '⏳' : '✅'}
                </span>
                <span className={syncingSource ? 'text-gray-600' : 'text-gray-400'}>
                  Fetching your data
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={isAgentExecuting ? 'text-blue-500 animate-pulse' : syncingSource ? 'text-gray-300' : 'text-green-500'}>
                  {isAgentExecuting ? '⏳' : syncingSource ? '○' : '✅'}
                </span>
                <span className={isAgentExecuting ? 'text-gray-600' : 'text-gray-400'}>
                  Analyzing interests
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-300">○</span>
                <span className="text-gray-400">Generating missions</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Show empty state with tip if data connected but no missions (processing complete)
  if (hasConnectedSources && !hasMissions && !isProcessing && !isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header showFilters={false} />
        <div className="flex-1 flex items-center justify-center px-4">
          <Card className="p-8 text-center max-w-md">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <span className="text-3xl">🔍</span>
            </div>
            <h2 className="text-xl font-bold mb-2">No missions yet</h2>
            <p className="text-gray-600 mb-6">
              We're still learning about you. Connect more data sources or check back in a few minutes.
            </p>
            <button
              onClick={() => navigate('/settings?tab=data')}
              className="w-full py-3 rounded-full font-bold"
              style={{ backgroundColor: '#70DF82', color: '#FFFFFF' }}
            >
              Connect More Data
            </button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen pb-32"> {/* Add padding for ChatInput */}
      <Header
        activeFilter={activeFilter}
        onFilterChange={handleFilterChange}
      />

      <div className="flex-1" style={{ padding: `0 ${cardDimensions.feedPadding}` }}>
        {isLoading ? (
          <MissionFeedSkeleton />
        ) : (
          <MissionFeed
            missions={missions.map(m => ({
              ...m,
              createdAt: m.createdAt instanceof Date ? m.createdAt.getTime() : m.createdAt,
            }))}
            onMissionClick={handleMissionClick}
            onFeedbackChange={handleFeedbackChange}
            onSnooze={handleSnooze}
            onDismiss={handleDismiss}
            onCallToAction={handleCallToAction}
          />
        )}
      </div>

      <ChatInput />
    </div>
  );
}

function MissionFeedSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4" style={{ gap: cardDimensions.gap }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="bg-placeholder animate-pulse"
          style={{
            height: `${180 + Math.random() * 100}px`,
            borderRadius: radius.card,
          }}
        />
      ))}
    </div>
  );
}
