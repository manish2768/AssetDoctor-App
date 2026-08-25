/**
 * Root navigation — Splash → Auth → Profile → Onboarding → Home
 * Guest browse still allowed; onboarding is per authenticated uid.
 *
 * IMPORTANT: Scan Invoice is a ROOT modal — never the Home tab landing screen.
 * Home tab always shows Dashboard (vault overview).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View, Text, Pressable, AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../context/AuthProvider';
import { SplashScreen } from '../screens/auth/SplashScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { SignUpScreen } from '../screens/auth/AuthScreens';
import { EmailVerificationScreen } from '../screens/auth/EmailVerificationScreen';
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen';
import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import { AssetEnergyScreen } from '../screens/dashboard/AssetEnergyScreen';
import { EnergyScreen } from '../screens/dashboard/EnergyScreen';
import { AddAssetScreen } from '../screens/assets/AddAssetScreen';
import { DocumentsVaultScreen } from '../screens/assets/DocumentsVaultScreen';
import { AssetPassportScreen } from '../screens/assets/AssetPassportScreen';
import { AssetListScreen } from '../screens/assets/AssetListScreen';
import { VaultHomeScreen } from '../screens/assets/VaultHomeScreen';
import { CategoryFoldersScreen } from '../screens/assets/CategoryFoldersScreen';
import { MaintenanceScreen } from '../screens/assets/MaintenanceScreen';
import { SettingsScreen, AboutScreen } from '../screens/settings/SettingsScreens';
import { ProfileScreen } from '../screens/settings/ProfileScreen';
import { ReportIssueScreen } from '../screens/settings/ReportIssueScreen';
import { PrivacyPolicyScreen } from '../screens/settings/PrivacyPolicyScreen';
import { PrivacySecurityScreen } from '../screens/settings/PrivacySecurityScreen';
import { ContactUsScreen } from '../screens/settings/ContactUsScreen';
import { PlayStoreListingScreen } from '../screens/settings/PlayStoreListingScreen';
import { NotificationSettingsScreen } from '../screens/settings/NotificationSettingsScreen';
import { NotificationCenterScreen } from '../screens/notifications/NotificationCenterScreen';
import { AssetAnalyticsScreen } from '../screens/analytics/AssetAnalyticsScreen';
import { openNotificationDeepLink } from '../services/notifications/notificationDeepLink';
import { OfflineSyncService } from '../services/offline/OfflineSyncService';
import { SyncEngine } from '../services/offline/SyncEngine';
import { PlayStoreUpdateService } from '../services/updates/PlayStoreUpdateService';
import { Haptics } from '../services/haptics';
import { COLORS } from '../theme/branding';
import { useTheme } from '../context/ThemeProvider';
import { ONBOARDING_KEY } from '../constants/storageKeys';
import { CustomBottomTabBar } from '../components/CustomBottomTabBar';
import { GlobalSearchScreen } from '../screens/search/GlobalSearchScreen';
import { ScanAssetQrScreen } from '../screens/assets/ScanAssetQrScreen';
import {
  WelcomeBackModal,
  shouldShowWelcomeGreeting,
} from '../components/WelcomeBackModal';
import { navigationRef, goHomeDashboard } from './navActions';
import { AuthBootGate } from './AuthBootGate';
import {
  clearScanSession,
  restoreScanSessionIfNeeded,
} from '../utils/scanNavGuard';

// Lazy-load scanner / review so OCR deps cannot blank the Home boot path.
// ScanBillScreen already wraps itself in ScanErrorBoundary.
function ScanBillScreen(props) {
  try {
    const Comp = require('../screens/ScanBillScreen').ScanBillScreen;
    return <Comp {...props} />;
  } catch (error) {
    console.error('[RootNavigator] ScanBill load failed:', error?.message || error);
    const Boundary = require('../components/ScanErrorBoundary').ScanErrorBoundary;
    return <Boundary navigation={props.navigation}>{null}</Boundary>;
  }
}
function ReviewAssetScreen(props) {
  try {
    const Comp = require('../screens/ReviewAssetScreen').ReviewAssetScreen;
    const Boundary = require('../components/ScanErrorBoundary').ScanErrorBoundary;
    return (
      <Boundary navigation={props.navigation}>
        <Comp {...props} />
      </Boundary>
    );
  } catch (error) {
    console.error('[RootNavigator] ReviewAsset load failed:', error?.message || error);
    const Boundary = require('../components/ScanErrorBoundary').ScanErrorBoundary;
    return <Boundary navigation={props.navigation}>{null}</Boundary>;
  }
}

export { navigationRef, openScanInvoice, openReviewInvoice, openRescanInvoice, goHomeDashboard } from './navActions';

const RootStack = createNativeStackNavigator();
const AuthStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const AssetsStack = createNativeStackNavigator();
const VaultStack = createNativeStackNavigator();
let pendingNotificationResponse = null;

function openNotificationTarget(response) {
  const assetId = response?.notification?.request?.content?.data?.assetId;
  if (!assetId) return;
  if (!navigationRef.isReady()) {
    pendingNotificationResponse = response;
    return;
  }
  pendingNotificationResponse = null;
  openNotificationDeepLink(navigationRef, response);
}

const stackOptions = {
  headerStyle: { backgroundColor: COLORS.bg },
  headerTintColor: COLORS.text,
  headerTitleStyle: { fontWeight: '800' },
  contentStyle: { backgroundColor: COLORS.bg },
  headerShadowVisible: false,
};

function addAssetOptions({ route }) {
  if (route?.params?.openScanner) return { title: 'Scan Bill / RC' };
  return { title: route?.params?.assetId ? 'Edit Asset' : 'Add Asset' };
}

/**
 * Home stack — Dashboard ONLY as landing. No ScanBill here.
 */
