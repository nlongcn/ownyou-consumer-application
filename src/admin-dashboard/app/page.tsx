'use client';

import { useEffect, useState } from 'react';
import { initiateOAuthFlow } from '@/lib/oauth-pkce';
import { getTokenStatus, deleteTokens } from '@/lib/token-storage';
import {
  startAutomaticRefresh,
  stopAutomaticRefresh
} from '@/lib/token-refresh-manager';

export default function HomePage() {
  const [authStatus, setAuthStatus] = useState<{
    authenticated: boolean;
    accountEmail?: string;
    expiresIn?: number;
  }>({ authenticated: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();

    // Cleanup on unmount
    return () => {
      stopAutomaticRefresh();
    };
  }, []);

  async function checkAuthStatus() {
    setLoading(true);
    const status = await getTokenStatus('microsoft');
    setAuthStatus(status);

    // Start automatic refresh if authenticated
    if (status.authenticated) {
      startAutomaticRefresh('microsoft');
    }

    setLoading(false);
  }

  async function handleConnect() {
    await initiateOAuthFlow();
  }

  async function handleDisconnect() {
    stopAutomaticRefresh();
    await deleteTokens('microsoft');
    setAuthStatus({ authenticated: false });
  }

  function formatExpiresIn(milliseconds?: number) {
    if (!milliseconds) return '';
    const days = Math.floor(milliseconds / (1000 * 60 * 60 * 24));
    const hours = Math.floor((milliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return `${days} days, ${hours} hours`;
  }

  return (
    <div className="space-y-8">
      {/* OAuth Testing Section */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-lg p-6 border border-blue-200">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            🔐 Client-Side PKCE OAuth
          </h2>
        </div>
        <p className="text-gray-700 mb-4">
          Browser-only authentication with automatic token refresh every 50 minutes for up to 24 hours.
        </p>

        {loading ? (
          <div className="flex items-center space-x-2 text-gray-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span>Checking authentication status...</span>
          </div>
        ) : authStatus.authenticated ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <svg className="h-6 w-6 text-green-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-green-900">✅ Authenticated</h3>
                  <p className="text-sm text-green-800 mt-1">
                    <strong>Account:</strong> {authStatus.accountEmail}
                  </p>
                  <p className="text-sm text-green-800">
                    <strong>Expires in:</strong> {formatExpiresIn(authStatus.expiresIn)}
                  </p>
                  {authStatus.expiresIn && (
                    <div className="text-xs text-green-700 mt-2 space-y-1">
                      {Math.floor(authStatus.expiresIn / (1000 * 60 * 60 * 24)) >= 60 ? (
                        <p className="font-bold">🎉 SUCCESS! This is a 90-day token!</p>
                      ) : (
                        <>
                          <p className="font-bold">⚠️ 24-hour SPA token (auto-refreshing)</p>
                          <p className="text-green-600">
                            ✓ Access tokens refresh automatically every 50 minutes
                          </p>
                          <p className="text-green-600">
                            ✓ Stay logged in for 24 hours, then re-authenticate
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={handleDisconnect}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Disconnect Account
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>Status:</strong> Not authenticated
              </p>
              <p className="text-xs text-yellow-700 mt-2">
                Click below to test the PKCE OAuth flow and verify token lifetime.
              </p>
            </div>
            <button
              onClick={handleConnect}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md hover:shadow-lg"
            >
              Connect Microsoft Account (PKCE)
            </button>
          </div>
        )}
      </div>

      {/* Welcome Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Welcome to the Admin Dashboard
        </h2>
        <p className="text-gray-600 mb-4">
          This is the TypeScript-based admin dashboard for debugging IAB classifications
          and developing mission agents. Phase 1.5 - Week 1/4.
        </p>
        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            ✅ Next.js 14 Setup Complete
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            ✅ TypeScript IAB Classifier Integrated
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            ✅ IndexedDB Store Ready
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
            🆕 Client-Side PKCE OAuth
          </span>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Existing Features */}
        <FeatureCard
          title="Profile Viewer"
          description="View IAB classifications across 6 sections"
          href="/profile"
          status="complete"
        />
        <FeatureCard
          title="Analysis Runner"
          description="Run IAB classification on text input"
          href="/analyze"
          status="complete"
        />
        <FeatureCard
          title="Classifications List"
          description="Browse all IAB classifications"
          href="/classifications"
          status="complete"
        />

        {/* New Features */}
        <FeatureCard
          title="Category Browser"
          description="Browse IAB Taxonomy 1.1 structure"
          href="/categories"
          status="complete"
        />
        <FeatureCard
          title="Quality Analytics"
          description="Classification quality metrics"
          href="/quality"
          status="complete"
        />

        {/* Week 2-3 - Email Download & Classification */}
        <FeatureCard
          title="Email Download"
          description="Download emails from Gmail/Outlook with OAuth"
          href="/emails"
          status="complete"
        />

        {/* A/B Testing */}
        <FeatureCard
          title="A/B Model Testing"
          description="Compare IAB classification across multiple LLM models"
          href="/ab-testing"
          status="new"
        />
      </div>

      {/* Status Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">
          📋 Phase 1.5 Progress (Week 1/4)
        </h3>
        <div className="space-y-2">
          <ProgressItem label="Strategic Roadmap Updated" completed />
          <ProgressItem label="Next.js Project Setup" completed />
          <ProgressItem label="Profile Viewer" completed />
          <ProgressItem label="Analysis Runner" completed />
          <ProgressItem label="Classifications List" completed />
          <ProgressItem label="Category Browser" completed />
          <ProgressItem label="Quality Analytics" completed />
          <ProgressItem label="End-to-End Testing" inProgress />
        </div>
      </div>

      {/* Documentation Links */}
      <div className="bg-gray-100 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          📚 Documentation
        </h3>
        <ul className="space-y-2">
          <li>
            <a
              href="/README.md"
              className="text-blue-600 hover:text-blue-800 hover:underline"
            >
              Admin Dashboard README
            </a>
          </li>
          <li>
            <a
              href="/docs/plans/2025-01-04-ownyou-strategic-roadmap.md"
              className="text-blue-600 hover:text-blue-800 hover:underline"
            >
              Strategic Roadmap (Phase 1.5)
            </a>
          </li>
          <li>
            <a
              href="/docs/learnings/ADMIN_DASHBOARD_TO_CONSUMER_UI.md"
              className="text-blue-600 hover:text-blue-800 hover:underline"
            >
              Learnings Document (For Phase 5)
            </a>
          </li>
        </ul>
      </div>
    </div>
  )
}

// Feature Card Component
function FeatureCard({
  title,
  description,
  href,
  status
}: {
  title: string
  description: string
  href: string
  status: 'migrating' | 'new' | 'complete'
}) {
  const statusStyles = {
    migrating: 'bg-yellow-100 text-yellow-800',
    new: 'bg-purple-100 text-purple-800',
    complete: 'bg-green-100 text-green-800',
  }

  const statusLabels = {
    migrating: '🔄 Migrating',
    new: '🆕 New',
    complete: '✅ Complete',
  }

  return (
    <a
      href={href}
      className="block p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <span className={`text-xs px-2 py-1 rounded-full ${statusStyles[status]}`}>
          {statusLabels[status]}
        </span>
      </div>
      <p className="text-sm text-gray-600">{description}</p>
    </a>
  )
}

// Progress Item Component
function ProgressItem({
  label,
  completed = false,
  inProgress = false
}: {
  label: string
  completed?: boolean
  inProgress?: boolean
}) {
  return (
    <div className="flex items-center space-x-2">
      {completed ? (
        <span className="text-green-600">✅</span>
      ) : inProgress ? (
        <span className="text-yellow-600">🔄</span>
      ) : (
        <span className="text-gray-400">⏳</span>
      )}
      <span className={completed ? 'text-gray-700' : inProgress ? 'text-blue-700 font-medium' : 'text-gray-500'}>
        {label}
      </span>
    </div>
  )
}
