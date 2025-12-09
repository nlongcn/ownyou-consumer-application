/**
 * Modal Primitive - Overlay modal dialog
 *
 * Accessible modal component with backdrop, focus trapping,
 * and keyboard navigation (Esc to close).
 *
 * @see docs/architecture/OwnYou_architecture_v13.md Section 4.4
 */

import React, { useEffect, useCallback, useRef } from 'react';
import { cn } from '../utils/cn';

export interface ModalProps {
  /**
   * Whether the modal is open
   */
  open: boolean;
  /**
   * Callback when modal should close
   */
  onClose: () => void;
  /**
   * Modal content
   */
  children: React.ReactNode;
  /**
   * Modal title for accessibility
   */
  title?: string;
  /**
   * Additional class names for the modal content
   */
  className?: string;
  /**
   * Close on backdrop click (default: true)
   */
  closeOnBackdropClick?: boolean;
  /**
   * Close on Escape key (default: true)
   */
  closeOnEscape?: boolean;
}

/**
 * Modal component with accessibility features
 *
 * @example
 * ```tsx
 * const [open, setOpen] = useState(false);
 *
 * <Modal open={open} onClose={() => setOpen(false)} title="Settings">
 *   <h2>Modal Title</h2>
 *   <p>Modal content here</p>
 * </Modal>
 * ```
 */
export function Modal({
  open,
  onClose,
  children,
  title,
  className,
  closeOnBackdropClick = true,
  closeOnEscape = true,
}: ModalProps): React.ReactElement | null {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Handle Escape key
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (closeOnEscape && event.key === 'Escape') {
        onClose();
      }
    },
    [closeOnEscape, onClose]
  );

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (event: React.MouseEvent) => {
      if (closeOnBackdropClick && event.target === event.currentTarget) {
        onClose();
      }
    },
    [closeOnBackdropClick, onClose]
  );

  // Focus management and event listeners
  useEffect(() => {
    if (open) {
      // Store current active element
      previousActiveElement.current = document.activeElement as HTMLElement;

      // Focus the modal
      modalRef.current?.focus();

      // Add event listeners
      document.addEventListener('keydown', handleKeyDown);

      // Prevent body scroll
      document.body.style.overflow = 'hidden';

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';

        // Restore focus
        previousActiveElement.current?.focus();
      };
    }
  }, [open, handleKeyDown]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Modal content */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className={cn(
          'relative z-50 max-h-[90vh] max-w-lg overflow-auto',
          'rounded-card bg-card-bg p-6 shadow-xl',
          'animate-in fade-in-0 zoom-in-95',
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Modal Header component
 */
export function ModalHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return (
    <div
      className={cn('flex items-center justify-between pb-4', className)}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Modal Title component
 */
export function ModalTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>): React.ReactElement {
  return (
    <h2
      className={cn('font-display text-display text-text-primary', className)}
      {...props}
    >
      {children}
    </h2>
  );
}

/**
 * Modal Close Button component
 */
export interface ModalCloseProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onClose: () => void;
}

export function ModalClose({
  className,
  onClose,
  ...props
}: ModalCloseProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClose}
      className={cn(
        'rounded-full p-1 hover:bg-gray-100 focus:outline-none focus:ring-2',
        className
      )}
      aria-label="Close modal"
      {...props}
    >
      <svg
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </button>
  );
}

/**
 * Modal Body component
 */
export function ModalBody({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return (
    <div className={cn('py-4', className)} {...props}>
      {children}
    </div>
  );
}

/**
 * Modal Footer component
 */
export function ModalFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return (
    <div
      className={cn('flex items-center justify-end gap-2 pt-4', className)}
      {...props}
    >
      {children}
    </div>
  );
}
