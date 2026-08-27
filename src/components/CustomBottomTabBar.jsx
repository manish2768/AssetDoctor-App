/**
 * Primary navigation — Home · Assets · Documents · Alerts · Profile
 * Compact floating bottom bar (68dp height), subtle elevation, clean #0F8F87 active indicator.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';

import { Haptics } from '../services/haptics';
import { FONTS } from '../theme/branding';
import { HIT, RADIUS, elevation } from '../theme/tokens';
import { useThemeColors } from '../context/ThemeProvider';
import {
  IconHome,
  IconAssets,
  IconDocuments,
  IconAlerts,
  IconProfile,
} from './icons/TabIcons';

const TAB_CONFIG = [
  { name: 'Home', label: 'Home', Icon: IconHome },
  { name: 'Assets', label: 'Assets', Icon: IconAssets },
  { name: 'Documents', label: 'Docs', Icon: IconDocuments },
  { name: 'Alerts', label: 'Alerts', Icon: IconAlerts },
  { name: 'Profile', label: 'Profile', Icon: IconProfile },
];

export function CustomBottomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const colors = useThemeColors();
  const active = colors.primary || '#0F8F87';
  const barWidth = Math.min(width - 24, 600);

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View
        style={[
          styles.floatingBar,
          {
            width: barWidth,
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
          elevation(2, colors.shadow),
        ]}
      >
        {TAB_CONFIG.map((config) => {
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
              activeOpacity={0.82}
              style={styles.tabItem}
              accessibilityRole="tab"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={descriptors[route.key]?.options?.tabBarLabel || config.label}
            >
              <View
                style={[
                  styles.iconWrap,
                  isFocused && {
                    backgroundColor: colors.accentLight || 'rgba(11,143,131,0.12)',
                  },
                ]}
              >
                <Icon color={isFocused ? active : colors.textMuted} solid={isFocused} size={20} />
              </View>
              {isFocused ? <View style={[styles.activeDot, { backgroundColor: active }]} /> : <View style={styles.activeDotSpacer} />}
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

export const TAB_BAR_HEIGHT = 68;

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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 6,
    height: TAB_BAR_HEIGHT,
    borderRadius: RADIUS.large,
    borderWidth: 1,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    minHeight: HIT.min,
  },
  iconWrap: {
    width: 38,
    height: 28,
    borderRadius: RADIUS.small,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  activeDot: {
    width: 12,
    height: 2,
    borderRadius: 2,
    marginBottom: 2,
  },
  activeDotSpacer: {
    height: 2,
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    fontFamily: FONTS.medium,
  },
  tabLabelActive: {
    fontWeight: '700',
    fontFamily: FONTS.bold,
  },
});
