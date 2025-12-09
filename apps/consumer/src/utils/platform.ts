/**
 * Platform detection utilities for PWA + Tauri shared codebase
 * Per v13 Section 4.8: Platform Adaptations
 */

export type Platform = 'pwa' | 'tauri';

declare global {
  interface Window {
    __TAURI__?: unknown;
  }
}

/**
 * Detect if running in Tauri or PWA
 */
export function getPlatform(): Platform {
  if (typeof window !== 'undefined' && '__TAURI__' in window) {
    return 'tauri';
  }
  return 'pwa';
}

/**
 * Check if running on mobile viewport
 */
export function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
}

/**
 * Check if running on tablet viewport
 */
export function isTablet(): boolean {
  if (typeof window === 'undefined') return false;
  const width = window.innerWidth;
  return width >= 768 && width < 1024;
}

/**
 * Check if running on desktop viewport
 */
export function isDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth >= 1024;
}

export type Breakpoint = 'mobile' | 'tablet' | 'desktop' | 'wide' | 'ultrawide';

/**
 * Get current breakpoint based on window width
 * Per v13 Section 4.8 breakpoint specifications
 */
export function getBreakpoint(): Breakpoint {
  if (typeof window === 'undefined') return 'mobile';

  const width = window.innerWidth;

  if (width >= 1440) return 'ultrawide';
  if (width >= 1280) return 'wide';
  if (width >= 1024) return 'desktop';
  if (width >= 768) return 'tablet';
  return 'mobile';
}

/**
 * Check if PWA is installed (standalone mode)
 */
export function isPWAInstalled(): boolean {
  if (typeof window === 'undefined') return false;

  // Check display-mode media query
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }

  // Check iOS safari standalone mode
  if ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone) {
    return true;
  }

  return false;
}

/**
 * Check if device supports touch
 */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;

  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0
  );
}

/**
 * Get safe area insets for PWA notch handling
 */
export function getSafeAreaInsets(): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  if (typeof window === 'undefined' || typeof getComputedStyle === 'undefined') {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  const style = getComputedStyle(document.documentElement);

  return {
    top: parseInt(style.getPropertyValue('--sat') || '0', 10),
    right: parseInt(style.getPropertyValue('--sar') || '0', 10),
    bottom: parseInt(style.getPropertyValue('--sab') || '0', 10),
    left: parseInt(style.getPropertyValue('--sal') || '0', 10),
  };
}

/**
 * Platform-specific feature availability
 */
export function getFeatureAvailability() {
  const platform = getPlatform();

  return {
    // Deep links only work in Tauri
    deepLinks: platform === 'tauri',

    // Push notifications require service worker (PWA) or native (Tauri)
    pushNotifications: platform === 'pwa' && 'serviceWorker' in navigator,

    // Biometric auth only in Tauri with native APIs
    biometricAuth: platform === 'tauri',

    // File system access
    fileSystemAccess: platform === 'tauri',

    // Background sync (PWA with service worker)
    backgroundSync: platform === 'pwa' && 'serviceWorker' in navigator,

    // Native window controls
    windowControls: platform === 'tauri',
  };
}

/**
 * Get columns based on current breakpoint
 * Per v13 Section 4.7 feed layout
 */
export function getColumns(): number {
  const breakpoint = getBreakpoint();

  switch (breakpoint) {
    case 'ultrawide':
      return 4;
    case 'wide':
    case 'desktop':
      return 3;
    case 'tablet':
    case 'mobile':
    default:
      return 2;
  }
}

/**
 * Get card width based on current breakpoint
 * Per v13 Section 4.8 platform adaptations
 */
export function getCardWidth(): number {
  const breakpoint = getBreakpoint();

  switch (breakpoint) {
    case 'ultrawide':
      return 280;
    case 'wide':
      return 260;
    case 'desktop':
      return 220;
    case 'tablet':
      return 200;
    case 'mobile':
    default:
      return 180;
  }
}
