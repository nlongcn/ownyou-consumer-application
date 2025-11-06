/**
 * Granularity Score Badge Component
 *
 * Displays granularity score with color-coded visual indicator.
 * Score calculation: confidence + (tier_depth × 0.05) for confidence >= 0.7
 *
 * Color scheme:
 * - Purple (1.1+): Exceptional - high confidence with deep tier
 * - Green (0.9-1.1): Excellent - high confidence with good depth
 * - Blue (0.7-0.9): Good - solid confidence with moderate depth
 * - Yellow (<0.7): Fair - lower confidence or shallow tier
 */

interface GranularityScoreBadgeProps {
  score: number
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function GranularityScoreBadge({
  score,
  showLabel = false,
  size = 'sm'
}: GranularityScoreBadgeProps) {
  const getColorClass = (score: number): string => {
    if (score >= 1.1) {
      return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900 dark:text-purple-200'
    }
    if (score >= 0.9) {
      return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200'
    }
    if (score >= 0.7) {
      return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-200'
    }
    return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200'
  }

  const getLabel = (score: number): string => {
    if (score >= 1.1) return 'Exceptional'
    if (score >= 0.9) return 'Excellent'
    if (score >= 0.7) return 'Good'
    return 'Fair'
  }

  const getSizeClasses = (): string => {
    switch (size) {
      case 'lg':
        return 'text-sm px-3 py-1'
      case 'md':
        return 'text-xs px-2.5 py-0.5'
      case 'sm':
      default:
        return 'text-xs px-2 py-0.5'
    }
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${getColorClass(score)} ${getSizeClasses()}`}
      title={`Granularity Score: ${score.toFixed(2)} (${getLabel(score)})`}
    >
      {showLabel && <span className="font-normal">{getLabel(score)}:</span>}
      <span className="font-semibold">{score.toFixed(2)}</span>
    </span>
  )
}
