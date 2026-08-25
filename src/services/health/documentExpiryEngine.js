/**
 * Document expiry evaluation — configurable windows.
 */

import { daysUntil } from '../../utils/dates';
import { ALERT_PRIORITY, EXPIRY_ALERT_DAYS } from './healthScoreConfig';

export const EXPIRY_DOC_FIELDS = Object.freeze([
  { field: 'insuranceExpiry', label: 'Insurance', category: 'Insurance' },
  { field: 'pucExpiry', label: 'PUC', category: 'PUC' },
  { field: 'warrantyExpiry', label: 'Warranty', category: 'Warranty' },
  { field: 'extendedWarrantyExpiry', label: 'Extended Warranty', category: 'Warranty' },
  { field: 'amcExpiry', label: 'AMC', category: 'Warranty' },
]);

function priorityForDays(days) {
  if (days == null) return ALERT_PRIORITY.LOW;
  if (days < 0 || days <= 1) return ALERT_PRIORITY.CRITICAL;
  if (days <= 7) return ALERT_PRIORITY.HIGH;
  if (days <= 15) return ALERT_PRIORITY.MEDIUM;
  return ALERT_PRIORITY.LOW;
}

/**
 * @returns {Array<{
 *   field: string,
 *   label: string,
 *   category: string,
 *   days: number,
 *   date: string,
 *   priority: string,
 *   status: 'EXPIRED'|'DUE_SOON'|'UPCOMING',
 *   message: string,
 *   windowDay: number|null
 * }>}
 */
export function evaluateDocumentExpiries(asset = {}, windows = EXPIRY_ALERT_DAYS) {
  const out = [];
  for (const meta of EXPIRY_DOC_FIELDS) {
    const date = asset[meta.field];
    if (!date) continue;
    const days = daysUntil(date);
    if (days == null) continue;

    let status = null;
    let windowDay = null;
    if (days < 0) {
      status = 'EXPIRED';
      windowDay = 0;
    } else {
      const hit = [...windows].sort((a, b) => a - b).find((w) => days <= w);
      if (hit != null) {
        status = days <= 7 ? 'DUE_SOON' : 'UPCOMING';
        windowDay = hit;
      }
    }
    if (!status) continue;

    const message =
      days < 0
        ? `${meta.label} expired.`
        : days === 0
          ? `${meta.label} expires today.`
          : days === 1
            ? `${meta.label} expires tomorrow.`
            : `${meta.label} expires in ${days} days.`;

    out.push({
      field: meta.field,
      label: meta.label,
      category: meta.category,
      days,
      date,
      priority: priorityForDays(days),
      status,
      message,
      windowDay,
      reason: status === 'EXPIRED' ? 'date_passed' : 'approaching_expiry',
      source: 'document_expiry_engine',
      confidence: 0.95,
    });
  }
  return out;
}

export default { EXPIRY_DOC_FIELDS, evaluateDocumentExpiries };
