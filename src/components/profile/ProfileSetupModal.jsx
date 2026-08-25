/**
 * Optional post–sign-in profile polish — NEVER blocks Home.
 * Phone linking is skippable; already-in-use phones sign into that account.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, Image, Pressable } from 'react-native';

import { useAuth } from '../../context/AuthProvider';
import { useUiFeedback } from '../../context/UiFeedbackProvider';
import { GlassCard, GlassInput, GlassButton } from '../ui/Glass';
import { BRAND, COLORS, SPACING } from '../../theme/branding';
import { Haptics } from '../../services/haptics';
import { normalizePhone } from '../../utils/profileSetup';
import { toErrorMessage } from '../../utils/errors';
import { SMS_OTP_TEMPLATE } from '../../constants/smsOtp';

export function ProfileSetupModal() {
  // Forced gate disabled via needsProfileSetup() === false.
  // Keep component mounted for optional future soft prompts.
  const { user, profile, completeProfileSetup, needsProfileSetup, sendOTP, verifyOTP } = useAuth();
  const ui = useUiFeedback();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSession, setOtpSession] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const visible = Boolean(user && needsProfileSetup);
  const needsPhoneOtp = Boolean(user && !user.phoneNumber);

  useEffect(() => {
    if (!visible) return;
    setName(profile?.name || user?.displayName || '');
    setPhone(profile?.phone || profile?.phoneNumber || '');
    setOtp('');
    setOtpSession(null);
    setError('');
  }, [visible, profile?.name, profile?.phone, profile?.phoneNumber, user?.displayName]);

  const onSkip = async () => {
    setBusy(true);
    setError('');
    try {
      const cleanName = String(name || profile?.name || user?.displayName || 'Asset Owner').trim();
      await completeProfileSetup({
        name: cleanName,
        skipPhone: true,
      });
      Haptics.select();
    } catch (e) {
      // Even if cloud write fails, dismiss — never trap user
      console.warn('[ProfileSetup] skip failed:', e?.message || e);
      Haptics.select();
    } finally {
      setBusy(false);
    }
  };

  const onSendPhoneOtp = async () => {
    setBusy(true);
    setError('');
    try {
      const cleanName = String(name || '').trim();
      const cleanPhone = normalizePhone(phone);
      if (!cleanName || cleanName.length < 2) {
        throw new Error('Enter your full name');
      }
      if (!/^\+[1-9]\d{9,14}$/.test(cleanPhone)) {
        throw new Error('Enter a valid mobile number (e.g. 9876543210 or +919876543210)');
      }
      setPhone(cleanPhone);

      if (!needsPhoneOtp) {
        const result = await completeProfileSetup({
          name: cleanName,
          phone: cleanPhone,
          phoneNumber: cleanPhone,
        });
        if (!result.success) throw new Error(result.error);
        Haptics.success();
        return;
      }

      // Prefer sign-in OTP so existing phone accounts merge instead of blocking
      const otpResult = await sendOTP(cleanPhone, { mode: 'signIn' });
      if (!otpResult.success) throw new Error(otpResult.error);
      if (!otpResult.confirmation) throw new Error('OTP session missing');
      setOtpSession(otpResult.confirmation);
      ui.info('SMS OTP sent', SMS_OTP_TEMPLATE.userHint);
      Haptics.success();
    } catch (e) {
      Haptics.error();
      setError(toErrorMessage(e, 'Could not send OTP'));
    } finally {
      setBusy(false);
    }
  };

  const onVerifyAndSave = async () => {
    setBusy(true);
    setError('');
    try {
      const cleanName = String(name || '').trim();
      const cleanPhone = normalizePhone(phone);
      if (!otpSession) throw new Error('Request OTP first');
      // signIn mode: existing phone users log in; new users get an account
      const verified = await verifyOTP(otpSession, otp, { name: cleanName, mode: 'signIn' });
      if (!verified.success) throw new Error(verified.error);

      const result = await completeProfileSetup({
        name: cleanName,
        phone: cleanPhone,
        phoneNumber: cleanPhone,
        skipPhoneCheck: true,
      });
      if (!result.success) {
        // Auth already succeeded — don't trap on profile write
        console.warn('[ProfileSetup] profile write:', result.error);
      }
      Haptics.success();
    } catch (e) {
      Haptics.error();
      setError(toErrorMessage(e, 'Could not verify phone'));
    } finally {
      setBusy(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen">
      <View style={styles.root}>
        <Image
          source={require('../../../assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>Add a few details</Text>
        <Text style={styles.sub}>
          Optional — you can skip and use {BRAND.name} now. Link a mobile later in Settings.
        </Text>

        <GlassCard glow style={styles.card}>
          <GlassInput
            label="Full Name"
            value={name}
            onChangeText={setName}
            placeholder="Ashutosh Rai"
            autoCapitalize="words"
            editable={!otpSession}
          />
          <GlassInput
            label="Mobile Number (optional)"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="+91 98765 43210"
            editable={!otpSession}
          />
          {otpSession ? (
            <>
              <GlassInput
                label="6-digit SMS OTP"
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="550066"
              />
              <GlassButton title="Verify & Continue" onPress={onVerifyAndSave} loading={busy} />
            </>
          ) : (
            <GlassButton
              title={phone.trim() ? 'Send SMS OTP & Continue' : 'Save name & Continue'}
              onPress={phone.trim() ? onSendPhoneOtp : onSkip}
              loading={busy}
            />
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable onPress={onSkip} disabled={busy} style={styles.skipWrap}>
            <Text style={styles.skip}>Skip for now → Go to Home</Text>
          </Pressable>
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
