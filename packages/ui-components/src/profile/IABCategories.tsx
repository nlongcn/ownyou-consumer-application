/**
 * IABCategories Component - Category breakdown display
 * v13 Section 4.4 - Profile Components
 */

import * as React from 'react';
import { cn, Card, CardContent, CardHeader, CardTitle, radius } from '@ownyou/ui-design-system';

/** Evidence chain entry - Sprint 11b Bugfix 9 */
export interface EvidenceEntry {
  sourceType: string;  // 'email' | 'calendar' | 'financial'
  extractedText: string;
  date: string;
  sourceId?: string;
}

export interface IABCategory {
  id: string;
  name: string;
  score: number;  // 0-100 confidence
  icon?: string;
  subcategories?: { name: string; score: number }[];
  /** Evidence chain for this classification - Sprint 11b Bugfix 9 */
  evidence?: EvidenceEntry[];
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
  /** Dispute handler - Sprint 11b Bugfix 9 */
  onDispute?: (categoryId: string) => void;
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
  onDispute,
  className,
}: IABCategoriesProps) {
  const [expanded, setExpanded] = React.useState(false);
  /** Track which categories have evidence shown - Sprint 11b Bugfix 9 */
  const [evidenceVisible, setEvidenceVisible] = React.useState<Set<string>>(new Set());

  const toggleEvidence = (categoryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEvidenceVisible(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

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
          {visibleCategories.map((category) => {
            const showEvidence = evidenceVisible.has(category.id);
            const hasEvidence = category.evidence && category.evidence.length > 0;

            return (
              <div
                key={category.id}
                className={cn(
                  'w-full text-left p-3',
                  'bg-gray-50',
                  'transition-colors duration-200',
                )}
                style={{ borderRadius: radius.image }}
                data-testid={`iab-category-${category.id}`}
              >
                {/* Main category row - clickable */}
                <button
                  type="button"
                  onClick={() => onCategoryClick?.(category)}
                  className="w-full text-left hover:bg-gray-100 -m-3 p-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-ownyou-primary"
                  style={{ borderRadius: radius.image }}
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
                    <div className="flex items-center gap-2">
                      <span className="font-price text-sm text-gray-500">
                        {typeof category.score === 'number' && !isNaN(category.score) ? category.score : 0}%
                      </span>
                      {/* Why? button - Sprint 11b Bugfix 9 */}
                      {hasEvidence && (
                        <button
                          type="button"
                          onClick={(e) => toggleEvidence(category.id, e)}
                          className="text-xs text-ownyou-primary hover:underline px-1"
                          data-testid={`iab-evidence-toggle-${category.id}`}
                        >
                          {showEvidence ? '▼' : '►'} Why?
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        getConfidenceColor(category.score ?? 0),
                      )}
                      style={{ width: `${typeof category.score === 'number' && !isNaN(category.score) ? category.score : 0}%` }}
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

                {/* Evidence Chain Display - Sprint 11b Bugfix 9 */}
                {showEvidence && hasEvidence && (
                  <div
                    className="mt-3 pt-3 border-t border-gray-200 text-sm"
                    data-testid={`iab-evidence-${category.id}`}
                  >
                    <p className="font-medium text-gray-700 mb-2">Evidence:</p>
                    <div className="space-y-2 ml-2">
                      {category.evidence!.map((e, i) => (
                        <div key={i} className="text-gray-600 text-xs">
                          <span className="inline-block px-1.5 py-0.5 bg-gray-200 rounded text-gray-500 mr-1">
                            {e.sourceType}
                          </span>
                          "{e.extractedText.length > 80 ? e.extractedText.slice(0, 80) + '...' : e.extractedText}"
                          <span className="text-gray-400 ml-1">({e.date})</span>
                        </div>
                      ))}
                    </div>
                    {/* Dispute button */}
                    {onDispute && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDispute(category.id);
                        }}
                        className="mt-3 text-red-500 text-xs hover:underline"
                        data-testid={`iab-dispute-${category.id}`}
                      >
                        This is wrong
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
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
