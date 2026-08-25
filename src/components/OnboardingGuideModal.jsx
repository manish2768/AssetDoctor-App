/**
 * OnboardingGuideModal — first-run guide for new users.
 * Wraps the existing full-screen OnboardingScreen for pack naming consistency.
 */

import React from 'react';
import { Modal } from 'react-native';

import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen';

/**
 * @param {{ visible: boolean, onDone: () => void }} props
 */
export function OnboardingGuideModal({ visible, onDone }) {
  if (!visible) return null;
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onDone}>
      <OnboardingScreen onDone={onDone} />
    </Modal>
  );
}

export { OnboardingScreen };
export default OnboardingGuideModal;
