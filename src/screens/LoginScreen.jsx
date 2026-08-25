/**
 * Multi-option Login — Google · Phone OTP · Email · Guest.
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
  Modal,
} from 'react-native';

import { useAuth } from '../context/AuthProvider';
import { useUiFeedback } from '../context/UiFeedbackProvider';
import { AppLogo } from '../components/AppLogo';
import { LottieSuccess } from '../components/LottieSuccess';
import {
  Screen,
  GlassCard,
  GlassInput,
  GlassButton,
  BrandFooter,
} from '../components/ui/Glass';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { BRAND, COLORS, SPACING } from '../theme/branding';
import { Haptics } from '../services/haptics';
import { toErrorMessage } from '../utils/errors';
import { normalizePhone } from '../utils/profileSetup';
import { goHomeDashboard } from '../navigation/navActions';
import { resetToMainApp } from '../navigation/NavigationService';
import { SMS_OTP_TEMPLATE } from '../constants/smsOtp';

function normalizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

export function LoginScreen({ navigation }) {
  const ui = useUiFeedback();
  const {
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    sendOTP,
    verifyOTP,
    enterGuestBrowse,
  } = useAuth();

  const [method, setMethod] = useState('choose'); // choose | email | phone
  const [emailMode, setEmailMode] = useState('login'); // login | register
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSession, setOtpSession] = useState(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otpModal, setOtpModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const finish = () => {
    setShowSuccess(false);
    setOtpModal(false);
    // AuthSwitch remounts MainApp when user is set; hard-reset Home as belt-and-suspenders
    try {
      resetToMainApp();
    } catch {
      goHomeDashboard();
    }
  };

  const enterGuest = () => {
    Haptics.select();
    try {
      enterGuestBrowse?.();
    } catch {
      /* ignore */
    }
    try {
      resetToMainApp();
    } catch {
      goHomeDashboard();
    }
  };

  const showAuthError = (message, title = 'Sign in') => {
    const msg = String(message || 'Something went wrong');
    setError(msg);
    ui.error(title, msg);
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
      showAuthError(toErrorMessage(e, 'Google Sign-In failed'), 'Google Sign-In');
    } finally {
      setBusy(false);
    }
  };

  const onEmailSubmit = async () => {
    setBusy(true);
    setError('');
    try {
      const cleanEmail = normalizeEmail(email);
      setEmail(cleanEmail);
      const cleanPassword = String(password || '').trim();
      if (!cleanEmail || cleanPassword.length < 6) {
        throw new Error('Enter a valid email and password (min 6 characters).');
      }

      let result;
      if (emailMode === 'register') {
        if (!String(name || '').trim()) {
          throw new Error('Full name is required to create an account.');
        }
        result = await signUpWithEmail({
          name: String(name).trim(),
          email: cleanEmail,
          password: cleanPassword,
        });
      } else {
        result = await signInWithEmail({ email: cleanEmail, password: cleanPassword });
      }
      if (!result.success) throw new Error(result.error);
      Haptics.success();
      setShowSuccess(true);
    } catch (e) {
      Haptics.error();
      showAuthError(
        toErrorMessage(e, emailMode === 'register' ? 'Sign up failed' : 'Login failed'),
        emailMode === 'register' ? 'Create account' : 'Email login',
      );
    } finally {
      setBusy(false);
    }
  };

  const onSendOtp = async () => {
    setBusy(true);
    setError('');
    try {
      const cleanPhone = normalizePhone(phone);
      setPhone(cleanPhone);
      // Always cold phone auth — never link / never "already registered" gate
      const result = await sendOTP(cleanPhone, { mode: 'signIn' });
      if (!result.success) throw new Error(result.error);
      if (!result.confirmation?.confirm) {
        throw new Error('SMS OTP session missing. Please try again.');
      }
      setOtpSession(result.confirmation);
      setOtp('');
      setOtpSent(true);
      setOtpModal(true);
      Haptics.success();
    } catch (e) {
      Haptics.error();
      setOtpSent(false);
      setOtpSession(null);
      showAuthError(toErrorMessage(e, 'Could not send SMS OTP'), 'Phone OTP');
    } finally {
      setBusy(false);
    }
  };

  const onVerifyOtp = async () => {
    setBusy(true);
    setError('');
    try {
      if (!otpSession) throw new Error('OTP session expired. Please request a new code.');
      const code = String(otp || '').trim();
      if (!/^\d{6}$/.test(code)) throw new Error('Enter the 6-digit OTP');
      const result = await verifyOTP(otpSession, code, {
        name: String(name || '').trim(),
      });
      if (!result.success || !result.user) {
        throw new Error(result.error || 'Invalid OTP');
      }
      Haptics.success();
      setOtpModal(false);
      setShowSuccess(true);
    } catch (e) {
      Haptics.error();
      setOtp('');
      showAuthError(toErrorMessage(e, 'Invalid OTP — please try again'), 'Phone OTP');
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
            <View style={styles.logoWrap}>
              <AppLogo size={92} />
            </View>
            <Text style={styles.brand}>{BRAND.name}</Text>
            <Text style={styles.welcome}>Welcome</Text>
            <Text style={styles.tagline}>{BRAND.tagline}</Text>

            {method === 'choose' ? (
              <GlassCard style={{ marginTop: SPACING.lg }} glow>
                <GoogleSignInButton
                  onPress={onGoogleLogin}
                  loading={busy}
                  title="Continue with Google"
                />

                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>

                <GlassButton
                  title="Continue with Mobile Number"
                  onPress={() => {
                    Haptics.select();
                    setMethod('phone');
                    setError('');
                  }}
                  disabled={busy}
                />
                <GlassButton
                  title="Email & Password"
                  variant="ghost"
                  style={{ marginTop: 10 }}
                  onPress={() => {
                    Haptics.select();
                    setMethod('email');
                    setError('');
                  }}
                  disabled={busy}
                />
                {error ? <Text style={styles.error}>{error}</Text> : null}
              </GlassCard>
            ) : null}

            {method === 'email' ? (
              <GlassCard style={{ marginTop: SPACING.lg }} glow>
                <View style={styles.toggleRow}>
                  {[
                    { id: 'login', label: 'Log in' },
                    { id: 'register', label: 'Register' },
                  ].map((tab) => {
                    const on = emailMode === tab.id;
                    return (
                      <Pressable
                        key={tab.id}
                        onPress={() => {
                          Haptics.select();
                          setEmailMode(tab.id);
                          setError('');
                        }}
                        style={[styles.toggleChip, on && styles.toggleChipOn]}
                      >
                        <Text style={[styles.toggleText, on && styles.toggleTextOn]}>
                          {tab.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {emailMode === 'register' ? (
                  <GlassInput
                    label="Full Name"
                    value={name}
                    onChangeText={setName}
                    placeholder="Your name"
                    autoCapitalize="words"
                  />
                ) : null}
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
                  placeholder={emailMode === 'register' ? 'Min 6 characters' : '••••••••'}
                />
                <GlassButton
                  title={emailMode === 'register' ? 'Create account' : 'Log in'}
                  onPress={onEmailSubmit}
                  loading={busy}
                />
                <Pressable
                  onPress={() => {
                    Haptics.select();
                    setMethod('choose');
                    setError('');
                  }}
                  style={{ marginTop: 12 }}
                >
                  <Text style={styles.link}>← All sign-in options</Text>
                </Pressable>
                {error ? <Text style={styles.error}>{error}</Text> : null}
              </GlassCard>
            ) : null}

            {method === 'phone' ? (
              <GlassCard style={{ marginTop: SPACING.lg }} glow>
                <Text style={styles.hint}>{SMS_OTP_TEMPLATE.userHint}</Text>
                <GlassInput
                  label="Mobile number"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="+91 98765 43210"
                  editable={!otpSent}
                />
                <GlassInput
                  label="Full Name (optional for new accounts)"
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  autoCapitalize="words"
                />
                <GlassButton title="Send OTP" onPress={onSendOtp} loading={busy} />
                <Pressable
                  onPress={() => {
                    Haptics.select();
                    setMethod('choose');
                    setOtpSent(false);
                    setOtpSession(null);
                    setError('');
                  }}
                  style={{ marginTop: 12 }}
                >
                  <Text style={styles.link}>← All sign-in options</Text>
                </Pressable>
                {error ? <Text style={styles.error}>{error}</Text> : null}
              </GlassCard>
            ) : null}

            <Pressable onPress={enterGuest} style={styles.guestBtn}>
              <Text style={styles.guestTitle}>Skip / Guest Mode</Text>
              <Text style={styles.guestSub}>Explore the vault offline — sign in later to sync</Text>
            </Pressable>

            <BrandFooter />
          </ScrollView>
        </KeyboardAvoidingView>

        <Modal
          visible={otpModal}
          transparent
          animationType="slide"
          onRequestClose={() => setOtpModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Verify OTP</Text>
              <Text style={styles.hint}>Enter the 6-digit code sent to {phone}</Text>
              <GlassInput
                label="6-digit OTP"
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="123456"
              />
              <GlassButton title="Verify & Log In" onPress={onVerifyOtp} loading={busy} />
              <Pressable
                onPress={() => {
                  Haptics.select();
                  setOtpModal(false);
                  setOtpSent(false);
                  setOtpSession(null);
                }}
                style={{ marginTop: 12 }}
              >
                <Text style={styles.link}>Change number / resend</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

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

export default LoginScreen;

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, paddingTop: 28, paddingBottom: 40 },
  logoWrap: {
    alignSelf: 'center',
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.18)',
  },
  brand: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  welcome: {
    color: '#2563EB',
    textAlign: 'center',
    marginTop: 8,
    fontSize: 15,
    fontWeight: '800',
  },
  tagline: {
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 12,
    fontWeight: '500',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 14,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { color: COLORS.muted, fontSize: 12, fontWeight: '700' },
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  toggleChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  toggleChipOn: {
    borderColor: '#2563EB',
    backgroundColor: 'rgba(37,99,235,0.1)',
  },
  toggleText: { color: COLORS.muted, fontWeight: '700', fontSize: 13 },
  toggleTextOn: { color: '#2563EB' },
  hint: { color: COLORS.muted, fontSize: 12, lineHeight: 17, marginBottom: 8 },
  link: { color: '#2563EB', textAlign: 'center', fontWeight: '700' },
  error: { color: COLORS.rose, textAlign: 'center', marginTop: 12, fontSize: 13 },
  guestBtn: {
    marginTop: SPACING.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(15,23,42,0.02)',
  },
  guestTitle: {
    color: COLORS.text,
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 14,
  },
  guestSub: {
    color: COLORS.muted,
    textAlign: 'center',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.bgElevated || COLORS.bg,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    paddingBottom: 36,
    borderWidth: 1,
    borderColor: COLORS.borderGlow,
  },
  modalTitle: { color: COLORS.text, fontSize: 20, fontWeight: '900', marginBottom: 6 },
});