function HomeStackNav() {
  return (
    <HomeStack.Navigator initialRouteName="Dashboard" screenOptions={stackOptions}>
      <HomeStack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: 'Home', headerShown: false }}
      />
      <HomeStack.Screen name="NotificationCenter" component={NotificationCenterScreen} options={{ title: 'Notifications' }} />
      <HomeStack.Screen name="GlobalSearch" component={GlobalSearchScreen} options={{ title: 'Search', headerShown: false }} />
      <HomeStack.Screen name="ScanAssetQr" component={ScanAssetQrScreen} options={{ title: 'Scan Asset QR' }} />
      <HomeStack.Screen name="AssetAnalytics" component={AssetAnalyticsScreen} options={{ title: 'Asset Analytics' }} />
      <HomeStack.Screen name="AssetPassport" component={AssetPassportScreen} options={{ title: 'Asset Passport' }} />
      <HomeStack.Screen name="AddAsset" component={AddAssetScreen} options={addAssetOptions} />
      <HomeStack.Screen name="Maintenance" component={MaintenanceScreen} options={{ title: 'Service & Maintenance' }} />
      <HomeStack.Screen name="DocumentsVault" component={DocumentsVaultScreen} options={{ title: 'Documents' }} />
      <HomeStack.Screen name="VaultHome" component={VaultHomeScreen} options={{ title: 'Document Vault' }} />
      <HomeStack.Screen
        name="CategoryFolders"
        component={CategoryFoldersScreen}
        options={{ title: 'Category Folders' }}
      />
    </HomeStack.Navigator>
  );
}

