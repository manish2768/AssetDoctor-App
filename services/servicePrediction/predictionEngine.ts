/**
 * Asset Doctor — Next Service Due & Service Prediction Engine
 * Implements "whichever comes first" calculation combining manufacturer KM/time thresholds and historical driving velocity.
 */

import type {
  ComponentChecklistItem,
  NextServicePredictionResult,
  OemServiceSchedule,
  ServiceRecord,
  UsageProfile
} from './types.ts';
import { matchOemSchedule } from './oemDatabase.ts';

export interface PredictionOptions {
  referenceDateIST?: Date;
  usageProfile?: UsageProfile;
  customDailyKm?: number;
}

/**
 * Add days to YYYY-MM-DD string in Asia/Kolkata timezone
 */
export function addDaysToDateString(dateStr: string, days: number): string {
  const parts = (dateStr || '').split('T')[0].split('-');
  let baseDate: Date;
  if (parts.length === 3) {
    baseDate = new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
  } else {
    baseDate = new Date();
  }

  baseDate.setUTCDate(baseDate.getUTCDate() + days);
  return baseDate.toISOString().split('T')[0];
}

/**
 * Calculate difference in days between two YYYY-MM-DD date strings
 */
export function diffDaysBetweenDates(earlierDateStr: string, laterDateStr: string): number {
  const p1 = earlierDateStr.split('T')[0].split('-');
  const p2 = laterDateStr.split('T')[0].split('-');
  if (p1.length !== 3 || p2.length !== 3) return 0;

  const d1 = Date.UTC(parseInt(p1[0], 10), parseInt(p1[1], 10) - 1, parseInt(p1[2], 10));
  const d2 = Date.UTC(parseInt(p2[0], 10), parseInt(p2[1], 10) - 1, parseInt(p2[2], 10));

  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

/**
 * Calculates historical driving velocity (Average Daily & Monthly KM)
 */
export function calculateDrivingVelocity(
  asset: any,
  serviceRecords: ServiceRecord[],
  referenceDateStr: string
): { avgDailyKm: number; avgMonthlyKm: number; confidence: 'HIGH' | 'MEDIUM' | 'ESTIMATED' } {
  // 1. If we have 2 or more verified service records with odometer readings
  const verifiedRecords = serviceRecords
    .filter(r => r.verificationStatus !== 'REJECTED' && r.odometerKm > 0)
    .sort((a, b) => (a.serviceDate > b.serviceDate ? 1 : -1));

  if (verifiedRecords.length >= 2) {
    const oldest = verifiedRecords[0];
    const newest = verifiedRecords[verifiedRecords.length - 1];
    const daysBetween = diffDaysBetweenDates(oldest.serviceDate, newest.serviceDate);
    const kmDelta = newest.odometerKm - oldest.odometerKm;

    if (daysBetween > 15 && kmDelta > 0) {
      const avgDailyKm = Math.max(1, Math.round((kmDelta / daysBetween) * 10) / 10);
      return {
        avgDailyKm,
        avgMonthlyKm: Math.round(avgDailyKm * 30.416),
        confidence: 'HIGH'
      };
    }
  }

  // 2. If we have 1 service record or current odometer with purchase date
  const purchaseDate = asset.purchaseDate ? asset.purchaseDate.split('T')[0] : null;
  const currentOdo = asset.odometerKm || (verifiedRecords.length > 0 ? verifiedRecords[0].odometerKm : 0);

  if (purchaseDate && currentOdo > 0) {
    const daysSincePurchase = diffDaysBetweenDates(purchaseDate, referenceDateStr);
    if (daysSincePurchase > 15) {
      const avgDailyKm = Math.max(1, Math.round((currentOdo / daysSincePurchase) * 10) / 10);
      return {
        avgDailyKm,
        avgMonthlyKm: Math.round(avgDailyKm * 30.416),
        confidence: 'MEDIUM'
      };
    }
  }

  // 3. Fallback baseline based on vehicle type
  const vehicleType = asset.vehicleType || (asset.category === 'Vehicles' ? 'Motorcycle' : 'Car');
  let baselineDailyKm = 25; // Default 2-Wheeler (750 KM/mo)
  if (vehicleType === 'Car') baselineDailyKm = 33; // Default Car (1000 KM/mo)
  if (vehicleType === 'EV') baselineDailyKm = 20;

  return {
    avgDailyKm: baselineDailyKm,
    avgMonthlyKm: Math.round(baselineDailyKm * 30.416),
    confidence: 'ESTIMATED'
  };
}

/**
 * Predict Next Service Due Date & Odometer Target for an Asset
 */
export function predictNextServiceDue(
  asset: any,
  serviceRecords: ServiceRecord[] = [],
  options?: PredictionOptions
): NextServicePredictionResult {
  const refDate = options?.referenceDateIST || new Date();
  const refDateStr = refDate.toISOString().split('T')[0];

  const schedule: OemServiceSchedule = matchOemSchedule(asset);
  const isSevere = Boolean(options?.usageProfile === 'SEVERE' || asset.usageProfile === 'SEVERE');
  const multiplier = isSevere ? schedule.severeUsageMultiplier : 1.0;

  // Find latest verified service record
  const verifiedRecords = [...serviceRecords]
    .filter(r => r.verificationStatus !== 'REJECTED')
    .sort((a, b) => (a.serviceDate > b.serviceDate ? 1 : -1));

  const latestRecord = verifiedRecords.length > 0 ? verifiedRecords[verifiedRecords.length - 1] : null;

  let isFirstService = false;
  let serviceNumber = 1;
  let serviceLabel = '';
  let lastServiceDate = '';
  let lastServiceOdometerKm = 0;
  let intervalKm = 0;
  let intervalDays = 0;

  if (!latestRecord) {
    // No previous service record -> 1st Break-in Service
    isFirstService = true;
    serviceNumber = 1;
    serviceLabel = schedule.serviceSteps[0]?.label || '1st Service (Break-in Check)';
    lastServiceDate = asset.purchaseDate ? asset.purchaseDate.split('T')[0] : refDateStr;
    lastServiceOdometerKm = 0;
    intervalKm = Math.round(schedule.firstServiceRule.intervalKm * multiplier);
    intervalDays = Math.round(schedule.firstServiceRule.intervalDays * multiplier);
  } else {
    // Subsequent periodic service
    isFirstService = false;
    serviceNumber = (latestRecord.serviceNumber || verifiedRecords.length) + 1;
    const stepDef = schedule.serviceSteps.find(s => s.serviceNumber === serviceNumber);
    serviceLabel = stepDef ? stepDef.label : `Service #${serviceNumber} (Periodic Maintenance)`;
    lastServiceDate = latestRecord.serviceDate.split('T')[0];
    lastServiceOdometerKm = latestRecord.odometerKm;
    intervalKm = Math.round(schedule.subsequentServiceRule.intervalKm * multiplier);
    intervalDays = Math.round(schedule.subsequentServiceRule.intervalDays * multiplier);
  }

  // Calculate Target KM & Target Calendar Date
  const targetKm = lastServiceOdometerKm + intervalKm;
  const currentOdometerKm = Math.max(asset.odometerKm || 0, lastServiceOdometerKm);
  const remainingKm = Math.max(0, targetKm - currentOdometerKm);
  const targetDate = addDaysToDateString(lastServiceDate, intervalDays);

  // Calculate Velocity & Projected Date from Daily Usage
  const { avgDailyKm, avgMonthlyKm, confidence } = calculateDrivingVelocity(asset, verifiedRecords, refDateStr);
  const effectiveDailyKm = options?.customDailyKm || avgDailyKm;

  const estimatedDaysToReachKm = effectiveDailyKm > 0 ? Math.round(remainingKm / effectiveDailyKm) : 999;
  const projectedDateFromKm = addDaysToDateString(refDateStr, estimatedDaysToReachKm);

  // Apply "Whichever Comes First" Principle
  let estimatedDueDate: string;
  let whicheverComesFirstReason: 'KM_THRESHOLD' | 'TIME_THRESHOLD';

  if (projectedDateFromKm < targetDate) {
    estimatedDueDate = projectedDateFromKm;
    whicheverComesFirstReason = 'KM_THRESHOLD';
  } else {
    estimatedDueDate = targetDate;
    whicheverComesFirstReason = 'TIME_THRESHOLD';
  }

  const remainingDays = diffDaysBetweenDates(refDateStr, estimatedDueDate);
  const estimatedWeeks = Math.max(1, Math.round(remainingDays / 7));

  // Determine Dynamic Status (GREEN / AMBER / RED)
  let status: 'GREEN' | 'AMBER' | 'RED';
  let statusLabel: 'HEALTHY' | 'DUE_SOON' | 'OVERDUE';

  // For first break-in service (e.g. 750 KM), threshold is 150 KM; for subsequent 10,000 KM service, threshold is 2,000 KM
  const amberKmThreshold = isFirstService ? Math.min(200, intervalKm * 0.2) : 2000;
  const amberDaysThreshold = isFirstService ? 15 : 30;

  if (remainingDays < 0 || remainingKm <= 0) {
    status = 'RED';
    statusLabel = 'OVERDUE';
  } else if (remainingDays <= amberDaysThreshold || remainingKm <= amberKmThreshold) {
    status = 'AMBER';
    statusLabel = 'DUE_SOON';
  } else {
    status = 'GREEN';
    statusLabel = 'HEALTHY';
  }

  // Component Maintenance Checklist
  const componentChecklist: ComponentChecklistItem[] = (schedule.componentRules || []).map(cr => {
    const compDueKm = lastServiceOdometerKm + cr.intervalKm;
    const compDueDate = addDaysToDateString(lastServiceDate, cr.intervalMonths * 30);
    const isDue = currentOdometerKm >= compDueKm || refDateStr >= compDueDate;
    const isUpcoming = (compDueKm - currentOdometerKm <= 1000) || (diffDaysBetweenDates(refDateStr, compDueDate) <= 30);

    return {
      component: cr.component,
      label: cr.componentLabel,
      action: cr.action,
      dueKm: compDueKm,
      dueDate: compDueDate,
      status: isDue ? 'DUE' : isUpcoming ? 'UPCOMING' : 'OK'
    };
  });

  return {
    assetId: asset.id || 'unknown',
    assetName: asset.assetName || asset.name || 'Vehicle',
    category: asset.categoryLabel || asset.category || 'Vehicles',
    identifier: asset.registration || asset.registrationNumber || asset.serialNumber || '—',
    serviceNumber,
    serviceLabel,
    currentOdometerKm,
    lastServiceDate,
    lastServiceOdometerKm,
    targetKm,
    targetDate,
    remainingKm,
    remainingDays,
    estimatedDueDate,
    whicheverComesFirstReason,
    estimatedDaysToReachKm,
    estimatedWeeks,
    avgDailyKm: effectiveDailyKm,
    avgMonthlyKm,
    status,
    statusLabel,
    predictionConfidence: confidence,
    scheduleSource: schedule.source,
    scheduleSourceType: schedule.sourceType,
    scheduleVersion: schedule.sourceVersion,
    isFirstService,
    severeUsageActive: isSevere,
    componentChecklist,
    calculatedAt: new Date().toISOString()
  };
}
