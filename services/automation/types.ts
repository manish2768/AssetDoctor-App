/**
 * Asset Doctor — Production Notification & Expiry Automation Engine Types
 */

export type OperationalEventType =
  | 'customer_login'
  | 'asset_created'
  | 'asset_updated'
  | 'document_uploaded'
  | 'document_updated'
  | 'ocr_completed'
  | 'ocr_review_required'
  | 'insurance_renewed'
  | 'warranty_updated'
  | 'puc_updated'
  | 'service_due'
  | 'support_ticket_created'
  | 'support_ticket_updated'
  | 'support_ticket_resolved'
  | 'document_downloaded';

export interface OperationalEvent {
  eventId: string;
  eventType: OperationalEventType;
  userId: string;
  assetId?: string;
  documentId?: string;
  createdAt: string;
  metadata: Record<string, any>;
  processed: boolean;
}

export type TemplateKey =
  | 'insurance_expiry_30d'
  | 'insurance_expiry_15d'
  | 'insurance_expiry_7d'
  | 'insurance_expiry_1d'
  | 'insurance_expired'
  | 'warranty_expiry_30d'
  | 'warranty_expiry_15d'
  | 'warranty_expiry_7d'
  | 'warranty_expiry_1d'
  | 'warranty_expired'
  | 'puc_expiry_30d'
  | 'puc_expiry_15d'
  | 'puc_expiry_7d'
  | 'puc_expiry_1d'
  | 'puc_expired'
  | 'service_due'
  | 'document_uploaded'
  | 'ocr_completed'
  | 'support_ticket_created'
  | 'support_ticket_resolved'
  | 'renewal_confirmed';

export type NotificationStatus =
  | 'queued'
  | 'processing'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'skipped';

export interface NotificationQueueItem {
  id?: string;
  userId: string;
  assetId?: string;
  documentId?: string;
  eventType: OperationalEventType | string;
  channel: 'whatsapp';
  templateKey: TemplateKey;
  recipientPhone: string;
  payload: Record<string, any>;
  status: NotificationStatus;
  scheduledAt: string;
  createdAt: string;
  sentAt?: string | null;
  deliveredAt?: string | null;
  readAt?: string | null;
  failedAt?: string | null;
  failureReason?: string | null;
  providerMessageId?: string | null;
  idempotencyKey: string;
  retryCount: number;
  lastAttemptAt?: string | null;
}

export interface ProviderResult {
  success: boolean;
  messageId?: string;
  error?: string;
  status: NotificationStatus;
}

export interface NotificationProvider {
  send(item: NotificationQueueItem): Promise<ProviderResult>;
  getStatus(messageId: string): Promise<NotificationStatus>;
  handleWebhook(payload: Record<string, any>): Promise<any>;
}
