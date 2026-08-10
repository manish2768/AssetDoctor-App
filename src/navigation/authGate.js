/**
 * Gate write actions behind login — browse-first UX.
 */

import { Alert } from 'react-native';

/**
 * If signed in, run action. Else prompt and open Login modal.
 * @param {{ isAuthenticated: boolean, navigation: any, message?: string, onAuthed?: () => void }} args
 */
export function requireAuth({ isAuthenticated, navigation, message, onAuthed }) {
  if (isAuthenticated) {
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
        onPress: () => {
          const root = navigation?.getParent?.()?.getParent?.() || navigation?.getParent?.() || navigation;
          root?.navigate?.('AuthModal', { screen: 'Login' });
        },
      },
    ],
  );
  return false;
}

/** Navigate to login modal from any nested screen */
export function openLogin(navigation, params = {}) {
  const root =
    navigation?.getParent?.()?.getParent?.() ||
    navigation?.getParent?.() ||
    navigation;
  root?.navigate?.('AuthModal', { screen: 'Login', params });
}

export default requireAuth;
