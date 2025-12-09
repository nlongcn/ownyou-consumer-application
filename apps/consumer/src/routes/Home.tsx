import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header, FilterTabs, MissionFeed } from '@ownyou/ui-components';
import type { HeartState } from '@ownyou/ui-components';
import { useMissions } from '../hooks/useMissions';
import { useFeedback } from '../hooks/useFeedback';

export type FilterTab = 'all' | 'savings' | 'ikigai' | 'health';

export function Home() {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const navigate = useNavigate();

  const { missions, isLoading, error } = useMissions(activeFilter);
  const { updateFeedback } = useFeedback();

  const handleMissionClick = useCallback((missionId: string) => {
    navigate(`/mission/${missionId}`);
  }, [navigate]);

  const handleFeedbackChange = useCallback((missionId: string, state: HeartState) => {
    updateFeedback(missionId, state);
  }, [updateFeedback]);

  const handleFilterChange = useCallback((filter: FilterTab) => {
    setActiveFilter(filter);
  }, []);

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

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <div className="px-[10px] py-4">
        <FilterTabs
          activeTab={activeFilter}
          onTabChange={handleFilterChange}
        />
      </div>

      <div className="flex-1 px-[10px]">
        {isLoading ? (
          <MissionFeedSkeleton />
        ) : (
          <MissionFeed
            missions={missions}
            onMissionClick={handleMissionClick}
            onFeedbackChange={handleFeedbackChange}
          />
        )}
      </div>
    </div>
  );
}

function MissionFeedSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-[13px]">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="bg-[#D9D9D9] rounded-[35px] animate-pulse"
          style={{ height: `${180 + Math.random() * 100}px` }}
        />
      ))}
    </div>
  );
}
