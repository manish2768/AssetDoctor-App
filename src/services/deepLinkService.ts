/**
 * Asset Doctor — Deep Link & Cross-Platform Bridge Service
 * Formats canonical asset deep-link URIs with safe web fallbacks.
 */

export interface DeepLinkTarget {
  assetId?: string;
  view?: 'vault' | 'asset_detail' | 'tool' | 'document';
  toolSlug?: string;
}

export class DeepLinkService {
  public static readonly NATIVE_SCHEME = 'assetdoctor://';
  public static readonly WEB_BASE_URL = 'https://assetdoctor.in';

  /**
   * Generate mobile native deep link
   */
  public static getNativeAppUri(target: DeepLinkTarget): string {
    if (target.assetId) {
      return `${this.NATIVE_SCHEME}asset/${target.assetId}`;
    }
    if (target.toolSlug) {
      return `${this.NATIVE_SCHEME}tool/${target.toolSlug.replace(/^tools\//, '')}`;
    }
    return `${this.NATIVE_SCHEME}vault`;
  }

  /**
   * Generate canonical web URL for the same asset/tool
   */
  public static getWebUrl(target: DeepLinkTarget): string {
    if (target.assetId) {
      return `${this.WEB_BASE_URL}/?view=vault&assetId=${target.assetId}`;
    }
    if (target.toolSlug) {
      const clean = target.toolSlug.startsWith('tools/') ? target.toolSlug : `tools/${target.toolSlug}`;
      return `${this.WEB_BASE_URL}/${clean}`;
    }
    return `${this.WEB_BASE_URL}/?view=vault`;
  }

  /**
   * Attempt to open native app with graceful fallback to web URL
   */
  public static openAssetCrossPlatform(assetId: string): void {
    const webFallback = this.getWebUrl({ assetId });
    const nativeUri = this.getNativeAppUri({ assetId });

    // In a browser environment, standard intent or direct fallback
    if (typeof window !== 'undefined') {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        // Try native URI, then timeout to web fallback
        const start = Date.now();
        window.location.href = nativeUri;
        setTimeout(() => {
          if (Date.now() - start < 1500) {
            window.location.href = webFallback;
          }
        }, 1000);
      } else {
        // Desktop browser -> Direct web route
        window.location.href = webFallback;
      }
    }
  }
}
