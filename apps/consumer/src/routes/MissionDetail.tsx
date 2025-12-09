import { useParams, useNavigate } from 'react-router-dom';
import { Header, FeedbackHeart } from '@ownyou/ui-components';
import type { HeartState } from '@ownyou/ui-components';
import { Card, Button } from '@ownyou/ui-design-system';
import { useMission } from '../hooks/useMission';
import { useFeedback } from '../hooks/useFeedback';

export function MissionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { mission, isLoading, error } = useMission(id ?? '');
  const { updateFeedback, getFeedbackState } = useFeedback();

  const handleFeedbackChange = (state: HeartState) => {
    if (id) {
      updateFeedback(id, state);
    }
  };

  const handleClose = () => {
    navigate(-1);
  };

  if (error) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header showLogo={false} title="Mission" onBack={handleClose} />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <h2 className="text-xl font-bold mb-2">Mission not found</h2>
            <p className="text-gray-600 mb-4">{error.message}</p>
            <Button onClick={handleClose}>Go Back</Button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || !mission) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header showLogo={false} title="Mission" onBack={handleClose} />
        <div className="flex-1 p-4 animate-pulse">
          <div className="h-64 bg-[#D9D9D9] rounded-[35px] mb-4" />
          <div className="h-8 bg-[#D9D9D9] rounded w-3/4 mb-2" />
          <div className="h-4 bg-[#D9D9D9] rounded w-1/2 mb-4" />
          <div className="h-24 bg-[#D9D9D9] rounded" />
        </div>
      </div>
    );
  }

  const feedbackState = getFeedbackState(mission.id);

  return (
    <div className="flex flex-col min-h-screen">
      <Header showLogo={false} title="Mission" onBack={handleClose} />

      <div className="flex-1 p-4 space-y-4">
        {/* Hero Image */}
        {mission.imageUrl && (
          <div className="aspect-video rounded-[35px] overflow-hidden">
            <img
              src={mission.imageUrl}
              alt={mission.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Mission Info */}
        <Card className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-xl font-bold mb-1">{mission.title}</h1>
              {mission.brandName && (
                <p className="text-sm text-gray-600">{mission.brandName}</p>
              )}
            </div>
            <FeedbackHeart
              initialState={feedbackState}
              onStateChange={handleFeedbackChange}
            />
          </div>

          {/* Price if applicable */}
          {mission.price && (
            <div className="mb-4">
              {mission.originalPrice && mission.originalPrice > mission.price && (
                <span className="text-sm text-gray-400 line-through mr-2">
                  ${mission.originalPrice.toFixed(2)}
                </span>
              )}
              <span className="text-2xl font-bold text-[#70DF82]">
                ${mission.price.toFixed(2)}
              </span>
              {mission.savings && (
                <span className="ml-2 text-sm text-[#70DF82]">
                  Save {mission.savings}%
                </span>
              )}
            </div>
          )}

          {/* Description */}
          <p className="text-gray-700 mb-6">{mission.description}</p>

          {/* Tags */}
          {mission.tags && mission.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {mission.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-gray-100 rounded-full text-sm"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Why This Mission */}
          {mission.reason && (
            <div className="bg-[#87CEEB]/20 rounded-2xl p-4 mb-6">
              <h3 className="font-bold mb-2">Why this mission?</h3>
              <p className="text-sm text-gray-700">{mission.reason}</p>
            </div>
          )}

          {/* CTA Button */}
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => mission.actionUrl && window.open(mission.actionUrl, '_blank')}
          >
            {mission.actionLabel || 'Take Action'}
          </Button>
        </Card>

        {/* Related Missions */}
        {mission.relatedMissionIds && mission.relatedMissionIds.length > 0 && (
          <Card className="p-6">
            <h3 className="font-bold mb-4">Related Missions</h3>
            <div className="text-center text-gray-600 py-4">
              Coming soon...
            </div>
          </Card>
        )}

        {/* Evidence Chain (for transparency) */}
        <Card className="p-6">
          <h3 className="font-bold mb-4">Why We Recommend This</h3>
          <div className="space-y-3 text-sm">
            {mission.evidenceChain?.map((evidence, index) => (
              <div key={index} className="flex items-start gap-2">
                <span className="text-[#70DF82]">•</span>
                <p className="text-gray-700">{evidence}</p>
              </div>
            )) || (
              <p className="text-gray-600">
                Based on your interests and preferences.
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
