import { useState, useEffect } from 'react';

/**
 * Custom hook providing responsive width for Ant Design Drawers and Modals.
 * - Viewport < 768px (Mobile): returns '100%' for seamless full-width drawer
 * - Viewport 768px - 1024px (Tablet): returns Math.min(windowWidth - 24, defaultWidth)
 * - Viewport > 1024px (Desktop): returns defaultWidth
 */
export function useResponsiveDrawerWidth(defaultWidth: number = 720): number | string {
  const [width, setWidth] = useState<number | string>(() => {
    if (typeof window === 'undefined') return defaultWidth;
    if (window.innerWidth < 768) return '100%';
    if (window.innerWidth <= 1024) return Math.min(window.innerWidth - 32, defaultWidth);
    return defaultWidth;
  });

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      if (w < 768) {
        setWidth('100%');
      } else if (w <= 1024) {
        setWidth(Math.min(w - 32, defaultWidth));
      } else {
        setWidth(defaultWidth);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [defaultWidth]);

  return width;
}

export default useResponsiveDrawerWidth;
