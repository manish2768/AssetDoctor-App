/**
 * Asset Doctor — Parking QR Service
 *
 * CANONICAL RULES:
 * 1. ONE ACTIVE QR per vehicle (assetId) at all times.
 * 2. Generation is idempotent — returns existing ACTIVE QR if present.
 * 3. Uses assetIdOf() as the canonical vehicle identity — never invents another.
 * 4. QR code format: AD-PARK-XXXXXX (6 uppercase hex chars, opaque, no PII).
 * 5. All writes go through Firestore atomic transactions.
 */

import firestore from '@react-native-firebase/firestore';
import { assetIdOf } from '../assets/assetIdentity';
import { secureRandomHex } from '../security/secureId';

const PARKING_QRS_COLLECTION = 'parking_qrs';

export const PARKING_QR_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  REVOKED: 'REVOKED',
  DISABLED: 'DISABLED',
});

function newParkingQrCode() {
  return `AD-PARK-${secureRandomHex(3).toUpperCase()}`;
}

export async function getParkingQr(assetId) {
  if (!assetId) return null;
  try {
    const snap = await firestore()
      .collection(PARKING_QRS_COLLECTION)
      .where('assetId', '==', assetId)
      .where('status', '==', PARKING_QR_STATUS.ACTIVE)
      .limit(1)
      .get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { qrCode: doc.id, ...doc.data() };
  } catch (error) {
    console.error('[ParkingQrService] getParkingQr error:', error?.message || error);
    return null;
  }
}

export async function getParkingQrByCode(qrCode) {
  if (!qrCode) return null;
  try {
    const doc = await firestore().collection(PARKING_QRS_COLLECTION).doc(qrCode).get();
    if (!doc.exists) return null;
    return { qrCode: doc.id, ...doc.data() };
  } catch (error) {
    console.error('[ParkingQrService] getParkingQrByCode error:', error?.message || error);
    return null;
  }
}

export async function getOrGenerateParkingQr(asset, userId) {
  const canonicalId = assetIdOf(asset);
  if (!canonicalId) return { error: 'Cannot resolve canonical asset identity. Ensure the asset is fully saved.' };
  if (!userId) return { error: 'User authentication required to generate a Parking QR.' };
  try {
    const existing = await getParkingQr(canonicalId);
    if (existing && existing.status === PARKING_QR_STATUS.ACTIVE) {
      console.log(`[PARKING_QR_DEBUG] Returning existing ACTIVE QR: qrCode=${existing.qrCode} assetId=${canonicalId}`);
      return { ...existing, isNew: false };
    }
    const now = new Date().toISOString();
    let qrCode;
    let attempt = 0;
    while (attempt < 5) {
      qrCode = newParkingQrCode();
      const check = await firestore().collection(PARKING_QRS_COLLECTION).doc(qrCode).get();
      if (!check.exists) break;
      attempt++;
    }
    const payload = {
      qrCode,
      assetId: canonicalId,
      userId,
      vehicleNumber: String(asset.registration || asset.registrationNumber || asset.assetName || '').trim(),
      assetName: String(asset.assetName || asset.name || '').trim(),
      status: PARKING_QR_STATUS.ACTIVE,
      createdAt: now,
      updatedAt: now,
      source: 'customer',
      createdBy: userId,
    };
    await firestore().collection(PARKING_QRS_COLLECTION).doc(qrCode).set(payload);
    console.log(`[PARKING_QR_DEBUG] Generated new ACTIVE QR: qrCode=${qrCode} assetId=${canonicalId} source=customer`);
    return { ...payload, isNew: true };
  } catch (error) {
    console.error('[ParkingQrService] getOrGenerateParkingQr error:', error?.message || error);
    return { error: `QR generation failed: ${error?.message || 'Unknown error'}` };
  }
}

export async function revokeAndRegenerate(canonicalId, userId, initiatedBy = 'customer') {
  if (!canonicalId || !userId) return { error: 'Asset ID and user ID are required for QR regeneration.' };
  try {
    const now = new Date().toISOString();
    const activeSnap = await firestore()
      .collection(PARKING_QRS_COLLECTION)
      .where('assetId', '==', canonicalId)
      .where('status', '==', PARKING_QR_STATUS.ACTIVE)
      .get();
    const oldQrCodes = activeSnap.docs.map((d) => d.id);
    let newQrCode;
    let attempt = 0;
    while (attempt < 5) {
      newQrCode = newParkingQrCode();
      const check = await firestore().collection(PARKING_QRS_COLLECTION).doc(newQrCode).get();
      if (!check.exists) break;
      attempt++;
    }
    const batch = firestore().batch();
    for (const oldCode of oldQrCodes) {
      batch.update(firestore().collection(PARKING_QRS_COLLECTION).doc(oldCode), {
        status: PARKING_QR_STATUS.REVOKED,
        revokedAt: now,
        revokedBy: userId,
        revokedReason: 'REGENERATED',
        updatedAt: now,
      });
    }
    const newPayload = {
      qrCode: newQrCode,
      assetId: canonicalId,
      userId,
      status: PARKING_QR_STATUS.ACTIVE,
      createdAt: now,
      updatedAt: now,
      source: initiatedBy,
      createdBy: userId,
      replacedQrCodes: oldQrCodes,
    };
    batch.set(firestore().collection(PARKING_QRS_COLLECTION).doc(newQrCode), newPayload);
    await batch.commit();
    console.log(`[PARKING_QR_DEBUG] Regenerated: oldCodes=${oldQrCodes.join(',')} newCode=${newQrCode} by=${initiatedBy}`);
    return { qrCode: newQrCode, oldQrCodes, isNew: true };
  } catch (error) {
    console.error('[ParkingQrService] revokeAndRegenerate error:', error?.message || error);
    return { error: `QR regeneration failed: ${error?.message || 'Unknown error'}` };
  }
}

export async function disableParkingQr(qrCode, adminId) {
  if (!qrCode) return { error: 'QR code is required.' };
  try {
    const now = new Date().toISOString();
    await firestore().collection(PARKING_QRS_COLLECTION).doc(qrCode).update({
      status: PARKING_QR_STATUS.DISABLED,
      disabledAt: now,
      disabledBy: adminId || 'admin',
      updatedAt: now,
    });
    console.log(`[PARKING_QR_DEBUG] Disabled QR: qrCode=${qrCode} by=${adminId}`);
    return { success: true };
  } catch (error) {
    console.error('[ParkingQrService] disableParkingQr error:', error?.message || error);
    return { error: `Failed to disable QR: ${error?.message || 'Unknown error'}` };
  }
}

export function buildParkingQrUrl(qrCode) {
  return `https://assetdoctor.app/park/${encodeURIComponent(qrCode)}`;
}

export default {
  getParkingQr,
  getParkingQrByCode,
  getOrGenerateParkingQr,
  revokeAndRegenerate,
  disableParkingQr,
  buildParkingQrUrl,
  PARKING_QR_STATUS,
};
