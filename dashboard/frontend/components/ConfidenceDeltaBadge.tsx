/**
 * Confidence Delta Badge Component
 *
 * Displays the confidence difference between alternative and primary classifications.
 * Lower delta = closer to primary classification (more uncertainty).
 *
 * Color scheme:
 * - Green (0.0-0.1): Very close - significant uncertainty between primary and alternative
 * - Blue (0.1-0.2): Close - notable uncertainty
 * - Yellow (0.2-0.3): Within threshold - alternative is viable but clearly secondary
 */

interface ConfidenceDeltaBadgeProps {
  delta?: number
  size?: 'sm' | 'md'
}

export function ConfidenceDeltaBadge({
  delta,
  size = 'sm'
}: ConfidenceDeltaBadgeProps) {
  if (!delta && delta !== 0) return null

  const getColorClass = (delta: number): string => {
    if (delta <= 0.1) {
      return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
    }
    if (delta <= 0.2) {
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
    }
    return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200'
  }

  const getTooltip = (delta: number): string => {
    if (delta <= 0.1) {
      return `Very close to primary (Δ${delta.toFixed(2)}) - significant uncertainty`
    }
    if (delta <= 0.2) {
      return `Close to primary (Δ${delta.toFixed(2)}) - notable uncertainty`
    }
    return `Within threshold (Δ${delta.toFixed(2)}) - viable alternative`
  }

  const getSizeClasses = (): string => {
    return size === 'md' ? 'text-xs px-2 py-0.5' : 'text-xs px-1.5 py-0.5'
  }

  return (
    <span
      className={`inline-flex items-center rounded font-mono ${getColorClass(delta)} ${getSizeClasses()}`}
      title={getTooltip(delta)}
    >
      Δ{delta.toFixed(2)}
    </span>
  )
}
