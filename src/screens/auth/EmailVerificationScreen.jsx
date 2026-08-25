import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';

import { useAuth } from '../../context/AuthProvider';
import { BrandingBanner } from '../../components/BrandingBanner';
import { Haptics } from '../../services/haptics';
import { COLORS } from '../../theme/branding';

export function EmailVerificationScreen() {
  const { user, sendEmailVerification, reloadUser, emailVerified, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('We sent a verification link to your inbox.');

  useEffect(() => {
    // RootNavigator switches to MainTabs when emailVerified flips
  }, [emailVerified]);

  const onResend = async () => {
    setBusy(true);
    const result = await sendEmailVerification();
    setBusy(false);
    setMessage(result.success ? 'Verification email resent + reminder queued.' : result.error);
  };

  const onRefresh = async () => {
    Haptics.tap();
    setBusy(true);
    const result = await reloadUser();
    setBusy(false);
    if (result.emailVerified) {
      Haptics.success();
      setMessage('Verified! Opening your vault…');
    } else {
      setMessage('Still waiting — open the link in your email, then tap Refresh.');
    }
  };

  return (
    <View style={styles.root}>
      <BrandingBanner compact />
      <Text style={styles.title}>Verify your email</Text>
      <Text style={styles.sub}>
        {user?.email
          ? `Confirm ${user.email} to unlock your vault. A welcome email is on the way via Resend/SendGrid.`
          : 'Confirm your email to continue.'}
      </Text>

      <Pressable style={styles.primary} onPress={onRefresh} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>I've verified — Refresh</Text>}
      </Pressable>

      <Pressable style={styles.secondary} onPress={onResend} disabled={busy}>
        <Text style={styles.secondaryText}>Resend verification</Text>
      </Pressable>

      <Text style={styles.msg}>{message}</Text>

      <Pressable
        onPress={async () => {
          await signOut();
        }}
      >
        <Text style={styles.link}>Use a different account</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg, padding: 24, paddingTop: 56 },
  title: { color: COLORS.text, fontSize: 22, fontWeight: '800', marginTop: 24 },
  sub: { color: COLORS.muted, marginTop: 10, lineHeight: 20, fontSize: 13 },
  primary: {
    marginTop: 28,
    backgroundColor: COLORS.indigo,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '800' },
  secondary: {
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryText: { color: COLORS.text, fontWeight: '700' },
  msg: { color: '#A5B4FC', marginTop: 18, textAlign: 'center', fontSize: 12 },
  link: { color: COLORS.muted, textAlign: 'center', marginTop: 28 },
});

export default EmailVerificationScreen;
