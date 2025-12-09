/**
 * OwnYouLogo Component - Brand logo
 * v13 Section 4.4 - Branding Components
 */

import React from 'react';
import { cn } from '@ownyou/ui-design-system';

export interface OwnYouLogoProps {
  /** Size variant */
  size?: 'small' | 'medium' | 'large';
  /** Show text alongside logo */
  showText?: boolean;
  /** Additional CSS class names */
  className?: string;
}

const SIZE_MAP = {
  small: { logo: 24, text: 'text-lg' },
  medium: { logo: 32, text: 'text-xl' },
  large: { logo: 48, text: 'text-2xl' },
};

/**
 * OwnYou brand logo
 */
export function OwnYouLogo({
  size = 'medium',
  showText = true,
  className,
}: OwnYouLogoProps) {
  const config = SIZE_MAP[size];

  return (
    <div
      className={cn('inline-flex items-center gap-2', className)}
      data-testid="ownyou-logo"
    >
      {/* Logo Icon */}
      <div
        className={cn(
          'flex items-center justify-center',
          'bg-white rounded-full shadow-sm',
        )}
        style={{ width: config.logo, height: config.logo }}
      >
        <span className="text-center" style={{ fontSize: config.logo * 0.5 }}>
          🎯
        </span>
      </div>

      {/* Text */}
      {showText && (
        <span
          className={cn(
            'font-display font-bold text-text-primary',
            config.text,
          )}
        >
          OwnYou
        </span>
      )}
    </div>
  );
}

export default OwnYouLogo;
