/**
 * Header Component - App header with logo, filters, and token balance
 * v13 Section 4.6 - Navigation Components
 */

import React from 'react';
import { cn } from '@ownyou/ui-design-system';
import { FilterTabs } from './FilterTabs';
import type { FilterTab } from '../types';

export interface HeaderProps {
  /** Logo element or image */
  logo?: React.ReactNode;
  /** Token balance to display */
  tokenBalance?: number;
  /** Active filter tab */
  activeFilter?: FilterTab;
  /** Filter change handler */
  onFilterChange?: (filter: FilterTab) => void;
  /** Additional CSS class names */
  className?: string;
  /** Show filter tabs */
  showFilters?: boolean;
  /** Show token balance */
  showTokenBalance?: boolean;
}

/**
 * App header with OwnYou logo, filter tabs, and token balance
 */
export function Header({
  logo,
  tokenBalance = 0,
  activeFilter = 'all',
  onFilterChange,
  className,
  showFilters = true,
  showTokenBalance = true,
}: HeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 px-4 py-3',
        'bg-ownyou-primary',
        className,
      )}
      data-testid="header"
    >
      {/* Top Row: Logo and Token Balance */}
      <div className="flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center" data-testid="header-logo">
          {logo || (
            <span className="font-display text-xl font-bold text-text-primary">
              OwnYou
            </span>
          )}
        </div>

        {/* Token Balance */}
        {showTokenBalance && (
          <div
            className={cn(
              'flex items-center gap-1.5',
              'bg-white/80 backdrop-blur-sm',
              'px-3 py-1.5 rounded-full',
              'shadow-sm',
            )}
            data-testid="token-balance"
          >
            <span className="text-lg">🪙</span>
            <span className="font-price text-sm font-medium">
              {tokenBalance.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      {showFilters && (
        <FilterTabs
          activeTab={activeFilter}
          onTabChange={onFilterChange}
        />
      )}
    </div>
  );
}

export default Header;
