/**
 * ConfidenceGauge Component - Confidence level visualization
 * v13 Section 4.4 - Profile Components
 */

import { cn, colors } from '@ownyou/ui-design-system';

export interface ConfidenceGaugeProps {
  /** Confidence value (0-100) */
  value: number;
  /** Label text */
  label?: string;
  /** Size variant */
  size?: 'small' | 'medium' | 'large';
  /** Show numeric value */
  showValue?: boolean;
  /** Additional CSS class names */
  className?: string;
}

const SIZE_MAP = {
  small: { diameter: 60, stroke: 4, fontSize: 'text-sm' },
  medium: { diameter: 80, stroke: 6, fontSize: 'text-base' },
  large: { diameter: 120, stroke: 8, fontSize: 'text-xl' },
};

/** Confidence level colors - using design tokens where available */
const confidenceLevelColors = {
  high: colors.secondary,       // Green (secondary token)
  good: colors.primary,         // Blue (primary token)
  moderate: '#FBBF24',          // Yellow (standard warning)
  low: '#FB923C',               // Orange (standard caution)
  veryLow: '#EF4444',           // Red (standard danger)
} as const;

/**
 * Get color based on confidence level
 */
function getConfidenceColor(value: number): string {
  if (value >= 80) return confidenceLevelColors.high;
  if (value >= 60) return confidenceLevelColors.good;
  if (value >= 40) return confidenceLevelColors.moderate;
  if (value >= 20) return confidenceLevelColors.low;
  return confidenceLevelColors.veryLow;
}

/**
 * Circular confidence gauge
 */
export function ConfidenceGauge({
  value,
  label,
  size = 'medium',
  showValue = true,
  className,
}: ConfidenceGaugeProps) {
  const config = SIZE_MAP[size];
  const radius = (config.diameter - config.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  // Guard against NaN/undefined values - Sprint 11b bugfix
  const safeValue = Number.isFinite(value) ? value : 0;
  const progress = Math.min(100, Math.max(0, safeValue));
  const offset = circumference - (progress / 100) * circumference;
  const color = getConfidenceColor(safeValue);

  return (
    <div
      className={cn('inline-flex flex-col items-center gap-1', className)}
      data-testid="confidence-gauge"
    >
      <div
        className="relative"
        style={{ width: config.diameter, height: config.diameter }}
      >
        <svg
          viewBox={`0 0 ${config.diameter} ${config.diameter}`}
          className="w-full h-full -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={config.diameter / 2}
            cy={config.diameter / 2}
            r={radius}
            fill="none"
            stroke="#E5E7EB"
            strokeWidth={config.stroke}
          />
          {/* Progress circle */}
          <circle
            cx={config.diameter / 2}
            cy={config.diameter / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={config.stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-500"
          />
        </svg>

        {/* Center value */}
        {showValue && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={cn('font-price font-bold', config.fontSize)}>
              {Math.round(safeValue)}%
            </span>
          </div>
        )}
      </div>

      {/* Label */}
      {label && (
        <span className="font-label text-xs text-gray-500 text-center">
          {label}
        </span>
      )}
    </div>
  );
}

export default ConfidenceGauge;
