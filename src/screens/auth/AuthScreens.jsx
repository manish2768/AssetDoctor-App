/**
 * Phase 1 — Auth screens (Email / Google / WhatsApp OTP)
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
import { normalizeWhatsAppPhone } from '../../utils/profileSetup';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function AuthModeTabs({ mode, onChange }) {
  return (
    <View style={styles.tabRow}>
      {[
        { id: 'email', label: 'Email' },
        { id: 'whatsapp', label: 'WhatsApp OTP' },
      ].map((tab) => {
        const active = mode === tab.id;
        return (
          <Pressable
            key={tab.id}
            onPress={() => {
              Haptics.select();
              onChange(tab.id);
            }}
            style={[styles.tab, active && styles.tabActive]}
          >
            <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function LoginScreen({ navigation }) {
  const { signInWithEmail, signInWithGoogle, sendOTP, verifyOTP } = useAuth();
  const [mode, setMode] = useState('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSession, setOtpSession] = useState(null);
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const finish = () => {
    setShowSuccess(false);
    if (navigation?.canGoBack?.()) navigation.goBack();
    else navigation?.getParent?.()?.goBack?.();
  };

  const resetOtpFlow = () => {
    setOtp('');
    setOtpSession(null);
    setOtpSent(false);
    setError('');
  };

  const onEmailLogin = async () => {
    setBusy(true);
    setError('');
    try {
      const cleanEmail = normalizeEmail(email);
      setEmail(cleanEmail);
      const result = await signInWithEmail({
        email: cleanEmail,
        password: String(password || '').trim(),
      });
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

  const onSendOtp = async () => {
    setBusy(true);
    setError('');
    setShowSuccess(false);
    try {
      const cleanPhone = normalizeWhatsAppPhone(phone);
      setPhone(cleanPhone);
      // WhatsApp tab → Cloud Function sendWhatsAppOtp only (never Firebase SMS)
      const result = await sendOTP(cleanPhone, { channel: 'whatsapp' });
      if (!result.success) throw new Error(result.error);
      setOtpSession(
        result.confirmation || { channel: 'whatsapp', phone: result.phone || cleanPhone },
      );
      setOtp('');
      setOtpSent(true);
      Haptics.success();
    } catch (e) {
      Haptics.error();
      setOtpSent(false);
      setOtpSession(null);
      setError(toErrorMessage(e, 'Could not send WhatsApp OTP'));
    } finally {
      setBusy(false);
    }
  };

  const onVerifyOtp = async () => {
    setBusy(true);
    setError('');
    setShowSuccess(false);
    try {
      if (!otpSession || otpSession.channel !== 'whatsapp' || !otpSession.phone) {
        throw new Error('OTP session expired. Please request a new code.');
      }
      const code = String(otp || '').trim();
      if (!/^\d{6}$/.test(code)) {
        throw new Error('Enter the 6-digit OTP');
      }

      // Must succeed via verifyWhatsAppOtp before any login UI / navigation
      const result = await verifyOTP(otpSession, code, {
        name: String(fullName || '').trim(),
      });
      if (!result.success || !result.user) {
        throw new Error(result.error || 'Invalid OTP');
      }

      Haptics.success();
      setShowSuccess(true);
    } catch (e) {
      Haptics.error();
      setShowSuccess(false);
      setOtp('');
      setError(toErrorMessage(e, 'Invalid OTP — please try again'));
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
            <View style={styles.heroCard}>
              <Image
                source={require('../../../assets/welcome-vault.png')}
                style={styles.heroArt}
                resizeMode="contain"
              />
            </View>
            <Image source={require('../../../assets/icon.png')} style={styles.logoImg} resizeMode="contain" />
            <Text style={styles.brand}>{BRAND.name}</Text>
            <Text style={styles.welcomeLine}>Welcome back</Text>
            <Text style={styles.tagline}>{BRAND.tagline}</Text>

            <GlassCard style={{ marginTop: SPACING.lg }} glow>
              <AuthModeTabs
                mode={mode}
                onChange={(next) => {
                  setMode(next);
                  resetOtpFlow();
                }}
              />

              {mode === 'email' ? (
                <>
                  <GlassInput
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    onBlur={() => setEmail(normalizeEmail(email))}
                    autoCapitalize="none"
                    autoCorrect={false}
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
                </>
              ) : (
                <>
                  <Text style={styles.waHint}>
                    We&apos;ll send a 6-digit code to your WhatsApp via Meta Cloud API.
                  </Text>
                  <GlassInput
                    label="WhatsApp Mobile"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    placeholder="+91 98765 43210"
                    editable={!otpSent}
                  />
                  {!otpSent ? (
                    <GlassButton title="Send WhatsApp OTP" onPress={onSendOtp} loading={busy} />
                  ) : (
                    <>
                      <GlassInput
                        label="Full Name (first login)"
                        value={fullName}
                        onChangeText={setFullName}
                        placeholder="Your name"
                        autoCapitalize="words"
                      />
                      <Text style={styles.waHint}>
                        Optional for returning users. New accounts use this name (or your phone if left blank) — never a fake default.
                      </Text>
                      <GlassInput
                        label="6-digit OTP"
                        value={otp}
                        onChangeText={setOtp}
                        keyboardType="number-pad"
                        maxLength={6}
                        placeholder="123456"
                      />
                      <GlassButton title="Verify & Log In" onPress={onVerifyOtp} loading={busy} />
                      <Pressable onPress={resetOtpFlow} style={{ marginTop: 10 }}>
                        <Text style={styles.link}>Change number / resend</Text>
                      </Pressable>
                    </>
                  )}
                </>
              )}

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
          duration={1600}
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
  heroCard: {
    width: 168,
    height: 168,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(13,148,136,0.16)',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 14,
    shadowColor: '#0A1628',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  heroArt: { width: 152, height: 152 },
  logoImg: { width: 56, height: 56, alignSelf: 'center', marginBottom: 6 },
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
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: SPACING.md,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  tabActive: {
    borderColor: COLORS.emerald,
    backgroundColor: COLORS.successSoft,
  },
  tabText: { color: COLORS.muted, fontWeight: '700', fontSize: 13 },
  tabTextActive: { color: COLORS.emerald },
  waHint: { color: COLORS.muted, fontSize: 12, lineHeight: 17, marginBottom: 8 },
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
