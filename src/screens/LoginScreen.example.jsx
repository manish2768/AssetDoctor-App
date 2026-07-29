/**
 * Example usage — Google + Phone OTP screens
 * Wire these into your React Native navigation once Expo/RN is scaffolded.
 */

import React, { useState } from 'react';
import { View, TextInput, Pressable, Text, ActivityIndicator } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

import { useAuth } from '../context/AuthProvider';
import { Haptics } from '../services/haptics';

export function LoginScreen() {
  const { signInWithGoogle, sendOTP, verifyOTP, loading } = useAuth();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const onGooglePress = async () => {
    Haptics.tap();
    setBusy(true);
    setMessage('');
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const result = await GoogleSignin.signIn();
      const idToken = result?.data?.idToken || result?.idToken;
      const authResult = await signInWithGoogle(idToken);
      if (!authResult.success) setMessage(authResult.error);
    } catch (e) {
      Haptics.error();
      setMessage(e?.message || 'Google Sign-In cancelled');
    } finally {
      setBusy(false);
    }
  };

  const onSendOtp = async () => {
    setBusy(true);
    setMessage('');
    const result = await sendOTP(phone);
    if (result.success) {
      setConfirmation(result.confirmation);
      setMessage('OTP sent via SMS');
    } else {
      setMessage(result.error);
    }
    setBusy(false);
  };

  const onVerifyOtp = async () => {
    setBusy(true);
    setMessage('');
    const result = await verifyOTP(confirmation, otp);
    if (!result.success) setMessage(result.error);
    setBusy(false);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 12 }}>
      <Pressable
        onPress={onGooglePress}
        disabled={busy}
        style={{ backgroundColor: '#4F46E5', padding: 14, borderRadius: 12 }}
      >
        <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700' }}>
          Continue with Google
        </Text>
      </Pressable>

      <TextInput
        value={phone}
        onChangeText={setPhone}
        placeholder="+91 9876543210"
        keyboardType="phone-pad"
        style={{ borderWidth: 1, borderColor: '#333', borderRadius: 12, padding: 12, color: '#fff' }}
        placeholderTextColor="#888"
      />

      <Pressable
        onPress={onSendOtp}
        disabled={busy}
        style={{ backgroundColor: '#7C3AED', padding: 14, borderRadius: 12 }}
      >
        <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700' }}>Send OTP</Text>
      </Pressable>

      {confirmation ? (
        <>
          <TextInput
            value={otp}
            onChangeText={setOtp}
            placeholder="6-digit OTP"
            keyboardType="number-pad"
            maxLength={6}
            style={{ borderWidth: 1, borderColor: '#333', borderRadius: 12, padding: 12, color: '#fff' }}
            placeholderTextColor="#888"
          />
          <Pressable
            onPress={onVerifyOtp}
            disabled={busy}
            style={{ backgroundColor: '#059669', padding: 14, borderRadius: 12 }}
          >
            <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700' }}>Verify OTP</Text>
          </Pressable>
        </>
      ) : null}

      {message ? <Text style={{ color: '#F87171', textAlign: 'center' }}>{message}</Text> : null}
      {busy ? <ActivityIndicator color="#818CF8" /> : null}
    </View>
  );
}
