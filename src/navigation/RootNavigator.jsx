/**
 * Root navigation — Splash → Onboarding → Main app (browse first)
 * Login opens as modal only when saving assets / documents.
 *
 * IMPORTANT: Scan Invoice is a ROOT modal — never the Home tab landing screen.
 * Home tab always shows Dashboard (vault overview).
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text, Pressable } from 'react-native';
import * as Notifications from 'expo-notifications';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../context/AuthProvider';
import { SplashScreen } from '../screens/auth/SplashScreen';
import { LoginScreen, SignUpScreen } from '../screens/auth/AuthScreens';
import { EmailVerificationScreen } from '../screens/auth/EmailVerificationScreen';
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen';
import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import { AssetEnergyScreen } from '../screens/dashboard/AssetEnergyScreen';
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
import { PlayStoreListingScreen } from '../screens/settings/PlayStoreListingScreen';
import { OfflineSyncService } from '../services/offline/OfflineSyncService';
import { PlayStoreUpdateService } from '../services/updates/PlayStoreUpdateService';
import { Haptics } from '../services/haptics';
import { COLORS, NAV_THEME } from '../theme/branding';
import { ONBOARDING_KEY } from '../constants/storageKeys';
import { CustomBottomTabBar } from '../components/CustomBottomTabBar';
import { navigationRef, goHomeDashboard } from './navActions';

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
  navigationRef.navigate('MainTabs', {
    screen: 'Home',
    params: {
      screen: 'Dashboard',
      params: {},
    },
  });
  setTimeout(() => {
    if (!navigationRef.isReady()) return;
    navigationRef.navigate('MainTabs', {
      screen: 'Home',
      params: {
        screen: 'AssetPassport',
        params: { assetId },
      },
    });
  }, 50);
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
      <HomeStack.Screen name="AssetPassport" component={AssetPassportScreen} options={{ title: 'Asset Passport' }} />
      <HomeStack.Screen name="AddAsset" component={AddAssetScreen} options={addAssetOptions} />
      <HomeStack.Screen name="Maintenance" component={MaintenanceScreen} options={{ title: 'Service & Maintenance' }} />
      <HomeStack.Screen name="DocumentsVault" component={DocumentsVaultScreen} options={{ title: 'Documents' }} />
    </HomeStack.Navigator>
  );
}

function AssetsStackNav() {
  return (
    <AssetsStack.Navigator initialRouteName="AssetList" screenOptions={stackOptions}>
      <AssetsStack.Screen name="AssetList" component={AssetListScreen} options={{ title: 'Assets' }} />
      <AssetsStack.Screen name="AddAsset" component={AddAssetScreen} options={addAssetOptions} />
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
    <Stack.Navigator initialRouteName="SettingsHome" screenOptions={stackOptions}>
      <Stack.Screen name="SettingsHome" component={SettingsScreen} options={{ title: 'Settings' }} />
      <Stack.Screen name="ProfileHome" component={ProfileScreen} options={{ title: 'Profile' }} />
      <Stack.Screen name="About" component={AboutScreen} options={{ title: 'About Us' }} />
      <Stack.Screen name="ReportIssue" component={ReportIssueScreen} options={{ title: 'Report Issue' }} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} options={{ title: 'Privacy Policy' }} />
      <Stack.Screen name="PlayStoreListing" component={PlayStoreListingScreen} options={{ title: 'Play Store' }} />
    </Stack.Navigator>
  );
}

/** When user taps Home tab, always show Dashboard — never stuck Scan Invoice. */
function homeTabPress(navigation) {
  Haptics.select();
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
      <Tab.Screen name="Vault" component={VaultStackNav} options={{ title: 'Vault' }} />
      <Tab.Screen
        name="Power"
        component={AssetEnergyScreen}
        options={{ headerShown: true, title: 'Appliance Energy', tabBarLabel: 'Energy' }}
      />
      <Tab.Screen name="Settings" component={SettingsStackNav} options={{ title: 'Settings' }} />
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
        if (navigation.canGoBack()) navigation.goBack();
        else goHomeDashboard();
      }}
      hitSlop={12}
      style={{ paddingHorizontal: 12 }}
    >
      <Text style={{ color: COLORS.emerald, fontWeight: '800', fontSize: 16 }}>Close</Text>
    </Pressable>
  );
}

export function RootNavigator() {
  const { isAuthenticated, loading, profileReady, emailVerified, user } = useAuth();
  const [bootDone, setBootDone] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    return OfflineSyncService.startAutoFlush();
  }, []);

  // Sideloaded APK → future Play Store update dialog (no-op until app_config/android.promptEnabled)
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
    if (!bootDone) return;
    let cancelled = false;
    (async () => {
      try {
        const done = await AsyncStorage.getItem(ONBOARDING_KEY);
        if (!cancelled) setShowOnboarding(done !== '1');
      } catch {
        if (!cancelled) setShowOnboarding(true);
      } finally {
        if (!cancelled) setOnboardingChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bootDone]);

  const finishOnboarding = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, '1');
    } catch {
      /* ignore */
    }
    setShowOnboarding(false);
  };

  if (!bootDone) {
    return <SplashScreen onFinish={() => setBootDone(true)} />;
  }

  if (!onboardingChecked) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={COLORS.emerald} />
      </View>
    );
  }

  if (showOnboarding) {
    return <OnboardingScreen onDone={finishOnboarding} />;
  }

  // Wait for auth + Firestore profile hydrate so signed-in users never flash "Guest"
  if (loading || (isAuthenticated && !profileReady)) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={COLORS.emerald} />
        <Text style={{ color: COLORS.muted, marginTop: 12, fontWeight: '600' }}>Loading your vault…</Text>
      </View>
    );
  }

  const needsVerify =
    isAuthenticated &&
    user?.providerData?.some((p) => p.providerId === 'password') &&
    !emailVerified;

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={NAV_THEME}
      onReady={() => {
        if (pendingNotificationResponse) {
          openNotificationTarget(pendingNotificationResponse);
        }
      }}
    >
      <RootStack.Navigator
        initialRouteName={needsVerify ? 'EmailVerification' : 'MainTabs'}
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.bg } }}
      >
        {needsVerify ? (
          <RootStack.Screen name="EmailVerification" component={EmailVerificationScreen} />
        ) : (
          <>
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
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

export default RootNavigator;
