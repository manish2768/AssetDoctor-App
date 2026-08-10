/**
 * Resize / compress bill photos before OCR / Gemini to avoid OOM crashes.
 * Soft-loads expo-image-manipulator so a missing native module cannot blank the app at boot.
 */

/**
 * @param {string} uri
 * @param {{ maxWidth?: number, compress?: number }} [opts]
 * @returns {Promise<string>} local file uri
 */
export async function compressScanImage(uri, opts = {}) {
  const maxWidth = opts.maxWidth || 1600;
  const compress = opts.compress ?? 0.7;
  if (!uri) return uri;

  try {
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const ImageManipulator = require('expo-image-manipulator');
    if (!ImageManipulator?.manipulateAsync) {
      console.warn('[compressScanImage] expo-image-manipulator unavailable — using original');
      return uri;
    }
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: maxWidth } }],
      {
        compress,
        format: ImageManipulator.SaveFormat?.JPEG || 'jpeg',
      },
    );
    return result?.uri || uri;
  } catch (error) {
    console.warn('[compressScanImage]', error?.message || error);
    return uri;
  }
}

export default compressScanImage;
