/**
 * Phase 1 — Auth screens (Login / Signup)
 * Glassmorphic inputs + Lottie success + welcome email via AuthService
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
  Image,
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

export function LoginScreen({ navigation }) {
  const { signInWithEmail, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const finish = () => {
    setShowSuccess(false);
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
    } else {
      navigation?.getParent?.()?.goBack?.();
    }
  };

  const onEmailLogin = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await signInWithEmail({ email, password });
      if (!result.success) throw new Error(result.error);
      Haptics.success();
      setShowSuccess(true);
    } catch (e) {
      Haptics.error();
      setError(toErrorMessage(e, 'Login failed'));
    } finally {
      setBusy(false);
    }
  };

  const onGoogleLogin = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await signInWithGoogle();
      if (!result.success) throw new Error(result.error);
      Haptics.success();
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
      <View style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Image
            source={require('../../../assets/icon.png')}
            style={styles.logoImg}
            resizeMode="contain"
          />
          <Text style={styles.brand}>{BRAND.name}</Text>
          <Text style={styles.tagline}>{BRAND.tagline}</Text>

          <GlassCard style={{ marginTop: SPACING.lg }} glow>
            <GlassInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@email.com"
            />
            <GlassInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
            />
            <GlassButton title="Log In" onPress={onEmailLogin} loading={busy} />
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>
            <GoogleSignInButton onPress={onGoogleLogin} loading={busy} />

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </GlassCard>

          <Pressable
            onPress={() => {
              Haptics.select();
              navigation?.navigate?.('SignUp');
            }}
            style={{ marginTop: SPACING.lg }}
          >
            <Text style={styles.link}>New here? Create an account</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.tap();
              if (navigation?.canGoBack?.()) navigation.goBack();
              else navigation?.getParent?.()?.goBack?.();
            }}
            style={{ marginTop: 14 }}
          >
            <Text style={[styles.link, { color: COLORS.muted }]}>
              Continue browsing without login
            </Text>
          </Pressable>

          <BrandFooter />
        </ScrollView>
      </KeyboardAvoidingView>

      <LottieSuccess
        visible={showSuccess}
        title="You're logged in!"
        subtitle={`${BRAND.tagline}\nYour smart asset vault is ready.`}
        duration={3500}
        onFinish={finish}
      />
      </View>
    </Screen>
  );
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
      const result = await signUpWithEmail({ name, email, password });
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
          <Text style={styles.tagline}>Create your vault in seconds</Text>

          <GlassCard style={{ marginTop: SPACING.lg }} glow>
            <GlassInput label="Full Name" value={name} onChangeText={setName} placeholder="Ashutosh" />
            <GlassInput
              label="Email"
              value={email}
              onChangeText={setEmail}
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
            <GlassButton
              title="Create Account"
              onPress={() => setConfirmVisible(true)}
              loading={busy}
            />
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
        duration={3500}
        onFinish={() => {
          setShowSuccess(false);
          if (navigation?.canGoBack?.()) navigation.goBack();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, paddingTop: 56 },
  logoImg: { width: 88, height: 88, alignSelf: 'center', marginBottom: 8 },
  brand: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 8,
  },
  tagline: {
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 12,
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

export default LoginScreen;
