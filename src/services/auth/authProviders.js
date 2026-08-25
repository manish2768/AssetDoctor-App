/**
 * Map Firebase Auth provider IDs → Asset Doctor authProviders labels.
 * Never log tokens / OTP.
 */

/**
 * @param {import('@react-native-firebase/auth').FirebaseAuthTypes.User|null|undefined} user
 * @returns {Array<'google'|'phone'|'email'>}
 */
export function authProvidersFromUser(user) {
  const out = new Set();
  for (const p of user?.providerData || []) {
    const id = String(p?.providerId || '');
    if (id === 'google.com') out.add('google');
    else if (id === 'phone') out.add('phone');
    else if (id === 'password') out.add('email');
  }
  if (user?.phoneNumber) out.add('phone');
  if (user?.email && !out.has('google') && !out.has('email')) {
    // Email present without password provider (rare) — still record email identity
    if ((user.providerData || []).some((p) => p.providerId === 'password')) {
      out.add('email');
    }
  }
  return [...out];
}

/**
 * Merge prior Firestore authProviders with live Firebase providers.
 * @param {string[]|undefined} prior
 * @param {string[]} next
 */
export function mergeAuthProviders(prior, next) {
  const set = new Set();
  for (const p of [...(prior || []), ...(next || [])]) {
    const k = String(p || '').toLowerCase();
    if (k === 'google' || k === 'phone' || k === 'email') set.add(k);
  }
  return [...set];
}

export default { authProvidersFromUser, mergeAuthProviders };
