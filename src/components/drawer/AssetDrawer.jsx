
/**
 * Asset Doctor — Master Universal Asset Drawer Component
 * 
 * Premium native mobile side navigation with 60fps physics,
 * collapsible universal categories, asset intelligence modules,
 * and high-priority hero scanning action.
 */

import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  useWindowDimensions,
  Platform,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDrawer } from '../../context/DrawerContext';
import { useAssets } from '../../context/AssetProvider';
import { useAuth } from '../../context/AuthProvider';
import { useThemeColors } from '../../context/ThemeProvider';
import { navigationRef, openScanInvoice } from '../../navigation/navActions';
import {
  MAIN_NAV_ITEMS,
  ASSET_CATEGORIES_CONFIG,
  getActiveNavSection,
} from '../../navigation/navigationConfig';
import { resolveAssetCategory } from '../../utils/categoryNormalization';

import { DrawerHeader } from './DrawerHeader';
import { UniversalSearchEntry } from './UniversalSearchEntry';
import { DrawerSection } from './DrawerSection';
import { DrawerItem } from './DrawerItem';
import { DrawerFooter } from './DrawerFooter';
import { SyncEngine } from '../../services/offline/SyncEngine';

/**
 * De-duplicated intelligence, tools and account destinations.
 * Each points to a unique screen registered in RootNavigator, so repeated
 * targets (e.g. AssetAnalytics, VaultHome) appear at most once in the drawer.
 */
const INTELLIGENCE_NAV = [
  {
    id: 'asset_health',
    label: 'Asset Health & Analytics',
    subtitle: 'Live health scores & portfolio insights',
    icon: 'spark',
    route: 'Home',
    params: { screen: 'AssetAnalytics' },
  },
  {
    id: 'maintenance',
    label: 'Maintenance',
    subtitle: 'Service logs, repairs & workshop records',
    icon: 'wrench',
    route: 'Home',
    params: { screen: 'Maintenance' },
  },
  {
    id: 'fuel_mileage',
    label: 'Fuel & Mileage',
    subtitle: 'Refuels, odometer & efficiency',
    icon: 'zap',
    route: 'Home',
    params: { screen: 'FuelVault' },
  },
  {
    id: 'energy_nig',
    label: 'Energy / NIG',
    subtitle: 'Network & home energy intelligence',
    icon: 'chart',
    route: 'Home',
    params: { screen: 'EnergyOverview' },
  },
];

const TOOLS_NAV = [
  {
    id: 'universal_search',
    label: 'Universal Search',
    subtitle: 'Search serial, IMEI, plate or policy',
    icon: 'search',
    route: 'Home',
    params: { screen: 'GlobalSearch' },
  },
];

const ACCOUNT_NAV = [
  {
    id: 'profile',
    label: 'Profile',
    subtitle: 'Your details & preferences',
    icon: 'user',
    route: 'Profile',
    params: { screen: 'ProfileHome' },
  },
  {
    id: 'privacy_security',
    label: 'Privacy & Security',
    subtitle: 'Biometric lock & encrypted storage',
    icon: 'lock',
    route: 'Profile',
    params: { screen: 'PrivacySecurity' },
  },
  {
    id: 'settings',
    label: 'Settings',
    subtitle: 'Notifications, currency, theme & sound',
    icon: 'settings',
    route: 'Profile',
    params: { screen: 'SettingsHome' },
  },
  {
    id: 'about',
    label: 'About',
    subtitle: 'Version, credits & licenses',
    icon: 'shield-check',
    route: 'Profile',
    params: { screen: 'About' },
  },
  {
    id: 'support',
    label: 'Support',
    subtitle: 'Contact, report issue & feedback',
    icon: 'message',
    route: 'Profile',
    params: { screen: 'ContactUs' },
  },
];

