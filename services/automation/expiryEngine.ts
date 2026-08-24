/**
 * Asset Doctor — Server-Side Expiry Surveillance & Notification Automation Engine
 * Runs in Asia/Kolkata timezone with strict idempotency and consent enforcement.
 */

import type { NotificationQueueItem, TemplateKey } from './types.ts';

export interface ExpiryEvaluationResult {
  assetId: string;
  assetName: string;
  category: string;
  identifier: string;
  ownerUid: string;
  coverageType: 'insurance' | 'warranty' | 'puc' | 'service';
  expiryDate: string;
  daysRemaining: number;
  reminderWindow: '30d' | '15d' | '7d' | '1d' | '0d' | 'expired' | 'none';
  templateKey?: TemplateKey;
  idempotencyKey?: string;
}

export interface ProcessingSummary {
  evaluatedAssets: number;
  generatedReminders: number;
  skippedConsents: number;
  duplicatePrevented: number;
  errors: number;
  details: any[];
}

/**
 * Timezone-aware date difference calculator in Asia/Kolkata (IST).
 * Avoids off-by-one errors from UTC shifts on date-only fields (YYYY-MM-DD).
 */
export function calculateDaysRemainingIST(expiryDateStr: string, referenceDateIST?: Date): { daysRemaining: number; valid: boolean; normalizedDate: string } {
  if (!expiryDateStr || typeof expiryDateStr !== 'string') {
    return { daysRemaining: 0, valid: false, normalizedDate: '' };
  }

  // Parse YYYY-MM-DD or ISO string
  const cleanDateStr = expiryDateStr.split('T')[0].trim();
  const parts = cleanDateStr.split('-');
  if (parts.length !== 3) {
    return { daysRemaining: 0, valid: false, normalizedDate: cleanDateStr };
  }

  const expYear = parseInt(parts[0], 10);
  const expMonth = parseInt(parts[1], 10) - 1; // 0-indexed
  const expDay = parseInt(parts[2], 10);

  // Expiry date at midnight UTC
  const expUtc = Date.UTC(expYear, expMonth, expDay);

  // Reference date in Asia/Kolkata
  const now = referenceDateIST || new Date();
  const istFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const istParts = istFormatter.format(now).split('-');
  const nowYear = parseInt(istParts[0], 10);
  const nowMonth = parseInt(istParts[1], 10) - 1;
  const nowDay = parseInt(istParts[2], 10);
  const nowUtc = Date.UTC(nowYear, nowMonth, nowDay);

  const diffMs = expUtc - nowUtc;
  const daysRemaining = Math.round(diffMs / (1000 * 60 * 60 * 24));

  return {
    daysRemaining,
    valid: !isNaN(daysRemaining),
    normalizedDate: cleanDateStr
  };
}

/**
 * Maps days remaining to operational notification window
 */
export function determineReminderWindow(daysRemaining: number): '30d' | '15d' | '7d' | '1d' | '0d' | 'expired' | 'none' {
  if (daysRemaining === 30) return '30d';
  if (daysRemaining === 15) return '15d';
  if (daysRemaining === 7) return '7d';
  if (daysRemaining === 1) return '1d';
  if (daysRemaining === 0) return '0d';
  if (daysRemaining < 0 && daysRemaining >= -3) return 'expired'; // Notify within 3 days of expiration
  return 'none';
}

/**
 * Generate unique idempotency key for reminder deduplication
 */
export function generateIdempotencyKey(userId: string, assetId: string, coverageType: string, expiryDate: string, window: string): string {
  return `${userId}_${assetId}_${coverageType.toLowerCase()}_${expiryDate}_${window}`;
}

/**
 * Evaluate single asset against all coverage types (Insurance, Warranty, PUC, Service)
 */
export function evaluateAssetExpiries(asset: any, referenceDateIST?: Date): ExpiryEvaluationResult[] {
  const results: ExpiryEvaluationResult[] = [];
  const ownerUid = asset.ownerUid || asset.uid || 'unknown';
  const assetId = asset.id || 'unknown';
  const assetName = asset.assetName || asset.name || 'Asset';
  const category = asset.categoryLabel || asset.category || 'Other';
  const identifier = asset.registration || asset.registrationNumber || asset.serialNumber || '—';

  const checkConfigs: Array<{ type: 'insurance' | 'warranty' | 'puc'; dateStr: string }> = [
    { type: 'insurance', dateStr: asset.insuranceExpiry },
    { type: 'warranty', dateStr: asset.warrantyExpiry },
    { type: 'puc', dateStr: asset.pucExpiry }
  ];

  for (const item of checkConfigs) {
    if (item.dateStr) {
      const { daysRemaining, valid, normalizedDate } = calculateDaysRemainingIST(item.dateStr, referenceDateIST);
      if (valid) {
        const window = determineReminderWindow(daysRemaining);
        let templateKey: TemplateKey | undefined;

        if (window === '30d') templateKey = `${item.type}_expiry_30d` as TemplateKey;
        else if (window === '15d') templateKey = `${item.type}_expiry_15d` as TemplateKey;
        else if (window === '7d') templateKey = `${item.type}_expiry_7d` as TemplateKey;
        else if (window === '1d') templateKey = `${item.type}_expiry_1d` as TemplateKey;
        else if (window === '0d' || window === 'expired') templateKey = `${item.type}_expired` as TemplateKey;

        results.push({
          assetId,
          assetName,
          category,
          identifier,
          ownerUid,
          coverageType: item.type,
          expiryDate: normalizedDate,
          daysRemaining,
          reminderWindow: window,
          templateKey,
          idempotencyKey: window !== 'none' ? generateIdempotencyKey(ownerUid, assetId, item.type, normalizedDate, window) : undefined
        });
      }
    }
  }

  // Check maintenance / periodic service
  if (asset.maintenanceDueDate) {
    const { daysRemaining, valid, normalizedDate } = calculateDaysRemainingIST(asset.maintenanceDueDate, referenceDateIST);
    if (valid && (daysRemaining === 7 || daysRemaining === 1 || daysRemaining === 0)) {
      const window = daysRemaining === 0 ? '0d' : daysRemaining === 1 ? '1d' : '7d';
      results.push({
        assetId,
        assetName,
        category,
        identifier,
        ownerUid,
        coverageType: 'service',
        expiryDate: normalizedDate,
        daysRemaining,
        reminderWindow: window,
        templateKey: 'service_due',
        idempotencyKey: generateIdempotencyKey(ownerUid, assetId, 'service', normalizedDate, window)
      });
    }
  }

  return results;
}

