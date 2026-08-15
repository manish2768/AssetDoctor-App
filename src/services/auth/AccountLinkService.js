/**
 * Seamless Google/Email ↔ Phone linking without scary "already linked" blocks.
 * When the phone credential belongs to another Firebase user, we sign into that
 * account and re-attach the previous Google/email provider when possible.
 */

import auth from '@react-native-firebase/auth';

import { UserService } from '../user/UserService';

function providerIds(user) {
  return (user?.providerData || []).map((p) => p.providerId).filter(Boolean);
}

/**
 * Snapshot OAuth credential material before a session switch.
 * Google idToken must be refreshed by caller if linking after switch.
 */
export function snapshotProviders(user = auth().currentUser) {
  if (!user) return { uid: null, email: null, providers: [] };
  return {
    uid: user.uid,
    email: user.email || null,
    displayName: user.displayName || null,
    photoURL: user.photoURL || null,
    providers: providerIds(user),
  };
}

/**
 * After signing into a phone account, try linking a Google credential so both
 * identities live on one UID (true merge of Auth providers).
 * @returns {Promise<{ linked: boolean, user: import('@react-native-firebase/auth').FirebaseAuthTypes.User|null, note?: string }>}
 */
export async function tryLinkGoogleAfterPhoneSignIn(googleIdToken) {
  const user = auth().currentUser;
  if (!user) return { linked: false, user: null, note: 'No signed-in user' };
  if (!googleIdToken) {
    return { linked: false, user, note: 'No Google token to link' };
  }
  if (providerIds(user).includes('google.com')) {
    return { linked: true, user, note: 'Google already on this account' };
  }
  try {
    const credential = auth.GoogleAuthProvider.credential(googleIdToken);
    const cred = await user.linkWithCredential(credential);
    await UserService.syncUserToFirestore(cred.user, {
      authProvider: 'linked',
      extra: {
        linkedProviders: providerIds(cred.user).join(','),
        email: cred.user.email || undefined,
      },
    });
    return { linked: true, user: cred.user };
  } catch (error) {
    const code = String(error?.code || '');
    if (code.includes('provider-already-linked')) {
      return { linked: true, user, note: 'Already linked' };
    }
    // Google already on another UID — keep phone session; soft note only
    if (
      code.includes('credential-already-in-use') ||
      code.includes('account-exists-with-different-credential')
    ) {
      return {
        linked: false,
        user,
        note: 'Phone vault unlocked. Google stays available on its own login.',
      };
    }
    console.warn('[AccountLink] link Google failed:', error?.message || error);
    return { linked: false, user, note: error?.message || 'Could not attach Google' };
  }
}

/**
 * Link phone credential into current session, or recover by signing into the
 * phone account (never surface "Already linked with another account").
 */
export async function linkOrRecoverPhoneCredential(verificationId, otpCode) {
  const code = String(otpCode || '').trim();
  if (!verificationId || !/^\d{6}$/.test(code)) {
    throw new Error('Enter the 6-digit OTP');
  }
  const current = auth().currentUser;
  if (!current) {
    throw new Error('Sign in first, then link your mobile number.');
  }

  const prior = snapshotProviders(current);
  const credential = auth.PhoneAuthProvider.credential(verificationId, code);

  try {
    const linked = await current.linkWithCredential(credential);
    return {
      userCredential: linked,
      mode: 'link',
      merged: false,
      prior,
      message: 'Mobile number linked to your account.',
    };
  } catch (linkErr) {
    const linkCode = String(linkErr?.code || '');
    if (linkCode.includes('provider-already-linked')) {
      return {
        userCredential: { user: current, additionalUserInfo: { isNewUser: false } },
        mode: 'link',
        merged: false,
        prior,
        message: 'This mobile is already on your account.',
      };
    }
    if (
      linkCode.includes('credential-already-in-use') ||
      linkCode.includes('account-exists-with-different-credential')
    ) {
      // Switch into the phone vault — same number, one session (no hard error)
      const signed = await auth().signInWithCredential(credential);
      return {
        userCredential: signed,
        mode: 'signIn',
        merged: true,
        prior,
        message:
          'Opened the vault for this mobile. Your Google/email login can be attached next time from Profile.',
      };
    }
    throw linkErr;
  }
}

export default {
  snapshotProviders,
  tryLinkGoogleAfterPhoneSignIn,
  linkOrRecoverPhoneCredential,
};
