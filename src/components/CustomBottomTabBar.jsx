/**
 * Floating premium tab bar — clean Park+-style light shell + solid icons.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Haptics } from '../services/haptics';
import { COLORS, FONTS } from '../theme/branding';
import { openScanInvoice } from '../navigation/navActions';
import {
  IconHome,
  IconAssets,
  IconEnergy,
  IconSettings,
  IconPlus,
} from './icons/TabIcons';

const { width } = Dimensions.get('window');
const ACTIVE = COLORS.neonBlue;

const TAB_CONFIG = [
  { name: 'Home', label: 'Home', Icon: IconHome },
  { name: 'Assets', label: 'Assets', Icon: IconAssets },
  { name: '__fab__', label: 'Scan', fab: true },
  { name: 'Power', label: 'Energy', Icon: IconEnergy },
  { name: 'Settings', label: 'Settings', Icon: IconSettings },
];

export function CustomBottomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();

  const onFabPress = () => {
    Haptics.tap();
    openScanInvoice();
  };

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.floatingBar}>
        {TAB_CONFIG.map((config) => {
          if (config.fab) {
            return (
              <View key="fab" style={styles.fabSlot}>
                <TouchableOpacity
                  onPress={onFabPress}
                  activeOpacity={0.9}
                  style={styles.fabBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Scan invoice"
                >
                  <IconPlus color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.fabLabel}>Scan</Text>
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
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={descriptors[route.key]?.options?.tabBarLabel || config.label}
            >
              <View style={[styles.iconWrap, isFocused && styles.iconWrapActive]}>
                <Icon color={isFocused ? ACTIVE : COLORS.muted} solid={isFocused} />
              </View>
              <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
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
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'transparent',
    zIndex: 50,
  },
  floatingBar: {
    flexDirection: 'row',
    width: width - 20,
    minHeight: TAB_BAR_HEIGHT,
    backgroundColor: COLORS.bgElevated,
    borderRadius: 28,
    paddingHorizontal: 6,
    paddingTop: 8,
    paddingBottom: 6,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...Platform.select({
      ios: {
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: { elevation: 10 },
    }),
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 4,
    gap: 2,
  },
  iconWrap: {
    width: 40,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.10)',
  },
  tabLabel: {
    color: COLORS.muted,
    fontSize: 10,
    fontFamily: FONTS.semibold,
    fontWeight: '700',
  },
  tabLabelActive: {
    color: ACTIVE,
  },
  fabSlot: {
    width: 68,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: -22,
    paddingBottom: 2,
  },
  fabBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: ACTIVE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: COLORS.bg,
    ...Platform.select({
      ios: {
        shadowColor: ACTIVE,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: { elevation: 8 },
    }),
  },
  fabLabel: {
    marginTop: 2,
    color: ACTIVE,
    fontSize: 10,
    fontFamily: FONTS.bold,
    fontWeight: '800',
  },
});

export default CustomBottomTabBar;
