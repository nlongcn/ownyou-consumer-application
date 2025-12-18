/**
 * Results Route - Detailed A/B Testing Results
 *
 * Shows comprehensive analysis of multi-model classification:
 * - Overview: Model comparison table
 * - Confidence: Distribution across models
 * - Agreement: Cross-model agreement metrics
 * - Categories: Category coverage analysis
 * - Details: Per-email classification breakdown
 * - Disagreements: Where models differ
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@ownyou/ui-components';
import { Card } from '@ownyou/ui-design-system';
import { NS } from '@ownyou/shared-types';
import type {
  Stage3Export,
  Stage2Export,
  ModelResults,
  ModelConfig,
  ModelStats,
  PreprocessedEmail,
  Classification,
} from '@ownyou/ab-testing';
import { resultsRecordToMap, getTopCategories } from '@ownyou/ab-testing';

import { useStore } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';

type Tab = 'overview' | 'confidence' | 'agreement' | 'categories' | 'details' | 'disagreements';

// Aggregated classification type for Details tab
interface AggregatedClassification {
  category: string;
  taxonomyId: string;
  section: string;
  emailCount: number;
  avgConfidence: number;
  minConfidence: number;
  maxConfidence: number;
  totalConfidence: number;
  emailIds: string[];
  reasonings: string[];
}

// Helper functions
function formatModelName(modelKey: string): string {
  const [provider, model] = modelKey.split(':');
  const shortModel = model?.split('/').pop() || model;
  return `${provider?.charAt(0).toUpperCase()}${provider?.slice(1)} ${shortModel}`;
}

function getConfidenceColor(value: number): string {
  if (value >= 0.8) return 'text-green-600';
  if (value >= 0.6) return 'text-yellow-600';
  return 'text-red-600';
}

function getSectionColor(section: string): string {
  switch (section) {
    case 'demographics': return 'bg-blue-100 text-blue-800';
    case 'household': return 'bg-green-100 text-green-800';
    case 'interests': return 'bg-purple-100 text-purple-800';
    case 'purchase_intent': return 'bg-orange-100 text-orange-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

export function Results() {
  const navigate = useNavigate();
  const { store, isReady } = useStore();
  const { wallet } = useAuth();

  const [data, setData] = useState<Stage3Export | null>(null);
  const [results, setResults] = useState<Map<string, ModelResults> | null>(null);
  const [emails, setEmails] = useState<PreprocessedEmail[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [isLoading, setIsLoading] = useState(true);

  // State for Details tab
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [sectionFilter, setSectionFilter] = useState<string>('all');
  const [expandedClassification, setExpandedClassification] = useState<string | null>(null);

  // State for Disagreements tab
  const [expandedDisagreement, setExpandedDisagreement] = useState<string | null>(null);

  const userId = wallet?.address ?? 'anonymous';

  // Load results and emails from store
  useEffect(() => {
    if (!store || !isReady) {
      setIsLoading(false);
      return;
    }

    const loadResults = async () => {
      try {
        // Load Stage 3 results
        const stored = await store.get<Stage3Export>(
          NS.abTestingResults(userId),
          'latest'
        );
        if (stored) {
          setData(stored);
          setResults(resultsRecordToMap(stored.results));

          // Set default selected model
          const modelKeys = Object.keys(stored.results);
          if (modelKeys.length > 0) {
            setSelectedModel(modelKeys[0]);
          }
        }

        // Load Stage 2 preprocessed emails for details/disagreements
        const stage2 = await store.get<Stage2Export>(
          NS.abTestingStage2(userId),
          'latest'
        );
        if (stage2?.emails) {
          setEmails(stage2.emails);
        }
      } catch (err) {
        console.error('[Results] Failed to load:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadResults();
  }, [store, isReady, userId]);

  // Create email lookup map for quick access
  const emailMap = useMemo(() => {
    const map = new Map<string, PreprocessedEmail>();
    emails.forEach(e => map.set(e.id, e));
    return map;
  }, [emails]);

  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <Header showLogo={false} title="Results" onBack={handleBack} showFilters={false} />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

  // No data
  if (!data || !results) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <Header showLogo={false} title="Results" onBack={handleBack} showFilters={false} />
        <div className="flex-1 flex items-center justify-center px-4 lg:px-8">
          <Card size="full" className="p-8 lg:p-10 text-center">
            <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center">
              <span className="text-2xl">📊</span>
            </div>
            <h2 className="text-xl font-bold mb-2">No Results Yet</h2>
            <p className="text-gray-600 mb-4">
              Run A/B testing first to see results.
            </p>
            <button
              onClick={() => navigate('/ab-testing')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg"
            >
              Start A/B Testing
            </button>
          </Card>
        </div>
      </div>
    );
  }

  const { comparisonMetrics, models } = data;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header showLogo={false} title="Classification Results" onBack={handleBack} showFilters={false} />

      <div className="flex-1 px-4 lg:px-8 xl:px-12 py-6 max-w-6xl mx-auto w-full">
        {/* Tab Navigation - All 6 tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {(['overview', 'confidence', 'agreement', 'categories', 'details', 'disagreements'] as Tab[]).map(
            (tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap capitalize ${
                  activeTab === tab
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab}
              </button>
            )
          )}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <Card size="full" className="p-4 lg:p-6">
              <h3 className="font-semibold mb-4">Model Comparison</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4">Model</th>
                      <th className="text-right py-2 px-2">Avg Conf</th>
                      <th className="text-right py-2 px-2">Classifications</th>
                      <th className="text-right py-2 px-2">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Object.entries(comparisonMetrics.modelStats) as [string, ModelStats][]).map(
                      ([modelKey, stats]: [string, ModelStats]) => {
                        const model = models.find(
                          (m: ModelConfig) => `${m.provider}:${m.model}` === modelKey
                        );
                        return (
                          <tr key={modelKey} className="border-b border-gray-100">
                            <td className="py-2 pr-4">
                              {model?.displayName || modelKey}
                            </td>
                            <td className="text-right py-2 px-2">
                              {(stats.avgConfidence * 100).toFixed(1)}%
                            </td>
                            <td className="text-right py-2 px-2">
                              {stats.totalClassifications}
                            </td>
                            <td className="text-right py-2 px-2">
                              {(stats.durationMs / 1000).toFixed(1)}s
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <Card size="full" className="p-4 lg:p-6">
                <div className="text-3xl font-bold text-green-600">
                  {Math.round(comparisonMetrics.agreement.agreementRate * 100)}%
                </div>
                <div className="text-sm text-gray-600">Full Agreement Rate</div>
              </Card>
              <Card size="full" className="p-4 lg:p-6">
                <div className="text-3xl font-bold text-blue-600">
                  {comparisonMetrics.agreement.fullAgreementCount}
                </div>
                <div className="text-sm text-gray-600">Emails with Full Agreement</div>
              </Card>
            </div>
          </div>
        )}

        {/* Confidence Tab */}
        {activeTab === 'confidence' && (
          <div className="space-y-4">
            {(Object.entries(comparisonMetrics.modelStats) as [string, ModelStats][]).map(
              ([modelKey, stats]: [string, ModelStats]) => {
                const model = models.find(
                  (m: ModelConfig) => `${m.provider}:${m.model}` === modelKey
                );
                return (
                  <Card key={modelKey} className="p-4">
                    <h3 className="font-semibold mb-2">
                      {model?.displayName || modelKey}
                    </h3>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-xl font-bold text-blue-600">
                          {(stats.avgConfidence * 100).toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-500">Average</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-green-600">
                          {(stats.maxConfidence * 100).toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-500">Max</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-red-600">
                          {(stats.minConfidence * 100).toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-500">Min</div>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      Std Dev: {(stats.stdDevConfidence * 100).toFixed(1)}%
                    </div>
                  </Card>
                );
              }
            )}
          </div>
        )}

        {/* Agreement Tab */}
        {activeTab === 'agreement' && (
          <div className="space-y-4">
            <Card size="full" className="p-4 lg:p-6">
              <h3 className="font-semibold mb-4">Agreement Summary</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-700">
                    {comparisonMetrics.agreement.fullAgreementCount}
                  </div>
                  <div className="text-xs text-green-600">Full Agreement</div>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-700">
                    {comparisonMetrics.agreement.partialAgreementCount}
                  </div>
                  <div className="text-xs text-yellow-600">Partial</div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-700">
                    {comparisonMetrics.agreement.noAgreementCount}
                  </div>
                  <div className="text-xs text-red-600">No Agreement</div>
                </div>
              </div>
            </Card>

            <Card size="full" className="p-4 lg:p-6">
              <h3 className="font-semibold mb-4">Pairwise Agreement</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className="text-left py-1"></th>
                      {models.map((m: ModelConfig) => (
                        <th key={m.model} className="text-center py-1 px-1">
                          {m.displayName.split(' ')[0]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {models.map((rowModel: ModelConfig) => {
                      const rowKey = `${rowModel.provider}:${rowModel.model}`;
                      return (
                        <tr key={rowKey}>
                          <td className="py-1 pr-2 font-medium">
                            {rowModel.displayName.split(' ')[0]}
                          </td>
                          {models.map((colModel: ModelConfig) => {
                            const colKey = `${colModel.provider}:${colModel.model}`;
                            const agreement =
                              comparisonMetrics.agreement.pairwiseAgreement[
                                rowKey
                              ]?.[colKey] ?? 0;
                            const bgColor =
                              agreement > 0.8
                                ? 'bg-green-100'
                                : agreement > 0.5
                                  ? 'bg-yellow-100'
                                  : 'bg-red-100';
                            return (
                              <td
                                key={colKey}
                                className={`text-center py-1 px-1 ${bgColor}`}
                              >
                                {(agreement * 100).toFixed(0)}%
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* Categories Tab */}
        {activeTab === 'categories' && (
          <div className="space-y-4">
            <Card size="full" className="p-4 lg:p-6">
              <h3 className="font-semibold mb-4">Top Categories</h3>
              <div className="space-y-2">
                {getTopCategories(comparisonMetrics.coverage, 10).map(
                  ({ category, frequency }: { category: string; frequency: number }) => (
                    <div
                      key={category}
                      className="flex items-center justify-between py-2 border-b border-gray-100"
                    >
                      <span className="text-sm">{category}</span>
                      <span className="text-xs text-gray-500">
                        Found by {frequency}/{models.length} models
                      </span>
                    </div>
                  )
                )}
              </div>
            </Card>

            <Card size="full" className="p-4 lg:p-6">
              <h3 className="font-semibold mb-4">
                Common Categories ({comparisonMetrics.coverage.commonCategories.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {comparisonMetrics.coverage.commonCategories.map((cat: string) => (
                  <span
                    key={cat}
                    className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </Card>

            <Card size="full" className="p-4 lg:p-6">
              <h3 className="font-semibold mb-4">Unique Categories per Model</h3>
              <div className="space-y-3">
                {(Object.entries(comparisonMetrics.coverage.uniqueCategories) as [string, string[]][]).map(
                  ([modelKey, categories]: [string, string[]]) => {
                    const model = models.find(
                      (m: ModelConfig) => `${m.provider}:${m.model}` === modelKey
                    );
                    if (categories.length === 0) return null;
                    return (
                      <div key={modelKey}>
                        <div className="text-sm font-medium mb-1">
                          {model?.displayName || modelKey}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {categories.map((cat: string) => (
                            <span
                              key={cat}
                              className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
                            >
                              {cat}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Details Tab - Per-model classification details */}
        {activeTab === 'details' && results && (
          <DetailsTab
            results={results}
            models={models}
            emailMap={emailMap}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            sectionFilter={sectionFilter}
            setSectionFilter={setSectionFilter}
            expandedClassification={expandedClassification}
            setExpandedClassification={setExpandedClassification}
          />
        )}

        {/* Disagreements Tab - Where models differ */}
        {activeTab === 'disagreements' && results && (
          <DisagreementsTab
            results={results}
            models={models}
            emailMap={emailMap}
            expandedDisagreement={expandedDisagreement}
            setExpandedDisagreement={setExpandedDisagreement}
          />
        )}

        {/* Export/Actions */}
        <div className="mt-6 flex gap-2">
          <button
            onClick={() => navigate('/ab-testing')}
            className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm"
          >
            Run New Test
          </button>
          <button
            onClick={() => navigate('/profile')}
            className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm"
          >
            View Profile
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Details Tab Component - Per-model classification details with aggregation
// ============================================================================
interface DetailsTabProps {
  results: Map<string, ModelResults>;
  models: ModelConfig[];
  emailMap: Map<string, PreprocessedEmail>;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  sectionFilter: string;
  setSectionFilter: (filter: string) => void;
  expandedClassification: string | null;
  setExpandedClassification: (key: string | null) => void;
}

function DetailsTab({
  results,
  models,
  emailMap,
  selectedModel,
  setSelectedModel,
  sectionFilter,
  setSectionFilter,
  expandedClassification,
  setExpandedClassification,
}: DetailsTabProps) {
  const modelKeys = Array.from(results.keys());
  const modelResults = results.get(selectedModel);
  const classifications = modelResults?.classifications || [];

  const sections = ['all', 'demographics', 'household', 'interests', 'purchase_intent'];

  const filteredClassifications = sectionFilter === 'all'
    ? classifications
    : classifications.filter(c => c.section === sectionFilter);

  // Aggregate classifications by category+section
  const aggregatedClassifications = useMemo(() => {
    const aggregateMap = new Map<string, AggregatedClassification>();

    for (const c of filteredClassifications) {
      const key = `${c.section}:${c.category}`;

      if (!aggregateMap.has(key)) {
        aggregateMap.set(key, {
          category: c.category,
          taxonomyId: c.taxonomyId,
          section: c.section,
          emailCount: 0,
          avgConfidence: 0,
          minConfidence: c.confidence,
          maxConfidence: c.confidence,
          totalConfidence: 0,
          emailIds: [],
          reasonings: [],
        });
      }

      const agg = aggregateMap.get(key)!;
      agg.emailCount++;
      agg.totalConfidence += c.confidence;
      agg.minConfidence = Math.min(agg.minConfidence, c.confidence);
      agg.maxConfidence = Math.max(agg.maxConfidence, c.confidence);
      if (c.emailId && c.emailId !== 'batch') {
        agg.emailIds.push(c.emailId);
      }
      if (c.reasoning && !agg.reasonings.includes(c.reasoning)) {
        agg.reasonings.push(c.reasoning);
      }
    }

    for (const agg of aggregateMap.values()) {
      agg.avgConfidence = agg.emailCount > 0 ? agg.totalConfidence / agg.emailCount : 0;
    }

    return Array.from(aggregateMap.values());
  }, [filteredClassifications]);

  const sortedClassifications = [...aggregatedClassifications].sort((a, b) => {
    if (b.emailCount !== a.emailCount) return b.emailCount - a.emailCount;
    return b.avgConfidence - a.avgConfidence;
  });

  return (
    <div className="space-y-4">
      <Card size="full" className="p-4 lg:p-6">
        <h3 className="font-semibold mb-4">Classification Details</h3>

        {/* Model and Section selectors */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Model</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              {modelKeys.map(key => {
                const model = models.find(m => `${m.provider}:${m.model}` === key);
                return (
                  <option key={key} value={key}>
                    {model?.displayName || formatModelName(key)}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Section</label>
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              {sections.map(s => (
                <option key={s} value={s}>
                  {s === 'all' ? 'All Sections' : s.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Stats summary */}
        <div className="bg-gray-50 rounded p-3 mb-4">
          <span className="text-sm text-gray-600">
            Showing {sortedClassifications.length} unique classification{sortedClassifications.length !== 1 ? 's' : ''}
            {sectionFilter !== 'all' && ` in ${sectionFilter.replace('_', ' ')}`}
            {' '}(from {filteredClassifications.length} total)
          </span>
        </div>

        {/* Classifications list */}
        <div className="space-y-3">
          {sortedClassifications.map((agg, idx) => {
            const classificationKey = `${agg.section}-${agg.category}`;
            const isExpanded = expandedClassification === classificationKey;

            return (
              <div key={idx} className="border rounded overflow-hidden">
                <button
                  onClick={() => setExpandedClassification(isExpanded ? null : classificationKey)}
                  className="w-full p-3 flex items-center justify-between bg-white hover:bg-gray-50 text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSectionColor(agg.section)}`}>
                      {agg.section.replace('_', ' ')}
                    </span>
                    <span className="font-medium text-sm">{agg.category}</span>
                    {agg.taxonomyId && (
                      <span className="text-xs text-gray-400">({agg.taxonomyId})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                      {agg.emailCount} email{agg.emailCount !== 1 ? 's' : ''}
                    </span>
                    <span className={`font-medium text-sm ${getConfidenceColor(agg.avgConfidence)}`}>
                      {(agg.avgConfidence * 100).toFixed(0)}%
                    </span>
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t bg-gray-50 p-4 space-y-3">
                    {agg.emailCount > 1 && (
                      <div>
                        <div className="text-xs font-medium text-gray-500 mb-1">CONFIDENCE RANGE</div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Avg: </span>
                            <span className="font-medium">{(agg.avgConfidence * 100).toFixed(1)}%</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Min: </span>
                            <span>{(agg.minConfidence * 100).toFixed(1)}%</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Max: </span>
                            <span>{(agg.maxConfidence * 100).toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {agg.reasonings.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-gray-500 mb-1">REASONING</div>
                        {agg.reasonings.slice(0, 3).map((reasoning, rIdx) => (
                          <p key={rIdx} className="text-sm text-gray-700 mb-1">{reasoning}</p>
                        ))}
                        {agg.reasonings.length > 3 && (
                          <p className="text-xs text-gray-400">+{agg.reasonings.length - 3} more...</p>
                        )}
                      </div>
                    )}

                    <div>
                      <div className="text-xs font-medium text-gray-500 mb-1">
                        SUPPORTING EMAILS ({agg.emailIds.length})
                      </div>
                      {agg.emailIds.length > 0 ? (
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {agg.emailIds.slice(0, 5).map((emailId, eIdx) => {
                            const email = emailMap.get(emailId);
                            return (
                              <div key={eIdx} className="bg-white rounded border p-2">
                                <div className="font-medium text-xs truncate">
                                  {email?.subject || '(No subject)'}
                                </div>
                                {email && (
                                  <div className="text-xs text-gray-500">From: {email.from}</div>
                                )}
                              </div>
                            );
                          })}
                          {agg.emailIds.length > 5 && (
                            <p className="text-xs text-gray-400 text-center">
                              +{agg.emailIds.length - 5} more emails
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 italic">Batch classification</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {sortedClassifications.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              No classifications found for this combination
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// Disagreements Tab Component - Where models differ
// ============================================================================
interface DisagreementsTabProps {
  results: Map<string, ModelResults>;
  models: ModelConfig[];
  emailMap: Map<string, PreprocessedEmail>;
  expandedDisagreement: string | null;
  setExpandedDisagreement: (key: string | null) => void;
}

function DisagreementsTab({
  results,
  models,
  emailMap,
  expandedDisagreement,
  setExpandedDisagreement,
}: DisagreementsTabProps) {
  // Build per-email classification map across all models
  const emailClassifications = useMemo(() => {
    const map = new Map<string, Map<string, Classification[]>>();

    for (const [modelKey, modelResults] of results) {
      for (const c of modelResults.classifications) {
        if (!map.has(c.emailId)) {
          map.set(c.emailId, new Map());
        }
        const modelMap = map.get(c.emailId)!;
        if (!modelMap.has(modelKey)) {
          modelMap.set(modelKey, []);
        }
        modelMap.get(modelKey)!.push(c);
      }
    }

    return map;
  }, [results]);

  // Find emails with disagreements
  const disagreements = useMemo(() => {
    const result: Array<{
      emailId: string;
      email: PreprocessedEmail | undefined;
      section: string;
      modelClassifications: Array<{ modelKey: string; classification: Classification }>;
    }> = [];

    for (const [emailId, modelMap] of emailClassifications) {
      const sectionModels = new Map<string, Array<{ modelKey: string; classification: Classification }>>();

      for (const [modelKey, classifications] of modelMap) {
        for (const c of classifications) {
          if (!sectionModels.has(c.section)) {
            sectionModels.set(c.section, []);
          }
          sectionModels.get(c.section)!.push({ modelKey, classification: c });
        }
      }

      for (const [section, modelClassifications] of sectionModels) {
        if (modelClassifications.length >= 2) {
          const categories = new Set(modelClassifications.map(mc => mc.classification.category));
          if (categories.size > 1) {
            result.push({
              emailId,
              email: emailMap.get(emailId),
              section,
              modelClassifications,
            });
          }
        }
      }
    }

    return result;
  }, [emailClassifications, emailMap]);

  return (
    <div className="space-y-4">
      <Card size="full" className="p-4 lg:p-6">
        <h3 className="font-semibold mb-4">Model Disagreements</h3>

        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
          <span className="text-yellow-800 text-sm">
            Found <strong>{disagreements.length}</strong> classification{disagreements.length !== 1 ? 's' : ''} where models disagree
          </span>
        </div>

        <div className="space-y-4">
          {disagreements.map((d, idx) => {
            const key = `${d.emailId}-${d.section}`;
            const isExpanded = expandedDisagreement === key;

            return (
              <div key={idx} className="border rounded overflow-hidden">
                <button
                  onClick={() => setExpandedDisagreement(isExpanded ? null : key)}
                  className="w-full p-3 bg-white hover:bg-gray-50 text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSectionColor(d.section)}`}>
                        {d.section.replace('_', ' ')}
                      </span>
                      <span className="text-sm font-medium text-gray-700 truncate max-w-[200px]">
                        {d.email?.subject || d.emailId.substring(0, 20)}...
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">
                        {d.modelClassifications.length} models
                      </span>
                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {/* Quick comparison preview */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {d.modelClassifications.map((mc, i) => {
                      const model = models.find(m => `${m.provider}:${m.model}` === mc.modelKey);
                      return (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded text-xs">
                          <span className="font-medium">{model?.displayName?.split(' ')[0] || mc.modelKey.split(':')[0]}:</span>
                          <span className="truncate max-w-[100px]">{mc.classification.category}</span>
                          <span className={getConfidenceColor(mc.classification.confidence)}>
                            ({(mc.classification.confidence * 100).toFixed(0)}%)
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t bg-gray-50 p-4">
                    {d.email && (
                      <div className="mb-4">
                        <div className="text-xs font-medium text-gray-500 mb-1">EMAIL</div>
                        <div className="bg-white rounded border p-3">
                          <div className="font-medium text-sm mb-1">{d.email.subject || '(No subject)'}</div>
                          <div className="text-xs text-gray-500 mb-2">From: {d.email.from}</div>
                          <div className="text-sm text-gray-600 max-h-24 overflow-y-auto">
                            {d.email.summary || '(No summary)'}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="text-xs font-medium text-gray-500 mb-2">MODEL CLASSIFICATIONS</div>
                    <div className="grid gap-3">
                      {d.modelClassifications.map((mc, i) => {
                        const model = models.find(m => `${m.provider}:${m.model}` === mc.modelKey);
                        return (
                          <div key={i} className="bg-white rounded border p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-sm">{model?.displayName || formatModelName(mc.modelKey)}</span>
                              <span className={`font-medium text-sm ${getConfidenceColor(mc.classification.confidence)}`}>
                                {(mc.classification.confidence * 100).toFixed(0)}%
                              </span>
                            </div>
                            <div className="text-sm">
                              <span className="font-medium">Category: </span>
                              {mc.classification.category}
                              {mc.classification.taxonomyId && (
                                <span className="text-gray-400 ml-1">({mc.classification.taxonomyId})</span>
                              )}
                            </div>
                            {mc.classification.reasoning && (
                              <div className="text-sm text-gray-600 mt-2">
                                <span className="font-medium">Reasoning: </span>
                                {mc.classification.reasoning}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {disagreements.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              <div className="text-4xl mb-2">🎉</div>
              <div>All models agree on their classifications!</div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
