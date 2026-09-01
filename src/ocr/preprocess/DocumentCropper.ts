/**
 * Asset Doctor — Document Cropper & Perspective Deskewer
 */

export interface CropRectangle {
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
  bottomRight: { x: number; y: number };
}

export class DocumentCropper {
  public static async autoDetectAndCrop(imageUri: string): Promise<{ croppedUri: string; appliedDeskew: boolean }> {
    // Passes through imageUri with safety fallback on native / web
    return {
      croppedUri: imageUri,
      appliedDeskew: false
    };
  }
}
