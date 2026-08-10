/**
 * Document capture helper — camera/gallery only after permission is granted.
 * Never opens a null camera view; returns null or a user-facing Error.
 */

import { Linking, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { compressScanImage } from '../../utils/compressScanImage';

const GALLERY_PICKER_OPTIONS = {
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  quality: 0.85,
  exif: false,
  allowsEditing: true,
  aspect: [3, 4],
};

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
      status: asked?.canAskAgain === false ? 'denied' : 'denied',
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

async function tryNativeDocumentScan() {
  try {
    // Only attempt native scanner when camera permission is already granted
    const perm = await ensureCameraPermission();
    if (!perm.granted) return null;

    // Optional native module (present after a custom-dev-client / EAS build with the plugin)
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const DocumentScanner = require('react-native-document-scanner-plugin').default;
    if (!DocumentScanner?.scanDocument) return null;

    const { scannedImages } = await DocumentScanner.scanDocument({
      maxNumDocuments: 1,
      croppedImageQuality: 80,
    });
    const uri = scannedImages?.[0];
    if (!uri) return null;
    return await compressScanImage(uri);
  } catch (error) {
    console.warn('[DocumentScanner] native unavailable:', error?.message || error);
    return null;
  }
}

/**
 * @param {'camera'|'gallery'|'auto'} mode
 * @returns {Promise<string|null>} compressed image uri
 */
export async function captureDocumentImage(mode = 'auto') {
  try {
    if (mode === 'gallery') {
      const perm = await ensureLibraryPermission();
      if (!perm.granted) {
        throw new Error(
          'Photo library permission denied. Enable Photos access in Settings to import invoices.',
        );
      }
      const pick = await ImagePicker.launchImageLibraryAsync(GALLERY_PICKER_OPTIONS);
      if (pick.canceled || !pick.assets?.[0]?.uri) return null;
      return await compressScanImage(pick.assets[0].uri);
    }

    // camera / auto
    const perm = await ensureCameraPermission();
    if (!perm.granted) {
      throw new Error(
        'Camera permission denied. Enable Camera access in Settings to scan invoices.',
      );
    }

    if (mode === 'auto' || mode === 'camera') {
      const nativeUri = await tryNativeDocumentScan();
      if (nativeUri) return nativeUri;
    }

    const shot = await ImagePicker.launchCameraAsync({
      quality: 0.85,
      exif: false,
      allowsEditing: Platform.OS !== 'web',
      aspect: [3, 4],
    });
    if (shot.canceled || !shot.assets?.[0]?.uri) return null;
    if (!shot.assets?.[0]?.uri) {
      throw new Error('Could not capture image. Please try again.');
    }
    return await compressScanImage(shot.assets[0].uri);
  } catch (error) {
    console.error('[DocumentScanner] capture failed:', error?.message || error);
    const msg = String(error?.message || '');
    if (/permission/i.test(msg)) {
      throw error instanceof Error ? error : new Error(msg);
    }
    throw new Error(
      msg && msg.length < 160 ? msg : 'Could not capture image. Please try again.',
    );
  }
}

/**
 * Pick a bill image from the device gallery (Images only).
 * Returns a local URI or null if cancelled.
 */
export async function pickGalleryImage() {
  try {
    const perm = await ensureLibraryPermission();
    if (!perm.granted) {
      throw new Error(
        'Photo library permission denied. Enable Photos access in Settings to import invoices.',
      );
    }
    const pick = await ImagePicker.launchImageLibraryAsync(GALLERY_PICKER_OPTIONS);
    if (pick.canceled || !pick.assets?.[0]?.uri) return null;
    return pick.assets[0].uri;
  } catch (error) {
    console.error('[DocumentScanner] gallery pick failed:', error?.message || error);
    const msg = String(error?.message || '');
    if (/permission/i.test(msg)) {
      throw error instanceof Error ? error : new Error(msg);
    }
    throw new Error(
      msg && msg.length < 160 ? msg : 'Could not open gallery. Please try again.',
    );
  }
}

export function openAppSettings() {
  return Linking.openSettings().catch(() => null);
}

export default captureDocumentImage;
