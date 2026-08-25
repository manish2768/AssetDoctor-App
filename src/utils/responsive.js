/**
 * Responsive layout helpers — phone / large phone / tablet.
 */

import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

export const BREAKPOINTS = Object.freeze({
  phone: 0,
  largePhone: 390,
  tablet: 768,
});

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  return useMemo(() => {
    const isTablet = width >= BREAKPOINTS.tablet;
    const isLargePhone = width >= BREAKPOINTS.largePhone && width < BREAKPOINTS.tablet;
    const isCompact = width < BREAKPOINTS.largePhone;
    const contentMaxWidth = isTablet ? 720 : undefined;
    const columns = isTablet ? 2 : 1;
    const summaryColumns = isCompact ? 4 : isTablet ? 7 : 7;
    return {
      width,
      height,
      isTablet,
      isLargePhone,
      isCompact,
      contentMaxWidth,
      columns,
      summaryColumns,
      horizontalPad: isTablet ? 28 : 16,
    };
  }, [width, height]);
}

export default { useResponsiveLayout, BREAKPOINTS };
