/**
 * Asset Doctor — Parking Alert Service
 */

import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { createSecureUuid } from '../security/secureId';

const ALERTS_COLLECTION = 'parking_alerts';

export const PARKING_ALERT_TYPE = Object.freeze({
  VEHICLE_BLOCKING: 'VEHICLE_BLOCKING',
  WRONG_PARKING: 'WRONG_PARKING',
  LIGHTS_LEFT_ON: 'LIGHTS_LEFT_ON',
  WINDOW_OPEN: 'WINDOW_OPEN',
  VEHICLE_ISSUE: 'VEHICLE_ISSUE',
  EMERGENCY: 'EMERGENCY',
});

export const PARKING_ALERT_TYPE_LABEL = Object.freeze({
  VEHICLE_BLOCKING: 'Vehicle Blocking Me',
  WRONG_PARKING: 'Wrong Parking',
  LIGHTS_LEFT_ON: 'Lights Left On',
  WINDOW_OPEN: 'Window / Door Open',
  VEHICLE_ISSUE: 'Vehicle Issue',
  EMERGENCY: 'Emergency',
});

export const PARKING_ALERT_STATUS = Object.freeze({
  PENDING: 'PENDING',
  OWNER_NOTIFIED: 'OWNER_NOTIFIED',
  OWNER_ACKNOWLEDGED: 'OWNER_ACKNOWLEDGED',
  RESOLVED: 'RESOLVED',
});

export async function createParkingAlert({ qrCode, assetId, ownerUid, alertType, message = '', photoUrl = null, vehicleNumber = '' }) {
  if (!qrCode || !assetId || !ownerUid || !alertType) return { error: 'Missing required alert parameters.' };
  if (!PARKING_ALERT_TYPE[alertType]) return { error: 'Invalid alert type.' };
  try {
    const now = new Date().toISOString();
    const alertId = `alert_${createSecureUuid().replace(/-/g, '').slice(0, 16)}`;
    const alertDoc = {
      alertId,
      qrCode,
      assetId,
      ownerUid,
      vehicleNumber,
      alertType,
      alertTypeLabel: PARKING_ALERT_TYPE_LABEL[alertType] || alertType,
      message: String(message || '').slice(0, 500),
      photoUrl: photoUrl || null,
      status: PARKING_ALERT_STATUS.PENDING,
      createdAt: now,
      updatedAt: now,
      acknowledgedAt: null,
      resolvedAt: null,
      scannerPhone: null,
      scannerEmail: null,
    };
    await firestore().collection(ALERTS_COLLECTION).doc(alertId).set(alertDoc);
    console.log(`[PARKING_ALERT] Created: alertId=${alertId} type=${alertType} qrCode=${qrCode}`);
    return { success: true, alertId };
  } catch (error) {
    console.error('[ParkingAlertService] createParkingAlert error:', error?.message || error);
    return { error: `Failed to create alert: ${error?.message || 'Unknown error'}` };
  }
}

export async function getAlertsForAsset(assetId, limitCount = 20) {
  if (!assetId) return [];
  try {
    const snap = await firestore()
      .collection(ALERTS_COLLECTION)
      .where('assetId', '==', assetId)
      .orderBy('createdAt', 'desc')
      .limit(limitCount)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('[ParkingAlertService] getAlertsForAsset error:', error?.message || error);
    return [];
  }
}

export async function acknowledgeAlert(alertId) {
  const uid = auth().currentUser?.uid;
  if (!uid || !alertId) return { error: 'Authentication required.' };
  try {
    const now = new Date().toISOString();
    await firestore().collection(ALERTS_COLLECTION).doc(alertId).update({
      status: PARKING_ALERT_STATUS.OWNER_ACKNOWLEDGED,
      acknowledgedAt: now,
      acknowledgedBy: uid,
      updatedAt: now,
    });
    console.log(`[PARKING_ALERT] Acknowledged: alertId=${alertId} by=${uid}`);
    return { success: true };
  } catch (error) {
    console.error('[ParkingAlertService] acknowledgeAlert error:', error?.message || error);
    return { error: `Acknowledge failed: ${error?.message || 'Unknown error'}` };
  }
}

export async function resolveAlert(alertId) {
  const uid = auth().currentUser?.uid;
  if (!uid || !alertId) return { error: 'Authentication required.' };
  try {
    const now = new Date().toISOString();
    await firestore().collection(ALERTS_COLLECTION).doc(alertId).update({
      status: PARKING_ALERT_STATUS.RESOLVED,
      resolvedAt: now,
      resolvedBy: uid,
      updatedAt: now,
    });
    console.log(`[PARKING_ALERT] Resolved: alertId=${alertId} by=${uid}`);
    return { success: true };
  } catch (error) {
    console.error('[ParkingAlertService] resolveAlert error:', error?.message || error);
    return { error: `Resolve failed: ${error?.message || 'Unknown error'}` };
  }
}

export default {
  PARKING_ALERT_TYPE,
  PARKING_ALERT_TYPE_LABEL,
  PARKING_ALERT_STATUS,
  createParkingAlert,
  getAlertsForAsset,
  acknowledgeAlert,
  resolveAlert,
};