export function AssetDrawer() {
  const { isOpen, closeDrawer, animatedProgress } = useDrawer();
  const { assets } = useAssets();
  const { isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const colors = useThemeColors();

  const drawerWidth = Math.min(width * 0.82, 340);
  const activeAssets = (assets || []).filter((a) => !a.isArchived).length;

  // Compute category counts dynamically across all assets
  const categoryCounts = useMemo(() => {
    const counts = {
      vehicles: 0,
      home_appliances: 0,
      gadgets_electronics: 0,
      equipment_machinery: 0,
      business_assets: 0,
      other_assets: 0,
    };

    for (const a of assets || []) {
      if (a.isArchived) continue;
      const resolved = resolveAssetCategory(a) || 'other';
      if (resolved === 'vehicle') counts.vehicles += 1;
      else if (resolved === 'home') counts.home_appliances += 1;
      else if (resolved === 'gadget') counts.gadgets_electronics += 1;
      else if (resolved === 'equipment') counts.equipment_machinery += 1;
      else if (resolved === 'business') counts.business_assets += 1;
      else counts.other_assets += 1;
    }
    return counts;
  }, [assets]);

  const handleNavigate = (item) => {
    closeDrawer();

    if (item.isHeroScanner) {
      setTimeout(() => {
        openScanInvoice();
      }, 150);
      return;
    }

    if (item.isSyncAction) {
      SyncEngine.syncNow().catch(() => {});
      return;
    }

    if (item.route) {
      setTimeout(() => {
        if (navigationRef.isReady()) {
          navigationRef.navigate(item.route, item.params);
        }
      }, 150);
    }
  };

  const handleProfilePress = () => {
    closeDrawer();
    setTimeout(() => {
      if (navigationRef.isReady()) {
        navigationRef.navigate('Profile', { screen: 'ProfileHome' });
      }
    }, 150);
  };

  const handleSearchPress = () => {
    closeDrawer();
    setTimeout(() => {
      if (navigationRef.isReady()) {
        navigationRef.navigate('Home', { screen: 'GlobalSearch' });
      }
    }, 150);
  };

  const handleAuthAction = () => {
    closeDrawer();
    setTimeout(() => {
      if (navigationRef.isReady()) {
        navigationRef.navigate('AuthModal', { screen: 'Login' });
      }
    }, 150);
  };

  if (!isOpen) return null;

  const backdropOpacity = animatedProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.6],
  });

  const translateX = animatedProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-drawerWidth, 0],
  });

  return (
    <Modal
      transparent
      visible={isOpen}
      animationType="none"
      onRequestClose={closeDrawer}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Animated backdrop */}
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable
            style={styles.backdropPressable}
            onPress={closeDrawer}
            accessibilityRole="button"
            accessibilityLabel="Close drawer backdrop"
          />
        </Animated.View>

        {/* Animated Drawer Slider */}
        <Animated.View
          style={[
            styles.drawerContainer,
            {
              width: drawerWidth,
              backgroundColor: colors.surface || '#FFFFFF',
              transform: [{ translateX }],
              paddingTop: insets.top || 16,
            },
          ]}
        >
          {/* Header */}
          <DrawerHeader
            onClose={closeDrawer}
            onProfilePress={handleProfilePress}
          />

          {/* Scrollable Navigation Body */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Universal Search Entry */}
            <UniversalSearchEntry onPress={handleSearchPress} />

            {/* 1. Core — Scan, Home, Assets, Docs, Alerts, Profile */}
            <DrawerSection title="Core" isCollapsible={false}>
              {getActiveNavSection(MAIN_NAV_ITEMS).map((item) => {
                const isTotalAssets = item.id === 'my_assets';
                const count = isTotalAssets && activeAssets > 0 ? `${activeAssets}` : item.badge;
                return (
                  <DrawerItem
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    subtitle={item.subtitle}
                    badge={count}
                    badgeColor={item.isHeroScanner ? '#14B8A6' : undefined}
                    onPress={() => handleNavigate(item)}
                  />
                );
              })}
            </DrawerSection>

            {/* 2. Universal Asset Categories */}
            <DrawerSection
              title="Asset Collections"
              badge="Universal"
              isCollapsible={true}
              defaultExpanded={true}
            >
              {getActiveNavSection(ASSET_CATEGORIES_CONFIG).map((category) => {
                const count = categoryCounts[category.id] || 0;
                const countBadge = count > 0 ? `${count}` : undefined;
                return (
                  <DrawerItem
                    key={category.id}
                    icon={category.icon}
                    label={category.label}
                    subtitle={category.subtitle}
                    badge={countBadge}
                    badgeColor={count > 0 ? category.color : undefined}
                    onPress={() => handleNavigate(category)}
                  />
                );
              })}
            </DrawerSection>

            {/* 3. Intelligence */}
            <DrawerSection
              title="Intelligence"
              isCollapsible={true}
              defaultExpanded={true}
            >
              {INTELLIGENCE_NAV.map((item) => (
                <DrawerItem
                  key={item.id}
                  icon={item.icon}
                  label={item.label}
                  subtitle={item.subtitle}
                  badge={item.badge}
                  onPress={() => handleNavigate(item)}
                />
              ))}
            </DrawerSection>

            {/* 4. Tools */}
            <DrawerSection
              title="Tools"
              isCollapsible={true}
              defaultExpanded={false}
            >
              {TOOLS_NAV.map((item) => (
                <DrawerItem
                  key={item.id}
                  icon={item.icon}
                  label={item.label}
                  subtitle={item.subtitle}
                  badge={item.badge}
                  onPress={() => handleNavigate(item)}
                />
              ))}
            </DrawerSection>

            {/* 5. Account */}
            <DrawerSection
              title="Account"
              isCollapsible={true}
              defaultExpanded={false}
            >
              {ACCOUNT_NAV.map((item) => (
                <DrawerItem
                  key={item.id}
                  icon={item.icon}
                  label={item.label}
                  subtitle={item.subtitle}
                  badge={item.badge}
                  onPress={() => handleNavigate(item)}
                />
              ))}
            </DrawerSection>
          </ScrollView>

          {/* Footer */}
          <DrawerFooter onAuthAction={handleAuthAction} />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  backdropPressable: {
    flex: 1,
  },
  drawerContainer: {
    height: '100%',
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 24,
  },
  scrollContent: {
    paddingBottom: 32,
    paddingTop: 4,
  },
});
