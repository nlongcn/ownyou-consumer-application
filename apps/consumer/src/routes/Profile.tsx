import { Header, IkigaiWheel, IABCategories, ConfidenceGauge } from '@ownyou/ui-components';
import { useProfile } from '../hooks/useProfile';

export function Profile() {
  const { profile, ikigaiScores, iabCategories, isLoading, error } = useProfile();

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
            <div className="w-48 h-48 rounded-full bg-[#D9D9D9] mx-auto mb-4" />
            <div className="h-6 w-32 bg-[#D9D9D9] rounded mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header showLogo={false} title="Profile" />

      <div className="flex-1 px-4 py-6 space-y-8">
        {/* Ikigai Wheel Section */}
        <section className="bg-white rounded-[35px] p-6 shadow-sm">
          <h2 className="text-lg font-bold mb-4 text-center">Your Ikigai</h2>
          <IkigaiWheel
            passion={ikigaiScores.passion}
            mission={ikigaiScores.mission}
            vocation={ikigaiScores.vocation}
            profession={ikigaiScores.profession}
          />
          <div className="mt-4 text-center">
            <ConfidenceGauge confidence={profile?.overallConfidence ?? 0} />
          </div>
        </section>

        {/* IAB Categories Section */}
        <section className="bg-white rounded-[35px] p-6 shadow-sm">
          <h2 className="text-lg font-bold mb-4">Your Interests</h2>
          <IABCategories categories={iabCategories} />
        </section>

        {/* Data Summary Section */}
        <section className="bg-white rounded-[35px] p-6 shadow-sm">
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
  );
}
