/**
 * Platform detection utilities for PWA + Tauri shared codebase
 * Per v13 Section 4.8: Platform Adaptations
 */

export type Platform = 'pwa' | 'tauri';

declare global {
  interface Window {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
    __TAURI_IPC__?: unknown;
  }
}

// Cache for platform detection to avoid repeated logs
let cachedPlatform: Platform | null = null;

/**
 * Detect if running in Tauri or PWA
 *
 * Uses multiple detection methods for reliability:
 * 1. Non-standard localhost ports (most reliable for release builds)
 * 2. window.__TAURI__ (withGlobalTauri: true in tauri.conf.json)
 * 3. window.__TAURI_INTERNALS__ or __TAURI_IPC__
 * 4. User-Agent containing "Tauri"
 * 5. tauri:// protocol
 */
export function getPlatform(): Platform {
  // Return cached result to avoid repeated detection logs
  if (cachedPlatform !== null) {
    return cachedPlatform;
  }

  if (typeof window !== 'undefined') {
    const port = window.location.port ? parseInt(window.location.port, 10) :
                 (window.location.protocol === 'https:' ? 443 : 80);
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;

    // Log detection info once
    console.log('[Platform] Detection starting:', {
      hostname,
      port,
      protocol,
      hasTauri: '__TAURI__' in window,
      tauriValue: (window as any).__TAURI__,
      hasInternals: '__TAURI_INTERNALS__' in window,
      hasIPC: '__TAURI_IPC__' in window,
      userAgent: navigator.userAgent,
    });

    // FIRST: Check for localhost with non-standard port (most reliable for Tauri release builds)
    // Standard web ports: 80, 443, 3000, 3001, 5173, 5174, 8080, 8000
    // Tauri uses random ports like 8765, 12345, etc.
    const standardPorts = [80, 443, 3000, 3001, 5173, 5174, 8080, 8000];
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

    if (isLocalhost && !standardPorts.includes(port) && port > 1024) {
      console.log(`[Platform] ✅ Detected TAURI via non-standard localhost port: ${port}`);
      cachedPlatform = 'tauri';
      return cachedPlatform;
    }

    // Check for tauri:// protocol (Tauri 2.0 production builds)
    if (protocol === 'tauri:') {
      console.log('[Platform] ✅ Detected TAURI via tauri:// protocol');
      cachedPlatform = 'tauri';
      return cachedPlatform;
    }

    // Tauri 2.0 with withGlobalTauri: true exposes window.__TAURI__
    if ('__TAURI__' in window && window.__TAURI__) {
      console.log('[Platform] ✅ Detected TAURI via __TAURI__');
      cachedPlatform = 'tauri';
      return cachedPlatform;
    }

    // Tauri 2.0 internals (backup check)
    if ('__TAURI_INTERNALS__' in window) {
      console.log('[Platform] ✅ Detected TAURI via __TAURI_INTERNALS__');
      cachedPlatform = 'tauri';
      return cachedPlatform;
    }

    // Tauri 2.0 IPC - most reliable check for Tauri environment
    if ('__TAURI_IPC__' in window) {
      console.log('[Platform] ✅ Detected TAURI via __TAURI_IPC__');
      cachedPlatform = 'tauri';
      return cachedPlatform;
    }

    // Check user agent for Tauri webview
    if (navigator.userAgent.includes('Tauri')) {
      console.log('[Platform] ✅ Detected TAURI via User-Agent');
      cachedPlatform = 'tauri';
      return cachedPlatform;
    }
  }

  console.log('[Platform] ❌ Detected PWA (no Tauri markers found)');
  cachedPlatform = 'pwa';
  return cachedPlatform;
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
