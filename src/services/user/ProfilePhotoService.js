/**
 * Profile avatar upload — Firebase Storage users/{uid}/avatar.jpg
 */

import { Haptics } from '../haptics/triggerHaptic';
import { uploadLocalFile } from '../storage/StorageUploadService';

export async function uploadProfilePhoto(uid, localUri) {
  Haptics.tap();
  if (!uid || !localUri) {
    return { success: false, error: 'Missing user or image' };
  }

  try {
    const path = `users/${uid}/avatar.jpg`;
    const uploaded = await uploadLocalFile(path, localUri, {
      contentType: 'image/jpeg',
      persistFolder: `avatars/${uid}`,
    });
    if (!uploaded.success) {
      Haptics.error();
      return { success: false, error: uploaded.error || 'Photo upload failed', code: uploaded.code };
    }
    Haptics.success();
    return {
      success: true,
      downloadUrl: uploaded.downloadUrl,
      storagePath: path,
    };
  } catch (error) {
    Haptics.error();
    return { success: false, error: error?.message || 'Photo upload failed' };
  }
}

export default { uploadProfilePhoto };
