import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

import { useAuth } from '../../context/AuthProvider';
import { useAssets } from '../../context/AssetProvider';
import { useAppLock } from '../../context/AppLockProvider';
import {
  Screen,
  GlassCard,
  GlassButton,
  GlassConfirmModal,
  GlassInput,
} from '../../components/ui/Glass';
import { BRAND, COLORS, SPACING } from '../../theme/branding';
import { Haptics } from '../../services/haptics';
import { ExpiryAlertService } from '../../services/notifications/ExpiryAlertService';
import { OfflineSyncService } from '../../services/offline/OfflineSyncService';
import { OtaUpdateService, OTA_BUNDLE_LABEL } from '../../services/updates/OtaUpdateService';
import { PlayStoreUpdateService } from '../../services/updates/PlayStoreUpdateService';
import { ANDROID_PACKAGE } from '../../constants/appIdentity';
import { ONBOARDING_KEY } from '../../constants/storageKeys';
import { openLogin } from '../../navigation/authGate';
import { useTabSafeBottomPadding } from '../../utils/tabSafePadding';
import { AboutUsScreen } from './AboutUsScreen';

export function SettingsScreen({ navigation }) {
  const { profile, signOut, user, updateProfile, isAuthenticated, displayName: authDisplayName } =
    useAuth();
  const { assets } = useAssets();
  const { enabled: appLockOn, securityLabel, setAppLockEnabled, canUseDeviceLock } = useAppLock();
  const bottomPad = useTabSafeBottomPadding({ extra: 24 });
  const [confirmOut, setConfirmOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile?.name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [email, setEmail] = useState(profile?.email || user?.email || '');
  const [address, setAddress] = useState(profile?.address || '');
  const [pincode, setPincode] = useState(profile?.pincode || '');
  const [pendingSync, setPendingSync] = useState(0);

  const refreshPending = useCallback(async () => {
    const n = await OfflineSyncService.pendingCount();
    setPendingSync(n);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshPending();
    }, [refreshPending]),
  );

  const onSignOut = async () => {
    setBusy(true);
    await signOut();
    setBusy(false);
    setConfirmOut(false);
  };

  const onSaveProfile = async () => {
    setBusy(true);
    const result = await updateProfile({ name, phone, email, address, pincode });
    setBusy(false);
    if (!result.success) {
      Alert.alert('Profile', result.error || 'Could not save');
      return;
    }
    Haptics.success();
    setEditing(false);
    Alert.alert('Saved', 'Your profile was updated.');
  };

  const onEnableAlerts = async () => {
    if (!user?.uid) {
      Alert.alert('Expiry alerts', 'Sign in first to enable alerts for your saved assets.');
      return;
    }
    const result = await ExpiryAlertService.registerPushToken(user?.uid);
    if (result?.success) {
      await ExpiryAlertService.syncPortfolioAlerts(assets);
    }
    Alert.alert(
      'Expiry alerts',
      result?.success
        ? 'Notifications enabled. You will get reminders 7, 3 and 1 day before expiry.'
        : result?.error || 'Permission denied. Enable notifications in system settings.',
    );
  };

  const onTogglePushReminders = () => {
    if (!isAuthenticated || !user?.uid) {
      Alert.alert('Reminders', 'Sign in first to manage reminder preferences.');
      return;
    }
    const currentlyOptedOut = profile?.pushRemindersOptOut === true;
    Alert.alert(
      'Expiry reminders',
      currentlyOptedOut
        ? 'Turn on email & push reminders for PUC, insurance, warranty and service?'
        : 'Turn off email & push service reminders? Local in-app alerts may still appear if enabled.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: currentlyOptedOut ? 'Turn on' : 'Turn off',
          style: currentlyOptedOut ? 'default' : 'destructive',
          onPress: async () => {
            setBusy(true);
            const result = await updateProfile({
              pushRemindersOptOut: !currentlyOptedOut,
              whatsappRemindersOptOut: !currentlyOptedOut, // legacy field mirror
            });
            setBusy(false);
            if (!result.success) {
              Alert.alert('Reminders', result.error || 'Could not update preference');
              return;
            }
            Haptics.success();
            Alert.alert(
              'Saved',
              currentlyOptedOut
                ? 'Email & push reminders are on again.'
                : 'Email & push reminders are off for your account.',
            );
          },
        },
      ],
    );
  };

  const onToggleAppLock = () => {
    const turningOff = appLockOn;
    Alert.alert(
      'App Lock',
      turningOff
        ? 'Turn off App Lock? Anyone who opens this phone can browse your vault without PIN/pattern.'
        : `Enable App Lock? Unlock with ${securityLabel.toLowerCase()} every time you open Asset Doctor.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: turningOff ? 'Turn off' : 'Enable',
          style: turningOff ? 'destructive' : 'default',
          onPress: async () => {
            setBusy(true);
            const result = await setAppLockEnabled(!turningOff);
            setBusy(false);
            if (!result.success) {
              Alert.alert(
                'App Lock',
                result.error ||
                  (result.missingEnrollment
                    ? 'Set a PIN or pattern in phone Settings first.'
                    : 'Could not update App Lock'),
              );
              return;
            }
            Alert.alert(
              'Saved',
              turningOff
                ? 'App Lock is off.'
                : 'App Lock is on. Phone PIN / pattern / biometrics protect the vault.',
            );
          },
        },
      ],
    );
  };

  const onSyncNow = async () => {
    setBusy(true);
    const result = await OfflineSyncService.flushNow();
    await refreshPending();
    setBusy(false);
    Alert.alert(
      'Cloud Locker',
      result.success
        ? pendingAfterSuccessMessage(result)
        : result.error || 'Sync failed — will retry when you reopen the app.',
    );
  };

  function pendingAfterSuccessMessage(result) {
    if ((result.remaining || 0) > 0) {
      return `All your asset data is safely backed up to Cloud Locker! (${result.processed || 0} synced, ${result.remaining} still pending)`;
    }
    return 'All your asset data is safely backed up to Cloud Locker!';
  }

  const onReplayOnboarding = async () => {
    try {
      await AsyncStorage.removeItem(ONBOARDING_KEY);
      Alert.alert('Onboarding', 'Tutorial will show again next time you restart the app.');
    } catch (e) {
      Alert.alert('Onboarding', e?.message || 'Could not reset');
    }
  };

  const onCheckUpdate = async () => {
    Haptics.tap();
    setBusy(true);
    const info = OtaUpdateService.getRuntimeInfo();
    const result = await OtaUpdateService.check({ reload: false });
    setBusy(false);
    if (!result.success) {
      Alert.alert(
        'App update',
        `${result.error || 'Could not check'}\n\nChannel: ${info.channel}\nBundle: ${info.bundleLabel}\nMode: ${info.isEmbeddedLaunch ? 'embedded (no OTA yet)' : 'OTA'}`,
      );
      return;
    }
    if (!result.available) {
      Alert.alert(
        'Already latest',
        `Channel: ${info.channel}\nBundle: ${info.bundleLabel}\nUpdate: ${info.updateIdShort}\n${info.isEmbeddedLaunch ? 'Still on APK bundle — OTA not loaded yet.' : 'OTA is active.'}`,
      );
      return;
    }
    Alert.alert('Update ready', 'Restart now to apply the new Home / Scan UI?', [
      { text: 'Later', style: 'cancel' },
      {
        text: 'Restart now',
        onPress: () => OtaUpdateService.reload(),
      },
    ]);
  };

  const onCheckPlayStore = async () => {
    Haptics.tap();
    setBusy(true);
    const decision = await PlayStoreUpdateService.checkAndPrompt({ showAlert: false });
    setBusy(false);
    const installed = decision.installed || PlayStoreUpdateService.getInstalledInfo();
    if (!decision.shouldPrompt) {
      Alert.alert(
        'Play Store',
        decision.reason === 'disabled'
          ? `Play update prompts are off until the listing is live.\n\nPackage: ${ANDROID_PACKAGE}\nInstalled: ${installed.version}`
          : `No Play Store update needed.\n\nInstalled: ${installed.version}\nStatus: ${decision.reason || 'current'}`,
      );
      return;
    }
    await PlayStoreUpdateService.checkAndPrompt({ showAlert: true });
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}>
        <Text style={styles.title}>Settings</Text>
        <GlassCard glow>
          <Text style={styles.label}>{isAuthenticated ? 'Signed in as' : 'Account'}</Text>
          {!isAuthenticated ? (
            <>
              <View style={styles.profileHeader}>
                <View style={styles.avatarFrame}>
                  <Text style={styles.avatarText}>G</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.value}>Guest</Text>
                  <Text style={styles.muted}>Sign in to sync & backup your vault.</Text>
                </View>
              </View>
              <GlassButton
                title="Sign in / Create account"
                style={{ marginTop: 12 }}
                onPress={() => openLogin(navigation)}
              />
            </>
          ) : !editing ? (
            <>
              <View style={styles.profileHeader}>
                <View style={styles.avatarFrame}>
                  <Text style={styles.avatarText}>
                    {(authDisplayName || profile?.name || 'A')
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((w) => w[0]?.toUpperCase())
                      .join('')}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.greeting}>
                    {new Date().getHours() < 12
                      ? 'Good morning'
                      : new Date().getHours() < 17
                        ? 'Good afternoon'
                        : 'Good evening'}
                  </Text>
                  <Text style={styles.value}>{authDisplayName || profile?.name || 'Asset Owner'}</Text>
                </View>
              </View>
              <GlassButton
                title="Edit profile"
                variant="ghost"
                style={{ marginTop: 12 }}
                onPress={() => {
                  setName(profile?.name || '');
                  setPhone(profile?.phone || '');
                  setEmail(profile?.email || user?.email || '');
                  setAddress(profile?.address || '');
                  setPincode(profile?.pincode || '');
                  setEditing(true);
                }}
              />
              <GlassButton
                title="Profile Settings"
                style={{ marginTop: 8 }}
                onPress={() => {
                  Haptics.tap();
                  navigation?.navigate?.('ProfileHome');
                }}
              />
            </>
          ) : (
            <>
              <GlassInput label="Full Name" value={name} onChangeText={setName} />
              <GlassInput
              label="Primary Mobile Number"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
              <GlassInput
                label="Email ID"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <GlassInput label="Home Address" value={address} onChangeText={setAddress} />
              <GlassInput
                label="Pincode"
                value={pincode}
                onChangeText={setPincode}
                keyboardType="number-pad"
                placeholder="e.g. 226010"
                maxLength={10}
              />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <GlassButton
                  title="Cancel"
                  variant="ghost"
                  style={{ flex: 1 }}
                  onPress={() => setEditing(false)}
                />
                <GlassButton title="Save" style={{ flex: 1 }} loading={busy} onPress={onSaveProfile} />
              </View>
            </>
          )}
        </GlassCard>

        <Text style={styles.sectionHeader}>Security & Privacy</Text>
        <GlassCard style={styles.sectionCard}>
          <Row
            title="App Lock"
            subtitle={
              appLockOn
                ? canUseDeviceLock
                  ? `On · ${securityLabel}`
                  : 'On · set phone PIN/pattern first'
                : 'Off · tap to protect vault with phone lock'
            }
            onPress={onToggleAppLock}
          />
          <Row
            title="Firestore security"
            subtitle={isAuthenticated ? 'Encrypted cloud backup active' : 'Sign in for cloud backup'}
            onPress={() =>
              Alert.alert(
                'Firestore',
                isAuthenticated
                  ? `Encrypted profile sync active for ${profile?.name || 'your account'}.`
                  : 'Sign in to enable encrypted Firestore backup.',
              )
            }
          />
          <Row
            title="Offline sync"
            subtitle={
              pendingSync > 0
                ? `${pendingSync} change(s) waiting — tap to sync now`
                : 'All changes synced'
            }
            onPress={onSyncNow}
          />
          <Row
            title="Privacy Policy"
            subtitle="Data, permissions & your controls"
            onPress={() => navigation?.navigate?.('PrivacyPolicy')}
            isLast
          />
        </GlassCard>

        <Text style={styles.sectionHeader}>Reminders & Alerts</Text>
        <GlassCard style={styles.sectionCard}>
          <Row
            title="Enable expiry alerts"
            subtitle="PUC 7/1 · Insurance 15/3 · Warranty 30 days"
            onPress={onEnableAlerts}
          />
          <Row
            title="Email & push reminders"
            subtitle={
              !isAuthenticated
                ? 'Sign in to manage'
                : profile?.pushRemindersOptOut || profile?.whatsappRemindersOptOut
                  ? 'Off — tap to turn on'
                  : 'On — expiry alerts via email & push'
            }
            onPress={onTogglePushReminders}
            isLast
          />
        </GlassCard>

        <Text style={styles.sectionHeader}>Support</Text>
        <GlassCard style={styles.sectionCard}>
          <Row
            title="Report an issue / Feedback"
            subtitle="Crash, bug, or idea — reach the team"
            onPress={() => navigation?.navigate?.('ReportIssue')}
          />
          <Row
            title="About Us"
            subtitle={`Built by Ashutosh Rai — story & vision`}
            onPress={() => navigation?.navigate?.('About')}
          />
          <Row
            title="Play Store listing"
            subtitle="Title, description & privacy URL notes"
            onPress={() => navigation?.navigate?.('PlayStoreListing')}
          />
          <Row
            title="Replay onboarding"
            subtitle="Show the first-run tutorial again"
            onPress={onReplayOnboarding}
          />
          <Row
            title="Edit profile"
            subtitle="Name, phone, address, optional PIN"
            onPress={() => navigation?.navigate?.('ProfileHome')}
            isLast
          />
        </GlassCard>

        {isAuthenticated ? (
          <GlassButton
            title="Sign out"
            variant="danger"
            style={{ marginTop: SPACING.lg }}
            onPress={() => setConfirmOut(true)}
          />
        ) : null}

        <View style={styles.footer}>
          <Pressable
            style={styles.footerLinkWrap}
            onPress={onCheckUpdate}
            disabled={busy}
          >
            <Text style={styles.footerLink}>Check for app update</Text>
          </Pressable>
          <Pressable
            style={styles.footerLinkWrap}
            onPress={onCheckPlayStore}
            disabled={busy}
          >
            <Text style={styles.footerLink}>Play Store update check</Text>
          </Pressable>
          <Text style={styles.footerMeta}>
            {OTA_BUNDLE_LABEL} · {ANDROID_PACKAGE}
          </Text>
        </View>
      </ScrollView>

      <GlassConfirmModal
        visible={confirmOut}
        title="Sign out?"
        message="You can sign back in anytime to access your vault."
        confirmLabel="Sign out"
        onCancel={() => setConfirmOut(false)}
        onConfirm={onSignOut}
        loading={busy}
      />
    </Screen>
  );
}

export function AboutScreen() {
  return <AboutUsScreen />;
}

function Row({ title, subtitle, onPress, isLast = false }) {
  return (
    <Pressable
      onPress={() => {
        Haptics.tap();
        onPress?.();
      }}
      style={[styles.row, isLast && styles.rowLast]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.muted}>{subtitle}</Text>
      </View>
      <Text style={{ color: COLORS.emerald, fontSize: 18 }}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, paddingTop: 48 },
  title: { color: COLORS.text, fontSize: 26, fontWeight: '900', marginBottom: SPACING.md },
  brand: { color: COLORS.text, fontSize: 22, fontWeight: '900' },
  tagline: { color: COLORS.emerald, marginTop: 8, fontWeight: '700' },
  label: { color: COLORS.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  sectionHeader: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  sectionCard: { marginTop: 0 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  avatarFrame: {
    width: 56,
    height: 56,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: COLORS.emerald,
    backgroundColor: COLORS.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: COLORS.emerald, fontWeight: '900', fontSize: 16 },
  greeting: { color: COLORS.muted, fontSize: 11, fontWeight: '700' },
  value: { color: COLORS.text, fontSize: 18, fontWeight: '800', marginTop: 2 },
  muted: { color: COLORS.muted, fontSize: 13, marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowTitle: { color: COLORS.text, fontWeight: '700', fontSize: 15 },
  footer: {
    marginTop: SPACING.xl,
    alignItems: 'center',
    gap: 6,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  footerLinkWrap: {
    paddingVertical: 6,
  },
  footerLink: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  footerMeta: {
    color: COLORS.muted,
    fontSize: 10,
    opacity: 0.55,
    marginTop: 4,
    textAlign: 'center',
  },
});

export default SettingsScreen;
