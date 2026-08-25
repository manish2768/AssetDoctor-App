/**
 * After Auth sign-in, reconcile split phone/Google vaults onto the current UID.
 * Uses Cloud Function (admin) to copy Assets without deleting source records.
 * Also attempts Auth provider linking when a Google idToken is available.
 */

import auth from '@react-native-firebase/auth';

import { UserService } from '../user/UserService';
import { tryLinkGoogleAfterPhoneSignIn } from './AccountLinkService';
import { loadLocalProfile } from '../../utils/userProfileStorage';

const REGION = process.env.EXPO_PUBLIC_FUNCTIONS_REGION || 'asia-south1';
const PROJECT_ID =
  process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'assetdoctor-5fd25';
const RECONCILE_URL =
  process.env.EXPO_PUBLIC_RECONCILE_VAULT_URL ||
  `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/reconcileCanonicalVaultHttp`;

function normalizePhone(value) {
  const trimmed = String(value || '').replace(/[\s-]/g, '');
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) return trimmed;
  if (/^\d{10}$/.test(trimmed)) return `+91${trimmed}`;
  if (trimmed.startsWith('91') && trimmed.length === 12) return `+${trimmed}`;
  return trimmed;
}

/**
 * @param {{
 *  user?: import('@react-native-firebase/auth').FirebaseAuthTypes.User | null,
 *  googleIdToken?: string | null,
 *  phoneHint?: string | null,
 * }} [opts]
 */
export async function reconcileAfterSignIn(opts = {}) {
  const user = opts.user || auth().currentUser;
  if (!user?.uid) {
    return { ok: false, reason: 'no_user' };
  }

  let localPhone = '';
  let localEmail = '';
  try {
    const local = await loadLocalProfile();
    localPhone = normalizePhone(local?.phone || local?.phoneNumber || '');
    localEmail = String(local?.email || '')
      .trim()
      .toLowerCase();
  } catch {
    /* optional */
  }

  const phone =
    normalizePhone(opts.phoneHint) ||
    normalizePhone(user.phoneNumber) ||
    localPhone ||
    '';

  const email =
    String(user.email || '')
      .trim()
      .toLowerCase() || localEmail;

  // Stamp cross-channel identity hints so sibling lookup works next time
  try {
    await UserService.syncUserToFirestore(user, {
      extra: {
        email: email || undefined,
        phone: phone || undefined,
        phoneNumber: phone || undefined,
      },
    });
  } catch {
    /* non-fatal */
  }

  let vault = null;
  try {
    const token = await user.getIdToken(true);
    const res = await fetch(RECONCILE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        email: email || undefined,
        phone: phone || undefined,
      }),
    });
    vault = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn('[IdentityReconcile] HTTP', res.status, vault);
      vault = { ...vault, httpError: true };
    }
  } catch (error) {
    console.warn('[IdentityReconcile] vault merge skipped:', error?.message || error);
  }

  let link = null;
  if (opts.googleIdToken) {
    try {
      link = await tryLinkGoogleAfterPhoneSignIn(opts.googleIdToken);
    } catch (error) {
      console.warn('[IdentityReconcile] Google link skipped:', error?.message || error);
    }
  }

  try {
    await UserService.syncUserToFirestore(auth().currentUser || user, {
      authProvider: link?.linked ? 'linked' : undefined,
      extra: {
        email: email || undefined,
        phone: phone || undefined,
        phoneNumber: phone || undefined,
        lastReconcileCopied: vault?.copied ?? 0,
      },
    });
  } catch {
    /* non-fatal */
  }

  return {
    ok: true,
    vault,
    link,
    uid: auth().currentUser?.uid || user.uid,
  };
}

export default { reconcileAfterSignIn };
