/**
 * FeedbackHeart Component
 * v13 Section 4.5.3 - Heart feedback cycle: meh → like → love
 */

import { useState, useCallback } from 'react';
import { cn } from '@ownyou/ui-design-system';
import type { HeartState } from '../types';

export interface FeedbackHeartProps {
  /** Initial feedback state */
  initialState?: HeartState;
  /** Size variant */
  size?: 'small' | 'default';
  /** Callback when state changes */
  onStateChange?: (state: HeartState) => void;
  /** Additional CSS class names */
  className?: string;
  /** Disable interaction */
  disabled?: boolean;
}

const HEART_CYCLE: HeartState[] = ['meh', 'like', 'love'];

/**
 * Heart feedback button that cycles through meh → like → love states
 * - meh: Gray heart (🩶)
 * - like: Red heart (❤️)
 * - love: Large red heart (❤️ scaled up)
 */
export function FeedbackHeart({
  initialState = 'meh',
  size = 'default',
  onStateChange,
  className,
  disabled = false,
}: FeedbackHeartProps) {
  const [state, setState] = useState<HeartState>(initialState);

  const handleTap = useCallback(() => {
    if (disabled) return;

    const currentIndex = HEART_CYCLE.indexOf(state);
    const nextIndex = (currentIndex + 1) % HEART_CYCLE.length;
    const nextState = HEART_CYCLE[nextIndex];
    setState(nextState);
    onStateChange?.(nextState);
  }, [state, onStateChange, disabled]);

  const sizeClasses = size === 'small' ? 'w-6 h-6 text-lg' : 'w-7 h-7 text-xl';

  const heartClasses = cn(
    sizeClasses,
    'inline-flex items-center justify-center',
    'cursor-pointer transition-all duration-200 ease-out',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-ownyou-primary focus-visible:ring-offset-2',
    'rounded-full',
    state === 'meh' && 'text-gray-400 hover:text-gray-500',
    state === 'like' && 'text-red-500 hover:text-red-600',
    state === 'love' && 'text-red-500 scale-125 hover:text-red-600',
    disabled && 'opacity-50 cursor-not-allowed',
    className,
  );

  return (
    <button
      type="button"
      onClick={handleTap}
      className={heartClasses}
      aria-label={`Feedback: ${state}`}
      aria-pressed={state !== 'meh'}
      disabled={disabled}
      data-state={state}
    >
      <span role="img" aria-hidden="true">
        {state === 'meh' ? '🩶' : '❤️'}
      </span>
    </button>
  );
}

export default FeedbackHeart;
