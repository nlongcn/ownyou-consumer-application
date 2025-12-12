import { useCallback, useState } from 'react';
import { Header, IkigaiWheel, IABCategories, ConfidenceGauge } from '@ownyou/ui-components';
import { radius, ikigaiColors } from '@ownyou/ui-design-system';
import { useProfile } from '../hooks/useProfile';
import { useIkigai } from '../contexts/IkigaiContext';
import type { IkigaiScores } from '../hooks/useProfile';

/** Ikigai dimension type for detail view */
type DimensionName = 'passion' | 'mission' | 'profession' | 'vocation';

/** Dimension metadata for display */
const DIMENSION_INFO: Record<DimensionName, { label: string; description: string; color: string }> = {
  passion: {
    label: 'Passion',
    description: 'What you love - activities, hobbies, and interests that bring you joy and fulfillment.',
    color: ikigaiColors.experiences,
  },
  mission: {
    label: 'Mission',
    description: 'What the world needs - causes you care about and ways you want to contribute to others.',
    color: ikigaiColors.relationships,
  },
  profession: {
    label: 'Profession',
    description: 'What you are good at - skills, talents, and expertise you have developed.',
    color: ikigaiColors.interests,
  },
  vocation: {
    label: 'Vocation',
    description: 'What you can be paid for - ways to earn a living that align with your other dimensions.',
    color: ikigaiColors.giving,
  },
};

/**
 * Convert IkigaiScores to IkigaiDimension array for IkigaiWheel
 */
function scoresToDimensions(scores: IkigaiScores) {
  return [
    { name: 'passion' as const, label: 'Passion', score: scores.passion, color: ikigaiColors.experiences },
    { name: 'mission' as const, label: 'Mission', score: scores.mission, color: ikigaiColors.relationships },
    { name: 'profession' as const, label: 'Profession', score: scores.profession, color: ikigaiColors.interests },
    { name: 'vocation' as const, label: 'Vocation', score: scores.vocation, color: ikigaiColors.giving },
  ];
}

/**
 * IkigaiDimensionDetail - Sprint 11b Bugfix 12
 * Shows detailed view of a single Ikigai dimension with insights and relationships
 */
interface IkigaiDimensionDetailProps {
  dimensionName: DimensionName;
  score: number;
  insights: Array<{ text: string; confidence: number }>;
  relationships: Array<{ name: string; relationship: string }>;
  onBack: () => void;
}

