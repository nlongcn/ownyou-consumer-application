/**
 * TokenBalance Component - Display user's token balance
 * v13 Section 4.4 - Branding Components
 */

import { cn } from '@ownyou/ui-design-system';

export interface TokenBalanceProps {
  /** Token balance amount */
  balance: number;
  /** Show icon */
  showIcon?: boolean;
  /** Size variant */
  size?: 'small' | 'medium' | 'large';
  /** Click handler */
  onClick?: () => void;
  /** Additional CSS class names */
  className?: string;
}

const SIZE_MAP = {
  small: { icon: 'text-sm', text: 'text-xs', padding: 'px-2 py-1' },
  medium: { icon: 'text-lg', text: 'text-sm', padding: 'px-3 py-1.5' },
  large: { icon: 'text-xl', text: 'text-base', padding: 'px-4 py-2' },
};

/**
 * Token balance display with coin icon
 */
export function TokenBalance({
  balance = 0,
  showIcon = true,
  size = 'medium',
  onClick,
  className,
}: TokenBalanceProps) {
  const config = SIZE_MAP[size];
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5',
        'bg-white/80 backdrop-blur-sm',
        'rounded-full shadow-sm',
        config.padding,
        onClick && 'cursor-pointer hover:bg-white transition-colors',
        className,
      )}
      data-testid="token-balance"
    >
      {showIcon && (
        <span className={config.icon} aria-hidden="true">
          🪙
        </span>
      )}
      <span className={cn('font-price font-medium', config.text)}>
        {balance.toLocaleString()}
      </span>
    </Component>
  );
}

export default TokenBalance;
