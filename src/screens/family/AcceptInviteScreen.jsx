/**
 * Asset Doctor — Accept Family Invitation Screen
 * 
 * Validates one-time invite code and joins user atomically to Family Vault.
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFamilyVault } from '../../context/FamilyVaultContext';
import { useAuth } from '../../context/AuthProvider';
import { COLORS } from '../../theme/branding';
import { Haptics } from '../../services/haptics';

export function AcceptInviteScreen({ navigation, route }) {
  const initialCode = route?.params?.code || '';
  const initialVaultId = route?.params?.vaultId || '';
  const initialInvId = route?.params?.invitationId || '';

  const [inviteCode, setInviteCode] = useState(initialCode);
  const [vaultId, setVaultId] = useState(initialVaultId);
  const [invitationId, setInvitationId] = useState(initialInvId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { acceptInvite } = useFamilyVault();
  const { isAuthenticated } = useAuth();

  const handleAccept = async () => {
    if (!isAuthenticated) {
      Alert.alert('Sign In Required', 'Please sign in or create an account to join this Family Vault.');
      return;
    }

    if (!vaultId || !invitationId) {
      setError('Please provide a valid invitation link or QR code.');
      return;
    }

    Haptics.tap();
    setLoading(true);
    setError(null);
    try {
      await acceptInvite(vaultId, invitationId);
      Haptics.success();
      Alert.alert(
        'Welcome to the Family Vault!',
        'You are now connected to your family assets.',
        [
          {
            text: 'Open Vault',
            onPress: () => navigation?.replace?.('FamilyVaultScreen'),
          },
        ]
      );
    } catch (err) {
      Haptics.error();
      setError(err?.message || 'Failed to accept invitation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation?.goBack?.()}
          activeOpacity={0.7}
        >
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Join Family Vault</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>👨‍👩‍👧‍👦</Text>
        </View>

        <Text style={styles.heading}>Protect Assets Together</Text>
        <Text style={styles.subtitle}>
          Enter the invitation details or code shared by your family member.
        </Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.inputLabel}>INVITE CODE</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 7F29A1"
            placeholderTextColor="#64748B"
            value={inviteCode}
            onChangeText={(t) => setInviteCode(t.toUpperCase())}
            maxLength={10}
            autoCapitalize="characters"
          />
        </View>

        <TouchableOpacity
          style={styles.submitBtn}
          onPress={handleAccept}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#0F172A" />
          ) : (
            <Text style={styles.submitText}>Accept & Join Vault</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 20,
    color: '#F8FAFC',
    fontWeight: '700',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(20, 184, 166, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  icon: {
    fontSize: 40,
  },
  heading: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    padding: 12,
    borderRadius: 12,
    width: '100%',
    marginBottom: 16,
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  submitBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#14B8A6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
});

export default AcceptInviteScreen;