function AssetsStackNav() {
  return (
    <AssetsStack.Navigator initialRouteName="AssetList" screenOptions={stackOptions}>
      <AssetsStack.Screen name="AssetList" component={AssetListScreen} options={{ title: 'Assets' }} />
      <AssetsStack.Screen name="AddAsset" component={AddAssetScreen} options={addAssetOptions} />
      <AssetsStack.Screen name="GlobalSearch" component={GlobalSearchScreen} options={{ title: 'Search', headerShown: false }} />
      <AssetsStack.Screen name="ScanAssetQr" component={ScanAssetQrScreen} options={{ title: 'Scan Asset QR' }} />
      <AssetsStack.Screen name="AssetAnalytics" component={AssetAnalyticsScreen} options={{ title: 'Analytics' }} />
      <AssetsStack.Screen name="AssetPassport" component={AssetPassportScreen} options={{ title: 'Passport' }} />
      <AssetsStack.Screen name="Maintenance" component={MaintenanceScreen} options={{ title: 'Service & Maintenance' }} />
      <AssetsStack.Screen name="DocumentsVault" component={DocumentsVaultScreen} options={{ title: 'Documents' }} />
    </AssetsStack.Navigator>
  );
}

function VaultStackNav() {
  return (
    <VaultStack.Navigator initialRouteName="VaultHome" screenOptions={stackOptions}>
      <VaultStack.Screen name="VaultHome" component={VaultHomeScreen} options={{ title: 'Document Vault' }} />
      <VaultStack.Screen
        name="CategoryFolders"
        component={CategoryFoldersScreen}
        options={{ title: 'Category Folders' }}
      />
      <VaultStack.Screen name="DocumentsVault" component={DocumentsVaultScreen} options={{ title: 'Documents' }} />
      <VaultStack.Screen name="AssetPassport" component={AssetPassportScreen} options={{ title: 'Passport' }} />
      <VaultStack.Screen name="AddAsset" component={AddAssetScreen} options={addAssetOptions} />
      <VaultStack.Screen
        name="Maintenance"
        component={MaintenanceScreen}
        options={{ title: 'Service & Maintenance' }}
      />
    </VaultStack.Navigator>
  );
}

function SettingsStackNav() {
  const Stack = createNativeStackNavigator();
  return (
    <Stack.Navigator initialRouteName="ProfileHome" screenOptions={stackOptions}>
      <Stack.Screen name="ProfileHome" component={ProfileScreen} options={{ title: 'Profile' }} />
      <Stack.Screen name="SettingsHome" component={SettingsScreen} options={{ title: 'Settings' }} />
      <Stack.Screen
        name="PrivacySecurity"
        component={PrivacySecurityScreen}
        options={{ title: 'Privacy & Security' }}
      />
      <Stack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{ title: 'Notification settings' }}
      />
      <Stack.Screen
        name="NotificationCenter"
        component={NotificationCenterScreen}
        options={{ title: 'Alerts' }}
      />
      <Stack.Screen name="AssetPassport" component={AssetPassportScreen} options={{ title: 'Asset Passport' }} />
      <Stack.Screen name="Maintenance" component={MaintenanceScreen} options={{ title: 'Service & Maintenance' }} />
      <Stack.Screen name="DocumentsVault" component={DocumentsVaultScreen} options={{ title: 'Documents' }} />
      <Stack.Screen name="AssetAnalytics" component={AssetAnalyticsScreen} options={{ title: 'Analytics' }} />
      <Stack.Screen name="About" component={AboutScreen} options={{ title: 'About Us' }} />
      <Stack.Screen name="ContactUs" component={ContactUsScreen} options={{ title: 'Contact Us' }} />
      <Stack.Screen name="ReportIssue" component={ReportIssueScreen} options={{ title: 'Report Issue' }} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} options={{ title: 'Privacy Policy' }} />
      <Stack.Screen name="PlayStoreListing" component={PlayStoreListingScreen} options={{ title: 'Play Store' }} />
      <Stack.Screen
        name="ApplianceEnergyDetail"
        component={AssetEnergyScreen}
        options={{ title: 'Appliance Energy' }}
      />
      <Stack.Screen
        name="EnergyOverview"
        component={EnergyScreen}
        options={{ title: 'Energy', headerShown: false }}
      />
    </Stack.Navigator>
  );
}

