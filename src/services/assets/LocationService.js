/**
 * User location hierarchy — Home → Floor → Room (customizable).
 * Path: Users/{uid}/Locations/{locationId}
 */

import firestore from '@react-native-firebase/firestore';

import { COLLECTIONS } from '../constants';

function locationsRef(userId) {
  return firestore().collection(COLLECTIONS.USERS).doc(userId).collection('Locations');
}

function locationHistoryRef(userId, assetId) {
  return firestore()
    .collection(COLLECTIONS.USERS)
    .doc(userId)
    .collection(COLLECTIONS.ASSETS)
    .doc(assetId)
    .collection('LocationHistory');
}

export function createLocationId() {
  return `loc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export class LocationService {
  static async list(userId) {
    if (!userId) return [];
    const snap = await locationsRef(userId).orderBy('name', 'asc').get();
    return snap.docs.map((d) => ({ locationId: d.id, ...d.data() }));
  }

  static async upsert(userId, location = {}) {
    if (!userId) throw new Error('Sign in required');
    const id = location.locationId || createLocationId();
    const payload = {
      locationId: id,
      name: String(location.name || '').trim() || 'Untitled',
      parentId: location.parentId || null,
      path: location.path || String(location.name || '').trim(),
      ownerUid: userId,
      // Digital Twin V2 (additive — optional)
      type: location.type || null,
      homeId: location.homeId || null,
      floorId: location.floorId || null,
      roomType: location.roomType || null,
      customName: location.customName || null,
      householdId: location.householdId || null,
      syncStatus: location.syncStatus || null,
      deletedAt: location.deletedAt || null,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    };
    if (!location.locationId) {
      payload.createdAt = firestore.FieldValue.serverTimestamp();
    }
    await locationsRef(userId).doc(id).set(payload, { merge: true });
    return payload;
  }

  static async remove(userId, locationId) {
    if (!userId || !locationId) return;
    await locationsRef(userId).doc(locationId).delete();
  }

  /**
   * Move asset + append location history (does not recreate asset).
   * Optional homeId / floorId / roomId keep Digital Twin links without changing assetId.
   */
  static async moveAsset(
    userId,
    assetId,
    { locationId, locationPath, homeId, floorId, roomId, reason = 'moved' } = {},
  ) {
    if (!userId || !assetId) throw new Error('Missing asset');
    const assetRef = firestore()
      .collection(COLLECTIONS.USERS)
      .doc(userId)
      .collection(COLLECTIONS.ASSETS)
      .doc(assetId);
    const snap = await assetRef.get();
    const prior = snap.data() || {};
    const histId = `lh_${Date.now()}`;
    if (prior.locationId || prior.locationPath || prior.roomId) {
      await locationHistoryRef(userId, assetId)
        .doc(histId)
        .set({
          id: histId,
          assetId,
          ownerUid: userId,
          locationId: prior.locationId || prior.roomId || null,
          locationPath: prior.locationPath || prior.nickname || '',
          homeId: prior.homeId || null,
          floorId: prior.floorId || null,
          roomId: prior.roomId || null,
          startDate: prior.locationAssignedAt || prior.createdAt || null,
          endDate: firestore.FieldValue.serverTimestamp(),
          reason,
          createdAt: firestore.FieldValue.serverTimestamp(),
        });
    }
    const patch = {
      locationId: locationId || roomId || null,
      locationPath: locationPath || '',
      roomId: roomId != null ? roomId : locationId || null,
      locationAssignedAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    };
    if (homeId !== undefined) patch.homeId = homeId;
    if (floorId !== undefined) patch.floorId = floorId;
    await assetRef.set(patch, { merge: true });
    return { success: true };
  }
}

export default LocationService;
