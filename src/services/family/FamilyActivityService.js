/**
 * Asset Doctor — Family Activity Service
 * 
 * Provides:
 * 1. Append-only activity logging for family actions (asset added, fuel logged, doc uploaded, service completed)
 * 2. Real-time activity feed listeners
 * 3. Sanitized metadata only (no raw image bytes or sensitive document content)
 */

import firestore from '@react-native-firebase/firestore';
import { FAMILY_COLLECTIONS } from './FamilyVaultService';

export const FAMILY_ACTIVITY_ACTIONS = Object.freeze({
  ASSET_ADDED: 'ASSET_ADDED',
  ASSET_UPDATED: 'ASSET_UPDATED',
  ASSET_TRANSFERRED: 'ASSET_TRANSFERRED',
  DOC_UPLOADED: 'DOC_UPLOADED',
  FUEL_LOGGED: 'FUEL_LOGGED',
  MAINTENANCE_ASSIGNED: 'MAINTENANCE_ASSIGNED',
  MAINTENANCE_COMPLETED: 'MAINTENANCE_COMPLETED',
  MEMBER_JOINED: 'MEMBER_JOINED',
  MEMBER_LEFT: 'MEMBER_LEFT',
});

function activitiesRef(vaultId) {
  return firestore()
    .collection(FAMILY_COLLECTIONS.FAMILY_VAULTS)
    .doc(vaultId)
    .collection(FAMILY_COLLECTIONS.ACTIVITIES);
}

export class FamilyActivityService {
  /**
   * Log an activity record in the Family Vault.
   * 
   * @param {string} vaultId 
   * @param {{ actorUid: string, actorName: string, action: string, assetId?: string, assetName?: string, documentId?: string, details: string }} payload 
   */
  static async logActivity(vaultId, payload = {}) {
    if (!vaultId) return { success: false, error: 'vaultId is required' };
    if (!payload.actorUid) return { success: false, error: 'actorUid is required' };

    try {
      const actRef = activitiesRef(vaultId).doc();
      const record = {
        activityId: actRef.id,
        vaultId,
        actorUid: payload.actorUid,
        actorName: payload.actorName || 'Family Member',
        action: payload.action || FAMILY_ACTIVITY_ACTIONS.ASSET_UPDATED,
        assetId: payload.assetId || null,
        assetName: payload.assetName || null,
        documentId: payload.documentId || null,
        details: String(payload.details || '').trim() || 'Updated vault activity',
        timestamp: firestore.FieldValue.serverTimestamp(),
      };

      await actRef.set(record);
      return { success: true, activityId: actRef.id, record };
    } catch (error) {
      console.warn('[FamilyActivityService] Failed to log activity:', error?.message || error);
      return { success: false, error: error?.message || 'Failed to log activity' };
    }
  }

  /**
   * Real-time listener for Family Vault recent activities (up to 50 records, newest first).
   * 
   * @param {string} vaultId 
   * @param {(activities: object[]) => void} onUpdate 
   * @param {(error: Error) => void} [onError] 
   */
  static listenToActivities(vaultId, onUpdate, onError) {
    if (!vaultId) {
      onUpdate([]);
      return () => {};
    }

    return activitiesRef(vaultId)
      .orderBy('timestamp', 'desc')
      .limit(50)
      .onSnapshot(
        (snapshot) => {
          const activities = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          onUpdate(activities);
        },
        (error) => {
          if (onError) onError(error);
          else onUpdate([]);
        }
      );
  }
}

export default FamilyActivityService;
