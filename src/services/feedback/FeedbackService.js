/**
 * Feedback / Report Issue helpers
 */

import { Linking, Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';

import { Haptics } from '../haptics/triggerHaptic';

const DRAFT_KEY = '@asset_doctor/feedback_draft_v1';

export class FeedbackService {
  static async saveLocalDraft(payload) {
    try {
      await AsyncStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ ...payload, savedAt: Date.now() }),
      );
    } catch {
      /* ignore */
    }
  }

  static async sendWhatsApp({ phone, text }) {
    Haptics.tap();
    try {
      const digits = String(phone || '').replace(/\D/g, '');
      const encoded = encodeURIComponent(text || '');
      if (!digits) {
        await Share.share({ message: text || '' });
        return { success: true, via: 'share' };
      }
      const url = `whatsapp://send?phone=${digits}&text=${encoded}`;
      const can = await Linking.canOpenURL(url);
      if (!can) {
        const web = `https://wa.me/${digits}?text=${encoded}`;
        await Linking.openURL(web);
        return { success: true, via: 'wa_web' };
      }
      await Linking.openURL(url);
      return { success: true, via: 'whatsapp' };
    } catch (error) {
      return { success: false, error: error?.message || 'WhatsApp failed' };
    }
  }

  /**
   * Store feedback in Firestore feedback_reports for the signed-in owner.
   */
  static async submitToCloud({ category, message, contact, uid, device }) {
    Haptics.tap();
    try {
      await firestore().collection('feedback_reports').add({
        category: category || 'other',
        message: String(message || '').slice(0, 4000),
        contact: String(contact || '').slice(0, 200),
        uid: uid || null,
        device: String(device || '').slice(0, 500),
        status: 'new',
        createdAt: firestore.FieldValue.serverTimestamp(),
        source: 'app',
      });
      Haptics.success();
      return { success: true };
    } catch (error) {
      Haptics.error();
      return { success: false, error: error?.message || 'Cloud submit failed' };
    }
  }
}

export default FeedbackService;
