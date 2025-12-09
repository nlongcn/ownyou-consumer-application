import { useEffect, useCallback, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface KeyboardNavOptions {
  enabled?: boolean;
}

/**
 * Keyboard navigation hook for accessibility and power users
 *
 * Key bindings (from v13 Section 4.8):
 * - J: Move to next mission card
 * - K: Move to previous mission card
 * - Enter: Open selected mission
 * - Esc: Close modal/detail, go back
 * - Tab: Standard focus navigation
 * - 1-5: Quick navigation to tabs (Home, Profile, Settings, Wallet, etc.)
 */
export function useKeyboardNav(options: KeyboardNavOptions = {}) {
  const { enabled = true } = options;
  const navigate = useNavigate();
  const location = useLocation();
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't interfere with input fields
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    switch (event.key) {
      case 'j':
      case 'J':
        // Move to next item
        event.preventDefault();
        setFocusedIndex(prev => {
          const cards = document.querySelectorAll('[data-mission-card]');
          const nextIndex = Math.min(prev + 1, cards.length - 1);
          const nextCard = cards[nextIndex] as HTMLElement;
          nextCard?.focus();
          return nextIndex;
        });
        break;

      case 'k':
      case 'K':
        // Move to previous item
        event.preventDefault();
        setFocusedIndex(prev => {
          const cards = document.querySelectorAll('[data-mission-card]');
          const nextIndex = Math.max(prev - 1, 0);
          const nextCard = cards[nextIndex] as HTMLElement;
          nextCard?.focus();
          return nextIndex;
        });
        break;

      case 'Enter':
        // Open focused item
        if (focusedIndex >= 0) {
          event.preventDefault();
          const cards = document.querySelectorAll('[data-mission-card]');
          const card = cards[focusedIndex] as HTMLElement;
          const missionId = card?.dataset.missionId;
          if (missionId) {
            navigate(`/mission/${missionId}`);
          }
        }
        break;

      case 'Escape':
        // Close modal or go back
        event.preventDefault();
        if (location.pathname.startsWith('/mission/')) {
          navigate(-1);
        } else {
          // Close any open modals
          const modal = document.querySelector('[data-modal]');
          if (modal) {
            const closeButton = modal.querySelector('[data-close]') as HTMLElement;
            closeButton?.click();
          }
        }
        break;

      case '1':
        // Navigate to Home
        if (!event.metaKey && !event.ctrlKey) {
          event.preventDefault();
          navigate('/');
        }
        break;

      case '2':
        // Navigate to Profile
        if (!event.metaKey && !event.ctrlKey) {
          event.preventDefault();
          navigate('/profile');
        }
        break;

      case '3':
        // Navigate to Settings
        if (!event.metaKey && !event.ctrlKey) {
          event.preventDefault();
          navigate('/settings');
        }
        break;

      case '4':
        // Navigate to Wallet
        if (!event.metaKey && !event.ctrlKey) {
          event.preventDefault();
          navigate('/wallet');
        }
        break;

      case '?':
        // Show keyboard shortcuts help
        if (event.shiftKey) {
          event.preventDefault();
          // TODO: Show shortcuts modal
          console.log('Keyboard shortcuts: J/K to navigate, Enter to open, Esc to close, 1-4 for tabs');
        }
        break;
    }
  }, [focusedIndex, navigate, location.pathname]);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);

  // Reset focus when route changes
  useEffect(() => {
    setFocusedIndex(-1);
  }, [location.pathname]);

  return {
    focusedIndex,
    setFocusedIndex,
  };
}
