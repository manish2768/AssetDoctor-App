/**
 * Asset Doctor — Invite Family Member Modal
 * 
 * Generates secure, one-time invitation tokens with WhatsApp Share, SMS, and Link Copy.
 * Never leaks sensitive asset data into the invite payload.
 */

import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Share,
  ActivityIndicator,
} from 'react-native';
import { useFamilyVault } from '../../context/FamilyVaultContext';
import { FAMILY_ROLES } from '../../services/family/FamilyVaultService';
import { COLORS } from '../../theme/branding';
import { Haptics } from '../../services/haptics';

export function InviteMemberModal({ visible, onClose }) {
  const { vaultData, inviteMember } = useFamilyVault();
  const [role, setRole] = useState(FAMILY_ROLES.MEMBER);
  const [recipientContact, setRecipientContact] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdInvite, setCreatedInvite] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  const handleGenerateInvite = async () => {
    Haptics.tap();
    setLoading(true);
    setError(null);
    try {
      const res = await inviteMember({
        role,
        recipientEmail: recipientContact.includes('@') ? recipientContact.trim() : '',
        recipientPhone: !recipientContact.includes('@') ? recipientContact.trim() : '',
      });
      setCreatedInvite(res);
      Haptics.success();
    } catch (err) {
      Haptics.error();
      setError(err?.message || 'Failed to create invite');
    } finally {
      setLoading(false);
    }
  };

  const getShareMessage = () => {
    const code = createdInvite?.inviteCode || '';
    const vName = vaultData?.name || 'Family Vault';
    return `Join our ${vName} on Asset Doctor to protect and manage our family vehicles and assets together.\n\nInvite Code: ${code}\nDownload: https://assetdoctor.app/invite?code=${code}`;
  };

  const handleShareWhatsApp = async () => {
    Haptics.tap();
    try {
      await Share.share({
        message: getShareMessage(),
        title: `Join ${vaultData?.name || 'Family Vault'}`,
      });
    } catch (err) {
      console.warn('Share error:', err);
    }
  };

  const handleCopyCode = async () => {
    Haptics.tap();
    if (createdInvite?.inviteCode) {
      try {
        await Share.share({
          message: createdInvite.inviteCode,
          title: 'Invite Code',
        });
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        /* ignore */
      }
    }
  };

  const handleResetAndClose = () => {
    setCreatedInvite(null);
    setRecipientContact('');
    setCopied(false);
    setError(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleResetAndClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>Invite Family Member</Text>
            <Text style={styles.subtitle}>
              Collaborate on {vaultData?.name || 'your Family Vault'}
            </Text>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {!createdInvite ? (
            <View>
              {/* Role Selection */}
              <Text style={styles.label}>ASSIGN ROLE</Text>
              <View style={styles.roleContainer}>
                {[
                  { r: FAMILY_ROLES.MEMBER, desc: 'Can view shared assets & log fuel/service' },
                  { r: FAMILY_ROLES.ADMIN, desc: 'Can manage shared assets & invite members' },
                  { r: FAMILY_ROLES.VIEWER, desc: 'Read-only access to permitted assets' },
                ].map(({ r, desc }) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.roleCard, role === r && styles.roleCardActive]}
                    onPress={() => {
                      Haptics.tap();
                      setRole(r);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.roleHeader}>
                      <Text style={[styles.roleTitle, role === r && styles.roleTitleActive]}>
                        {r}
                      </Text>
                      <View style={[styles.radio, role === r && styles.radioActive]} />
                    </View>
                    <Text style={styles.roleDesc}>{desc}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Optional Phone / Email */}
              <Text style={styles.label}>RECIPIENT (OPTIONAL)</Text>
              <TextInput
                style={styles.input}
                placeholder="Phone number or Email"
                placeholderTextColor="#64748B"
                value={recipientContact}
                onChangeText={setRecipientContact}
              />

              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={handleResetAndClose}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.generateBtn}
                  onPress={handleGenerateInvite}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color="#0F172A" />
                  ) : (
                    <Text style={styles.generateText}>Generate Invite</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.inviteSuccessContainer}>
              <View style={styles.codeBox}>
                <Text style={styles.codeLabel}>ONE-TIME INVITE CODE</Text>
                <Text style={styles.codeValue}>{createdInvite.inviteCode}</Text>
                <Text style={styles.codeSub}>Expires in 7 days</Text>
              </View>

              <View style={styles.shareButtonsRow}>
                <TouchableOpacity
                  style={styles.whatsappBtn}
                  onPress={handleShareWhatsApp}
                  activeOpacity={0.8}
                >
                  <Text style={styles.shareBtnIcon}>💬</Text>
                  <Text style={styles.whatsappBtnText}>Share on WhatsApp / SMS</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.copyBtn}
                  onPress={handleCopyCode}
                  activeOpacity={0.7}
                >
                  <Text style={styles.copyBtnText}>{copied ? '✓ Copied!' : '📋 Copy Code'}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.doneBtn}
                onPress={handleResetAndClose}
                activeOpacity={0.8}
              >
                <Text style={styles.doneText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 36,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#334155',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
    fontWeight: '600',
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
  },
  roleContainer: {
    gap: 8,
    marginBottom: 14,
  },
  roleCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  roleCardActive: {
    borderColor: '#14B8A6',
    backgroundColor: 'rgba(20, 184, 166, 0.08)',
  },
  roleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  roleTitleActive: {
    color: '#14B8A6',
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#64748B',
  },
  radioActive: {
    borderColor: '#14B8A6',
    backgroundColor: '#14B8A6',
  },
  roleDesc: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  input: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#94A3B8',
  },
  generateBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#14B8A6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  inviteSuccessContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  codeBox: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 28,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#14B8A6',
    width: '100%',
    marginBottom: 18,
  },
  codeLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
  },
  codeValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#14B8A6',
    letterSpacing: 4,
    marginVertical: 6,
  },
  codeSub: {
    fontSize: 12,
    color: '#64748B',
  },
  shareButtonsRow: {
    width: '100%',
    gap: 10,
    marginBottom: 16,
  },
  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22C55E',
    paddingVertical: 14,
    borderRadius: 14,
  },
  shareBtnIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  whatsappBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  copyBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  copyBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#38BDF8',
  },
  doneBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#334155',
    alignItems: 'center',
  },
  doneText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default InviteMemberModal;
