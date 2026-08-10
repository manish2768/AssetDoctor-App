/**
 * Vendor directory — workshops, dealers, insurers linked to assets/repairs.
 */

import firestore from '@react-native-firebase/firestore';

import { COLLECTIONS } from '../constants';
import { Haptics, triggerHaptic } from '../haptics/triggerHaptic';
import { toErrorMessage } from '../../utils/errors';

function vendorsRef(userId) {
  return firestore().collection(COLLECTIONS.USERS).doc(userId).collection('Vendors');
}

export class VendorService {
  /**
   * @param {string} userId
   * @param {{
   *   name: string,
   *   type?: 'dealer'|'workshop'|'insurer'|'other',
   *   phone?: string,
   *   email?: string,
   *   address?: string,
   *   gstin?: string,
   *   notes?: string
   * }} payload
   */
  static async upsert(userId, payload = {}) {
    triggerHaptic('impactMedium');
    try {
      if (!userId) throw new Error('userId required');
      if (!payload.name?.trim()) throw new Error('Vendor name is required');

      const ref = payload.vendorId
        ? vendorsRef(userId).doc(payload.vendorId)
        : vendorsRef(userId).doc();

      const doc = {
        vendorId: ref.id,
        name: payload.name.trim(),
        type: payload.type || 'other',
        phone: payload.phone || '',
        email: payload.email || '',
        address: payload.address || '',
        gstin: payload.gstin || '',
        notes: payload.notes || '',
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };

      const existing = await ref.get();
      if (!existing.exists) {
        doc.createdAt = firestore.FieldValue.serverTimestamp();
      }

      await ref.set(doc, { merge: true });
      Haptics.success();
      return { success: true, vendor: doc };
    } catch (error) {
      Haptics.error();
      return { success: false, error: toErrorMessage(error) };
    }
  }

  static listen(userId, onUpdate) {
    if (!userId) {
      onUpdate([]);
      return () => {};
    }
    return vendorsRef(userId)
      .orderBy('name', 'asc')
      .onSnapshot(
        (snap) => onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        () => onUpdate([]),
      );
  }

  static async remove(userId, vendorId) {
    Haptics.tap();
    try {
      await vendorsRef(userId).doc(vendorId).delete();
      Haptics.success();
      return { success: true };
    } catch (error) {
      Haptics.error();
      return { success: false, error: toErrorMessage(error) };
    }
  }
}

export default VendorService;