function AlertsStackNav() {
  const Stack = createNativeStackNavigator();
  return (
    <Stack.Navigator initialRouteName="NotificationCenter" screenOptions={stackOptions}>
      <Stack.Screen
        name="NotificationCenter"
        component={NotificationCenterScreen}
        options={{ title: 'Alerts' }}
      />
      <Stack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{ title: 'Notification settings' }}
      />
      <Stack.Screen name="AssetPassport" component={AssetPassportScreen} options={{ title: 'Asset Passport' }} />
      <Stack.Screen name="DocumentsVault" component={DocumentsVaultScreen} options={{ title: 'Documents' }} />
      <Stack.Screen name="Maintenance" component={MaintenanceScreen} options={{ title: 'Service & Maintenance' }} />
    </Stack.Navigator>
  );
}

/** When user taps Home tab, always show Dashboard — never stuck Scan Invoice. */
function homeTabPress(navigation) {
  Haptics.select();
  clearScanSession().catch(() => {});
  navigation.navigate('Home', {
    screen: 'Dashboard',
  });
}

function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      tabBar={(props) => <CustomBottomTabBar {...props} />}
      screenListeners={({ navigation, route }) => ({
        tabPress: (e) => {
          if (route.name === 'Home') {
            e.preventDefault();
            homeTabPress(navigation);
            return;
          }
          Haptics.select();
          const state = navigation.getState();
          const tab = state?.routes?.find((r) => r.name === route.name);
          if (tab?.state?.index > 0) {
            e.preventDefault();
            navigation.navigate(route.name, {
              screen: tab.state.routes[0]?.name,
            });
          }
        },
      })}
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
        sceneStyle: { backgroundColor: COLORS.bg, paddingBottom: 86 },
      }}
    >
      <Tab.Screen name="Home" component={HomeStackNav} options={{ title: 'Home', tabBarLabel: 'Home' }} />
      <Tab.Screen name="Assets" component={AssetsStackNav} options={{ title: 'Assets' }} />
      <Tab.Screen name="Documents" component={VaultStackNav} options={{ title: 'Documents', tabBarLabel: 'Docs' }} />
      <Tab.Screen name="Alerts" component={AlertsStackNav} options={{ title: 'Alerts' }} />
      <Tab.Screen name="Profile" component={SettingsStackNav} options={{ title: 'Profile', tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
}

function AuthModalNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ ...stackOptions, headerShown: true }}>
      <AuthStack.Screen
        name="Login"
        component={LoginScreen}
        options={({ navigation }) => ({
          title: 'Sign in to save',
          headerShown: true,
          headerLeft: () => (
            <Text
              onPress={() => navigation.getParent()?.goBack?.()}
              style={{ color: COLORS.emerald, fontWeight: '700', paddingHorizontal: 12 }}
            >
              Close
            </Text>
          ),
        })}
      />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} options={{ title: 'Create account' }} />
      <AuthStack.Screen
        name="EmailVerification"
        component={EmailVerificationScreen}
        options={{ title: 'Verify Email' }}
      />
    </AuthStack.Navigator>
  );
}

function ScanCloseButton({ navigation }) {
  return (
    <Pressable
      onPress={() => {
        Haptics.tap();
        // Explicit user Close — clear scan restore guard, then leave scanner
        clearScanSession().finally(() => {
          try {
            if (navigation?.canGoBack?.()) {
              navigation.goBack();
              return;
            }
            goHomeDashboard();
          } catch {
            /* ignore */
          }
        });
      }}
      hitSlop={12}
      style={{ paddingHorizontal: 12 }}
    >
      <Text style={{ color: COLORS.emerald, fontWeight: '800', fontSize: 16 }}>Close</Text>
    </Pressable>
  );
}

