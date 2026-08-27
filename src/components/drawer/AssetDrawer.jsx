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
  INTELLIGENCE_NAV_ITEMS,
  SMART_TOOLS_ITEMS,
  ACCOUNT_NAV_ITEMS,
  getActiveNavSection,
} from '../../navigation/navigationConfig';

import { DrawerHeader } from './DrawerHeader';
import { ScannerHeroCard } from './ScannerHeroCard';
import { UniversalSearchEntry } from './UniversalSearchEntry';
import { DrawerSection } from './DrawerSection';
import { DrawerItem } from './DrawerItem';
import { DrawerFooter } from './DrawerFooter';
import { SyncEngine } from '../../services/offline/SyncEngine';

export function AssetDrawer() {
  const { isOpen, closeDrawer, animatedProgress } = useDrawer();
  const { assets } = useAssets();
  const { isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const colors = useThemeColors();

  const drawerWidth = Math.min(width * 0.82, 340);

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
      const cat = String(a.categoryId || a.category || '').toLowerCase();
      if (['bike', 'car', 'scooter', 'ev', 'vehicle', 'motorcycle', 'commercial'].some((k) => cat.includes(k))) {
        counts.vehicles += 1;
      } else if (['ac', 'fridge', 'washer', 'washing_machine', 'tv', 'microwave', 'geyser', 'appliance'].some((k) => cat.includes(k))) {
        counts.home_appliances += 1;
      } else if (['phone', 'mobile', 'laptop', 'tablet', 'gadget', 'camera', 'console', 'electronics'].some((k) => cat.includes(k))) {
        counts.gadgets_electronics += 1;
      } else if (['equipment', 'generator', 'inverter', 'solar', 'tool', 'machinery'].some((k) => cat.includes(k))) {
        counts.equipment_machinery += 1;
      } else if (['business', 'commercial', 'office', 'pos'].some((k) => cat.includes(k))) {
        counts.business_assets += 1;
      } else {
        counts.other_assets += 1;
      }
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
            {/* Prominent Scan & Identify Hero Card */}
            <ScannerHeroCard
              onPress={() => handleNavigate({ isHeroScanner: true })}
            />

            {/* Universal Search Entry */}
            <UniversalSearchEntry onPress={handleSearchPress} />

            {/* 1. Main Navigation */}
            <DrawerSection title="Core" isCollapsible={false}>
              {getActiveNavSection(MAIN_NAV_ITEMS)
                .filter((it) => !it.isHeroScanner)
                .map((item) => (
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

            {/* 3. Asset Intelligence */}
            <DrawerSection
              title="Intelligence"
              isCollapsible={true}
              defaultExpanded={true}
            >
              {getActiveNavSection(INTELLIGENCE_NAV_ITEMS).map((item) => (
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

            {/* 4. Smart Tools */}
            <DrawerSection
              title="Smart Tools"
              isCollapsible={true}
              defaultExpanded={false}
            >
              {getActiveNavSection(SMART_TOOLS_ITEMS).map((item) => (
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

            {/* 5. Account & Security */}
            <DrawerSection
              title="Account"
              isCollapsible={true}
              defaultExpanded={false}
            >
              {getActiveNavSection(ACCOUNT_NAV_ITEMS).map((item) => (
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
    paddingBottom: 24,
  },
});
