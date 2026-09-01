/**
 * Phase 15 — honest image-quality capability.
 * Current pipeline uses file-size / resolution heuristics only.
 * Pixel-level blur / glare / dark / overexposure CV is NOT implemented.
 */

export const IMAGE_QUALITY_CV_REQUIRED = 'IMAGE_QUALITY_CV_REQUIRED';

export const IMAGE_QUALITY_CAPABILITY = Object.freeze({
  blur: 'HEURISTIC_FILE_SIZE_ONLY',
  darkImage: 'NOT_AVAILABLE',
  overexposure: 'NOT_AVAILABLE',
  rotation: 'ASPECT_RATIO_HEURISTIC',
  cropping: 'RESOLUTION_HEURISTIC',
  partialDocument: 'RESOLUTION_HEURISTIC',
  glare: 'NOT_AVAILABLE',
  lowResolution: 'AVAILABLE',
  multiPage: 'NOT_AVAILABLE',
  futureRequirement: IMAGE_QUALITY_CV_REQUIRED,
});

export function canReliablyDetect(kind: keyof typeof IMAGE_QUALITY_CAPABILITY): boolean {
  return IMAGE_QUALITY_CAPABILITY[kind] === 'AVAILABLE';
}
