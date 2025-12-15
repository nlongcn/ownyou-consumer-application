/**
 * ImagePlaceholder - Placeholder for loading/missing images
 * v13 Section 4.4 - Branding Components
 *
 * Displays a skeleton loading animation while images are loading,
 * or a placeholder icon for missing images.
 */

import * as React from 'react';
import { cn } from '@ownyou/ui-design-system';

export interface ImagePlaceholderProps {
  /** Width in pixels or CSS value */
  width?: string | number;
  /** Height in pixels or CSS value */
  height?: string | number;
  /** Border radius variant */
  rounded?: 'none' | 'small' | 'medium' | 'large' | 'full';
  /** Show loading skeleton animation */
  loading?: boolean;
  /** Icon to display (optional) */
  icon?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

const roundedClasses = {
  none: 'rounded-none',
  small: 'rounded',
  medium: 'rounded-lg',
  large: 'rounded-xl',
  full: 'rounded-full',
} as const;

/**
 * Shimmer animation keyframes (inline for portability)
 */
const shimmerStyles = `
@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}
`;

/**
 * Placeholder component for images that are loading or unavailable
 */
export function ImagePlaceholder({
  width = '100%',
  height = '100%',
  rounded = 'medium',
  loading = false,
  icon,
  className,
}: ImagePlaceholderProps) {
  // Inject shimmer styles if not already present
  React.useEffect(() => {
    if (typeof document === 'undefined') return;

    const styleId = 'ownyou-shimmer-styles';
    if (!document.getElementById(styleId)) {
      const styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.textContent = shimmerStyles;
      document.head.appendChild(styleEl);
    }
  }, []);

  return (
    <div
      className={cn(
        'flex items-center justify-center overflow-hidden',
        roundedClasses[rounded],
        className,
      )}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        backgroundColor: loading ? undefined : '#E5E7EB', // gray-200
        ...(loading ? {
          background: 'linear-gradient(90deg, #E5E7EB 0%, #F3F4F6 50%, #E5E7EB 100%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s ease-in-out infinite',
        } : {}),
      }}
      role="img"
      aria-label={loading ? 'Loading image' : 'Image placeholder'}
      aria-busy={loading}
    >
      {/* Only show icon when not loading */}
      {!loading && (
        icon ? (
          icon
        ) : (
          <svg
            className="w-8 h-8 text-gray-400"
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm0 2v8l4-4 3 3 5-5 4 4V6H4zm5 10l-3-3-2 2v3h16v-1l-4-4-5 5-2-2z" />
          </svg>
        )
      )}
    </div>
  );
}

/**
 * Skeleton text placeholder for loading content
 */
export function TextSkeleton({
  width = '100%',
  height = 16,
  className,
}: {
  width?: string | number;
  height?: number;
  className?: string;
}) {
  // Inject shimmer styles if not already present
  React.useEffect(() => {
    if (typeof document === 'undefined') return;

    const styleId = 'ownyou-shimmer-styles';
    if (!document.getElementById(styleId)) {
      const styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.textContent = shimmerStyles;
      document.head.appendChild(styleEl);
    }
  }, []);

  return (
    <div
      className={cn('rounded', className)}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: `${height}px`,
        background: 'linear-gradient(90deg, #E5E7EB 0%, #F3F4F6 50%, #E5E7EB 100%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s ease-in-out infinite',
      }}
      role="presentation"
      aria-hidden="true"
    />
  );
}

/**
 * Card skeleton placeholder for loading cards
 */
export function CardSkeleton({
  width,
  height = 200,
  className,
}: {
  width?: string | number;
  height?: number;
  className?: string;
}) {
  return (
    <div
      className={cn('rounded-xl overflow-hidden', className)}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: `${height}px`,
      }}
    >
      {/* Image skeleton */}
      <ImagePlaceholder
        width="100%"
        height="60%"
        rounded="none"
        loading
      />
      {/* Content skeleton */}
      <div className="p-3 space-y-2 bg-gray-50">
        <TextSkeleton width="80%" height={14} />
        <TextSkeleton width="60%" height={12} />
        <TextSkeleton width="40%" height={12} />
      </div>
    </div>
  );
}

export default ImagePlaceholder;
