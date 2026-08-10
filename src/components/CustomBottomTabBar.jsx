/**
 * Floating tab bar — light slate surface (OTA-safe, no extra icon packages).
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Haptics } from '../services/haptics';
import { COLORS } from '../theme/branding';

const { width } = Dimensions.get('window');

const TAB_CONFIG = [
  { name: 'Home', label: 'Home', icon: '▣', tint: '#0D9488' },
  { name: 'Assets', label: 'Assets', icon: '▦', tint: '#0891B2' },
  { name: 'Vault', label: 'Vault', icon: '▤', tint: '#0E7490' },
  { name: 'Power', label: 'Energy', icon: '⚡', tint: '#6366F1' },
  { name: 'Settings', label: 'Settings', icon: '⚙', tint: '#0A1628' },
];

export function CustomBottomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.floatingBar}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const config = TAB_CONFIG.find((t) => t.name === route.name) || TAB_CONFIG[index] || TAB_CONFIG[0];

          const onPress = () => {
            Haptics.select();
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (event.defaultPrevented) return;

            if (route.name === 'Home') {
              navigation.navigate('Home', { screen: 'Dashboard' });
              return;
            }

            if (!isFocused) {
              navigation.navigate(route.name);
              return;
            }

            const nested = state.routes[index]?.state;
            const rootScreen = nested?.routes?.[0]?.name;
            if (rootScreen) {
              navigation.navigate(route.name, { screen: rootScreen });
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.85}
              style={styles.tabItem}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={descriptors[route.key]?.options?.tabBarLabel || config.label}
            >
              {isFocused ? (
                <View style={[styles.activeGlowPill, { backgroundColor: config.tint }]}>
                  <Text style={styles.activeIcon}>{config.icon}</Text>
                  <Text style={styles.activeTabText}>{config.label}</Text>
                </View>
              ) : (
                <View style={styles.inactiveTab}>
                  <Text style={styles.inactiveIcon}>{config.icon}</Text>
                  <Text style={styles.inactiveTabText}>{config.label}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export const TAB_BAR_HEIGHT = 68;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 4,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  floatingBar: {
    flexDirection: 'row',
    width: width - 24,
    height: TAB_BAR_HEIGHT,
    backgroundColor: COLORS.bgElevated,
    borderRadius: 24,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 14,
      },
      android: { elevation: 8 },
    }),
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeGlowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 16,
    gap: 5,
  },
  inactiveTab: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  activeIcon: { fontSize: 14, color: '#FFFFFF', fontWeight: '900' },
  inactiveIcon: { fontSize: 16, color: COLORS.muted },
  activeTabText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  inactiveTabText: {
    color: COLORS.muted,
    fontSize: 9,
    fontWeight: '600',
  },
});

export default CustomBottomTabBar;
