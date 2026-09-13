/**
 * Asset Doctor — Family Vault Service
 * 
 * Provides:
 * 1. Atomic Family Vault creation (vault doc, owner membership, user index in one batch)
 * 2. Member lifecycle (invite, accept, update role, remove)
 * 3. Secure invitation token validation (single-use, expiration, revocation checks)
 * 4. Asset-level sharing & permission mapping
 * 5. Canonical asset synchronization (refreshes summary without mutating canonical truth)
 * 6. Ownership protection & safe transfer
 */

import firestore from '@react-native-firebase/firestore';
import { COLLECTIONS } from '../constants';
import { Haptics, triggerHaptic } from '../haptics/triggerHaptic';
import { toErrorMessage } from '../../utils/errors';
import { resolveCanonicalAssetId } from '../assets/assetIdentity';

export const FAMILY_ROLES = Object.freeze({
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
  VIEWER: 'VIEWER',
});

export const INVITATION_STATUS = Object.freeze({
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED',
});

export const ASSET_ACCESS_LEVEL = Object.freeze({
  ALL_MEMBERS: 'ALL_MEMBERS',
  RESTRICTED: 'RESTRICTED',
});

/** Top-level Firestore collections for Family Vaults */
export const FAMILY_COLLECTIONS = Object.freeze({
  FAMILY_VAULTS: 'family_vaults',
  MEMBERS: 'members',
  SHARED_ASSETS: 'shared_assets',
  INVITATIONS: 'invitations',
  ACTIVITIES: 'activities',
  USER_MEMBERSHIPS: 'family_memberships',
});

function vaultDocRef(vaultId) {
  return firestore().collection(FAMILY_COLLECTIONS.FAMILY_VAULTS).doc(vaultId);
}

function userMembershipRef(userId, vaultId) {
  return firestore()
    .collection(COLLECTIONS.USERS)
    .doc(userId)
    .collection(FAMILY_COLLECTIONS.USER_MEMBERSHIPS)
    .doc(vaultId);
}

