/**
 * Document capture via expo-image-picker only.
 * Never uses Google ML Kit / react-native-document-scanner-plugin
 * (those destroy the Activity on Android and bounce users to Home).
 */

import * as ImagePicker from 'expo-image-picker';
import { Linking, Platform } from 'react-native';

import {
  compressScanImage,
  SCAN_IMAGE_COMPRESS,
  SCAN_IMAGE_MAX_WIDTH,
} from '../../utils/compressScanImage';
import { getImageManipulator } from '../../utils/safeNativeModules';

/** Prefer MediaTypeOptions when present; else modern string array. */
function resolveMediaTypes() {
  return ImagePicker.MediaTypeOptions?.Images || ['images'];
}

/** Camera options — Expo ImagePicker (no ML Kit document scanner). */
function cameraOptions() {
  return {
    mediaTypes: resolveMediaTypes(),
    allowsEditing: true,
    quality: 0.5,
    base64: false,
    exif: false,
  };
}

/** Gallery options — same picker stack, slightly leaner. */
function galleryOptions() {
  return {
    mediaTypes: resolveMediaTypes(),
    allowsEditing: true,
    quality: 0.5,
    base64: false,
    exif: false,
  };
}

/** Resize to min 1200px + JPEG 0.6 (EXIF-upright) immediately after capture/pick. */
async function compressCapturedUri(uri) {
  if (!uri) return uri;
  try {
    const ImageManipulator = getImageManipulator();
    if (ImageManipulator?.manipulateAsync) {
      const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: SCAN_IMAGE_MAX_WIDTH } }],
        {
          compress: SCAN_IMAGE_COMPRESS,
          format: ImageManipulator.SaveFormat?.JPEG || 'jpeg',
          base64: false,
        },
      );
      if (manipulated?.uri) return manipulated.uri;
    }
  } catch (error) {
    console.warn('[DocumentScanner] manipulator failed:', error?.message || error);
  }
  return compressScanImage(uri, {
    maxWidth: SCAN_IMAGE_MAX_WIDTH,
    compress: SCAN_IMAGE_COMPRESS,
  });
}

export async function getCameraPermissionStatus() {
  try {
    const current = await ImagePicker.getCameraPermissionsAsync();
    if (current?.granted) return 'granted';
    if (current?.canAskAgain === false) return 'denied';
    return current?.status === 'denied' ? 'denied' : 'undetermined';
  } catch (error) {
    console.warn('[DocumentScanner] getCameraPermissionStatus:', error?.message || error);
    return 'undetermined';
  }
}

export async function ensureCameraPermission() {
  try {
    const current = await ImagePicker.getCameraPermissionsAsync();
    if (current?.granted) return { granted: true, status: 'granted' };

    const asked = await ImagePicker.requestCameraPermissionsAsync();
    if (asked?.granted) return { granted: true, status: 'granted' };

    return {
      granted: false,
      status: 'denied',
      canAskAgain: asked?.canAskAgain !== false,
    };
  } catch (error) {
    console.warn('[DocumentScanner] ensureCameraPermission:', error?.message || error);
    return { granted: false, status: 'denied', error: error?.message };
  }
}

export async function ensureLibraryPermission() {
  try {
    const current = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (current?.granted) return { granted: true, status: 'granted' };
    const asked = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (asked?.granted) return { granted: true, status: 'granted' };
    return { granted: false, status: 'denied', canAskAgain: asked?.canAskAgain !== false };
  } catch (error) {
    console.warn('[DocumentScanner] ensureLibraryPermission:', error?.message || error);
    return { granted: false, status: 'denied', error: error?.message };
  }
}

/**
 * Capture / pick with expo-image-picker only.
 * Cancel → returns null (caller must stay on ScanBillScreen — never Home).
 *
 * @param {'camera'|'gallery'|'auto'} mode
 * @returns {Promise<string|null>} compressed image uri
 */
export async function captureDocumentImage(mode = 'auto') {
  try {
    if (mode === 'gallery') {
      return await pickGalleryImage();
    }

    const cam = await ensureCameraPermission();
    if (!cam.granted) {
      throw new Error(
        'Camera permission denied. Enable Camera in Settings to scan invoices.',
      );
    }

    const result = await ImagePicker.launchCameraAsync(cameraOptions());
    if (result.canceled || !result.assets?.[0]?.uri) {
      // User cancelled — stay on ScanBill; do not navigate Home
      return null;
    }
    return await compressCapturedUri(result.assets[0].uri);
  } catch (error) {
    console.error('[ScanBillScreen Error]:', error);
    console.warn('[DocumentScanner] captureDocumentImage:', error?.message || error);
    throw error;
  }
}

export async function pickGalleryImage() {
  const perm = await ensureLibraryPermission();
  if (!perm.granted) {
    throw new Error(
      'Photo library permission denied. Enable Photos access in Settings to import invoices.',
    );
  }
  const result = await ImagePicker.launchImageLibraryAsync(galleryOptions());
  if (result.canceled || !result.assets?.[0]?.uri) {
    // User cancelled — stay on ScanBill; do not navigate Home
    return null;
  }
  return compressCapturedUri(result.assets[0].uri);
}

export async function openAppSettings() {
  try {
    if (Platform.OS === 'ios') {
      await Linking.openURL('app-settings:');
    } else {
      await Linking.openSettings();
    }
  } catch (error) {
    console.warn('[DocumentScanner] openAppSettings:', error?.message || error);
  }
}

export default {
  getCameraPermissionStatus,
  ensureCameraPermission,
  ensureLibraryPermission,
  captureDocumentImage,
  pickGalleryImage,
  openAppSettings,
};
