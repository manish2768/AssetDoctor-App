/**
 * Asset Doctor — Centralized Operational Event Service
 * Dispatches operational telemetry and queues transactional notifications.
 */

import type { NotificationQueueItem, OperationalEvent, OperationalEventType, TemplateKey } from './types.ts';
import { generateIdempotencyKey } from './expiryEngine.ts';

export class OperationalEventService {
  private db: any;

  constructor(firestoreDb: any) {
    this.db = firestoreDb;
  }

  /**
   * Log an operational event to Firestore
   */
  async logEvent(
    eventType: OperationalEventType,
    userId: string,
    metadata: Record<string, any> = {},
    options?: { assetId?: string; documentId?: string; priority?: 'INFO' | 'SUCCESS' | 'WARNING' | 'HIGH' | 'CRITICAL' }
  ): Promise<string> {
    const now = new Date().toISOString();
    const eventRef = this.db.collection('operational_events').doc();
    const eventId = eventRef.id;

    const eventData: any = {
      eventId,
      eventType,
      userId,
      createdAt: now,
      metadata: metadata || {},
      processed: false
    };

    if (options?.assetId) eventData.assetId = options.assetId;
    if (options?.documentId) eventData.documentId = options.documentId;

    await eventRef.set(eventData);

    // Stream to admin activity for real-time observability
    const actionLabel = this.formatActionLabel(eventType, metadata);
    const activityData: any = {
      type: eventType.toUpperCase(),
      action: actionLabel,
      customerUid: userId,
      customerName: metadata.customerName || metadata.userName || 'Customer',
      customerEmail: metadata.customerEmail || metadata.email || '',
      priority: options?.priority || this.determinePriority(eventType),
      source: metadata.source || 'APPLICATION_EVENT',
      timestamp: now,
      status: metadata.status || 'COMPLETED'
    };

    if (metadata.assetName || metadata.assetTitle) activityData.assetTitle = metadata.assetName || metadata.assetTitle;
    if (metadata.documentType || metadata.docLabel) activityData.documentType = metadata.documentType || metadata.docLabel;

    await this.db.collection('adminActivity').add(activityData);

    // Check if event triggers a transactional notification
    await this.maybeQueueTransactionalNotification(eventType, userId, metadata, options);

    return eventId;
  }

  /**
   * Queue transactional notifications for critical events
   */
  private async maybeQueueTransactionalNotification(
    eventType: OperationalEventType,
    userId: string,
    metadata: Record<string, any>,
    options?: { assetId?: string; documentId?: string }
  ): Promise<void> {
    let templateKey: TemplateKey | null = null;
    let window = 'realtime';

    if (eventType === 'document_uploaded') templateKey = 'document_uploaded';
    else if (eventType === 'ocr_completed') templateKey = 'ocr_completed';
    else if (eventType === 'support_ticket_created') templateKey = 'support_ticket_created';
    else if (eventType === 'support_ticket_resolved') templateKey = 'support_ticket_resolved';
    else if (eventType === 'insurance_renewed') templateKey = 'renewal_confirmed';

    if (!templateKey) return;

    const idempotencyKey = generateIdempotencyKey(
      userId,
      options?.assetId || options?.documentId || 'txn',
      eventType,
      new Date().toISOString().split('T')[0],
      metadata.ticketId || metadata.docId || window
    );

    // Deduplication check
    const existing = await this.db.collection('notification_queue')
      .where('idempotencyKey', '==', idempotencyKey)
      .limit(1)
      .get();

    if (!existing.empty) return;

    // Fetch recipient user details
    let userSnap = await this.db.collection('users').doc(userId).get();
    if (!userSnap.exists) {
      userSnap = await this.db.collection('Users').doc(userId).get();
    }

    const userData = userSnap.exists ? userSnap.data() : {};
    const userName = userData.name || metadata.userName || 'Valued Customer';
    const recipientPhone = userData.phoneNumber || userData.phone || metadata.phone || '';
    const whatsappOptIn = Boolean(userData.whatsappOptIn ?? userData.optInWhatsApp ?? true);

    let status: 'queued' | 'skipped' = 'queued';
    let failureReason: string | null = null;

    if (!whatsappOptIn) {
      status = 'skipped';
      failureReason = 'whatsapp_opt_in_required';
    } else if (!recipientPhone) {
      status = 'skipped';
      failureReason = 'missing_recipient_phone';
    }

    const now = new Date().toISOString();
    const queueItem: any = {
      userId,
      eventType,
      channel: 'whatsapp',
      templateKey,
      recipientPhone,
      payload: {
        userName,
        assetName: metadata.assetName || metadata.assetTitle || 'Asset',
        identifier: metadata.registration || metadata.serialNumber || '—',
        docLabel: metadata.docLabel || metadata.documentType || 'Document',
        ticketId: metadata.ticketId || '—',
        resolutionNote: metadata.resolutionNote || 'Inquiry resolved by team',
        coverageType: metadata.coverageType || 'Insurance',
        newExpiryDate: metadata.newExpiryDate || '—'
      },
      status,
      scheduledAt: now,
      createdAt: now,
      idempotencyKey,
      retryCount: 0
    };

    if (options?.assetId) queueItem.assetId = options.assetId;
    if (options?.documentId) queueItem.documentId = options.documentId;
    if (failureReason) queueItem.failureReason = failureReason;

    await this.db.collection('notification_queue').add(queueItem);
  }

  private formatActionLabel(eventType: OperationalEventType, meta: Record<string, any>): string {
    switch (eventType) {
      case 'customer_login': return 'Customer Logged In';
      case 'asset_created': return `Added Asset (${meta.assetName || 'Vehicle/Appliance'})`;
      case 'asset_updated': return `Updated Asset (${meta.assetName || 'Vehicle/Appliance'})`;
      case 'document_uploaded': return `Uploaded Document (${meta.docLabel || meta.documentType || 'Doc'})`;
      case 'ocr_completed': return 'Smart OCR Extraction Completed';
      case 'ocr_review_required': return 'OCR Flagged for Manual Review';
      case 'insurance_renewed': return 'Insurance Policy Renewed';
      case 'warranty_updated': return 'Warranty Coverage Updated';
      case 'puc_updated': return 'PUC Certificate Updated';
      case 'service_due': return 'Maintenance Service Due';
      case 'support_ticket_created': return `Raised Complaint (${meta.ticketId || 'Ticket'})`;
      case 'support_ticket_updated': return `Updated Complaint (${meta.ticketId || 'Ticket'})`;
      case 'support_ticket_resolved': return `Resolved Ticket (${meta.ticketId || 'Ticket'})`;
      case 'document_downloaded': return `Downloaded Document (${meta.docLabel || 'Doc'})`;
      default: return eventType.replace(/_/g, ' ').toUpperCase();
    }
  }

  private determinePriority(eventType: OperationalEventType): 'INFO' | 'SUCCESS' | 'WARNING' | 'HIGH' | 'CRITICAL' {
    if (eventType === 'ocr_review_required' || eventType === 'support_ticket_created') return 'HIGH';
    if (eventType === 'ocr_completed' || eventType === 'insurance_renewed' || eventType === 'asset_created') return 'SUCCESS';
    return 'INFO';
  }
}
