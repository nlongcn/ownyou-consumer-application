/**
 * PriceDisplay - Consistent price formatting component
 * v13 Section 4.4 - Branding Components
 * TODO: Add localization and currency formatting
 */

import { cn } from '@ownyou/ui-design-system';

export interface PriceDisplayProps {
  /** Price value */
  price: number;
  /** Original price for showing discounts */
  originalPrice?: number;
  /** Currency symbol or code */
  currency?: string;
  /** Size variant */
  size?: 'small' | 'medium' | 'large';
  /** Additional CSS classes */
  className?: string;
}

const sizeClasses = {
  small: 'text-sm',
  medium: 'text-base',
  large: 'text-lg',
} as const;

/**
 * Price display with optional discount strikethrough
 */
export function PriceDisplay({
  price,
  originalPrice,
  currency = '$',
  size = 'medium',
  className,
}: PriceDisplayProps) {
  const hasDiscount = originalPrice !== undefined && originalPrice > price;
  const discountPercentage = hasDiscount
    ? Math.round(((originalPrice - price) / originalPrice) * 100)
    : 0;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span
        className={cn(
          'font-price font-semibold text-text-primary',
          sizeClasses[size],
        )}
      >
        {currency}{price.toFixed(2)}
      </span>

      {hasDiscount && (
        <>
          <span
            className={cn(
              'font-price text-gray-400 line-through',
              size === 'small' ? 'text-xs' : 'text-sm',
            )}
          >
            {currency}{originalPrice.toFixed(2)}
          </span>
          <span className="text-xs text-green-600 font-medium">
            -{discountPercentage}%
          </span>
        </>
      )}
    </div>
  );
}

export default PriceDisplay;
