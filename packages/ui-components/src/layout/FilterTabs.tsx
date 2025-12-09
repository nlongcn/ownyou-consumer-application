/**
 * FilterTabs Component - Mission filter tabs
 * v13 Section 4.6 - Navigation Components
 */

import React from 'react';
import { cn } from '@ownyou/ui-design-system';
import { FILTER_TABS, type FilterTab } from '../types';

export interface FilterTabsProps {
  /** Currently active tab */
  activeTab?: FilterTab;
  /** Tab change handler */
  onTabChange?: (tab: FilterTab) => void;
  /** Additional CSS class names */
  className?: string;
}

/**
 * Filter tabs: All | Savings | Ikigai | Health
 */
export function FilterTabs({
  activeTab = 'all',
  onTabChange,
  className,
}: FilterTabsProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2',
        'overflow-x-auto scrollbar-hide',
        '-mx-4 px-4', // Extend to edges with padding
        className,
      )}
      role="tablist"
      aria-label="Filter missions"
      data-testid="filter-tabs"
    >
      {FILTER_TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`${tab.id}-panel`}
            onClick={() => onTabChange?.(tab.id)}
            className={cn(
              'px-4 py-2 rounded-full',
              'font-display text-sm font-bold',
              'transition-colors duration-200',
              'whitespace-nowrap',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-white',
              isActive
                ? 'bg-white text-text-primary shadow-sm'
                : 'bg-transparent text-text-primary/70 hover:bg-white/30',
            )}
            data-testid={`filter-tab-${tab.id}`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export default FilterTabs;
