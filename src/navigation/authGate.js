/**
 * Gate write actions behind login — browse-first UX.
 */

import { Alert } from 'react-native';

const AUTH_BYPASS_FOR_SCAN_TESTING = false;

/**
 * If signed in, run action. Else prompt and open Login modal.
 * @param {{ isAuthenticated: boolean, navigation: any, message?: string, onAuthed?: () => void }} args
 */
export function requireAuth({ isAuthenticated, navigation, message, onAuthed }) {
  if (AUTH_BYPASS_FOR_SCAN_TESTING || isAuthenticated) {
    onAuthed?.();
    return true;
  }

  Alert.alert(
    'Sign in to save',
    message ||
      'Create a free account to save assets, documents and bills securely in your vault.',
    [
      { text: 'Browse more', style: 'cancel' },
      {
        text: 'Sign in',
        onPress: () => openLogin(navigation),
      },
    ],
  );
  return false;
}

/** Navigate to login modal from any nested screen (always allowed — for account switch). */
export function openLogin(navigation, params = {}) {
  const root =
    navigation?.getParent?.()?.getParent?.() ||
    navigation?.getParent?.() ||
    navigation;
  root?.navigate?.('AuthModal', { screen: 'Login', params });
}

export default requireAuth;
