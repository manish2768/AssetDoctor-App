/**
 * Auth screens — SignUp stays here; Login is `src/screens/LoginScreen.jsx`.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
} from 'react-native';

import { useAuth } from '../../context/AuthProvider';
import { LottieSuccess } from '../../components/LottieSuccess';
import {
  Screen,
  GlassCard,
  GlassInput,
  GlassButton,
  BrandFooter,
  GlassConfirmModal,
} from '../../components/ui/Glass';
import { GoogleSignInButton } from '../../components/GoogleSignInButton';
import { BRAND, COLORS, SPACING } from '../../theme/branding';
import { Haptics } from '../../services/haptics';
import { toErrorMessage } from '../../utils/errors';

export { LoginScreen } from '../LoginScreen';

function normalizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

export function SignUpScreen({ navigation }) {
  const { signUpWithEmail, signInWithGoogle } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);

  const submit = async () => {
    setConfirmVisible(false);
    setBusy(true);
    setError('');
    try {
      const cleanEmail = normalizeEmail(email);
      setEmail(cleanEmail);
      const result = await signUpWithEmail({
        name,
        email: cleanEmail,
        password: String(password || '').trim(),
      });
      if (!result.success) throw new Error(result.error);
      setShowSuccess(true);
    } catch (e) {
      Haptics.error();
      setError(toErrorMessage(e, 'Sign up failed'));
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await signInWithGoogle();
      if (!result.success) throw new Error(result.error);
      setShowSuccess(true);
    } catch (e) {
      Haptics.error();
      setError(toErrorMessage(e, 'Google Sign-In failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.brand}>{BRAND.name}</Text>
          <Text style={styles.welcomeLine}>Create your vault</Text>
          <Text style={styles.tagline}>Protect your assets in seconds</Text>

          <GlassCard style={{ marginTop: SPACING.lg }} glow>
            <GlassInput label="Full Name" value={name} onChangeText={setName} placeholder="Ashutosh" />
            <GlassInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              onBlur={() => setEmail(normalizeEmail(email))}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@email.com"
            />
            <GlassInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Min 6 characters"
            />
            <GlassButton title="Create Account" onPress={() => setConfirmVisible(true)} loading={busy} />
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>
            <GoogleSignInButton onPress={onGoogle} loading={busy} />
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </GlassCard>

          <Pressable onPress={() => navigation?.navigate?.('Login')} style={{ marginTop: SPACING.lg }}>
            <Text style={styles.link}>Already have an account? Log in</Text>
          </Pressable>

          <BrandFooter />
        </ScrollView>
      </KeyboardAvoidingView>

      <GlassConfirmModal
        visible={confirmVisible}
        title="Create Asset Doctor account?"
        message="We'll send a verification email and a welcome message to your inbox."
        confirmLabel="Sign Up"
        onCancel={() => setConfirmVisible(false)}
        onConfirm={submit}
        loading={busy}
      />

      <LottieSuccess
        visible={showSuccess}
        title="Welcome to Asset Doctor!"
        subtitle={`${BRAND.tagline}\nVerification + welcome email queued.`}
        duration={1600}
        onFinish={() => {
          setShowSuccess(false);
          if (navigation?.canGoBack?.()) navigation.goBack();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, paddingTop: 36, paddingBottom: 40 },
  brand: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.4,
    marginTop: 4,
  },
  welcomeLine: {
    color: COLORS.emerald,
    textAlign: 'center',
    marginTop: 8,
    fontSize: 15,
    fontWeight: '700',
  },
  tagline: {
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 16,
    fontWeight: '500',
  },
  link: { color: COLORS.neonBlue, textAlign: 'center', fontWeight: '700' },
  error: { color: COLORS.rose, textAlign: 'center', marginTop: 12, fontSize: 13 },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 14,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { color: COLORS.muted, fontSize: 12, fontWeight: '700' },
});

export default SignUpScreen;
