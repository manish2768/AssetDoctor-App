/**
 * Asset Doctor — WhatsApp Notification Template Registry
 * Separates template content and parameters from core business logic.
 */

import type { TemplateKey } from './types.ts';

export interface TemplateDefinition {
  key: TemplateKey;
  category: 'EXPIRY_REMINDER' | 'SERVICE' | 'DOCUMENT' | 'SUPPORT' | 'TRANSACTIONAL';
  title: string;
  bodyTemplate: string;
  requiredParams: string[];
}

export const TEMPLATE_REGISTRY: Record<TemplateKey, TemplateDefinition> = {
  // --- Insurance Expiry Reminders ---
  insurance_expiry_30d: {
    key: 'insurance_expiry_30d',
    category: 'EXPIRY_REMINDER',
    title: 'Vehicle Insurance Expiring in 30 Days',
    bodyTemplate: 'Hi {{userName}}, the insurance policy for your {{assetName}} ({{identifier}}) expires on {{expiryDate}} (in 30 days). Renew early to ensure continuous coverage and avoid penalties.',
    requiredParams: ['userName', 'assetName', 'identifier', 'expiryDate']
  },
  insurance_expiry_15d: {
    key: 'insurance_expiry_15d',
    category: 'EXPIRY_REMINDER',
    title: 'Vehicle Insurance Expiring in 15 Days',
    bodyTemplate: 'Reminder: The insurance for your {{assetName}} ({{identifier}}) expires in 15 days on {{expiryDate}}. Renew today on Asset Doctor.',
    requiredParams: ['userName', 'assetName', 'identifier', 'expiryDate']
  },
  insurance_expiry_7d: {
    key: 'insurance_expiry_7d',
    category: 'EXPIRY_REMINDER',
    title: 'Urgent: Insurance Expiring in 7 Days',
    bodyTemplate: 'Urgent: Your {{assetName}} ({{identifier}}) insurance policy expires in 7 days ({{expiryDate}}). Avoid lapse of coverage by renewing now.',
    requiredParams: ['userName', 'assetName', 'identifier', 'expiryDate']
  },
  insurance_expiry_1d: {
    key: 'insurance_expiry_1d',
    category: 'EXPIRY_REMINDER',
    title: 'Critical: Insurance Expires Tomorrow',
    bodyTemplate: 'Critical Alert: The insurance for your {{assetName}} ({{identifier}}) expires tomorrow ({{expiryDate}}). Renew immediately to remain legally compliant.',
    requiredParams: ['userName', 'assetName', 'identifier', 'expiryDate']
  },
  insurance_expired: {
    key: 'insurance_expired',
    category: 'EXPIRY_REMINDER',
    title: 'Attention: Insurance Policy Expired',
    bodyTemplate: 'Attention: The insurance policy for your {{assetName}} ({{identifier}}) has expired on {{expiryDate}}. Renew now to restore active protection.',
    requiredParams: ['userName', 'assetName', 'identifier', 'expiryDate']
  },

  // --- Warranty Expiry Reminders ---
  warranty_expiry_30d: {
    key: 'warranty_expiry_30d',
    category: 'EXPIRY_REMINDER',
    title: 'Warranty Expiring in 30 Days',
    bodyTemplate: 'Hi {{userName}}, the manufacturer warranty on your {{assetName}} ({{identifier}}) expires on {{expiryDate}} (in 30 days). Consider checking extended warranty plans.',
    requiredParams: ['userName', 'assetName', 'identifier', 'expiryDate']
  },
  warranty_expiry_15d: {
    key: 'warranty_expiry_15d',
    category: 'EXPIRY_REMINDER',
    title: 'Warranty Expiring in 15 Days',
    bodyTemplate: 'Reminder: The warranty for your {{assetName}} ({{identifier}}) expires on {{expiryDate}} (15 days left). Check your coverage on Asset Doctor.',
    requiredParams: ['userName', 'assetName', 'identifier', 'expiryDate']
  },
  warranty_expiry_7d: {
    key: 'warranty_expiry_7d',
    category: 'EXPIRY_REMINDER',
    title: 'Warranty Expiring in 7 Days',
    bodyTemplate: 'Notice: Warranty for your {{assetName}} ({{identifier}}) expires in 7 days on {{expiryDate}}.',
    requiredParams: ['userName', 'assetName', 'identifier', 'expiryDate']
  },
  warranty_expiry_1d: {
    key: 'warranty_expiry_1d',
    category: 'EXPIRY_REMINDER',
    title: 'Warranty Expires Tomorrow',
    bodyTemplate: 'Alert: The warranty for your {{assetName}} ({{identifier}}) expires tomorrow ({{expiryDate}}).',
    requiredParams: ['userName', 'assetName', 'identifier', 'expiryDate']
  },
  warranty_expired: {
    key: 'warranty_expired',
    category: 'EXPIRY_REMINDER',
    title: 'Warranty Expired',
    bodyTemplate: 'The manufacturer warranty on your {{assetName}} ({{identifier}}) has expired on {{expiryDate}}.',
    requiredParams: ['userName', 'assetName', 'identifier', 'expiryDate']
  },

  // --- PUC Expiry Reminders ---
  puc_expiry_30d: {
    key: 'puc_expiry_30d',
    category: 'EXPIRY_REMINDER',
    title: 'PUC Certificate Expiring in 30 Days',
    bodyTemplate: 'Hi {{userName}}, the PUC certificate for your vehicle {{assetName}} ({{identifier}}) expires on {{expiryDate}}.',
    requiredParams: ['userName', 'assetName', 'identifier', 'expiryDate']
  },
  puc_expiry_15d: {
    key: 'puc_expiry_15d',
    category: 'EXPIRY_REMINDER',
    title: 'PUC Certificate Expiring in 15 Days',
    bodyTemplate: 'Reminder: PUC certificate for {{assetName}} ({{identifier}}) is due for renewal on {{expiryDate}} (15 days remaining).',
    requiredParams: ['userName', 'assetName', 'identifier', 'expiryDate']
  },
  puc_expiry_7d: {
    key: 'puc_expiry_7d',
    category: 'EXPIRY_REMINDER',
    title: 'PUC Certificate Expiring in 7 Days',
    bodyTemplate: 'Urgent: The PUC certificate for {{assetName}} ({{identifier}}) expires in 7 days on {{expiryDate}}.',
    requiredParams: ['userName', 'assetName', 'identifier', 'expiryDate']
  },
  puc_expiry_1d: {
    key: 'puc_expiry_1d',
    category: 'EXPIRY_REMINDER',
    title: 'PUC Certificate Expires Tomorrow',
    bodyTemplate: 'Critical: The PUC certificate for {{assetName}} ({{identifier}}) expires tomorrow ({{expiryDate}}). Avoid challan by getting it tested.',
    requiredParams: ['userName', 'assetName', 'identifier', 'expiryDate']
  },
  puc_expired: {
    key: 'puc_expired',
    category: 'EXPIRY_REMINDER',
    title: 'PUC Certificate Expired',
    bodyTemplate: 'Notice: The PUC certificate for {{assetName}} ({{identifier}}) has expired on {{expiryDate}}.',
    requiredParams: ['userName', 'assetName', 'identifier', 'expiryDate']
  },

  // --- Service, Document & Support Templates ---
  service_due: {
    key: 'service_due',
    category: 'SERVICE',
    title: 'Periodic Maintenance Service Due',
    bodyTemplate: 'Hi {{userName}}, your {{assetName}} ({{identifier}}) is due for periodic maintenance service (Due: {{dueDate}}). Book a service slot today.',
    requiredParams: ['userName', 'assetName', 'identifier', 'dueDate']
  },
  document_uploaded: {
    key: 'document_uploaded',
    category: 'DOCUMENT',
    title: 'Document Uploaded Successfully',
    bodyTemplate: 'Hi {{userName}}, your document {{docLabel}} for {{assetName}} has been safely vaulted in your Asset Doctor locker.',
    requiredParams: ['userName', 'docLabel', 'assetName']
  },
  ocr_completed: {
    key: 'ocr_completed',
    category: 'DOCUMENT',
    title: 'Smart OCR Processing Completed',
    bodyTemplate: 'Smart Scan Complete: Details from your {{docLabel}} ({{assetName}}) have been verified and updated in your vault.',
    requiredParams: ['userName', 'docLabel', 'assetName']
  },
  support_ticket_created: {
    key: 'support_ticket_created',
    category: 'SUPPORT',
    title: 'Support Ticket Received',
    bodyTemplate: 'Hi {{userName}}, we have received your support request (Ticket #{{ticketId}}). Our operations team is reviewing it.',
    requiredParams: ['userName', 'ticketId']
  },
  support_ticket_resolved: {
    key: 'support_ticket_resolved',
    category: 'SUPPORT',
    title: 'Support Ticket Resolved',
    bodyTemplate: 'Hi {{userName}}, your support request (Ticket #{{ticketId}}) has been resolved: {{resolutionNote}}.',
    requiredParams: ['userName', 'ticketId', 'resolutionNote']
  },
  renewal_confirmed: {
    key: 'renewal_confirmed',
    category: 'TRANSACTIONAL',
    title: 'Coverage Renewal Confirmed',
    bodyTemplate: 'Hi {{userName}}, your {{coverageType}} for {{assetName}} has been successfully renewed through {{newExpiryDate}}.',
    requiredParams: ['userName', 'coverageType', 'assetName', 'newExpiryDate']
  }
};

/**
 * Format template message with payload variables
 */
export function formatTemplateMessage(templateKey: TemplateKey, params: Record<string, any>): string {
  const def = TEMPLATE_REGISTRY[templateKey];
  if (!def) {
    throw new Error(`Template key "${templateKey}" is not registered.`);
  }

  let text = def.bodyTemplate;
  for (const [key, val] of Object.entries(params)) {
    text = text.replace(new RegExp(`{{${key}}}`, 'g'), String(val || ''));
  }
  return text;
}