export class FamilyVaultService {
  /**
   * Generates a unique, high-entropy Family Vault ID.
   */
  static createVaultId() {
    return `fvault_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Generates a 6-character alphanumeric quick invite code.
   */
  static createInviteCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  /**
   * Atomic creation of a new Family Vault.
   * Ensures vault, owner member doc, and user membership record succeed together or fail completely.
   * 
   * @param {string} ownerUid 
   * @param {{ name: string, ownerName?: string, ownerEmail?: string, ownerPhone?: string }} payload 
   */
  static async createFamilyVault(ownerUid, payload = {}) {
    triggerHaptic('impactMedium');
    if (!ownerUid) throw new Error('ownerUid is required to create a Family Vault.');
    const vaultName = String(payload.name || '').trim();
    if (!vaultName) throw new Error('Family Vault name is required.');

    const vaultId = this.createVaultId();
    const batch = firestore().batch();

    // 1. Family Vault Document
    const vRef = vaultDocRef(vaultId);
    const vaultData = {
      vaultId,
      name: vaultName,
      ownerUid,
      ownerName: payload.ownerName || 'Vault Owner',
      memberCount: 1,
      assetCount: 0,
      documentCount: 0,
      attentionCount: 0,
      healthScore: 100,
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    };
    batch.set(vRef, vaultData);

    // 2. Owner Member Document in Vault subcollection
    const memberRef = vRef.collection(FAMILY_COLLECTIONS.MEMBERS).doc(ownerUid);
    const memberData = {
      uid: ownerUid,
      vaultId,
      role: FAMILY_ROLES.OWNER,
      displayName: payload.ownerName || 'Vault Owner',
      email: payload.ownerEmail || '',
      phoneNumber: payload.ownerPhone || '',
      photoURL: payload.photoURL || '',
      joinedAt: firestore.FieldValue.serverTimestamp(),
      invitedByUid: ownerUid,
      status: 'ACTIVE',
    };
    batch.set(memberRef, memberData);

    // 3. User Membership Index (for instantaneous lookup on client launch)
    const mRef = userMembershipRef(ownerUid, vaultId);
    const membershipData = {
      vaultId,
      vaultName,
      role: FAMILY_ROLES.OWNER,
      joinedAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    };
    batch.set(mRef, membershipData);

    // 4. Initial Activity
    const actRef = vRef.collection(FAMILY_COLLECTIONS.ACTIVITIES).doc();
    batch.set(actRef, {
      activityId: actRef.id,
      vaultId,
      actorUid: ownerUid,
      actorName: payload.ownerName || 'Vault Owner',
      action: 'MEMBER_JOINED',
      details: `${payload.ownerName || 'Vault Owner'} created ${vaultName}`,
      timestamp: firestore.FieldValue.serverTimestamp(),
    });

    try {
      await batch.commit();
      Haptics.success();
      return { success: true, vaultId, vault: vaultData };
    } catch (error) {
      Haptics.error();
      throw new Error(`Failed to create Family Vault atomically: ${toErrorMessage(error)}`);
    }
  }

  /**
   * Listen to all Family Vault memberships for a given user.
   */
  static listenToUserVaults(userId, onUpdate, onError) {
    if (!userId) {
      onUpdate([]);
      return () => {};
    }
    return firestore()
      .collection(COLLECTIONS.USERS)
      .doc(userId)
      .collection(FAMILY_COLLECTIONS.USER_MEMBERSHIPS)
      .onSnapshot(
        (snapshot) => {
          const memberships = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          onUpdate(memberships);
        },
        (error) => {
          if (onError) onError(error);
          else onUpdate([]);
        }
      );
  }

  /**
   * Listen to a specific Family Vault doc in real-time.
   */
  static listenToVault(vaultId, onUpdate, onError) {
    if (!vaultId) {
      onUpdate(null);
      return () => {};
    }
    return vaultDocRef(vaultId).onSnapshot(
      (doc) => {
        if (!doc.exists) {
          onUpdate(null);
          return;
        }
        onUpdate({ id: doc.id, ...doc.data() });
      },
      (error) => {
        if (onError) onError(error);
      }
    );
  }

  /**
   * Listen to the members of a Family Vault.
   */
  static listenToMembers(vaultId, onUpdate, onError) {
    if (!vaultId) {
      onUpdate([]);
      return () => {};
    }
    return vaultDocRef(vaultId)
      .collection(FAMILY_COLLECTIONS.MEMBERS)
      .orderBy('joinedAt', 'asc')
      .onSnapshot(
        (snapshot) => {
          const members = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          onUpdate(members);
        },
        (error) => {
          if (onError) onError(error);
        }
      );
  }

  /**
   * Listen to shared assets in a Family Vault.
   */
  static listenToSharedAssets(vaultId, onUpdate, onError) {
    if (!vaultId) {
      onUpdate([]);
      return () => {};
    }
    return vaultDocRef(vaultId)
      .collection(FAMILY_COLLECTIONS.SHARED_ASSETS)
      .orderBy('updatedAt', 'desc')
      .onSnapshot(
        (snapshot) => {
          const assets = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          onUpdate(assets);
        },
        (error) => {
          if (onError) onError(error);
        }
      );
  }

  /**
   * Create an invitation to a Family Vault.
   * 
   * @param {string} senderUid 
   * @param {string} vaultId 
   * @param {{ vaultName: string, senderName: string, role?: string, recipientEmail?: string, recipientPhone?: string, expiresInDays?: number }} options 
   */
  static async createInvitation(senderUid, vaultId, options = {}) {
    triggerHaptic('impactMedium');
    if (!senderUid || !vaultId) throw new Error('senderUid and vaultId required');

    // Verify sender has permission (OWNER or ADMIN)
    const memberDoc = await vaultDocRef(vaultId).collection(FAMILY_COLLECTIONS.MEMBERS).doc(senderUid).get();
    if (!memberDoc.exists) throw new Error('You are not a member of this Family Vault.');
    const role = memberDoc.data()?.role;
    if (role !== FAMILY_ROLES.OWNER && role !== FAMILY_ROLES.ADMIN) {
      throw new Error('Only Vault Owners and Admins can invite new members.');
    }

    const invitationId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const inviteCode = this.createInviteCode();
    const expiryDays = options.expiresInDays || 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    const invRef = vaultDocRef(vaultId).collection(FAMILY_COLLECTIONS.INVITATIONS).doc(invitationId);
    const invData = {
      invitationId,
      vaultId,
      vaultName: options.vaultName || 'Family Vault',
      invitedByUid: senderUid,
      invitedByName: options.senderName || 'Family Member',
      recipientEmail: options.recipientEmail || '',
      recipientPhone: options.recipientPhone || '',
      role: options.role || FAMILY_ROLES.MEMBER,
      status: INVITATION_STATUS.PENDING,
      inviteCode,
      expiresAt: firestore.Timestamp.fromDate(expiresAt),
      createdAt: firestore.FieldValue.serverTimestamp(),
    };

    await invRef.set(invData);
    Haptics.success();
    return { success: true, invitationId, inviteCode, invitation: invData };
  }

  /**
   * Accept an invitation using an authenticated user session and invitation credentials.
   * Validates status, expiration, and ensures atomic membership write.
   * 
   * @param {string} acceptingUserUid 
   * @param {{ vaultId: string, invitationId: string, displayName?: string, email?: string, phoneNumber?: string }} userProfile 
   */
  static async acceptInvitation(acceptingUserUid, { vaultId, invitationId, displayName, email, phoneNumber, photoURL } = {}) {
    triggerHaptic('impactMedium');
    if (!acceptingUserUid) throw new Error('You must be signed in to accept an invitation.');
    if (!vaultId || !invitationId) throw new Error('vaultId and invitationId are required.');

    const invRef = vaultDocRef(vaultId).collection(FAMILY_COLLECTIONS.INVITATIONS).doc(invitationId);
    const invDoc = await invRef.get();

    if (!invDoc.exists) {
      throw new Error('Invalid or non-existent invitation.');
    }

    const inv = invDoc.data();
    if (inv.status !== INVITATION_STATUS.PENDING) {
      throw new Error(`Invitation cannot be accepted (Status: ${inv.status}).`);
    }

    const now = Date.now();
    const expTime = inv.expiresAt?.toDate?.() ? inv.expiresAt.toDate().getTime() : 0;
    if (expTime && expTime < now) {
      await invRef.update({ status: INVITATION_STATUS.EXPIRED });
      throw new Error('This invitation has expired.');
    }

    // Atomic acceptance
    const batch = firestore().batch();

    // 1. Mark invitation accepted
    batch.update(invRef, {
      status: INVITATION_STATUS.ACCEPTED,
      acceptedByUid: acceptingUserUid,
      acceptedAt: firestore.FieldValue.serverTimestamp(),
    });

    // 2. Add member to vault
    const memberRef = vaultDocRef(vaultId).collection(FAMILY_COLLECTIONS.MEMBERS).doc(acceptingUserUid);
    batch.set(memberRef, {
      uid: acceptingUserUid,
      vaultId,
      role: inv.role || FAMILY_ROLES.MEMBER,
      displayName: displayName || 'Family Member',
      email: email || '',
      phoneNumber: phoneNumber || '',
      photoURL: photoURL || '',
      joinedAt: firestore.FieldValue.serverTimestamp(),
      invitedByUid: inv.invitedByUid,
      status: 'ACTIVE',
    });

    // 3. Increment vault memberCount
    batch.update(vaultDocRef(vaultId), {
      memberCount: firestore.FieldValue.increment(1),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });

    // 4. Index membership in user document
    const userMemRef = userMembershipRef(acceptingUserUid, vaultId);
    batch.set(userMemRef, {
      vaultId,
      vaultName: inv.vaultName || 'Family Vault',
      role: inv.role || FAMILY_ROLES.MEMBER,
      joinedAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });

    // 5. Activity log
    const actRef = vaultDocRef(vaultId).collection(FAMILY_COLLECTIONS.ACTIVITIES).doc();
    batch.set(actRef, {
      activityId: actRef.id,
      vaultId,
      actorUid: acceptingUserUid,
      actorName: displayName || 'Family Member',
      action: 'MEMBER_JOINED',
      details: `${displayName || 'A new member'} joined the vault`,
      timestamp: firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();
    Haptics.success();
    return { success: true, vaultId };
  }

  /**
   * Revoke an invitation.
   */
  static async revokeInvitation(senderUid, vaultId, invitationId) {
    if (!senderUid || !vaultId || !invitationId) throw new Error('Missing parameters');
    const invRef = vaultDocRef(vaultId).collection(FAMILY_COLLECTIONS.INVITATIONS).doc(invitationId);
    await invRef.update({
      status: INVITATION_STATUS.REVOKED,
      revokedAt: firestore.FieldValue.serverTimestamp(),
    });
    return { success: true };
  }

  /**
   * Share an asset with the Family Vault.
   * Creates a denormalized reference in `shared_assets` pointing to canonical `Users/{ownerUid}/Assets/{canonicalAssetId}`.
   * 
   * @param {string} ownerUid 
   * @param {string} vaultId 
   * @param {object} canonicalAsset 
   * @param {{ accessLevel?: string, sharedWithMemberUids?: string[] }} options 
   */
  static async shareAsset(ownerUid, vaultId, canonicalAsset = {}, options = {}) {
    triggerHaptic('impactMedium');
    const assetId = resolveCanonicalAssetId(canonicalAsset);
    if (!ownerUid || !vaultId || !assetId) {
      throw new Error('ownerUid, vaultId, and valid canonicalAsset required.');
    }

    const sharedAssetId = `shared_${assetId}`;
    const sharedRef = vaultDocRef(vaultId).collection(FAMILY_COLLECTIONS.SHARED_ASSETS).doc(sharedAssetId);

    const accessLevel = options.accessLevel || ASSET_ACCESS_LEVEL.ALL_MEMBERS;
    const sharedWithMemberUids = Array.isArray(options.sharedWithMemberUids)
      ? options.sharedWithMemberUids
      : [ownerUid];

    const attentionItems = [];
    if (canonicalAsset.insuranceExpiry) attentionItems.push(`Insurance: ${canonicalAsset.insuranceExpiry}`);
    if (canonicalAsset.pucExpiry) attentionItems.push(`PUC: ${canonicalAsset.pucExpiry}`);
    if (canonicalAsset.warrantyExpiry) attentionItems.push(`Warranty: ${canonicalAsset.warrantyExpiry}`);

    const sharedRecord = {
      sharedAssetId,
      canonicalAssetId: assetId,
      ownerUid,
      vaultId,
      assetName: canonicalAsset.assetName || 'Asset',
      category: canonicalAsset.category || 'General',
      icon: canonicalAsset.icon || '📦',
      registration: canonicalAsset.registration || '',
      accessLevel,
      sharedWithMemberUids,
      healthScore: Number(canonicalAsset.healthScore) || 100,
      pucExpiry: canonicalAsset.pucExpiry || null,
      insuranceExpiry: canonicalAsset.insuranceExpiry || null,
      warrantyExpiry: canonicalAsset.warrantyExpiry || null,
      nextServiceDue: canonicalAsset.nextServiceDue || null,
      attentionItems,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    };

    const batch = firestore().batch();
    batch.set(sharedRef, sharedRecord);

    // Update vault asset count
    batch.update(vaultDocRef(vaultId), {
      assetCount: firestore.FieldValue.increment(1),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });

    // Record activity
    const actRef = vaultDocRef(vaultId).collection(FAMILY_COLLECTIONS.ACTIVITIES).doc();
    batch.set(actRef, {
      activityId: actRef.id,
      vaultId,
      actorUid: ownerUid,
      actorName: canonicalAsset.ownerName || 'Owner',
      action: 'ASSET_ADDED',
      assetId,
      assetName: canonicalAsset.assetName,
      details: `Shared ${canonicalAsset.assetName || 'an asset'} with the vault`,
      timestamp: firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();
    Haptics.success();
    return { success: true, sharedAssetId, sharedRecord };
  }

  /**
   * Refreshes the shared asset summary from the canonical asset doc.
   * Guarantees denormalized summaries do not get permanently out of sync.
   */
  static async syncSharedAssetSummary(vaultId, canonicalAsset = {}) {
    const assetId = resolveCanonicalAssetId(canonicalAsset);
    if (!vaultId || !assetId) return;

    const sharedAssetId = `shared_${assetId}`;
    const sharedRef = vaultDocRef(vaultId).collection(FAMILY_COLLECTIONS.SHARED_ASSETS).doc(sharedAssetId);

    const snap = await sharedRef.get();
    if (!snap.exists) return; // Not shared with this vault

    const attentionItems = [];
    if (canonicalAsset.insuranceExpiry) attentionItems.push(`Insurance: ${canonicalAsset.insuranceExpiry}`);
    if (canonicalAsset.pucExpiry) attentionItems.push(`PUC: ${canonicalAsset.pucExpiry}`);
    if (canonicalAsset.warrantyExpiry) attentionItems.push(`Warranty: ${canonicalAsset.warrantyExpiry}`);

    await sharedRef.update({
      assetName: canonicalAsset.assetName || 'Asset',
      category: canonicalAsset.category || 'General',
      icon: canonicalAsset.icon || '📦',
      registration: canonicalAsset.registration || '',
      healthScore: Number(canonicalAsset.healthScore) || 100,
      pucExpiry: canonicalAsset.pucExpiry || null,
      insuranceExpiry: canonicalAsset.insuranceExpiry || null,
      warrantyExpiry: canonicalAsset.warrantyExpiry || null,
      nextServiceDue: canonicalAsset.nextServiceDue || null,
      attentionItems,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
  }

  /**
   * Unshare an asset from the Family Vault.
   */
  static async unshareAsset(actorUid, vaultId, assetId) {
    triggerHaptic('impactMedium');
    const sharedAssetId = `shared_${assetId}`;
    const sharedRef = vaultDocRef(vaultId).collection(FAMILY_COLLECTIONS.SHARED_ASSETS).doc(sharedAssetId);

    const snap = await sharedRef.get();
    if (!snap.exists) return { success: true };

    const batch = firestore().batch();
    batch.delete(sharedRef);
    batch.update(vaultDocRef(vaultId), {
      assetCount: firestore.FieldValue.increment(-1),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();
    Haptics.success();
    return { success: true };
  }

  /**
   * Update member role.
   * Guard: MEMBER or ADMIN cannot change OWNER's role.
   */
  static async updateMemberRole(actorUid, vaultId, targetMemberUid, newRole) {
    triggerHaptic('impactMedium');
    if (!Object.values(FAMILY_ROLES).includes(newRole)) {
      throw new Error('Invalid role');
    }

    const actorDoc = await vaultDocRef(vaultId).collection(FAMILY_COLLECTIONS.MEMBERS).doc(actorUid).get();
    const targetDoc = await vaultDocRef(vaultId).collection(FAMILY_COLLECTIONS.MEMBERS).doc(targetMemberUid).get();

    if (!actorDoc.exists || !targetDoc.exists) throw new Error('Member record not found');

    const actorRole = actorDoc.data()?.role;
    const targetRole = targetDoc.data()?.role;

    if (actorRole !== FAMILY_ROLES.OWNER) {
      throw new Error('Only the Vault Owner can change member roles.');
    }

    if (targetRole === FAMILY_ROLES.OWNER && newRole !== FAMILY_ROLES.OWNER) {
      throw new Error('Cannot demote Vault Owner without explicit ownership transfer.');
    }

    const batch = firestore().batch();
    batch.update(vaultDocRef(vaultId).collection(FAMILY_COLLECTIONS.MEMBERS).doc(targetMemberUid), {
      role: newRole,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
    batch.update(userMembershipRef(targetMemberUid, vaultId), {
      role: newRole,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();
    Haptics.success();
    return { success: true };
  }

  /**
   * Remove a member from the Family Vault.
   * Guard: No member can remove the OWNER.
   */
  static async removeMember(actorUid, vaultId, targetMemberUid) {
    triggerHaptic('impactMedium');
    const actorDoc = await vaultDocRef(vaultId).collection(FAMILY_COLLECTIONS.MEMBERS).doc(actorUid).get();
    const targetDoc = await vaultDocRef(vaultId).collection(FAMILY_COLLECTIONS.MEMBERS).doc(targetMemberUid).get();

    if (!actorDoc.exists || !targetDoc.exists) throw new Error('Member record not found');

    const actorRole = actorDoc.data()?.role;
    const targetRole = targetDoc.data()?.role;

    if (targetRole === FAMILY_ROLES.OWNER) {
      throw new Error('The Vault Owner cannot be removed.');
    }

    // Owner or Admin can remove members, or a member can remove themselves (leave vault)
    const isSelf = actorUid === targetMemberUid;
    const isPermitted = actorRole === FAMILY_ROLES.OWNER || actorRole === FAMILY_ROLES.ADMIN || isSelf;

    if (!isPermitted) {
      throw new Error('You do not have permission to remove this member.');
    }

    const batch = firestore().batch();
    batch.delete(vaultDocRef(vaultId).collection(FAMILY_COLLECTIONS.MEMBERS).doc(targetMemberUid));
    batch.delete(userMembershipRef(targetMemberUid, vaultId));
    batch.update(vaultDocRef(vaultId), {
      memberCount: firestore.FieldValue.increment(-1),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();
    Haptics.success();
    return { success: true };
  }

  /**
   * Transfer Vault Ownership.
   * Preserves vaultId, canonical asset IDs, and member history.
   */
  static async transferOwnership(currentOwnerUid, vaultId, newOwnerUid) {
    triggerHaptic('impactHeavy');
    const vDoc = await vaultDocRef(vaultId).get();
    if (!vDoc.exists) throw new Error('Vault not found');
    if (vDoc.data()?.ownerUid !== currentOwnerUid) {
      throw new Error('Only current owner can transfer vault ownership');
    }

    const targetDoc = await vaultDocRef(vaultId).collection(FAMILY_COLLECTIONS.MEMBERS).doc(newOwnerUid).get();
    if (!targetDoc.exists) throw new Error('Target user must already be an active member of this vault');

    const batch = firestore().batch();

    // 1. Update Vault Doc
    batch.update(vaultDocRef(vaultId), {
      ownerUid: newOwnerUid,
      ownerName: targetDoc.data()?.displayName || 'Owner',
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });

    // 2. Demote old owner to ADMIN
    batch.update(vaultDocRef(vaultId).collection(FAMILY_COLLECTIONS.MEMBERS).doc(currentOwnerUid), {
      role: FAMILY_ROLES.ADMIN,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
    batch.update(userMembershipRef(currentOwnerUid, vaultId), {
      role: FAMILY_ROLES.ADMIN,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });

    // 3. Promote new owner to OWNER
    batch.update(vaultDocRef(vaultId).collection(FAMILY_COLLECTIONS.MEMBERS).doc(newOwnerUid), {
      role: FAMILY_ROLES.OWNER,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
    batch.update(userMembershipRef(newOwnerUid, vaultId), {
      role: FAMILY_ROLES.OWNER,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });

    // 4. Activity Log
    const actRef = vaultDocRef(vaultId).collection(FAMILY_COLLECTIONS.ACTIVITIES).doc();
    batch.set(actRef, {
      activityId: actRef.id,
      vaultId,
      actorUid: currentOwnerUid,
      actorName: vDoc.data()?.ownerName || 'Previous Owner',
      action: 'MEMBER_JOINED',
      details: `Transferred vault ownership to ${targetDoc.data()?.displayName || 'New Owner'}`,
      timestamp: firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();
    Haptics.success();
    return { success: true };
  }
}

export default FamilyVaultService;
