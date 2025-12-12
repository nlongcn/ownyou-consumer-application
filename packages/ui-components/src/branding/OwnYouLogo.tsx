/**
 * OwnYouLogo Component - Brand logo
 * v13 Section 4.4 - Branding Components
 */

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
 *
 * Uses actual brand logo from /assets/ownyou-logo.png
 * Falls back to emoji placeholder if image fails to load
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
      {/* Logo Icon - uses actual brand asset */}
      <img
        src="/assets/ownyou-logo.png"
        alt="OwnYou"
        className="rounded-full shadow-sm object-cover"
        style={{ width: config.logo, height: config.logo }}
        onError={(e) => {
          // Fallback to emoji if image fails to load
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
          const fallback = target.nextElementSibling as HTMLElement;
          if (fallback) fallback.style.display = 'flex';
        }}
      />
      {/* Fallback icon (hidden by default) */}
      <div
        className={cn(
          'items-center justify-center hidden',
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