function AuthStackNavigator() {
  return (
    <AuthStack.Navigator
      initialRouteName="Login"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.bg },
      }}
    >
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen
        name="SignUp"
        component={SignUpScreen}
        options={{ headerShown: true, title: 'Create account', ...stackOptions }}
      />
      <AuthStack.Screen
        name="EmailVerification"
        component={EmailVerificationScreen}
        options={{ headerShown: true, title: 'Verify Email', ...stackOptions }}
      />
    </AuthStack.Navigator>
  );
}

function MainAppStackNavigator() {
  return (
    <RootStack.Navigator
      initialRouteName="MainTabs"
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.bg } }}
    >
      <RootStack.Screen name="MainTabs" component={MainTabs} />
      <RootStack.Screen
        name="ScanBill"
        component={ScanBillScreen}
        options={({ navigation }) => ({
          headerShown: true,
          title: 'Scan Invoice',
          presentation: 'fullScreenModal',
          ...stackOptions,
          headerLeft: () => <ScanCloseButton navigation={navigation} />,
        })}
      />
      <RootStack.Screen
        name="ReviewAsset"
        component={ReviewAssetScreen}
        options={({ navigation }) => ({
          headerShown: true,
          title: 'Review Invoice',
          presentation: 'fullScreenModal',
          ...stackOptions,
          headerLeft: () => <ScanCloseButton navigation={navigation} />,
        })}
      />
      <RootStack.Screen
        name="AuthModal"
        component={AuthModalNavigator}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
    </RootStack.Navigator>
  );
}

/**
 * AuthSwitchNavigator — user null → AuthStack (Login), else → MainAppStack.
 * NavigationContainer remount key forces a hard tree reset on logout/login.
 */
