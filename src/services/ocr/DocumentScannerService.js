/**
 * Document capture helper — prefers native document scanner when available,
 * otherwise camera / gallery with crop-friendly ImagePicker.
 * Never throws white-screen crashes — returns null or throws user-facing Error.
 */

import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { compressScanImage } from '../../utils/compressScanImage';

async function tryNativeDocumentScan() {
  try {
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
    if (mode === 'auto' || mode === 'camera') {
      const nativeUri = await tryNativeDocumentScan();
      if (nativeUri) return nativeUri;
    }

    if (mode === 'gallery') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        throw new Error('Photo library permission denied. Enable Photos access in Settings to import invoices.');
      }
      const pick = await ImagePicker.launchImageLibraryAsync({
        quality: 0.85,
        exif: false,
        allowsEditing: true,
        aspect: [3, 4],
      });
      if (pick.canceled || !pick.assets?.[0]?.uri) return null;
      return await compressScanImage(pick.assets[0].uri);
    }

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Camera permission denied. Enable Camera access in Settings to scan invoices.');
    }

    const shot = await ImagePicker.launchCameraAsync({
      quality: 0.85,
      exif: false,
      allowsEditing: Platform.OS !== 'web',
      aspect: [3, 4],
    });
    if (shot.canceled || !shot.assets?.[0]?.uri) return null;
    return await compressScanImage(shot.assets[0].uri);
  } catch (error) {
    console.error('[DocumentScanner] capture failed:', error?.message || error);
    throw error instanceof Error
      ? error
      : new Error(String(error?.message || 'Could not open camera'));
  }
}

export default captureDocumentImage;
