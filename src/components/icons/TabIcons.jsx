/**
 * Tab / FAB SVG icons — strokeWidth 2.5, 28px (OTA-safe via react-native-svg).
 */

import React from 'react';
import Svg, { Path, Circle, Rect, Polyline, Line } from 'react-native-svg';

const SIZE = 28;
const STROKE = 2.5;

function baseProps(color) {
  return {
    width: SIZE,
    height: SIZE,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: STROKE,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
}

export function IconHome({ color = '#64748B', solid = false }) {
  if (solid) {
    return (
      <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24">
        <Path
          d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5z"
          fill={color}
        />
      </Svg>
    );
  }
  return (
    <Svg {...baseProps(color)}>
      <Path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5z" />
    </Svg>
  );
}

export function IconAssets({ color = '#64748B', solid = false }) {
  return (
    <Svg {...baseProps(color)} fill={solid ? color : 'none'}>
      <Rect x="3" y="3" width="7" height="7" rx="1.5" />
      <Rect x="14" y="3" width="7" height="7" rx="1.5" />
      <Rect x="3" y="14" width="7" height="7" rx="1.5" />
      <Rect x="14" y="14" width="7" height="7" rx="1.5" />
    </Svg>
  );
}

export function IconVault({ color = '#64748B', solid = false }) {
  return (
    <Svg {...baseProps(color)} fill={solid ? color : 'none'}>
      <Rect x="4" y="10" width="16" height="11" rx="2" />
      <Path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <Circle cx="12" cy="15.5" r="1.2" fill={color} stroke="none" />
    </Svg>
  );
}

export function IconEnergy({ color = '#64748B', solid = false }) {
  return (
    <Svg {...baseProps(color)} fill={solid ? color : 'none'}>
      <Polyline points="13 2 5 13 11 13 9 22 17 11 11 11 13 2" />
    </Svg>
  );
}

export function IconSettings({ color = '#64748B', solid = false }) {
  return (
    <Svg {...baseProps(color)} fill={solid ? color : 'none'}>
      <Circle cx="12" cy="12" r="3" />
      <Path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Svg>
  );
}

export function IconPlus({ color = '#FFFFFF' }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.8} strokeLinecap="round">
      <Line x1="12" y1="5" x2="12" y2="19" />
      <Line x1="5" y1="12" x2="19" y2="12" />
    </Svg>
  );
}

export const TAB_ICON_SIZE = SIZE;
export const TAB_ICON_STROKE = STROKE;

export default {
  IconHome,
  IconAssets,
  IconVault,
  IconEnergy,
  IconSettings,
  IconPlus,
};