/**
 * Server-Side Expiry Surveillance Engine
 * Evaluates all vaulted assets and queues reminders in Firestore.
 */
export async function runServerExpirySurveillance(
  firestoreDb: any,
  options?: { referenceDateIST?: Date; dryRun?: boolean }
): Promise<ProcessingSummary> {
  const summary: ProcessingSummary = {
    evaluatedAssets: 0,
    generatedReminders: 0,
    skippedConsents: 0,
    duplicatePrevented: 0,
    errors: 0,
    details: []
  };

  const refDate = options?.referenceDateIST || new Date();
  const nowIso = new Date().toISOString();

  try {
    // 1. Fetch all assets via collectionGroup
    const assetsSnap = await firestoreDb.collectionGroup('Assets').get();
    summary.evaluatedAssets = assetsSnap.size;

    // 2. Fetch all user profiles for consent checking
    const usersSnap = await firestoreDb.collection('users').get();
    const userMap = new Map<string, any>();
    usersSnap.forEach((doc: any) => userMap.set(doc.id, doc.data()));

    const upperUsersSnap = await firestoreDb.collection('Users').get();
    upperUsersSnap.forEach((doc: any) => {
      if (!userMap.has(doc.id)) userMap.set(doc.id, doc.data());
    });

    // 3. Process each asset
    for (const doc of assetsSnap.docs) {
      const assetData = { id: doc.id, ...doc.data() };
      const pathParts = doc.ref.path.split('/');
      const ownerUid = pathParts[1] || assetData.ownerUid || assetData.uid;
      assetData.ownerUid = ownerUid;

      const evaluations = evaluateAssetExpiries(assetData, refDate);

      for (const evalItem of evaluations) {
        if (evalItem.reminderWindow === 'none' || !evalItem.templateKey || !evalItem.idempotencyKey) {
          continue;
        }

        // Deduplication Check: Query notification_queue by idempotencyKey
        const existingQueueSnap = await firestoreDb
          .collection('notification_queue')
          .where('idempotencyKey', '==', evalItem.idempotencyKey)
          .limit(1)
          .get();

        if (!existingQueueSnap.empty) {
          summary.duplicatePrevented++;
          continue;
        }

        // Check customer consent & contact info
        const user = userMap.get(ownerUid) || {};
        const userName = user.name || 'Valued Customer';
        const recipientPhone = user.phoneNumber || user.phone || '';
        const whatsappOptIn = Boolean(user.whatsappOptIn ?? user.optInWhatsApp ?? true); // Default true for notifications if opted-in

        let initialStatus: 'queued' | 'skipped' = 'queued';
        let failureReason: string | null = null;

        if (!whatsappOptIn) {
          initialStatus = 'skipped';
          failureReason = 'whatsapp_opt_in_required';
          summary.skippedConsents++;
        } else if (!recipientPhone) {
          initialStatus = 'skipped';
          failureReason = 'missing_recipient_phone';
          summary.skippedConsents++;
        }

        const queueItem: NotificationQueueItem = {
          userId: ownerUid,
          assetId: evalItem.assetId,
          eventType: `expiry_${evalItem.coverageType}`,
          channel: 'whatsapp',
          templateKey: evalItem.templateKey,
          recipientPhone,
          payload: {
            userName,
            assetName: evalItem.assetName,
            identifier: evalItem.identifier,
            expiryDate: evalItem.expiryDate,
            daysRemaining: evalItem.daysRemaining,
            coverageType: evalItem.coverageType.toUpperCase(),
            dueDate: evalItem.expiryDate
          },
          status: initialStatus,
          scheduledAt: nowIso,
          createdAt: nowIso,
          failureReason,
          idempotencyKey: evalItem.idempotencyKey,
          retryCount: 0
        };

        if (!options?.dryRun) {
          await firestoreDb.collection('notification_queue').add(queueItem);
          
          // Also log to admin activity for real-time surveillance
          await firestoreDb.collection('adminActivity').add({
            type: 'NOTIFICATION_GENERATED',
            action: `Generated ${evalItem.coverageType.toUpperCase()} Reminder (${evalItem.reminderWindow})`,
            customerUid: ownerUid,
            customerName: userName,
            assetTitle: evalItem.assetName,
            priority: evalItem.reminderWindow === '1d' || evalItem.reminderWindow === '0d' || evalItem.reminderWindow === 'expired' ? 'HIGH' : 'INFO',
            source: 'EXPIRY_AUTOMATION_ENGINE',
            timestamp: nowIso,
            status: initialStatus === 'queued' ? 'QUEUED' : 'SKIPPED'
          });
        }

        summary.generatedReminders++;
        summary.details.push({
          idempotencyKey: evalItem.idempotencyKey,
          template: evalItem.templateKey,
          status: initialStatus,
          reason: failureReason
        });
      }
    }
  } catch (err: any) {
    summary.errors++;
    console.error('[ExpirySurveillanceEngine Error]', err);
  }

  return summary;
}
