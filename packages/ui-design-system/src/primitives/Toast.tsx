/**
 * Toast Primitive - Notification toast component
 *
 * Displays brief notifications to users with auto-dismiss functionality.
 * Supports different variants (success, error, warning, info).
 *
 * @see docs/architecture/OwnYou_architecture_v13.md Section 4.4
 */

import React, { useEffect, useState, useCallback } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

const toastVariants = cva(
  'flex items-center gap-3 rounded-card-small px-4 py-3 shadow-lg',
  {
    variants: {
      variant: {
        default: 'bg-card-bg text-text-primary border border-gray-200',
        success: 'bg-ownyou-secondary text-text-primary',
        error: 'bg-red-500 text-white',
        warning: 'bg-yellow-500 text-black',
        info: 'bg-ownyou-primary text-text-primary',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface ToastProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof toastVariants> {
  /**
   * Toast message content
   */
  message: string;
  /**
   * Optional title
   */
  title?: string;
  /**
   * Auto-dismiss duration in milliseconds (0 = no auto-dismiss)
   */
  duration?: number;
  /**
   * Callback when toast is dismissed
   */
  onDismiss?: () => void;
  /**
   * Whether the toast is visible
   */
  open?: boolean;
  /**
   * Show close button
   */
  showClose?: boolean;
}

/**
 * Toast notification component
 *
 * @example
 * ```tsx
 * <Toast
 *   variant="success"
 *   message="Settings saved successfully!"
 *   duration={3000}
 *   onDismiss={() => setShowToast(false)}
 * />
 * ```
 */
export function Toast({
  className,
  variant,
  message,
  title,
  duration = 5000,
  onDismiss,
  open = true,
  showClose = true,
  ...props
}: ToastProps): React.ReactElement | null {
  const [isVisible, setIsVisible] = useState(open);
  const [isLeaving, setIsLeaving] = useState(false);

  const handleDismiss = useCallback(() => {
    setIsLeaving(true);
    setTimeout(() => {
      setIsVisible(false);
      onDismiss?.();
    }, 200); // Match animation duration
  }, [onDismiss]);

  // Auto-dismiss after duration
  useEffect(() => {
    if (duration > 0 && isVisible) {
      const timer = setTimeout(handleDismiss, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, isVisible, handleDismiss]);

  // Sync with open prop
  useEffect(() => {
    if (open) {
      setIsVisible(true);
      setIsLeaving(false);
    } else {
      handleDismiss();
    }
  }, [open, handleDismiss]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={cn(
        toastVariants({ variant }),
        isLeaving ? 'animate-out fade-out-0 slide-out-to-right-2' : 'animate-in fade-in-0 slide-in-from-right-2',
        className
      )}
      role="alert"
      aria-live="polite"
      {...props}
    >
      {/* Icon based on variant */}
      <ToastIcon variant={variant} />

      {/* Content */}
      <div className="flex-1">
        {title && (
          <div className="font-display text-body font-bold">{title}</div>
        )}
        <div className="font-display text-label">{message}</div>
      </div>

      {/* Close button */}
      {showClose && (
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-full p-1 hover:bg-black/10 focus:outline-none"
          aria-label="Dismiss notification"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

/**
 * Toast icon based on variant
 */
function ToastIcon({ variant }: { variant?: ToastProps['variant'] }): React.ReactElement {
  const iconClass = 'h-5 w-5 flex-shrink-0';

  switch (variant) {
    case 'success':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'error':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    case 'warning':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    case 'info':
    default:
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
}

/**
 * Toast Container - positions toasts in the viewport
 */
export interface ToastContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Position of toast container
   */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

export function ToastContainer({
  className,
  position = 'bottom-right',
  children,
  ...props
}: ToastContainerProps): React.ReactElement {
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  };

  return (
    <div
      className={cn(
        'fixed z-50 flex flex-col gap-2',
        positionClasses[position],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export { toastVariants };
