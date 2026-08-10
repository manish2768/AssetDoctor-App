/**
 * Bottom clearance under the floating custom tab bar.
 */

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TAB_BAR_HEIGHT } from '../components/CustomBottomTabBar';

/** Extra breathing room above the floating bar */
const TAB_GAP = 16;

/**
 * @param {{ extra?: number }} [opts]
 * @returns {number} paddingBottom for ScrollView content
 */
export function useTabSafeBottomPadding(opts = {}) {
  const insets = useSafeAreaInsets();
  const extra = opts.extra ?? 0;
  return TAB_BAR_HEIGHT + Math.max(insets.bottom, 8) + TAB_GAP + extra;
}

export { TAB_BAR_HEIGHT, TAB_GAP };
