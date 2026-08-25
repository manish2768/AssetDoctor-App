/**
 * Asset Doctor — Next Service Due & Service Prediction Engine
 * Strictly implements OEM specifications, historical driving velocity, and safety bounds.
 */

import type {
  ComponentChecklistItem,
  NextServicePredictionResult,
  OemServiceSchedule,
  ServiceRecord,
  UsageProfile
} from './types.ts';
import { matchOemSchedule } from './oemDatabase.ts';
import { getAssetCapabilities } from '../../src/utils/assetCapabilities.ts';

export interface PredictionOptions {
  referenceDateIST?: Date;
  usageProfile?: UsageProfile;
  customDailyKm?: number;
}

/**
 * Add days to YYYY-MM-DD string in UTC
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
 * Calculate difference in days between two YYYY-MM-DD date strings (later - earlier)
 */
export function diffDaysBetweenDates(earlierDateStr: string, laterDateStr: string): number {
  const p1 = (earlierDateStr || '').split('T')[0].split('-');
  const p2 = (laterDateStr || '').split('T')[0].split('-');
  if (p1.length !== 3 || p2.length !== 3) return 0;

  const d1 = Date.UTC(parseInt(p1[0], 10), parseInt(p1[1], 10) - 1, parseInt(p1[2], 10));
  const d2 = Date.UTC(parseInt(p2[0], 10), parseInt(p2[1], 10) - 1, parseInt(p2[2], 10));

  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

/**
 * Calculates historical driving velocity strictly from verified service records with valid progression.
 * Returns null if driving history is missing or invalid (never invents a fake velocity).
 */
export function calculateDrivingVelocity(
  asset: any,
  serviceRecords: ServiceRecord[],
  referenceDateStr: string
): {
  avgDailyKm: number | null;
  avgMonthlyKm: number | null;
  confidence: 'HIGH' | 'MEDIUM' | 'INSUFFICIENT_HISTORY';
  hasOdometerAnomaly: boolean;
  odometerAnomalyReason?: string;
} {
  // Sort verified records chronologically
  const verifiedRecords = serviceRecords
    .filter(r => r.verificationStatus === 'VERIFIED' && r.odometerKm > 0)
    .sort((a, b) => (a.serviceDate > b.serviceDate ? 1 : a.serviceDate < b.serviceDate ? -1 : 0));

  // Check for ODOMETER_ANOMALY (odometer decreasing over time)
  let hasOdometerAnomaly = false;
  let odometerAnomalyReason: string | undefined;

  for (let i = 0; i < verifiedRecords.length - 1; i++) {
    const current = verifiedRecords[i];
    const next = verifiedRecords[i + 1];
    if (next.serviceDate >= current.serviceDate && next.odometerKm < current.odometerKm) {
      hasOdometerAnomaly = true;
      odometerAnomalyReason = `Odometer decreased from ${current.odometerKm.toLocaleString()} KM on ${current.serviceDate} to ${next.odometerKm.toLocaleString()} KM on ${next.serviceDate} (ODOMETER_ANOMALY)`;
      break;
    }
  }

  // Also check if current asset odometer is lower than the latest verified service record
  if (verifiedRecords.length > 0 && asset.odometerKm && asset.odometerKm < verifiedRecords[verifiedRecords.length - 1].odometerKm) {
    hasOdometerAnomaly = true;
    odometerAnomalyReason = `Current odometer (${asset.odometerKm.toLocaleString()} KM) is lower than latest verified service record (${verifiedRecords[verifiedRecords.length - 1].odometerKm.toLocaleString()} KM) (ODOMETER_ANOMALY)`;
  }

  if (hasOdometerAnomaly) {
    return {
      avgDailyKm: null,
      avgMonthlyKm: null,
      confidence: 'INSUFFICIENT_HISTORY',
      hasOdometerAnomaly: true,
      odometerAnomalyReason
    };
  }

  // 1. If 2 or more verified service records exist
  if (verifiedRecords.length >= 2) {
    const oldest = verifiedRecords[0];
    const newest = verifiedRecords[verifiedRecords.length - 1];
    const daysBetween = diffDaysBetweenDates(oldest.serviceDate, newest.serviceDate);
    const kmDelta = newest.odometerKm - oldest.odometerKm;

    if (daysBetween >= 10 && kmDelta > 0) {
      const avgDailyKm = Math.max(1, Math.round((kmDelta / daysBetween) * 10) / 10);
      return {
        avgDailyKm,
        avgMonthlyKm: Math.round(avgDailyKm * 30.416),
        confidence: 'HIGH',
        hasOdometerAnomaly: false
      };
    }
  }

  // 2. If exactly 1 verified service record exists with purchase date
  if (verifiedRecords.length === 1 && asset.purchaseDate) {
    const single = verifiedRecords[0];
    const daysSincePurchase = diffDaysBetweenDates(asset.purchaseDate, single.serviceDate);
    if (daysSincePurchase >= 15 && single.odometerKm > 0) {
      const avgDailyKm = Math.max(1, Math.round((single.odometerKm / daysSincePurchase) * 10) / 10);
      return {
        avgDailyKm,
        avgMonthlyKm: Math.round(avgDailyKm * 30.416),
        confidence: 'MEDIUM',
        hasOdometerAnomaly: false
      };
    }
  }

  // 3. No sufficient verified history -> Never synthesize fake driving velocity!
  return {
    avgDailyKm: null,
    avgMonthlyKm: null,
    confidence: 'INSUFFICIENT_HISTORY',
    hasOdometerAnomaly: false
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

  // 1. Normalize Asset Odometer & Fields
  const rawOdo = typeof asset.odometerKm === 'number' ? asset.odometerKm :
                 typeof asset.currentOdometer === 'number' ? asset.currentOdometer :
                 typeof asset.currentKm === 'number' ? asset.currentKm :
                 typeof asset.currentKM === 'number' ? asset.currentKM :
                 typeof asset.mileage === 'number' ? asset.mileage :
                 parseFloat(asset.odometerKm || asset.currentOdometer || asset.currentKm || asset.currentKM || asset.mileage || '0') || 0;

  const normalizedAsset = {
    ...asset,
    odometerKm: rawOdo,
    currentOdometer: rawOdo
  };

  const capabilities = getAssetCapabilities(normalizedAsset);
  if (!capabilities.hasVehicleServiceSchedule) {
    return {
      assetId: normalizedAsset.id || 'unknown',
      assetName: normalizedAsset.assetName || normalizedAsset.name || 'Asset',
      category: normalizedAsset.categoryLabel || normalizedAsset.category || 'General',
      identifier: normalizedAsset.serialNumber || normalizedAsset.imei || '—',
      serviceNumber: 0,
      serviceLabel: 'Maintenance schedule not configured',
      currentOdometerKm: 0,
      oemTargetKm: 0,
      oemTargetCalendarDate: 'N/A',
      oemIntervalKm: 0,
      oemIntervalDays: 0,
      remainingKm: 0,
      remainingDays: 0,
      avgDailyKm: null,
      avgMonthlyKm: null,
      hasDrivingHistory: false,
      projectedKmThresholdDate: null,
      finalEstimatedDueDate: 'N/A',
      whicheverComesFirstCriterion: capabilities.serviceDueUnavailableNotice || 'Maintenance schedule not configured for this asset type',
      whicheverReasonType: 'INSUFFICIENT_HISTORY',
      estimatedDaysToReachKm: null,
      estimatedWeeks: null,
      status: 'GREEN',
      statusLabel: 'HEALTHY',
      predictionConfidence: 'INSUFFICIENT_HISTORY',
      hasOdometerAnomaly: false,
      scheduleSource: 'None',
      scheduleSourceType: 'GENERIC_FALLBACK',
      scheduleVersion: 'N/A',
      scheduleLabel: 'Maintenance schedule not configured',
      isFirstService: false,
      severeUsageActive: false,
      componentChecklist: [],
      calculatedAt: new Date().toISOString(),
      targetKm: 0,
      estimatedDueDate: 'N/A',
      finalDueDate: 'N/A',
      currentOdometer: 0,
      lastServiceOdometer: 0,
      serviceIntervalKm: 0,
      serviceIntervalDays: 0,
      scheduleUnavailableOffline: true,
      offlineNotice: capabilities.serviceDueUnavailableNotice || 'Maintenance schedule not configured for this asset type'
    };
  }

  const schedule: OemServiceSchedule = matchOemSchedule(normalizedAsset);
  const isSevere = Boolean(options?.usageProfile === 'SEVERE' || normalizedAsset.usageProfile === 'SEVERE');

  // 2. Normalize and filter verified service records
  const normalizedRecords: ServiceRecord[] = (serviceRecords || []).map(r => {
    const odo = typeof r.odometerKm === 'number' ? r.odometerKm :
                typeof r.odometer === 'number' ? r.odometer :
                typeof (r as any).serviceOdometer === 'number' ? (r as any).serviceOdometer :
                parseFloat(r.odometerKm || r.odometer || (r as any).serviceOdometer || '0') || 0;
    const isVer = r.verificationStatus === 'VERIFIED' || r.verificationStatus === undefined || r.verificationStatus === 'verified' || (r as any).isVerified === true;
    return {
      ...r,
      odometerKm: odo,
      odometer: odo,
      verificationStatus: isVer ? 'VERIFIED' : r.verificationStatus
    } as ServiceRecord;
  });

  const verifiedRecords = normalizedRecords
    .filter(r => r.verificationStatus === 'VERIFIED')
    .sort((a, b) => (a.serviceDate > b.serviceDate ? 1 : a.serviceDate < b.serviceDate ? -1 : 0));

  const latestRecord = verifiedRecords.length > 0 ? verifiedRecords[verifiedRecords.length - 1] : null;

  let isFirstService = false;
  let serviceNumber = 1;
  let serviceLabel = '';
  let lastServiceDate = '';
  let lastServiceOdometerKm = 0;
  let oemIntervalKm = 0;
  let oemIntervalDays = 0;
  let severeUsageActive = false;
  let severeUsageNote: string | undefined;

  if (!latestRecord) {
    // Break-in First Service
    isFirstService = true;
    serviceNumber = 1;
    serviceLabel = schedule.serviceSteps[0]?.label || '1st Service (Break-in Check)';
    lastServiceDate = normalizedAsset.purchaseDate ? normalizedAsset.purchaseDate.split('T')[0] : refDateStr;
    lastServiceOdometerKm = 0;
    oemIntervalKm = schedule.firstServiceRule.intervalKm;
    oemIntervalDays = schedule.firstServiceRule.intervalDays;
  } else {
    // Subsequent Periodic Service
    isFirstService = false;
    serviceNumber = (latestRecord.serviceNumber || verifiedRecords.length) + 1;
    const stepDef = schedule.serviceSteps.find(s => s.serviceNumber === serviceNumber);
    serviceLabel = stepDef ? stepDef.label : `Service #${serviceNumber} (Periodic Maintenance)`;
    lastServiceDate = latestRecord.serviceDate.split('T')[0];
    lastServiceOdometerKm = latestRecord.odometerKm;

    if (isSevere && schedule.severeSubsequentRule) {
      // Use documented OEM severe schedule
      oemIntervalKm = schedule.severeSubsequentRule.intervalKm;
      oemIntervalDays = schedule.severeSubsequentRule.intervalDays;
      severeUsageActive = true;
      severeUsageNote = schedule.severeSubsequentRule.source;
    } else {
      oemIntervalKm = schedule.subsequentServiceRule.intervalKm;
      oemIntervalDays = schedule.subsequentServiceRule.intervalDays;
      if (isSevere && !schedule.severeSubsequentRule) {
        severeUsageActive = false;
        severeUsageNote = 'OEM severe-service interval unavailable — using standard manufacturer interval';
      }
    }
  }

  // Official OEM Targets (Unmodified)
  const oemTargetKm = lastServiceOdometerKm + oemIntervalKm;
  const oemTargetCalendarDate = addDaysToDateString(lastServiceDate, oemIntervalDays);
  const currentOdometerKm = Math.max(normalizedAsset.odometerKm || 0, lastServiceOdometerKm);
  const remainingKm = Math.max(0, oemTargetKm - currentOdometerKm);
  const remainingDays = diffDaysBetweenDates(refDateStr, oemTargetCalendarDate);

  // Calculate Velocity & Projected KM Threshold Date
  const { avgDailyKm, avgMonthlyKm, confidence, hasOdometerAnomaly, odometerAnomalyReason } = calculateDrivingVelocity(
    normalizedAsset,
    verifiedRecords,
    refDateStr
  );

  const effectiveDailyKm = options?.customDailyKm || avgDailyKm;

  let projectedKmThresholdDate: string | null = null;
  let estimatedDaysToReachKm: number | null = null;
  let estimatedWeeks: number | null = null;
  let finalEstimatedDueDate: string;
  let whicheverComesFirstCriterion: string;
  let whicheverReasonType: 'KM_THRESHOLD' | 'TIME_THRESHOLD' | 'INSUFFICIENT_HISTORY';

  if (effectiveDailyKm !== null && effectiveDailyKm > 0) {
    estimatedDaysToReachKm = Math.round(remainingKm / effectiveDailyKm);
    projectedKmThresholdDate = addDaysToDateString(refDateStr, estimatedDaysToReachKm);
    estimatedWeeks = Math.max(1, Math.round(estimatedDaysToReachKm / 7));

    if (projectedKmThresholdDate < oemTargetCalendarDate) {
      finalEstimatedDueDate = projectedKmThresholdDate;
      whicheverReasonType = 'KM_THRESHOLD';
      whicheverComesFirstCriterion = `KM threshold projected to be reached first (~${estimatedWeeks} weeks)`;
    } else {
      finalEstimatedDueDate = oemTargetCalendarDate;
      whicheverReasonType = 'TIME_THRESHOLD';
      whicheverComesFirstCriterion = `OEM calendar limit reached first (${oemTargetCalendarDate})`;
    }
  } else {
    // Insufficient driving history
    finalEstimatedDueDate = oemTargetCalendarDate;
    whicheverReasonType = 'INSUFFICIENT_HISTORY';
    whicheverComesFirstCriterion = 'Estimated service date unavailable — insufficient driving history';
  }

  // Dynamic Status Evaluation
  let status: 'GREEN' | 'AMBER' | 'RED';
  let statusLabel: 'HEALTHY' | 'DUE_SOON' | 'OVERDUE';

  const effectiveRemainingDays = diffDaysBetweenDates(refDateStr, finalEstimatedDueDate);
  const amberKmThreshold = isFirstService ? Math.min(200, oemIntervalKm * 0.2) : 2000;
  const amberDaysThreshold = isFirstService ? 15 : 30;

  if (effectiveRemainingDays < 0 || remainingKm <= 0) {
    status = 'RED';
    statusLabel = 'OVERDUE';
  } else if (effectiveRemainingDays <= amberDaysThreshold || remainingKm <= amberKmThreshold) {
    status = 'AMBER';
    statusLabel = 'DUE_SOON';
  } else {
    status = 'GREEN';
    statusLabel = 'HEALTHY';
  }

  // Component Checklist
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

  const scheduleLabel = schedule.sourceType === 'GENERIC_FALLBACK'
    ? 'Generic estimate — manufacturer schedule unavailable'
    : 'Manufacturer Recommended';

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
    
    oemTargetKm,
    oemTargetCalendarDate,
    oemIntervalKm,
    oemIntervalDays,
    
    remainingKm,
    remainingDays,
    
    avgDailyKm: effectiveDailyKm,
    avgMonthlyKm: effectiveDailyKm ? Math.round(effectiveDailyKm * 30.416) : null,
    hasDrivingHistory: effectiveDailyKm !== null,
    projectedKmThresholdDate,
    
    finalEstimatedDueDate,
    whicheverComesFirstCriterion,
    whicheverReasonType,
    estimatedDaysToReachKm,
    estimatedWeeks,
    
    status,
    statusLabel,
    predictionConfidence: confidence,
    hasOdometerAnomaly,
    odometerAnomalyReason,
    
    scheduleSource: schedule.source,
    scheduleSourceUrl: schedule.sourceUrl,
    scheduleSourceType: schedule.sourceType,
    scheduleVersion: schedule.sourceVersion,
    scheduleLabel,
    isFirstService,
    severeUsageActive,
    severeUsageNote,
    componentChecklist,
    calculatedAt: new Date().toISOString(),

    // Canonical compatibility aliases
    targetKm: oemTargetKm,
    estimatedDueDate: finalEstimatedDueDate,
    finalDueDate: finalEstimatedDueDate,
    currentOdometer: currentOdometerKm,
    lastServiceOdometer: lastServiceOdometerKm,
    serviceIntervalKm: oemIntervalKm,
    serviceIntervalDays: oemIntervalDays,
    scheduleUnavailableOffline: schedule.sourceType === 'GENERIC_FALLBACK',
    offlineNotice: schedule.sourceType === 'GENERIC_FALLBACK' ? 'Service schedule unavailable offline. Will update when connected.' : undefined
  };
}
