/**
 * Asset Doctor — Share Card capture + export (cardShare)
 *
 * High-res capture + native share for the Refill Impact Card, Fuel Passport
 * and share canvases. Reuses the already-installed react-native-view-shot and
 * react-native-share — no new native deps for export/share.
 *
 * Exposes:
 *   - captureView(shotRef, { width, format }) → tmp file URI
 *   - shareCard(asset, { uri, caption, fileName, mime }) → { success, via }
 *   - quoteInstallUrl() → the QR/store URL (from central config)
 */

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Share } from 'react-native';
import { Share as ShareRN } from 'react-native-share';

import { BRAND } from '../../theme/branding';
import { ASSET_DOCTOR_INSTALL_URL } from '../../config/installUrl';
import { toErrorMessage } from '../../utils/errors';

export interface CaptureOptions {
  width?: number;
  format?: 'png' | 'jpg';
  quality?: number;
}

export interface ShareResult {
  success: boolean;
  via?: string;
  uri?: string;
  error?: string;
}

/**
 * Capture a component tree (via a ViewShot ref) to a temporary high-res file.
 * `shotRef` must point at a react-native-view-shot <ViewShot> node.
 */
export async function captureView(
  shotRef: React.RefObject<any>,
  options: CaptureOptions = {},
): Promise<string | null> {
  if (!shotRef || !shotRef.current) return null;
  try {
    const capture = shotRef.current.capture || shotRef.current?.capture;
    if (typeof capture !== 'function') {
      // Some view-shot versions expose capture as the ref method directly.
      if (typeof shotRef.current === 'function') {
        const uri = await shotRef.current(options ?? {});
        return uri || null;
      }
      return null;
    }
    const uri = await capture({
      format: options.format || 'png',
      quality: options.quality ?? 0.95,
      result: 'tmpfile',
      width: options.width || 1080,
    });
    return uri || null;
  } catch (e) {
    console.warn('[cardShare] captureView failed:', toErrorMessage(e));
    return null;
  }
}

/**
 * Open the native iOS/Android share sheet for a local file with a caption.
 */
export async function shareCard(
  asset: { assetName?: string } | undefined | null,
  input: {
    uri: string;
    caption: string;
    fileName?: string;
    mime?: string;
  },
): Promise<ShareResult> {
  const mime = input.mime || 'image/png';
  try {
    // react-native-share (native module) supports images + custom fileName.
    const title = `${asset?.assetName || 'Vehicle'} · ${BRAND.name}`;
    await ShareRN.open({
      url: input.uri,
      type: mime,
      filename: input.fileName || `asset-doctor-card-${Date.now()}`,
      title,
      message: input.caption,
      failOnCancel: false,
    });
    return { success: true, via: 'share_sheet', uri: input.uri };
  } catch (error) {
    const message = String(error?.message || error || '');
    if (message.toLowerCase().includes('cancel')) {
      return { success: false, error: 'Share cancelled' };
    }
    // Fallback to the system Share for text-only when the native module fails.
    try {
      await Share.share({
        message: input.caption,
        title: `${BRAND.name} Asset Card`,
      });
      return { success: true, via: 'system_share', uri: input.uri };
    } catch (error2) {
      return { success: false, error: toErrorMessage(error2, 'Share failed') };
    }
  }
}

/**
 * The install URL embedded in the QR code + store footer.
 */
export function getInstallUrl(): string {
  return ASSET_DOCTOR_INSTALL_URL;
}

export function isAndroid(): boolean {
  return Platform.OS === 'android';
}

export { FileSystem };

export default {
  captureView,
  shareCard,
  getInstallUrl,
  isAndroid,
};
