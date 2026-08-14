/**
 * Soft-load Expo / native modules so Expo Go (or a missing native binary)
 * never throws a fatal exception at module evaluation time.
 *
 * Metro requires static string literals in require() — never pass a variable.
 */

/** @returns {typeof import('expo-image-manipulator') | null} */
export function getImageManipulator() {
  try {
    // eslint-disable-next-line global-require
    const mod = require('expo-image-manipulator');
    if (!mod?.manipulateAsync) return null;
    return mod;
  } catch (error) {
    console.warn('[safeNativeModules] expo-image-manipulator:', error?.message || error);
    return null;
  }
}

/** @returns {typeof import('expo-image-picker') | null} */
export function getImagePicker() {
  try {
    // eslint-disable-next-line global-require
    const mod = require('expo-image-picker');
    if (!mod?.launchCameraAsync && !mod?.launchImageLibraryAsync) return null;
    return mod;
  } catch (error) {
    console.warn('[safeNativeModules] expo-image-picker:', error?.message || error);
    return null;
  }
}

/** @returns {any} expo-file-system (legacy or modern) or null */
export function getFileSystem() {
  try {
    // eslint-disable-next-line global-require
    return require('expo-file-system/legacy');
  } catch {
    /* try modern entry */
  }
  try {
    // eslint-disable-next-line global-require
    return require('expo-file-system');
  } catch (error) {
    console.warn('[safeNativeModules] expo-file-system:', error?.message || error);
    return null;
  }
}

export default {
  getImageManipulator,
  getImagePicker,
  getFileSystem,
};
