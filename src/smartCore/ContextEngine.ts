/**
 * Smart Core — Context Engine
 *
 * Pillar 4: 6-Dimension Context Resolution & Actionable Intelligence.
 *
 * Resolves:
 * 1. WHO: Customer identity
 * 2. WHAT: Canonical asset
 * 3. DOCUMENT: Scanned or viewed document type
 * 4. HISTORY: Prior service records, readings, or past policies
 * 5. STATE: Active, Expiring, Expired, Incomplete
 * 6. NEXT ACTION: Concrete, contextual next step for the customer
 */

import { resolveCanonicalAssetId } from '../services/assets/assetIdentity';

export interface SmartContext {
  who: {
    userId: string;
    userName?: string;
  };
  what: {
    assetId: string | null;
    assetName: string;
    category?: string;
    identifier?: string;
  };
  document: {
    documentType: string;
    documentNumber?: string;
    date?: string;
  };
  history: {
    previousServiceKm?: number | null;
    previousReading?: number | null;
    recordCount: number;
  };
  state: {
    healthStatus: 'HEALTHY' | 'AT_RISK' | 'EXPIRED' | 'MISSING_DATA' | 'UNKNOWN';
    urgencyDays?: number | null;
    summary: string;
  };
  nextAction: {
    title: string;
    description: string;
    actionType: 'RENEW_POLICY' | 'GET_PUC' | 'BOOK_SERVICE' | 'VERIFY_READING' | 'VIEW_PASSPORT' | 'NONE';
  };
}

export class ContextEngine {
  /**
   * Resolve friendly name for an asset.
   */
  public static resolveAssetName(asset: any): string {
    if (!asset || typeof asset !== 'object') return 'Asset';
    return (
      asset.assetName ||
      asset.name ||
      (asset.brand && asset.model ? `${asset.brand} ${asset.model}` : null) ||
      asset.brandName ||
      asset.registration ||
      asset.registrationNumber ||
      'Your Asset'
    );
  }

  /**
   * Formulate highly contextual notification titles and messages.
   * E.g.: "Your Honda City insurance expires in 18 days."
   */
  public static formatExpiryNotification(
    asset: any,
    field: 'insuranceExpiry' | 'pucExpiry' | 'warrantyExpiry' | string,
    daysRemaining: number,
  ): { title: string; body: string } {
    const assetName = ContextEngine.resolveAssetName(asset);

    const docName =
      field === 'pucExpiry'
        ? 'PUC'
        : field === 'insuranceExpiry'
        ? 'insurance'
        : field === 'warrantyExpiry'
        ? 'warranty'
        : 'protection';

    if (daysRemaining < 0) {
      const pastDays = Math.abs(daysRemaining);
      return {
        title: `${docName.toUpperCase()} Expired: ${assetName}`,
        body: `Your ${assetName} ${docName} expired ${pastDays} day${pastDays === 1 ? '' : 's'} ago. Renew immediately to stay compliant.`,
      };
    }

    if (daysRemaining === 0) {
      return {
        title: `${docName.toUpperCase()} Expires Today: ${assetName}`,
        body: `Your ${assetName} ${docName} expires today. Take action now to prevent fines or lapse of coverage.`,
      };
    }

    return {
      title: `${docName.toUpperCase()} Reminder: ${assetName}`,
      body: `Your ${assetName} ${docName} expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}.`,
    };
  }

  /**
   * Synthesize complete 6-dimension context.
   */
  public static resolveContext(params: {
    user?: any;
    asset?: any;
    documentType?: string;
    documentData?: any;
    historyRecords?: any[];
  }): SmartContext {
    const { user, asset, documentType = 'GENERAL_DOCUMENT', documentData = {}, historyRecords = [] } = params;

    const assetName = ContextEngine.resolveAssetName(asset);
    const assetId = resolveCanonicalAssetId(asset);

    const who = {
      userId: user?.uid || user?.id || 'anonymous_user',
      userName: user?.displayName || user?.name || undefined,
    };

    const what = {
      assetId,
      assetName,
      category: asset?.categoryId || asset?.category || undefined,
      identifier: asset?.registration || asset?.serialNumber || asset?.chassisNumber || undefined,
    };

    const doc = {
      documentType,
      documentNumber: documentData.invoiceNumber || documentData.policyNumber || documentData.certificateNumber || undefined,
      date: documentData.serviceDate || documentData.billDate || documentData.issueDate || undefined,
    };

    const history = {
      previousServiceKm: asset?.odometerKm || asset?.odometerReading || null,
      previousReading: historyRecords.length > 0 ? historyRecords[0]?.currentMeterReading || null : null,
      recordCount: historyRecords.length,
    };

    // Determine state and next action
    let healthStatus: SmartContext['state']['healthStatus'] = 'HEALTHY';
    let urgencyDays: number | null = null;
    let summary = `${assetName} is protected and active.`;
    let nextAction: SmartContext['nextAction'] = {
      title: 'Passport Up to Date',
      description: 'All documents are active and verified.',
      actionType: 'VIEW_PASSPORT',
    };

    if (documentType === 'VEHICLE_INSURANCE') {
      const expiry = documentData.policyExpiryDate || documentData.insuranceExpiry;
      if (expiry) {
        const diff = Math.ceil((new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        urgencyDays = diff;
        if (diff < 0) {
          healthStatus = 'EXPIRED';
          summary = `Insurance policy expired ${Math.abs(diff)} days ago.`;
          nextAction = {
            title: 'Renew Insurance',
            description: `Renew insurance for ${assetName} immediately.`,
            actionType: 'RENEW_POLICY',
          };
        } else if (diff <= 15) {
          healthStatus = 'AT_RISK';
          summary = `Insurance policy expires in ${diff} days.`;
          nextAction = {
            title: 'Renew Insurance Soon',
            description: `Get renewal quotes for ${assetName}.`,
            actionType: 'RENEW_POLICY',
          };
        }
      }
    } else if (documentType === 'VEHICLE_PUC') {
      const expiry = documentData.validUntil || documentData.pucExpiry;
      if (expiry) {
        const diff = Math.ceil((new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        urgencyDays = diff;
        if (diff < 0) {
          healthStatus = 'EXPIRED';
          summary = `PUC certificate expired ${Math.abs(diff)} days ago.`;
          nextAction = {
            title: 'Get New PUC',
            description: `Visit an authorized testing centre to avoid fine.`,
            actionType: 'GET_PUC',
          };
        }
      }
    }

    return {
      who,
      what,
      document: doc,
      history,
      state: {
        healthStatus,
        urgencyDays,
        summary,
      },
      nextAction,
    };
  }
}
