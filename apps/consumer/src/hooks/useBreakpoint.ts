import { useState, useEffect } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop' | 'wide' | 'ultrawide';

/**
 * Breakpoints from v13 Section 4.8
 *
 * | Breakpoint | Min Width | Columns | Card Width |
 * |------------|-----------|---------|------------|
 * | mobile     | < 768px   | 2       | 180px      |
 * | tablet     | 768px     | 2       | 200px      |
 * | desktop    | 1024px    | 3       | 220px      |
 * | wide       | 1280px    | 3       | 260px      |
 * | ultrawide  | 1440px+   | 4       | 280px      |
 */
const BREAKPOINTS: Record<Breakpoint, number> = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
  wide: 1280,
  ultrawide: 1440,
};

function getBreakpoint(width: number): Breakpoint {
  if (width >= BREAKPOINTS.ultrawide) return 'ultrawide';
  if (width >= BREAKPOINTS.wide) return 'wide';
  if (width >= BREAKPOINTS.desktop) return 'desktop';
  if (width >= BREAKPOINTS.tablet) return 'tablet';
  return 'mobile';
}

export function useBreakpoint() {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(() => {
    if (typeof window === 'undefined') return 'mobile';
    return getBreakpoint(window.innerWidth);
  });

  const [dimensions, setDimensions] = useState(() => {
    if (typeof window === 'undefined') return { width: 0, height: 0 };
    return { width: window.innerWidth, height: window.innerHeight };
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      setDimensions({ width, height });
      setBreakpoint(getBreakpoint(width));
    };

    // Use ResizeObserver for better performance
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(document.body);

    // Fallback for initial load
    handleResize();

    return () => resizeObserver.disconnect();
  }, []);

  return {
    breakpoint,
    isMobile: breakpoint === 'mobile',
    isTablet: breakpoint === 'tablet',
    isDesktop: breakpoint === 'desktop' || breakpoint === 'wide' || breakpoint === 'ultrawide',
    width: dimensions.width,
    height: dimensions.height,

    // Grid configuration based on breakpoint
    columns: breakpoint === 'ultrawide' ? 4 :
             breakpoint === 'wide' || breakpoint === 'desktop' ? 3 : 2,

    cardWidth: breakpoint === 'ultrawide' ? 280 :
               breakpoint === 'wide' ? 260 :
               breakpoint === 'desktop' ? 220 :
               breakpoint === 'tablet' ? 200 : 180,

    showSidebar: breakpoint !== 'mobile' && breakpoint !== 'tablet',
  };
}