function IkigaiDimensionDetail({
  dimensionName,
  score,
  insights,
  relationships,
  onBack,
}: IkigaiDimensionDetailProps) {
  const info = DIMENSION_INFO[dimensionName];

  return (
    <div className="space-y-4">
      {/* Header with back button */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Back to wheel"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: info.color }}
          />
          <h3 className="text-xl font-bold">{info.label}</h3>
        </div>
      </div>

      {/* Score */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${score}%`, backgroundColor: info.color }}
          />
        </div>
        <span className="font-bold text-lg">{score}%</span>
      </div>

      {/* Description */}
      <p className="text-gray-600">{info.description}</p>

      {/* Insights */}
      <div className="pt-4 border-t">
        <h4 className="font-bold mb-3">What we've learned:</h4>
        {insights.length === 0 ? (
          <p className="text-gray-500 text-sm italic">
            No insights yet. Connect more data sources or provide more feedback to help us understand you better.
          </p>
        ) : (
          <ul className="space-y-2">
            {insights.map((insight, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-ownyou-secondary">•</span>
                <div>
                  <p className="text-sm">{insight.text}</p>
                  <span className="text-xs text-gray-400">
                    ({Math.round(insight.confidence * 100)}% confidence)
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Relationships */}
      <div className="pt-4 border-t">
        <h4 className="font-bold mb-3">Key People:</h4>
        {relationships.length === 0 ? (
          <p className="text-gray-500 text-sm italic">
            No key relationships discovered yet. We'll learn about important people in your life as we analyze more data.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {relationships.map((person, i) => (
              <span
                key={i}
                className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
              >
                {person.name}
                <span className="text-blue-400 ml-1">({person.relationship})</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function Profile() {
  const { profile, ikigaiScores, iabCategories, isLoading, error, disputeCategory } = useProfile();
  const { profile: ikigaiProfile } = useIkigai();
  const [disputeMessage, setDisputeMessage] = useState<string | null>(null);
  const [selectedDimension, setSelectedDimension] = useState<DimensionName | null>(null);

  /** Handle IAB category dispute - Sprint 11b Bugfix 9 */
  const handleDispute = useCallback(async (categoryId: string) => {
    try {
      await disputeCategory(categoryId);
      setDisputeMessage('Classification flagged for review. We will re-evaluate this.');
      setTimeout(() => setDisputeMessage(null), 3000);
    } catch (error) {
      console.error('[Profile] Dispute failed:', error);
      setDisputeMessage('Failed to flag classification. Please try again.');
      setTimeout(() => setDisputeMessage(null), 3000);
    }
  }, [disputeCategory]);

  /** Handle dimension selection - Sprint 11b Bugfix 12 */
  const handleDimensionSelect = useCallback((dimensionName: string) => {
    if (['passion', 'mission', 'profession', 'vocation'].includes(dimensionName)) {
      setSelectedDimension(dimensionName as DimensionName);
    }
  }, []);

  /** Get insights for a dimension from Ikigai profile */
  const getDimensionInsights = (dimension: DimensionName): Array<{ text: string; confidence: number }> => {
    if (!ikigaiProfile) return [];

    // Extract insights from Ikigai profile based on dimension
    // The profile structure may vary - adapt to actual API
    type IkigaiProfile = { passion?: unknown; mission?: unknown; profession?: unknown; vocation?: unknown };
    const dimensionData = (ikigaiProfile as IkigaiProfile)[dimension];
    if (dimensionData && typeof dimensionData === 'object') {
      const insights = (dimensionData as Record<string, unknown>).insights as Array<{ text: string; confidence: number }> | undefined;
      return insights ?? [];
    }
    return [];
  };

  /** Get relationships for a dimension from Ikigai profile */
  const getDimensionRelationships = (dimension: DimensionName): Array<{ name: string; relationship: string }> => {
    if (!ikigaiProfile) return [];

    // Extract relationships from Ikigai profile based on dimension
    type IkigaiProfile = { passion?: unknown; mission?: unknown; profession?: unknown; vocation?: unknown };
    const dimensionData = (ikigaiProfile as IkigaiProfile)[dimension];
    if (dimensionData && typeof dimensionData === 'object') {
      const relationships = (dimensionData as Record<string, unknown>).relationships as Array<{ name: string; relationship: string }> | undefined;
      return relationships ?? [];
    }
    return [];
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center p-4">
          <h2 className="text-xl font-bold mb-2">Failed to load profile</h2>
          <p className="text-gray-600">{error.message}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header showLogo={false} title="Profile" />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-center">
            <div className="w-48 h-48 rounded-full bg-placeholder mx-auto mb-4" />
            <div className="h-6 w-32 bg-placeholder rounded mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header showLogo={false} title="Profile" />

      <div className="flex-1 px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-8">
        {/* Ikigai Wheel Section - Sprint 11b Bugfix 12: Added dimension detail view */}
        <section className="bg-white p-6 shadow-sm" style={{ borderRadius: radius.card }}>
          {selectedDimension ? (
            // Show dimension detail view
            <IkigaiDimensionDetail
              dimensionName={selectedDimension}
              score={ikigaiScores[selectedDimension]}
              insights={getDimensionInsights(selectedDimension)}
              relationships={getDimensionRelationships(selectedDimension)}
              onBack={() => setSelectedDimension(null)}
            />
          ) : (
            // Show wheel overview
            <>
              <h2 className="text-lg font-bold mb-4 text-center">Your Ikigai</h2>
              <p className="text-sm text-gray-500 text-center mb-4">
                Tap a dimension to see details
              </p>
              <div className="flex justify-center">
                <IkigaiWheel
                  dimensions={scoresToDimensions(ikigaiScores)}
                  onDimensionSelect={handleDimensionSelect}
                />
              </div>
              <div className="mt-4 text-center">
                <ConfidenceGauge value={(profile?.overallConfidence ?? 0) * 100} label="Overall Confidence" />
              </div>
            </>
          )}
        </section>

        {/* IAB Categories Section */}
        <section className="bg-white p-6 shadow-sm" style={{ borderRadius: radius.card }}>
          <h2 className="text-lg font-bold mb-4">Your Interests</h2>
          {/* Dispute feedback message - Sprint 11b Bugfix 9 */}
          {disputeMessage && (
            <div className="mb-4 p-3 bg-blue-50 text-blue-700 text-sm rounded-lg">
              {disputeMessage}
            </div>
          )}
          <IABCategories categories={iabCategories} onDispute={handleDispute} />
        </section>

        {/* Data Summary Section */}
        <section className="bg-white p-6 shadow-sm" style={{ borderRadius: radius.card }}>
          <h2 className="text-lg font-bold mb-4">Data Summary</h2>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{profile?.emailsAnalyzed ?? 0}</p>
              <p className="text-sm text-gray-600">Emails Analyzed</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{profile?.missionsGenerated ?? 0}</p>
              <p className="text-sm text-gray-600">Missions Generated</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{profile?.feedbackGiven ?? 0}</p>
              <p className="text-sm text-gray-600">Feedback Given</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{profile?.dataSourcesConnected ?? 0}</p>
              <p className="text-sm text-gray-600">Data Sources</p>
            </div>
          </div>
        </section>
        </div>
      </div>
    </div>
  );
}
