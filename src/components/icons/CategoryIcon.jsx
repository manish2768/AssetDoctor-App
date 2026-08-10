/**
 * Premium minimal vector category / folder icons.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Rect, Circle, Line as SvgLine } from 'react-native-svg';

import { COLORS } from '../../theme/branding';

export function CategoryIcon({ name = 'other', size = 28, color = COLORS.emerald }) {
  const s = size;
  const c = color;
  const key = String(name).toLowerCase();

  const glyph = (() => {
    switch (key) {
      case 'vehicle':
      case 'bike':
      case 'car':
      case 'scooter':
      case 'motorcycle':
      case 'vehicle_parts':
        return (
          <Svg width={s * 0.62} height={s * 0.62} viewBox="0 0 24 24" fill="none">
            <Path
              d="M5 16h1.5l1.2-3.5h8.6L17.5 16H19"
              stroke={c}
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d="M7.5 12.5 L9 8.5 h4.5 l1.8 4"
              stroke={c}
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Circle cx="7.2" cy="16.2" r="1.8" stroke={c} strokeWidth="1.7" />
            <Circle cx="16.8" cy="16.2" r="1.8" stroke={c} strokeWidth="1.7" />
          </Svg>
        );
      case 'electronics':
      case 'mobile':
      case 'phone':
      case 'tablet':
        return (
          <Svg width={s * 0.5} height={s * 0.62} viewBox="0 0 20 24" fill="none">
            <Rect x="3" y="1.5" width="14" height="21" rx="2.5" stroke={c} strokeWidth="1.7" />
            <SvgLine x1="8" y1="19" x2="12" y2="19" stroke={c} strokeWidth="1.7" strokeLinecap="round" />
          </Svg>
        );
      case 'laptop':
        return (
          <Svg width={s * 0.62} height={s * 0.5} viewBox="0 0 24 18" fill="none">
            <Rect x="3" y="1.5" width="18" height="12" rx="1.5" stroke={c} strokeWidth="1.7" />
            <Path d="M1.5 15.5 H22.5" stroke={c} strokeWidth="1.7" strokeLinecap="round" />
          </Svg>
        );
      case 'ac':
      case 'tv':
      case 'fridge':
      case 'washer':
      case 'washing_machine':
      case 'microwave':
      case 'geyser':
      case 'appliance':
        return (
          <Svg width={s * 0.58} height={s * 0.58} viewBox="0 0 24 24" fill="none">
            <Rect x="3" y="4" width="18" height="14" rx="2" stroke={c} strokeWidth="1.7" />
            <SvgLine x1="7" y1="9" x2="17" y2="9" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
            <SvgLine x1="9" y1="20" x2="15" y2="20" stroke={c} strokeWidth="1.7" strokeLinecap="round" />
          </Svg>
        );
      case 'digital':
      case 'property':
      case 'utility':
      case 'utility_bill':
      case 'electricity_bill':
      case 'broadband':
      case 'digital_subscription':
      case 'rent_agreement':
      case 'home_insurance':
        return (
          <Svg width={s * 0.55} height={s * 0.62} viewBox="0 0 22 24" fill="none">
            <Path
              d="M4 3.5 H14 L18 7.5 V20.5 H4 Z"
              stroke={c}
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
            <SvgLine x1="7" y1="11" x2="15" y2="11" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
            <SvgLine x1="7" y1="14.5" x2="13" y2="14.5" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
          </Svg>
        );
      case 'personal':
      case 'insurance_policy':
      case 'legal_document':
      case 'guarantee':
      case 'accessory':
      case 'other':
      default:
        return (
          <Svg width={s * 0.55} height={s * 0.62} viewBox="0 0 22 24" fill="none">
            <Path
              d="M11 2.5 L18 5.5 V11.5 C18 16.2 14.2 19.8 11 21 C7.8 19.8 4 16.2 4 11.5 V5.5 Z"
              stroke={c}
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
            <Path
              d="M8.2 11.8 L10.2 13.8 L14.2 9.4"
              stroke={c}
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        );
    }
  })();

  return (
    <View
      style={[
        styles.frame,
        {
          width: s,
          height: s,
          borderRadius: Math.round(s * 0.28),
          borderColor: `${c}55`,
          backgroundColor: `${c}12`,
        },
      ]}
    >
      {glyph}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default CategoryIcon;
