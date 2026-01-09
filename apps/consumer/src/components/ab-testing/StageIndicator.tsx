import { StageStatus } from '../../lib/ab-testing/types'

interface StageIndicatorProps {
  currentStage: 1 | 2 | 3
  stageStatus: {
    download: StageStatus
    preprocess: StageStatus
    classify: StageStatus
  }
}

const stages = [
  { num: 1, name: 'Download', key: 'download' as const },
  { num: 2, name: 'Pre-process', key: 'preprocess' as const },
  { num: 3, name: 'Classify & Compare', key: 'classify' as const },
]

export function StageIndicator({ currentStage, stageStatus }: StageIndicatorProps) {
  const getStageColor = (stageNum: number, status: StageStatus) => {
    if (status === 'completed') return 'bg-green-500 text-white'
    if (status === 'running') return 'bg-blue-500 text-white animate-pulse'
    if (status === 'error') return 'bg-red-500 text-white'
    if (stageNum <= currentStage) return 'bg-gray-700 text-white'
    return 'bg-gray-300 text-gray-500'
  }

  const getConnectorColor = (stageNum: number) => {
    const prevStage = stages.find(s => s.num === stageNum - 1)
    if (prevStage && stageStatus[prevStage.key] === 'completed') {
      return 'bg-green-500'
    }
    return 'bg-gray-300'
  }

  return (
    <div className="flex items-center justify-center mb-8">
      {stages.map((stage, index) => (
        <div key={stage.num} className="flex items-center">
          {/* Connector line */}
          {index > 0 && (
            <div className={`w-16 h-1 ${getConnectorColor(stage.num)}`} />
          )}

          {/* Stage circle and label */}
          <div className="flex flex-col items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${getStageColor(stage.num, stageStatus[stage.key])}`}
            >
              {stageStatus[stage.key] === 'completed' ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : stageStatus[stage.key] === 'error' ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                stage.num
              )}
            </div>
            <span className="mt-2 text-sm font-medium text-gray-600">{stage.name}</span>
            {stageStatus[stage.key] === 'running' && (
              <span className="text-xs text-blue-500">Running...</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
