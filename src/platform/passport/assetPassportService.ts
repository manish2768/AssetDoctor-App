/**
 * Asset Doctor — Shareable Asset Passport & QR Verification Service
 * Formats public-safe digital passports with zero personal data leakage.
 */

import type { Asset, AssetCategory } from '../../types';

export interface PublicAssetPassport {
  publicId: string;
  isPublic: boolean;
  name: string;
  brand: string;
  category: AssetCategory;
  modelYear?: string | number;
  healthScore: number;
  maintenanceStatus: 'OPTIMAL' | 'SERVICE_DUE' | 'REQUIRES_INSPECTION';
  verificationStatus: 'VERIFIED_OWNERSHIP' | 'SELF_REGISTERED';
  lifecycleStage: string;
  serviceCount: number;
  publicTimelineHighlights: Array<{
    date: string;
    event: string;
    status: string;
  }>;
  shareableUrl: string;
  generatedAt: string;
}

export class AssetPassportService {
  public static readonly BASE_URL = 'https://assetdoctor.in';

  /**
   * Create public-safe passport representation from an internal Asset
   * STRICT PRIVACY WHITELIST: Zero emails, phones, notes, or private invoices.
   */
  public static createPublicPassport(asset: Asset, isPublic = true): PublicAssetPassport {
    // Generate deterministic public verification ID based on asset ID
    const publicId = `pass_${asset.id.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16)}`;
    const serviceCount = asset.serviceLogs ? asset.serviceLogs.length : 0;

    let maintenanceStatus: PublicAssetPassport['maintenanceStatus'] = 'OPTIMAL';
    if (asset.maintenanceDueDate) {
      const diff = new Date(asset.maintenanceDueDate).getTime() - Date.now();
      if (diff < 0) maintenanceStatus = 'SERVICE_DUE';
      else if (diff < 15 * 86400000) maintenanceStatus = 'REQUIRES_INSPECTION';
    }

    const highlights: PublicAssetPassport['publicTimelineHighlights'] = [];
    if (asset.purchaseDate) {
      highlights.push({
        date: asset.purchaseDate,
        event: 'Initial Registration & Invoice Verification',
        status: 'VERIFIED'
      });
    }
    if (asset.serviceLogs && asset.serviceLogs.length > 0) {
      asset.serviceLogs.slice(0, 3).forEach(log => {
        highlights.push({
          date: log.date,
          event: log.serviceType || 'Authorized Upkeep',
          status: 'RECORDED'
        });
      });
    }

    return {
      publicId,
      isPublic,
      name: asset.name,
      brand: asset.brand || 'Universal',
      category: asset.category,
      modelYear: asset.modelYear || (asset.purchaseDate ? asset.purchaseDate.split('-')[0] : undefined),
      healthScore: asset.status === 'expired' ? 74 : asset.status === 'expiring_soon' ? 82 : 94,
      maintenanceStatus,
      verificationStatus: asset.receiptImageUrl ? 'VERIFIED_OWNERSHIP' : 'SELF_REGISTERED',
      lifecycleStage: asset.status === 'expired' ? 'Out of Warranty' : 'Protected Under Coverage',
      serviceCount,
      publicTimelineHighlights: highlights,
      shareableUrl: `${this.BASE_URL}/passport/${publicId}`,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Get QR Verification image URL (using standard vector QR API)
   */
  public static getQrVerificationUrl(publicId: string): string {
    const targetUrl = encodeURIComponent(`${this.BASE_URL}/passport/${publicId}`);
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${targetUrl}&bgcolor=070D18&color=10B981&margin=10`;
  }
}
