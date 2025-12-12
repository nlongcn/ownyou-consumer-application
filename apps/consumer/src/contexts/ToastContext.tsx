/**
 * ToastContext - App-wide toast notification system
 *
 * Sprint 11 UX Overhaul Phase 4: Feedback Loop
 * Provides visual feedback for user actions (mission feedback, saves, etc.)
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { Toast, ToastContainer } from '@ownyou/ui-design-system';

type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
}

interface ToastContextValue {
  /** Show a toast notification */
  showToast: (message: string, variant?: ToastVariant, duration?: number) => void;
  /** Show feedback-specific toast with contextual message */
  showFeedbackToast: (state: 'meh' | 'like' | 'love') => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, variant: ToastVariant = 'default', duration = 3000) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts(prev => [...prev, { id, message, variant, duration }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  /**
   * Show contextual feedback toast based on heart state
   * - meh: "Got it - showing fewer like this"
   * - like: "Preference saved!"
   * - love: "Finding more like this..."
   */
  const showFeedbackToast = useCallback((state: 'meh' | 'like' | 'love') => {
    const messages: Record<typeof state, { message: string; variant: ToastVariant }> = {
      meh: { message: "Got it - we'll show fewer like this", variant: 'info' },
      like: { message: 'Preference saved!', variant: 'success' },
      love: { message: 'Finding more like this...', variant: 'success' },
    };

    const config = messages[state];
    showToast(config.message, config.variant, 2000);
  }, [showToast]);

  const value: ToastContextValue = {
    showToast,
    showFeedbackToast,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Toast container positioned at bottom-center for mobile-friendly access */}
      <ToastContainer position="bottom-center">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            variant={toast.variant}
            duration={toast.duration}
            onDismiss={() => dismissToast(toast.id)}
            showClose={false}
          />
        ))}
      </ToastContainer>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
