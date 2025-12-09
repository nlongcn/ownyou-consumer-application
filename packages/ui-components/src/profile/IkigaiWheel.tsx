/**
 * IkigaiWheel Component - Four-dimension visualization
 * v13 Section 4.4 - Profile Components
 */

import React from 'react';
import { cn } from '@ownyou/ui-design-system';
import type { IkigaiDimension } from '../types';

export interface IkigaiWheelProps {
  /** Dimension data */
  dimensions?: IkigaiDimension[];
  /** Size of the wheel */
  size?: 'small' | 'medium' | 'large';
  /** Show labels */
  showLabels?: boolean;
  /** Show scores */
  showScores?: boolean;
  /** Additional CSS class names */
  className?: string;
}

const DEFAULT_DIMENSIONS: IkigaiDimension[] = [
  { name: 'passion', label: 'Passion', score: 0, color: '#FF6B6B' },
  { name: 'mission', label: 'Mission', score: 0, color: '#4ECDC4' },
  { name: 'profession', label: 'Profession', score: 0, color: '#45B7D1' },
  { name: 'vocation', label: 'Vocation', score: 0, color: '#96CEB4' },
];

const SIZE_MAP = {
  small: { container: 150, radius: 60, label: 'text-xs' },
  medium: { container: 200, radius: 80, label: 'text-sm' },
  large: { container: 280, radius: 110, label: 'text-base' },
};

/**
 * Ikigai wheel visualization showing four dimensions
 */
export function IkigaiWheel({
  dimensions = DEFAULT_DIMENSIONS,
  size = 'medium',
  showLabels = true,
  showScores = true,
  className,
}: IkigaiWheelProps) {
  const sizeConfig = SIZE_MAP[size];
  const center = sizeConfig.container / 2;
  const maxRadius = sizeConfig.radius;

  // Calculate points for the radar chart
  const getPoint = (index: number, score: number) => {
    const angle = (index * 90 - 90) * (Math.PI / 180); // Start from top
    const radius = (score / 100) * maxRadius;
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
    };
  };

  // Create path for the filled area
  const pathPoints = dimensions.map((d, i) => {
    const point = getPoint(i, d.score);
    return `${i === 0 ? 'M' : 'L'} ${point.x} ${point.y}`;
  }).join(' ') + ' Z';

  // Label positions (outside the wheel)
  const labelPositions = [
    { x: center, y: 10, anchor: 'middle' },           // Top
    { x: sizeConfig.container - 10, y: center, anchor: 'start' }, // Right
    { x: center, y: sizeConfig.container - 10, anchor: 'middle' }, // Bottom
    { x: 10, y: center, anchor: 'end' },              // Left
  ];

  return (
    <div
      className={cn('relative inline-block', className)}
      data-testid="ikigai-wheel"
      style={{ width: sizeConfig.container, height: sizeConfig.container }}
    >
      <svg
        viewBox={`0 0 ${sizeConfig.container} ${sizeConfig.container}`}
        className="w-full h-full"
      >
        {/* Background circles */}
        {[0.25, 0.5, 0.75, 1].map((scale, i) => (
          <circle
            key={i}
            cx={center}
            cy={center}
            r={maxRadius * scale}
            fill="none"
            stroke="#E5E7EB"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        ))}

        {/* Axis lines */}
        {dimensions.map((_, i) => {
          const endPoint = getPoint(i, 100);
          return (
            <line
              key={`axis-${i}`}
              x1={center}
              y1={center}
              x2={endPoint.x}
              y2={endPoint.y}
              stroke="#E5E7EB"
              strokeWidth="1"
            />
          );
        })}

        {/* Filled area */}
        <path
          d={pathPoints}
          fill="rgba(135, 206, 235, 0.3)"
          stroke="#87CEEB"
          strokeWidth="2"
        />

        {/* Data points */}
        {dimensions.map((dimension, i) => {
          const point = getPoint(i, dimension.score);
          return (
            <g key={dimension.name}>
              <circle
                cx={point.x}
                cy={point.y}
                r={6}
                fill={dimension.color}
                stroke="white"
                strokeWidth="2"
              />
              {showScores && (
                <text
                  x={point.x}
                  y={point.y - 12}
                  textAnchor="middle"
                  className="font-price text-xs fill-gray-600"
                >
                  {dimension.score}%
                </text>
              )}
            </g>
          );
        })}

        {/* Labels */}
        {showLabels && dimensions.map((dimension, i) => {
          const pos = labelPositions[i];
          return (
            <text
              key={`label-${dimension.name}`}
              x={pos.x}
              y={pos.y}
              textAnchor={pos.anchor as 'middle' | 'start' | 'end'}
              dominantBaseline={i === 0 ? 'auto' : i === 2 ? 'hanging' : 'middle'}
              className={cn('font-display font-bold fill-gray-700', sizeConfig.label)}
            >
              {dimension.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export default IkigaiWheel;
