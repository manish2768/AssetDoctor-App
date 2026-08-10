/**
 * Power Log Service — persist daily running-cost entries.
 */

import firestore from '@react-native-firebase/firestore';

import { COLLECTIONS } from '../constants';
import { Haptics } from '../haptics/triggerHaptic';
import { buildDailyPowerLog } from '../../utils/powerCost';

function logsRef(userId) {
  return firestore().collection(COLLECTIONS.USERS).doc(userId).collection('PowerLogs');
}

export class PowerLogService {
  static async logUsage(userId, params) {
    Haptics.tap();
    try {
      if (!userId) throw new Error('Not signed in');
      const payload = {
        ...buildDailyPowerLog(params),
        createdAt: firestore.FieldValue.serverTimestamp(),
      };
      const ref = await logsRef(userId).add(payload);
      Haptics.success();
      return { success: true, id: ref.id, log: payload };
    } catch (error) {
      Haptics.error();
      return { success: false, error: error?.message || 'Failed to log power usage' };
    }
  }

  static listenToLogs(userId, onUpdate, limit = 30) {
    if (!userId) {
      onUpdate([]);
      return () => {};
    }
    return logsRef(userId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .onSnapshot(
        (snap) => onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        () => onUpdate([]),
      );
  }
}

export default PowerLogService;
