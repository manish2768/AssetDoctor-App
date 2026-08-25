/**
 * Asset Doctor brand mark — shield + emerald check (SVG).
 */

import React from 'react';
import Svg, { Path } from 'react-native-svg';

/**
 * @param {{ size?: number, style?: object }} props
 */
export function AppLogo({ size = 96, style }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      style={style}
      accessibilityRole="image"
      accessibilityLabel="Asset Doctor"
    >
      {/* Soft shadow (FeDropShadow not available in react-native-svg) */}
      <Path
        d="M256 50 C330 90, 410 90, 422 100 C422 258, 370 388, 256 478 C142 388, 90 258, 90 100 C102 90, 182 90, 256 50 Z"
        fill="#000000"
        opacity={0.1}
      />
      <Path
        d="M256 42 C330 82, 410 82, 422 92 C422 250, 370 380, 256 470 C142 380, 90 250, 90 92 C102 82, 182 82, 256 42 Z"
        fill="#E0E8FF"
      />
      <Path
        d="M256 60 C322 96, 394 96, 404 105 C404 246, 356 362, 256 445 C156 362, 108 246, 108 105 C118 96, 190 96, 256 60 Z"
        fill="#2563EB"
      />
      <Path
        d="M182 248 L232 298 L330 200"
        stroke="#10B981"
        strokeWidth={38}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default AppLogo;
