/**
 * Header Component - App header with logo, filters, and token balance
 * v13 Section 4.6 - Navigation Components
 */

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
  /** Show logo (when false, shows title instead) - Sprint 11b Bugfix 13 */
  showLogo?: boolean;
  /** Page title (shown when showLogo is false) - Sprint 11b Bugfix 13 */
  title?: string;
  /** Back button handler (shows back arrow when provided) - Sprint 11b Bugfix 13 */
  onBack?: () => void;
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
  showLogo = true,
  title,
  onBack,
}: HeaderProps) {
  // Page header mode: showLogo=false, title provided
  const isPageHeader = !showLogo && title;

  return (
    <div
      className={cn(
        'flex flex-col gap-3 px-4 py-3',
        'bg-ownyou-primary',
        className,
      )}
      data-testid="header"
    >
      {/* Top Row: Logo/Title and Token Balance */}
      <div className="flex items-center justify-between">
        {/* Left side: Back button + Logo/Title */}
        <div className="flex items-center gap-2" data-testid="header-logo">
          {/* Back button - Sprint 11b Bugfix 13 */}
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 -ml-2 rounded-full hover:bg-black/10 transition-colors"
              aria-label="Go back"
              data-testid="header-back"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Logo or Title - Sprint 11b Bugfix 13 */}
          {isPageHeader ? (
            <h1 className="font-display text-xl font-bold text-text-primary">
              {title}
            </h1>
          ) : (
            logo || (
              <span className="font-display text-xl font-bold text-text-primary">
                OwnYou
              </span>
            )
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
