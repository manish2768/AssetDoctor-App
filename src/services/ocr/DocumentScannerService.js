/**
 * Document capture:
 * 1) Prefer Google ML Kit Document Scanner (edge detect + auto capture)
 * 2) Fall back to expo-image-picker camera / gallery
 *
 * Always call markScanSession('ScanBill') before launch — Android may recreate
 * the Activity when the scanner Activity finishes.
 */

import { Linking, Platform } from 'react-native';

import {
  compressScanImage,
  SCAN_IMAGE_COMPRESS,
  SCAN_IMAGE_MAX_WIDTH,
} from '../../utils/compressScanImage';
import { getImageManipulator, getImagePicker } from '../../utils/safeNativeModules';

/** Soft-load ML Kit scanner — missing native binary must not crash at import. */
function getDocumentScanner() {
  try {
    // eslint-disable-next-line global-require
    const mod = require('react-native-document-scanner-plugin');
    const scanner = mod?.default || mod;
    if (typeof scanner?.scanDocument === 'function') return scanner;
    return null;
  } catch (error) {
    console.warn('[DocumentScanner] plugin unavailable:', error?.message || error);
    return null;
  }
}

/** Prefer MediaTypeOptions when present; else modern string array. */
function resolveMediaTypes(ImagePicker) {
  return ImagePicker?.MediaTypeOptions?.Images || ['images'];
}

function cameraOptions(ImagePicker) {
  return {
    mediaTypes: resolveMediaTypes(ImagePicker),
    allowsEditing: true,
    quality: 0.75,
    base64: false,
    exif: false,
  };
}

function galleryOptions(ImagePicker) {
  return {
    mediaTypes: resolveMediaTypes(ImagePicker),
    allowsEditing: true,
    quality: 0.75,
    base64: false,
    exif: false,
  };
}

/** Resize + JPEG compress (EXIF-upright) immediately after capture/pick. */
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

function normalizeFileUri(path) {
  if (!path || typeof path !== 'string') return null;
  if (path.startsWith('file://') || path.startsWith('content://') || path.startsWith('ph://')) {
    return path;
  }
  // Android ML Kit often returns absolute paths without scheme
  if (path.startsWith('/')) return `file://${path}`;
  return path;
}

/**
 * Live document scanner: hold paper in frame → auto edge detect → crop.
 * @returns {Promise<'unavailable'|null|string>} unavailable | cancel null | compressed uri
 */
export async function scanWithMlKitDocumentScanner() {
  const DocumentScanner = getDocumentScanner();
  if (!DocumentScanner) return 'unavailable';

  try {
    const result = await DocumentScanner.scanDocument({
      maxNumDocuments: 1,
      croppedImageQuality: 85,
      responseType: 'imageFilePath',
    });

    if (result?.status === 'cancel') return null;

    const raw = result?.scannedImages?.[0];
    const uri = normalizeFileUri(raw);
    if (!uri) return null;
    return await compressCapturedUri(uri);
  } catch (error) {
    console.warn('[DocumentScanner] ML Kit scan failed:', error?.message || error);
    return 'unavailable';
  }
}

export async function getCameraPermissionStatus() {
  try {
    const ImagePicker = getImagePicker();
    if (!ImagePicker?.getCameraPermissionsAsync) return 'undetermined';
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
    const ImagePicker = getImagePicker();
    if (!ImagePicker?.getCameraPermissionsAsync) {
      return { granted: false, status: 'denied', error: 'ImagePicker unavailable' };
    }
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
    const ImagePicker = getImagePicker();
    if (!ImagePicker?.getMediaLibraryPermissionsAsync) {
      return { granted: false, status: 'denied', error: 'ImagePicker unavailable' };
    }
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

async function captureWithImagePickerCamera() {
  const ImagePicker = getImagePicker();
  if (!ImagePicker?.launchCameraAsync) {
    throw new Error('Camera picker unavailable on this build.');
  }
  const cam = await ensureCameraPermission();
  if (!cam.granted) {
    throw new Error(
      'Camera permission denied. Enable Camera in Settings to scan invoices.',
    );
  }
  const result = await ImagePicker.launchCameraAsync(cameraOptions(ImagePicker));
  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return compressCapturedUri(result.assets[0].uri);
}

/**
 * Capture document image.
 * mode:
 *  - 'auto' | 'camera' → ML Kit document scanner first, then ImagePicker camera
 *  - 'gallery' → photo library only
 *  - 'photo' → ImagePicker camera only (skip ML Kit)
 *
 * Cancel → returns null (caller must stay on ScanBillScreen).
 *
 * @param {'camera'|'gallery'|'auto'|'photo'} mode
 * @returns {Promise<string|null>} compressed image uri
 */
export async function captureDocumentImage(mode = 'auto') {
  try {
    if (mode === 'gallery') {
      return await pickGalleryImage();
    }

    if (mode !== 'photo') {
      const mlKitUri = await scanWithMlKitDocumentScanner();
      if (mlKitUri && mlKitUri !== 'unavailable') {
        return mlKitUri;
      }
      if (mlKitUri === null) {
        // User cancelled ML Kit UI — stay on ScanBill
        return null;
      }
      // unavailable → fall through to ImagePicker
      console.warn('[DocumentScanner] falling back to ImagePicker camera');
    }

    return await captureWithImagePickerCamera();
  } catch (error) {
    console.error('[ScanBillScreen Error]:', error);
    console.warn('[DocumentScanner] captureDocumentImage:', error?.message || error);
    throw error;
  }
}

export async function pickGalleryImage() {
  const ImagePicker = getImagePicker();
  if (!ImagePicker?.launchImageLibraryAsync) {
    throw new Error('Photo picker unavailable on this build.');
  }
  const perm = await ensureLibraryPermission();
  if (!perm.granted) {
    throw new Error(
      'Photo library permission denied. Enable Photos access in Settings to import invoices.',
    );
  }
  const result = await ImagePicker.launchImageLibraryAsync(galleryOptions(ImagePicker));
  if (result.canceled || !result.assets?.[0]?.uri) return null;
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
  scanWithMlKitDocumentScanner,
  captureDocumentImage,
  pickGalleryImage,
  openAppSettings,
};
