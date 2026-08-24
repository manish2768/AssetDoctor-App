/**
 * Asset Doctor — Service Due Notification & Expiry Watcher
 * Integrates service predictions with the centralized notification queue and Expiry Radar.
 */

import { predictNextServiceDue } from './predictionEngine.ts';
import type { NextServicePredictionResult, ServiceRecord } from './types.ts';

export interface ServiceReminderEvaluation {
  assetId: string;
  assetName: string;
  ownerUid: string;
  identifier: string;
  targetKm: number;
  remainingKm: number;
  remainingDays: number;
  estimatedDueDate: string;
  reminderWindow: '30d' | '1000km' | '7d' | 'due_today' | 'overdue' | 'none';
  idempotencyKey?: string;
  prediction: NextServicePredictionResult;
}

/**
 * Determine the active notification window based on both remaining KM and remaining days
 */
export function determineServiceReminderWindow(prediction: NextServicePredictionResult): '30d' | '1000km' | '7d' | 'due_today' | 'overdue' | 'none' {
  const { remainingDays, remainingKm } = prediction;

  if (remainingDays < 0 || remainingKm <= 0) {
    return 'overdue';
  }
  if (remainingDays === 0) {
    return 'due_today';
  }
  if (remainingDays <= 7) {
    return '7d';
  }
  if (remainingKm <= 1000) {
    return '1000km';
  }
  if (remainingDays <= 30) {
    return '30d';
  }

  return 'none';
}

/**
 * Evaluate asset for service reminders and return surveillance metadata
 */
export function evaluateAssetServiceReminder(
  asset: any,
  serviceRecords: ServiceRecord[] = [],
  referenceDateIST?: Date
): ServiceReminderEvaluation {
  const ownerUid = asset.ownerUid || asset.uid || 'unknown';
  const assetId = asset.id || 'unknown';
  const prediction = predictNextServiceDue(asset, serviceRecords, { referenceDateIST });

  const window = determineServiceReminderWindow(prediction);
  let idempotencyKey: string | undefined;

  if (window !== 'none') {
    idempotencyKey = `${ownerUid}_${assetId}_service_${prediction.oemTargetKm}_${prediction.finalEstimatedDueDate}_${window}`;
  }

  return {
    assetId,
    assetName: prediction.assetName,
    ownerUid,
    identifier: prediction.identifier,
    targetKm: prediction.oemTargetKm,
    remainingKm: prediction.remainingKm,
    remainingDays: prediction.remainingDays,
    estimatedDueDate: prediction.finalEstimatedDueDate,
    reminderWindow: window,
    idempotencyKey,
    prediction
  };
}