export function RootNavigator() {
  const {
    isAuthenticated: authIsAuthenticated,
    loading,
    profileReady,
    emailVerified,
    user,
    displayName,
    allowGuestBrowse,
    retryProfileHydrate,
    needsProfileSetup,
  } = useAuth();
  const { navTheme } = useTheme();
  const AUTH_BYPASS_FOR_SCAN_TESTING = false;
  const isAuthenticated = AUTH_BYPASS_FOR_SCAN_TESTING ? true : authIsAuthenticated;
  /** Auth stack when logged out (unless guest Skip). */
  const showAuthStack =
    !AUTH_BYPASS_FOR_SCAN_TESTING && !isAuthenticated && !allowGuestBrowse;

  const [bootDone, setBootDone] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  /** User opted to continue past boot gate with cached data */
  const [bootBypass, setBootBypass] = useState(false);

  useEffect(() => {
    return SyncEngine.startAutoFlush(() => user?.uid);
  }, [user?.uid]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        restoreScanSessionIfNeeded().catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!bootDone || showOnboarding || !onboardingChecked) return undefined;
    const timer = setTimeout(() => {
      PlayStoreUpdateService.checkAndPrompt({ showAlert: true }).catch(() => {});
    }, 1800);
    return () => clearTimeout(timer);
  }, [bootDone, showOnboarding, onboardingChecked]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      openNotificationTarget,
    );
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) openNotificationTarget(response);
      })
      .catch(() => {});
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!bootDone) return undefined;
    let cancelled = false;

    // Guests / logged-out: never block on product onboarding before auth
    if (showAuthStack || allowGuestBrowse || !isAuthenticated || !user?.uid) {
      setShowOnboarding(false);
      setOnboardingChecked(true);
      return undefined;
    }

    // Wait until profile setup finishes for new phone users
    if (needsProfileSetup) {
      setShowOnboarding(false);
      setOnboardingChecked(true);
      return undefined;
    }

    (async () => {
      try {
        const key = `${ONBOARDING_KEY}:${user.uid}`;
        const done = await AsyncStorage.getItem(key);
        // Migrate legacy global flag once
        const legacy = await AsyncStorage.getItem(ONBOARDING_KEY);
        const complete = done === '1' || legacy === '1';
        if (complete && done !== '1') {
          await AsyncStorage.setItem(key, '1');
        }
        if (!cancelled) setShowOnboarding(!complete);
      } catch {
        if (!cancelled) setShowOnboarding(true);
      } finally {
        if (!cancelled) setOnboardingChecked(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    bootDone,
    showAuthStack,
    allowGuestBrowse,
    isAuthenticated,
    user?.uid,
    needsProfileSetup,
  ]);

  const finishOnboarding = async () => {
    try {
      const uid = user?.uid;
      if (uid) await AsyncStorage.setItem(`${ONBOARDING_KEY}:${uid}`, '1');
      await AsyncStorage.setItem(ONBOARDING_KEY, '1');
    } catch {
      /* ignore */
    }
    setShowOnboarding(false);
  };

  useEffect(() => {
    if (!bootDone || showOnboarding || !onboardingChecked || showAuthStack) return undefined;
    if (!bootBypass && (loading || (authIsAuthenticated && !profileReady))) {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const show = await shouldShowWelcomeGreeting();
      if (!cancelled && show) setShowWelcome(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    bootDone,
    showOnboarding,
    onboardingChecked,
    showAuthStack,
    loading,
    authIsAuthenticated,
    profileReady,
    bootBypass,
  ]);

  // Reset boot bypass when auth user changes
  useEffect(() => {
    setBootBypass(false);
  }, [user?.uid, allowGuestBrowse]);

  const finishSplash = useCallback(() => {
    setBootDone(true);
  }, []);

  if (!bootDone) {
    return <SplashScreen onFinish={finishSplash} holdMs={1500} />;
  }

  if (!onboardingChecked) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={COLORS.emerald} />
      </View>
    );
  }

  // Auth first — onboarding only for signed-in users after profile gate
  if (showOnboarding && isAuthenticated && !needsProfileSetup && !showAuthStack) {
    return <OnboardingScreen onDone={finishOnboarding} />;
  }

  const bootBlocking =
    !AUTH_BYPASS_FOR_SCAN_TESTING &&
    !showAuthStack &&
    !bootBypass &&
    (loading || (authIsAuthenticated && !profileReady));

  if (bootBlocking) {
    return (
      <AuthBootGate
        loading
        onRetry={() => {
          retryProfileHydrate?.();
        }}
        onContinueAnyway={() => setBootBypass(true)}
      />
    );
  }

  const needsVerify =
    !AUTH_BYPASS_FOR_SCAN_TESTING &&
    isAuthenticated &&
    user?.providerData?.some((p) => p.providerId === 'password') &&
    !emailVerified;

  const switchKey = needsVerify
    ? `verify-${user?.uid || 'x'}`
    : showAuthStack
      ? 'auth'
      : isAuthenticated
        ? `app-${user?.uid || 'x'}`
        : 'guest';

  return (
    <>
      <NavigationContainer
        key={switchKey}
        ref={navigationRef}
        theme={navTheme}
        onReady={() => {
          if (pendingNotificationResponse) {
            openNotificationTarget(pendingNotificationResponse);
          }
          restoreScanSessionIfNeeded().catch(() => {});
          setTimeout(() => {
            restoreScanSessionIfNeeded().catch(() => {});
          }, 400);
        }}
      >
        {needsVerify ? (
          <AuthStack.Navigator screenOptions={{ headerShown: false }}>
            <AuthStack.Screen name="EmailVerification" component={EmailVerificationScreen} />
          </AuthStack.Navigator>
        ) : showAuthStack ? (
          <AuthStackNavigator />
        ) : (
          <MainAppStackNavigator />
        )}
      </NavigationContainer>
      <WelcomeBackModal
        visible={showWelcome && !showAuthStack}
        displayName={displayName || user?.displayName || 'Guest'}
        onDismiss={() => setShowWelcome(false)}
      />
    </>
  );
}

export default RootNavigator;
