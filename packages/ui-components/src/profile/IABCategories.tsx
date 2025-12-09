/**
 * IABCategories Component - Category breakdown display
 * v13 Section 4.4 - Profile Components
 */

import React from 'react';
import { cn, Card, CardContent, CardHeader, CardTitle } from '@ownyou/ui-design-system';

export interface IABCategory {
  id: string;
  name: string;
  score: number;  // 0-100 confidence
  icon?: string;
  subcategories?: { name: string; score: number }[];
}

export interface IABCategoriesProps {
  /** Category data */
  categories: IABCategory[];
  /** Maximum categories to show */
  maxVisible?: number;
  /** Show expand button */
  expandable?: boolean;
  /** Category click handler */
  onCategoryClick?: (category: IABCategory) => void;
  /** Additional CSS class names */
  className?: string;
}

/**
 * Get color based on confidence score
 */
function getConfidenceColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-green-400';
  if (score >= 40) return 'bg-yellow-400';
  if (score >= 20) return 'bg-orange-400';
  return 'bg-gray-300';
}

/**
 * IAB Categories breakdown display
 */
export function IABCategories({
  categories,
  maxVisible = 6,
  expandable = true,
  onCategoryClick,
  className,
}: IABCategoriesProps) {
  const [expanded, setExpanded] = React.useState(false);

  const visibleCategories = expanded
    ? categories
    : categories.slice(0, maxVisible);

  const hasMore = categories.length > maxVisible;

  return (
    <Card className={cn('', className)} data-testid="iab-categories">
      <CardHeader>
        <CardTitle>Your Interests</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {visibleCategories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => onCategoryClick?.(category)}
              className={cn(
                'w-full text-left p-3 rounded-[12px]',
                'bg-gray-50 hover:bg-gray-100',
                'transition-colors duration-200',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-ownyou-primary',
              )}
              data-testid={`iab-category-${category.id}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {category.icon && (
                    <span className="text-lg">{category.icon}</span>
                  )}
                  <span className="font-display text-sm font-bold text-text-primary">
                    {category.name}
                  </span>
                </div>
                <span className="font-price text-sm text-gray-500">
                  {category.score}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    getConfidenceColor(category.score),
                  )}
                  style={{ width: `${category.score}%` }}
                />
              </div>

              {/* Subcategories */}
              {category.subcategories && category.subcategories.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {category.subcategories.slice(0, 3).map((sub) => (
                    <span
                      key={sub.name}
                      className="inline-block px-2 py-0.5 text-xs bg-white rounded-full text-gray-600"
                    >
                      {sub.name}
                    </span>
                  ))}
                  {category.subcategories.length > 3 && (
                    <span className="inline-block px-2 py-0.5 text-xs bg-white rounded-full text-gray-400">
                      +{category.subcategories.length - 3} more
                    </span>
                  )}
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Expand/Collapse Button */}
        {expandable && hasMore && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className={cn(
              'w-full mt-4 py-2',
              'font-display text-sm text-ownyou-primary',
              'hover:underline',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ownyou-primary',
            )}
          >
            {expanded ? 'Show Less' : `Show ${categories.length - maxVisible} More`}
          </button>
        )}
      </CardContent>
    </Card>
  );
}

export default IABCategories;
