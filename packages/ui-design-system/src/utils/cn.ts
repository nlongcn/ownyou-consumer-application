/**
 * Class Name Utility - combines clsx and tailwind-merge
 *
 * Use this utility for merging Tailwind CSS class names safely.
 * It handles conditional classes and resolves Tailwind conflicts.
 *
 * @example
 * cn('px-2 py-1', isActive && 'bg-blue-500', 'px-4')
 * // => 'py-1 bg-blue-500 px-4' (px-4 overrides px-2)
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names with Tailwind conflict resolution
 * @param inputs - Class values to merge (strings, arrays, objects, conditionals)
 * @returns Merged and deduplicated class string
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
