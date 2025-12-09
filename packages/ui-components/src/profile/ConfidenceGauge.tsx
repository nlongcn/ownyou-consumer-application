/**
 * ConfidenceGauge Component - Confidence level visualization
 * v13 Section 4.4 - Profile Components
 */

import React from 'react';
import { cn } from '@ownyou/ui-design-system';

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

/**
 * Get color based on confidence level
 */
function getConfidenceColor(value: number): string {
  if (value >= 80) return '#70DF82'; // Green (secondary)
  if (value >= 60) return '#87CEEB'; // Blue (primary)
  if (value >= 40) return '#FBBF24'; // Yellow
  if (value >= 20) return '#FB923C'; // Orange
  return '#EF4444'; // Red
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
  const progress = Math.min(100, Math.max(0, value));
  const offset = circumference - (progress / 100) * circumference;
  const color = getConfidenceColor(value);

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
              {Math.round(value)}%
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
