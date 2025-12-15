/**
 * BrandLogo - Display third-party brand logos
 * v13 Section 4.4 - Branding Components
 * TODO: Implement full brand logo display with fallback
 */

import { cn } from '@ownyou/ui-design-system';

export interface BrandLogoProps {
  /** URL to the brand logo image */
  src?: string;
  /** Brand name for alt text and fallback */
  brandName: string;
  /** Size variant */
  size?: 'small' | 'medium' | 'large';
  /** Additional CSS classes */
  className?: string;
}

const sizeClasses = {
  small: 'w-6 h-6',
  medium: 'w-8 h-8',
  large: 'w-12 h-12',
} as const;

/**
 * Brand logo component with fallback to initials
 */
export function BrandLogo({
  src,
  brandName,
  size = 'medium',
  className,
}: BrandLogoProps) {
  const initials = brandName
    .split(' ')
    .map(word => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  if (src) {
    return (
      <img
        src={src}
        alt={brandName}
        className={cn(
          'rounded-full object-contain bg-white',
          sizeClasses[size],
          className,
        )}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={cn(
        'rounded-full bg-gray-200 flex items-center justify-center',
        'text-gray-600 font-bold text-xs',
        sizeClasses[size],
        className,
      )}
      title={brandName}
    >
      {initials}
    </div>
  );
}

export default BrandLogo;
