/**
 * Golden Shield badge — shown when portfolio health hits 100%.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

import { COLORS } from '../theme/branding';

export function GoldenShieldBadge({ size = 22, style }) {
  const s = size;
  return (
    <View
      style={[
        styles.wrap,
        {
          width: s + 10,
          height: s + 10,
          borderRadius: (s + 10) / 2,
        },
        style,
      ]}
      accessibilityLabel="Perfect health golden shield"
    >
      <Svg width={s} height={s} viewBox="0 0 24 24">
        <Defs>
          <LinearGradient id="goldShield" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#F5D76E" />
            <Stop offset="55%" stopColor={COLORS.gold} />
            <Stop offset="100%" stopColor="#A67C00" />
          </LinearGradient>
        </Defs>
        <Path
          d="M12 2.5 L19 5.2 V11.2 C19 16.1 15.4 20.1 12 21.5 C8.6 20.1 5 16.1 5 11.2 V5.2 Z"
          fill="url(#goldShield)"
        />
        <Path
          d="M8.6 12.1 L10.8 14.3 L15.5 9.2"
          stroke="#FFF8E7"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: COLORS.goldSoft,
    borderWidth: 1,
    borderColor: 'rgba(212, 160, 23, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.gold,
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});

export default GoldenShieldBadge;
