/**
 * Asset Doctor — Family Members Management Screen
 * 
 * Lists members, their roles, and allows Owner/Admin to manage roles or remove members.
 * Strictly prevents removing the Vault Owner.
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  Alert,
} from 'react-native';
import { useFamilyVault } from '../../context/FamilyVaultContext';
import { FAMILY_ROLES } from '../../services/family/FamilyVaultService';
import { COLORS } from '../../theme/branding';
import { Haptics } from '../../services/haptics';
import { InviteMemberModal } from './InviteMemberModal';

export function FamilyMembersScreen({ navigation }) {
  const {
    vaultData,
    members,
    currentRole,
    isOwner,
    isAdmin,
    updateRole,
    removeMember,
    transferOwnership,
  } = useFamilyVault();

  const [inviteModalVisible, setInviteModalVisible] = useState(false);

  const handleRoleChange = (member) => {
    if (!isOwner) {
      Alert.alert('Permission Denied', 'Only the Vault Owner can change member roles.');
      return;
    }
    if (member.role === FAMILY_ROLES.OWNER) {
      Alert.alert('Vault Owner', 'Cannot change Owner role without transferring vault ownership.');
      return;
    }

    Haptics.tap();
    Alert.alert(
      `Change Role for ${member.displayName}`,
      'Select a new role for this member:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Set as Admin',
          onPress: () => updateRole(member.uid, FAMILY_ROLES.ADMIN),
        },
        {
          text: 'Set as Member',
          onPress: () => updateRole(member.uid, FAMILY_ROLES.MEMBER),
        },
        {
          text: 'Set as Viewer (Read-only)',
          onPress: () => updateRole(member.uid, FAMILY_ROLES.VIEWER),
        },
      ]
    );
  };

  const handleRemoveMember = (member) => {
    if (member.role === FAMILY_ROLES.OWNER) {
      Alert.alert('Action Blocked', 'The Vault Owner cannot be removed.');
      return;
    }

    Haptics.tap();
    Alert.alert(
      'Remove Family Member',
      `Are you sure you want to remove ${member.displayName} from ${vaultData?.name || 'this vault'}? They will immediately lose access to shared assets.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeMember(member.uid);
            } catch (err) {
              Alert.alert('Error', err?.message || 'Failed to remove member');
            }
          },
        },
      ]
    );
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
        <View>
          <Text style={styles.title}>Family Members</Text>
          <Text style={styles.subtitle}>{vaultData?.name || 'Family Vault'}</Text>
        </View>
        {isAdmin ? (
          <TouchableOpacity
            style={styles.inviteHeaderBtn}
            onPress={() => setInviteModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.inviteHeaderBtnText}>+ Invite</Text>
          </TouchableOpacity>
        ) : <View style={{ width: 60 }} />}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionLabel}>MEMBERS ({members.length})</Text>

        {members.map((m) => {
          const isMemberOwner = m.role === FAMILY_ROLES.OWNER;
          const isMemberAdmin = m.role === FAMILY_ROLES.ADMIN;
          const isMemberViewer = m.role === FAMILY_ROLES.VIEWER;

          const roleColor = isMemberOwner
            ? '#F59E0B'
            : isMemberAdmin
              ? '#38BDF8'
              : isMemberViewer
                ? '#94A3B8'
                : '#14B8A6';

          return (
            <View key={m.uid} style={styles.memberCard}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>
                  {(m.displayName || 'U')[0].toUpperCase()}
                </Text>
              </View>

              <View style={styles.memberDetails}>
                <View style={styles.nameRow}>
                  <Text style={styles.memberName}>{m.displayName || 'Family Member'}</Text>
                  <View style={[styles.rolePill, { borderColor: roleColor }]}>
                    <Text style={[styles.rolePillText, { color: roleColor }]}>
                      {m.role}
                    </Text>
                  </View>
                </View>
                {m.email ? <Text style={styles.contactText}>{m.email}</Text> : null}
                {m.phoneNumber ? <Text style={styles.contactText}>{m.phoneNumber}</Text> : null}
              </View>

              {isOwner && !isMemberOwner ? (
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={styles.roleBtn}
                    onPress={() => handleRoleChange(m)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.roleBtnText}>Role</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => handleRemoveMember(m)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      <InviteMemberModal
        visible={inviteModalVisible}
        onClose={() => setInviteModalVisible(false)}
      />
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
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
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
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 2,
  },
  inviteHeaderBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#14B8A6',
  },
  inviteHeaderBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  memberDetails: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
    marginRight: 8,
  },
  rolePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  rolePillText: {
    fontSize: 9,
    fontWeight: '800',
  },
  contactText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  roleBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#EF4444',
  },
});

export default FamilyMembersScreen;
