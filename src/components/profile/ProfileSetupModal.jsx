/**
 * Optional post–sign-in profile polish — NEVER blocks Home.
 * Phone linking is skippable; already-in-use phones sign into that account.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';

import { useAuth } from '../../context/AuthProvider';
import { useUiFeedback } from '../../context/UiFeedbackProvider';
import { GlassCard, GlassInput, GlassButton } from '../ui/Glass';
import { AppLogo } from '../AppLogo';
import { BRAND, COLORS, SPACING } from '../../theme/branding';
import { Haptics } from '../../services/haptics';
import { validateIndianPincode, lookupPincode, normalizeCanonicalEmail } from '../../services/identity/identityNormalizer';
import { computeProfileCompletion } from '../../utils/profileCompletion';
import { toErrorMessage } from '../../utils/errors';
import { goHomeDashboard } from '../../navigation/navActions';

export function ProfileSetupModal() {
  const {
    user,
    profile,
    completeProfileSetup,
    needsProfileSetup,
    needsProfileOnboarding,
    profileHydrationPending,
    profileStatus,
  } = useAuth();
  const ui = useUiFeedback();
  const [name, setName] = useState('');
  const [pincode, setPincode] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dismissed, setDismissed] = useState(false);

  const shouldShow = typeof needsProfileOnboarding === 'boolean' ? needsProfileOnboarding : needsProfileSetup;
  const visible = Boolean(
    user &&
    !profileHydrationPending &&
    profileStatus !== 'PROFILE_LOADING' &&
    profileStatus !== 'PROFILE_FOUND_COMPLETE' &&
    shouldShow &&
    !dismissed
  );

  useEffect(() => {
    if (!visible) return;
    const initialName = (profile?.fullName || (profile?.name && profile.name !== 'Name not set' && profile.name !== 'Asset Owner'))
      ? (profile.fullName || profile.name)
      : (user?.displayName && !/^\+?[0-9\s\-()]{7,18}$/.test(user.displayName))
        ? user.displayName
        : '';
    setName(initialName);
    setPincode(profile?.pinCode || profile?.pincode || '');
    setCity(profile?.city || '');
    setState(profile?.state || '');
    setEmail(profile?.email || user?.email || '');
    setError('');
  }, [visible, profile, user]);

  const handlePincodeChange = (text) => {
    setPincode(text);
    const check = validateIndianPincode(text);
    if (check.valid) {
      const derived = lookupPincode(check.pincode);
      if (derived) {
        if (!city && derived.city) setCity(derived.city);
        if (!state && derived.state) setState(derived.state);
      }
    }
  };

  const onSaveProfile = async () => {
    setBusy(true);
    setError('');
    console.log('[PROFILE_SAVE_START]', { uid: user?.uid });
    try {
      const cleanName = String(name || '').trim();
      if (!cleanName || cleanName.length < 2) {
        throw new Error('Please enter your Full Name (min 2 characters).');
      }
      if (/^\+?[0-9\s\-\(\)\.]{7,18}$/.test(cleanName)) {
        throw new Error('Full Name cannot be a mobile number.');
      }

      const pinCheck = validateIndianPincode(pincode);
      if (!pinCheck.valid) {
        throw new Error(pinCheck.error || 'Please enter a valid 6-digit Indian PIN Code.');
      }

      const cleanCity = String(city || '').trim();
      if (!cleanCity) {
        throw new Error('City is required.');
      }

      const cleanState = String(state || '').trim();
      if (!cleanState) {
        throw new Error('State is required.');
      }

      console.log('[PROFILE_SAVE_VALIDATED]', { name: cleanName, pincode: pinCheck.pincode, city: cleanCity, state: cleanState });

      const payload = {
        name: cleanName,
        fullName: cleanName,
        pincode: pinCheck.pincode,
        pinCode: pinCheck.pincode,
        city: cleanCity,
        state: cleanState,
        email: email ? normalizeCanonicalEmail(email) : undefined,
        profileSetupComplete: true,
      };

      const result = await completeProfileSetup(payload);
      if (!result.success) {
        throw new Error(result.error || 'Failed to complete profile.');
      }

      console.log('[PROFILE_SAVE_PERSISTED]');
      console.log('[PROFILE_STATE_UPDATED]');
      console.log('[PROFILE_COMPLETION_CONFIRMED]');

      setDismissed(true);
      console.log('[PROFILE_NAVIGATION_START]');
      Haptics.success();
      goHomeDashboard();
      console.log('[PROFILE_NAVIGATION_SUCCESS]');
    } catch (e) {
      Haptics.error();
      setError(toErrorMessage(e, 'Could not complete profile'));
    } finally {
      setBusy(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen">
      <View style={styles.root}>
        <AppLogo size={64} style={styles.logo} />
        <Text style={styles.title}>Complete Your Profile</Text>
        <Text style={styles.sub}>
          Complete your profile once to secure and personalize your Asset Doctor Vault.
        </Text>

        <GlassCard glow style={styles.card}>
          <GlassInput
            label="Full Name *"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Ayush Rai"
            autoCapitalize="words"
          />

          <GlassInput
            label="6-Digit PIN Code *"
            value={pincode}
            onChangeText={handlePincodeChange}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="e.g. 226010"
          />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <GlassInput
                label="City *"
                value={city}
                onChangeText={setCity}
                placeholder="e.g. Lucknow"
              />
            </View>
            <View style={{ flex: 1 }}>
              <GlassInput
                label="State *"
                value={state}
                onChangeText={setState}
                placeholder="e.g. Uttar Pradesh"
              />
            </View>
          </View>

          {!user?.email ? (
            <GlassInput
              label="Email Address (optional)"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="you@email.com"
            />
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <GlassButton
            title="Save & Enter Vault"
            onPress={onSaveProfile}
            loading={busy}
            style={{ marginTop: 14 }}
          />
        </GlassCard>

        <Text style={styles.footer}>{BRAND.creatorCredit}</Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
    padding: SPACING.lg,
    justifyContent: 'center',
  },
  logo: { width: 72, height: 72, alignSelf: 'center', marginBottom: 12 },
  title: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  sub: {
    color: COLORS.muted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
    lineHeight: 18,
  },
  card: { marginTop: 8 },
  error: { color: COLORS.rose, marginTop: 10, fontWeight: '700', fontSize: 12 },
  skipWrap: { marginTop: 16, alignItems: 'center', paddingVertical: 8 },
  skip: { color: COLORS.neonBlue, fontWeight: '800', fontSize: 14 },
  footer: {
    color: COLORS.muted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 24,
  },
});

export default ProfileSetupModal;
