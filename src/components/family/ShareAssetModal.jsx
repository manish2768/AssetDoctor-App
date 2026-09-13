/**
 * Asset Doctor — Share Asset with Family Modal
 * 
 * Allows an asset owner to choose which family members to share their asset with:
 * - ALL FAMILY MEMBERS
 * - or Selected Members only
 * 
 * Shows transparently what metadata and documents will be shared.
 */

import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useFamilyVault } from '../../context/FamilyVaultContext';
import { ASSET_ACCESS_LEVEL } from '../../services/family/FamilyVaultService';
import { COLORS } from '../../theme/branding';
import { Haptics } from '../../services/haptics';

export function ShareAssetModal({
  visible,
  onClose,
  asset,
  onSharedSuccess,
}) {
  const { vaultData, members, shareAsset, isOwner, isAdmin } = useFamilyVault();
  const [accessLevel, setAccessLevel] = useState(ASSET_ACCESS_LEVEL.ALL_MEMBERS);
  const [selectedMemberUids, setSelectedMemberUids] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!asset) return null;

  const toggleMember = (uid) => {
    Haptics.tap();
    setSelectedMemberUids((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleShare = async () => {
    Haptics.tap();
    setLoading(true);
    setError(null);
    try {
      await shareAsset(asset, {
        accessLevel,
        sharedWithMemberUids:
          accessLevel === ASSET_ACCESS_LEVEL.ALL_MEMBERS
            ? members.map((m) => m.uid)
            : selectedMemberUids,
      });
      Haptics.success();
      if (onSharedSuccess) onSharedSuccess();
      onClose();
    } catch (err) {
      Haptics.error();
      setError(err?.message || 'Failed to share asset');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>Share with Family</Text>
            <Text style={styles.subtitle}>
              Share <Text style={styles.highlight}>{asset.assetName}</Text> with{' '}
              {vaultData?.name || 'your Family Vault'}
            </Text>
          </View>

          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Sharing Scope Selection */}
          <View style={styles.scopeContainer}>
            <TouchableOpacity
              style={[
                styles.scopeCard,
                accessLevel === ASSET_ACCESS_LEVEL.ALL_MEMBERS && styles.scopeCardSelected,
              ]}
              onPress={() => {
                Haptics.tap();
                setAccessLevel(ASSET_ACCESS_LEVEL.ALL_MEMBERS);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.scopeIcon}>👨‍👩‍👧‍👦</Text>
              <View style={styles.scopeInfo}>
                <Text style={styles.scopeTitle}>All Family Members</Text>
                <Text style={styles.scopeDesc}>Everyone in {vaultData?.name || 'this vault'} can view</Text>
              </View>
              <View style={[styles.radioCircle, accessLevel === ASSET_ACCESS_LEVEL.ALL_MEMBERS && styles.radioCircleActive]} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.scopeCard,
                accessLevel === ASSET_ACCESS_LEVEL.RESTRICTED && styles.scopeCardSelected,
              ]}
              onPress={() => {
                Haptics.tap();
                setAccessLevel(ASSET_ACCESS_LEVEL.RESTRICTED);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.scopeIcon}>🔒</Text>
              <View style={styles.scopeInfo}>
                <Text style={styles.scopeTitle}>Selected Members Only</Text>
                <Text style={styles.scopeDesc}>Choose specific family members</Text>
              </View>
              <View style={[styles.radioCircle, accessLevel === ASSET_ACCESS_LEVEL.RESTRICTED && styles.radioCircleActive]} />
            </TouchableOpacity>
          </View>

          {/* Member Picker when Restricted */}
          {accessLevel === ASSET_ACCESS_LEVEL.RESTRICTED ? (
            <View style={styles.memberPickerContainer}>
              <Text style={styles.sectionLabel}>SELECT MEMBERS</Text>
              <ScrollView style={styles.memberList} showsVerticalScrollIndicator={false}>
                {members.map((m) => {
                  const isChecked = selectedMemberUids.includes(m.uid);
                  return (
                    <TouchableOpacity
                      key={m.uid}
                      style={[styles.memberRow, isChecked && styles.memberRowSelected]}
                      onPress={() => toggleMember(m.uid)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.memberAvatar}>
                        <Text style={styles.avatarLetter}>
                          {(m.displayName || 'U')[0].toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.memberMeta}>
                        <Text style={styles.memberName}>{m.displayName}</Text>
                        <Text style={styles.memberRole}>{m.role}</Text>
                      </View>
                      <View style={[styles.checkbox, isChecked && styles.checkboxActive]}>
                        {isChecked ? <Text style={styles.checkmark}>✓</Text> : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          {/* Transparent sharing guarantee badge */}
          <View style={styles.guaranteeBox}>
            <Text style={styles.guaranteeText}>
              🛡️ Canonical Asset ID ({asset.assetId}) remains locked to your personal vault. You can revoke sharing anytime.
            </Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.shareBtn}
              onPress={handleShare}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#0F172A" />
              ) : (
                <Text style={styles.shareText}>Confirm & Share</Text>
              )}
            </TouchableOpacity>
          </View>
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
    maxHeight: '85%',
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
  highlight: {
    color: '#14B8A6',
    fontWeight: '700',
  },
  errorBanner: {
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
  scopeContainer: {
    gap: 10,
    marginBottom: 16,
  },
  scopeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  scopeCardSelected: {
    borderColor: '#14B8A6',
    backgroundColor: 'rgba(20, 184, 166, 0.08)',
  },
  scopeIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  scopeInfo: {
    flex: 1,
  },
  scopeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scopeDesc: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#64748B',
  },
  radioCircleActive: {
    borderColor: '#14B8A6',
    backgroundColor: '#14B8A6',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  memberPickerContainer: {
    marginBottom: 16,
  },
  memberList: {
    maxHeight: 160,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  memberRowSelected: {
    borderColor: '#14B8A6',
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarLetter: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  memberMeta: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  memberRole: {
    fontSize: 11,
    color: '#94A3B8',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#64748B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    borderColor: '#14B8A6',
    backgroundColor: '#14B8A6',
  },
  checkmark: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '900',
  },
  guaranteeBox: {
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    padding: 10,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
  },
  guaranteeText: {
    fontSize: 11,
    color: '#38BDF8',
    lineHeight: 16,
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
  shareBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#14B8A6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
});

export default ShareAssetModal;
