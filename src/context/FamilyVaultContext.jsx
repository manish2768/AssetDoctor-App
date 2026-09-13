/**
 * Asset Doctor — Family Vault Context Provider
 * 
 * Manages:
 * - Active Family Vault state and memberships
 * - Real-time synchronization of shared assets, members, and activity feed
 * - High-level action dispatchers for the UI
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from './AuthProvider';
import {
  FamilyVaultService,
  FAMILY_ROLES,
} from '../services/family/FamilyVaultService';
import { FamilyActivityService } from '../services/family/FamilyActivityService';
import { Haptics } from '../services/haptics';

const FamilyVaultContext = createContext(null);

export function FamilyVaultProvider({ children }) {
  const { user, profile } = useAuth();
  const [memberships, setMemberships] = useState([]);
  const [activeVaultId, setActiveVaultId] = useState(null);
  const [vaultData, setVaultData] = useState(null);
  const [members, setMembers] = useState([]);
  const [sharedAssets, setSharedAssets] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  const currentUid = user?.uid || null;

  // 1. Listen to user's Family Vault memberships
  useEffect(() => {
    if (!currentUid) {
      setMemberships([]);
      setActiveVaultId(null);
      setVaultData(null);
      setMembers([]);
      setSharedAssets([]);
      setActivities([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = FamilyVaultService.listenToUserVaults(
      currentUid,
      (list) => {
        setMemberships(list);
        if (list.length > 0) {
          // If no active vault selected or current active vault is no longer in list, pick the first
          setActiveVaultId((prev) => {
            const stillMember = list.some((m) => m.vaultId === prev);
            return stillMember ? prev : list[0].vaultId;
          });
        } else {
          setActiveVaultId(null);
          setVaultData(null);
          setMembers([]);
          setSharedAssets([]);
          setActivities([]);
        }
        setLoading(false);
      },
      (err) => {
        console.warn('[FamilyVaultContext] Listen memberships error:', err);
        setLoading(false);
      }
    );

    return () => unsub?.();
  }, [currentUid]);

  // 2. Listen to active Family Vault details
  useEffect(() => {
    if (!activeVaultId) {
      setVaultData(null);
      setMembers([]);
      setSharedAssets([]);
      setActivities([]);
      return;
    }

    const unsubVault = FamilyVaultService.listenToVault(activeVaultId, setVaultData);
    const unsubMembers = FamilyVaultService.listenToMembers(activeVaultId, setMembers);
    const unsubAssets = FamilyVaultService.listenToSharedAssets(activeVaultId, setSharedAssets);
    const unsubActs = FamilyActivityService.listenToActivities(activeVaultId, setActivities);

    return () => {
      unsubVault?.();
      unsubMembers?.();
      unsubAssets?.();
      unsubActs?.();
    };
  }, [activeVaultId]);

  // Active member's role in the current vault
  const currentMemberRecord = useMemo(() => {
    if (!currentUid || !members.length) return null;
    return members.find((m) => m.uid === currentUid) || null;
  }, [currentUid, members]);

  const currentRole = currentMemberRecord?.role || null;
  const isOwner = currentRole === FAMILY_ROLES.OWNER;
  const isAdmin = isOwner || currentRole === FAMILY_ROLES.ADMIN;
  const isViewer = currentRole === FAMILY_ROLES.VIEWER;

  // Actions
  const createVault = useCallback(
    async (vaultName) => {
      if (!currentUid) throw new Error('Sign in required');
      const res = await FamilyVaultService.createFamilyVault(currentUid, {
        name: vaultName,
        ownerName: profile?.name || user?.displayName || 'Vault Owner',
        ownerEmail: profile?.email || user?.email || '',
        ownerPhone: profile?.phone || user?.phoneNumber || '',
        photoURL: profile?.photoURL || user?.photoURL || '',
      });
      if (res?.vaultId) {
        setActiveVaultId(res.vaultId);
      }
      return res;
    },
    [currentUid, profile, user]
  );

  const inviteMember = useCallback(
    async (options) => {
      if (!currentUid || !activeVaultId) throw new Error('Active vault required');
      return FamilyVaultService.createInvitation(currentUid, activeVaultId, {
        vaultName: vaultData?.name || 'Family Vault',
        senderName: profile?.name || user?.displayName || 'Family Member',
        ...options,
      });
    },
    [currentUid, activeVaultId, vaultData, profile, user]
  );

  const acceptInvite = useCallback(
    async (vaultId, invitationId) => {
      if (!currentUid) throw new Error('Sign in required');
      const res = await FamilyVaultService.acceptInvitation(currentUid, {
        vaultId,
        invitationId,
        displayName: profile?.name || user?.displayName || 'Family Member',
        email: profile?.email || user?.email || '',
        phoneNumber: profile?.phone || user?.phoneNumber || '',
        photoURL: profile?.photoURL || user?.photoURL || '',
      });
      setActiveVaultId(vaultId);
      return res;
    },
    [currentUid, profile, user]
  );

  const shareAsset = useCallback(
    async (canonicalAsset, options) => {
      if (!currentUid || !activeVaultId) throw new Error('Active vault required');
      return FamilyVaultService.shareAsset(currentUid, activeVaultId, canonicalAsset, options);
    },
    [currentUid, activeVaultId]
  );

  const unshareAsset = useCallback(
    async (assetId) => {
      if (!currentUid || !activeVaultId) throw new Error('Active vault required');
      return FamilyVaultService.unshareAsset(currentUid, activeVaultId, assetId);
    },
    [currentUid, activeVaultId]
  );

  const updateRole = useCallback(
    async (targetUid, newRole) => {
      if (!currentUid || !activeVaultId) throw new Error('Active vault required');
      return FamilyVaultService.updateMemberRole(currentUid, activeVaultId, targetUid, newRole);
    },
    [currentUid, activeVaultId]
  );

  const removeMember = useCallback(
    async (targetUid) => {
      if (!currentUid || !activeVaultId) throw new Error('Active vault required');
      return FamilyVaultService.removeMember(currentUid, activeVaultId, targetUid);
    },
    [currentUid, activeVaultId]
  );

  const transferOwnership = useCallback(
    async (newOwnerUid) => {
      if (!currentUid || !activeVaultId) throw new Error('Active vault required');
      return FamilyVaultService.transferOwnership(currentUid, activeVaultId, newOwnerUid);
    },
    [currentUid, activeVaultId]
  );

  const value = useMemo(
    () => ({
      hasFamilyVault: memberships.length > 0,
      memberships,
      activeVaultId,
      setActiveVaultId,
      vaultData,
      members,
      sharedAssets,
      activities,
      loading,
      currentRole,
      isOwner,
      isAdmin,
      isViewer,
      createVault,
      inviteMember,
      acceptInvite,
      shareAsset,
      unshareAsset,
      updateRole,
      removeMember,
      transferOwnership,
    }),
    [
      memberships,
      activeVaultId,
      vaultData,
      members,
      sharedAssets,
      activities,
      loading,
      currentRole,
      isOwner,
      isAdmin,
      isViewer,
      createVault,
      inviteMember,
      acceptInvite,
      shareAsset,
      unshareAsset,
      updateRole,
      removeMember,
      transferOwnership,
    ]
  );

  return (
    <FamilyVaultContext.Provider value={value}>
      {children}
    </FamilyVaultContext.Provider>
  );
}

export function useFamilyVault() {
  const ctx = useContext(FamilyVaultContext);
  if (!ctx) {
    throw new Error('useFamilyVault must be used within a FamilyVaultProvider');
  }
  return ctx;
}

export default FamilyVaultContext;
