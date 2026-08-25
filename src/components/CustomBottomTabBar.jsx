/**
 * Floating premium tab bar — theme-aware + responsive width.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';

import { Haptics } from '../services/haptics';
import { FONTS } from '../theme/branding';
import { HIT, RADIUS } from '../theme/tokens';
import { useThemeColors } from '../context/ThemeProvider';
import { openScanInvoice } from '../navigation/navActions';
import {
  IconHome,
  IconAssets,
  IconEnergy,
  IconSettings,
  IconPlus,
} from './icons/TabIcons';

const TAB_CONFIG = [
  { name: 'Home', label: 'Home', Icon: IconHome },
  { name: 'Assets', label: 'Assets', Icon: IconAssets },
  { name: '__fab__', label: 'Scan', fab: true },
  { name: 'Power', label: 'Energy', Icon: IconEnergy },
  { name: 'Settings', label: 'Settings', Icon: IconSettings },
];

export function CustomBottomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const colors = useThemeColors();
  const active = colors.tabActive || colors.secondary || colors.neonBlue;
  const barWidth = Math.min(width - 20, 720);

  const onFabPress = () => {
    Haptics.tap();
    openScanInvoice();
  };

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View
        style={[
          styles.floatingBar,
          {
            width: barWidth,
            backgroundColor: colors.surface,
            borderColor: colors.border,
            shadowColor: colors.shadow,
          },
        ]}
      >
        {TAB_CONFIG.map((config) => {
          if (config.fab) {
            return (
              <View key="fab" style={styles.fabSlot}>
                <TouchableOpacity
                  onPress={onFabPress}
                  activeOpacity={0.9}
                  style={[styles.fabBtn, { backgroundColor: colors.primary }]}
                  accessibilityRole="button"
                  accessibilityLabel="Scan invoice"
                >
                  <IconPlus color={colors.textOnPrimary || '#FFFFFF'} />
                </TouchableOpacity>
                <Text style={[styles.fabLabel, { color: colors.textMuted }]}>Scan</Text>
              </View>
            );
          }

          const route = state.routes.find((r) => r.name === config.name);
          if (!route) return <View key={config.name} style={styles.tabItem} />;

          const index = state.routes.findIndex((r) => r.key === route.key);
          const isFocused = state.index === index;
          const Icon = config.Icon;

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
              accessibilityRole="tab"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={descriptors[route.key]?.options?.tabBarLabel || config.label}
            >
              <View
                style={[
                  styles.iconWrap,
                  isFocused && {
                    backgroundColor: colors.infoSoft || 'rgba(37,99,235,0.10)',
                  },
                ]}
              >
                <Icon color={isFocused ? active : colors.textMuted} solid={isFocused} />
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  { color: isFocused ? active : colors.textMuted },
                  isFocused && styles.tabLabelActive,
                ]}
              >
                {config.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export const TAB_BAR_HEIGHT = 72;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  floatingBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    ...Platform.select({
      ios: {},
      android: {},
      default: {},
    }),
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: HIT.min,
    minWidth: HIT.min,
  },
  iconWrap: {
    width: 44,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 10,
    fontFamily: FONTS.medium,
    fontWeight: '600',
    marginTop: 2,
  },
  tabLabelActive: {
    fontFamily: FONTS.semibold,
    fontWeight: '700',
  },
  fabSlot: {
    width: 64,
    alignItems: 'center',
    marginTop: -22,
  },
  fabBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  fabLabel: {
    fontSize: 10,
    fontFamily: FONTS.medium,
    fontWeight: '600',
    marginTop: 4,
  },
});

export default CustomBottomTabBar;
