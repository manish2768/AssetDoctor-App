/**
 * File upload validation — type, size, extension, MIME.
 * Do not trust extension alone; Storage rules still enforce contentType.
 */

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/gif',
  'application/pdf',
]);

const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif', 'pdf']);

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // align with storage.rules
export const MAX_OCR_IMAGE_BYTES = 10 * 1024 * 1024;

export function validateUploadFile({
  contentType,
  fileName,
  sizeBytes,
  purpose = 'document',
} = {}) {
  const mime = String(contentType || '').toLowerCase().split(';')[0].trim();
  const ext = String(fileName || '')
    .split('.')
    .pop()
    .toLowerCase();

  if (mime && !ALLOWED_MIME.has(mime)) {
    return { ok: false, error: 'UNSUPPORTED_TYPE', message: 'Unsupported file type' };
  }
  if (ext && !ALLOWED_EXT.has(ext)) {
    return { ok: false, error: 'UNSUPPORTED_EXTENSION', message: 'Unsupported file extension' };
  }
  if (mime && ext) {
    const mimeOk =
      (mime === 'application/pdf' && ext === 'pdf') ||
      (mime.startsWith('image/') && ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif'].includes(ext));
    if (!mimeOk) {
      return {
        ok: false,
        error: 'TYPE_MISMATCH',
        message: 'File extension does not match content type',
      };
    }
  }

  const max = purpose === 'ocr' ? MAX_OCR_IMAGE_BYTES : MAX_UPLOAD_BYTES;
  if (sizeBytes != null && Number(sizeBytes) > max) {
    return {
      ok: false,
      error: 'FILE_TOO_LARGE',
      message: `File exceeds ${Math.round(max / (1024 * 1024))} MB limit`,
    };
  }
  if (sizeBytes != null && Number(sizeBytes) < 16) {
    return { ok: false, error: 'FILE_EMPTY', message: 'File is empty or unreadable' };
  }

  return { ok: true, contentType: mime || null, extension: ext || null };
}

export default {
  validateUploadFile,
  MAX_UPLOAD_BYTES,
  MAX_OCR_IMAGE_BYTES,
  ALLOWED_MIME,
};
