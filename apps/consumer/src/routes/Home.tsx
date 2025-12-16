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
        <div className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-lg">
            {/* Hero Section */}
            <div className="text-center mb-8">
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-4xl">✨</span>
              </div>
              <h1 className="text-3xl font-bold mb-3">Your AI is Ready</h1>
              <p className="text-gray-600 text-lg">
                Connect your email and we'll find savings, insights, and opportunities personalized for you.
              </p>
            </div>

            {/* Benefits - FIRST, before asking for action */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-center">
                <span className="text-3xl mb-2 block">💰</span>
                <p className="font-semibold text-sm">Savings Missions</p>
                <p className="text-xs text-gray-500">Find deals you'll love</p>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-center">
                <span className="text-3xl mb-2 block">🎯</span>
                <p className="font-semibold text-sm">Personal Insights</p>
                <p className="text-xs text-gray-500">Understand your patterns</p>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-center">
                <span className="text-3xl mb-2 block">🍽️</span>
                <p className="font-semibold text-sm">Smart Suggestions</p>
                <p className="text-xs text-gray-500">Restaurants, travel & more</p>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-center">
                <span className="text-3xl mb-2 block">🔒</span>
                <p className="font-semibold text-sm">100% Private</p>
                <p className="text-xs text-gray-500">Data stays on your device</p>
              </div>
            </div>

            {/* Primary CTA - Email connection */}
            <button
              onClick={() => navigate('/settings?tab=data')}
              className="w-full flex items-center gap-4 p-5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg mb-6"
            >
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-3xl">📧</span>
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="font-bold text-xl">Connect Your Email</p>
                <p className="text-blue-100 text-sm">Gmail or Outlook • Takes 30 seconds</p>
              </div>
              <svg className="w-6 h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Secondary options - smaller, less prominent */}
            <div className="flex justify-center gap-4 text-sm">
              <button
                onClick={() => navigate('/settings?tab=data')}
                className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <span>📅</span> Calendar
              </button>
              <span className="text-gray-300">•</span>
              <button
                onClick={() => window.open('https://chrome.google.com/webstore', '_blank')}
                className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <span>🧩</span> Extension
              </button>
              <span className="text-gray-300">•</span>
              <button
                onClick={() => navigate('/settings?tab=data')}
                className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <span>💻</span> Desktop
              </button>
            </div>

            {/* Privacy reassurance */}
            <p className="text-center text-xs text-gray-400 mt-6">
              Your data is analyzed locally and never leaves your device.
            </p>
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
      <div className="flex flex-col min-h-screen pb-32"> {/* Add padding for ChatInput */}
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
        <ChatInput />
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
