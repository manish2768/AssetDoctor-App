/**
 * Phase 13 — Admin Learning Center aggregators.
 * Real events only. Never hardcode counts. Empty → available: false.
 */

import { PATTERN_STATUS, type LearningFeedbackEvent, type LearningPattern } from './types.ts';

export interface LearningCenterSummary {
  available: boolean;
  eventCount: number | null;
  patternCount: number | null;
  emerging: LearningPattern[];
  trusted: LearningPattern[];
  rejected: LearningPattern[];
  fieldsMostCorrected: Array<{ fieldName: string; count: number }>;
  documentTypesWithMostErrors: Array<{ documentType: string; count: number }>;
  recentEvents: LearningFeedbackEvent[];
}

function isEvent(row: Record<string, unknown>): boolean {
  const type = String(row.recordType || 'EVENT').toUpperCase();
  return type !== 'PATTERN';
}

function isPattern(row: Record<string, unknown>): boolean {
  return String(row.recordType || '').toUpperCase() === 'PATTERN';
}

export function derivePatternsFromEvents(events: LearningFeedbackEvent[]): LearningPattern[] {
  const buckets = new Map<
    string,
    { count: number; users: Set<string>; fps: Set<string>; sample: LearningFeedbackEvent }
  >();
  for (const ev of events) {
    if (!ev || ev.correctionType === 'USER_CONFIRMED') continue;
    const key = `${ev.documentType}|${ev.fieldName}|REJECT_${ev.originalValueShape}_AS_${String(ev.fieldName).toUpperCase()}`;
    const hit = buckets.get(key) || {
      count: 0,
      users: new Set<string>(),
      fps: new Set<string>(),
      sample: ev,
    };
    hit.count += 1;
    if (ev.userId) hit.users.add(ev.userId);
    if (ev.documentFingerprint) hit.fps.add(ev.documentFingerprint);
    buckets.set(key, hit);
  }
  const out: LearningPattern[] = [];
  for (const [key, hit] of buckets) {
    const independent = Math.max(hit.users.size, hit.fps.size, 1);
    let status: LearningPattern['status'] = PATTERN_STATUS.CANDIDATE;
    if (independent >= 5) status = PATTERN_STATUS.TRUSTED;
    else if (independent >= 3) status = PATTERN_STATUS.EMERGING;
    const [documentType, fieldName, normalizedPattern] = key.split('|');
    out.push({
      patternId: key,
      recordType: 'PATTERN',
      documentType,
      fieldName,
      semanticLabel: normalizedPattern,
      normalizedPattern,
      supportCount: hit.count,
      independentEvidence: independent,
      confidence: Math.min(0.98, 0.2 + independent * 0.12),
      status,
      createdAt: hit.sample.createdAt,
      updatedAt: hit.sample.timestamp,
    });
  }
  return out;
}

export function summarizeLearningCenter(
  rows: Array<Record<string, unknown>> = [],
  patternsInput?: LearningPattern[],
): LearningCenterSummary {
  const list = Array.isArray(rows) ? rows : [];
  const events = list.filter(isEvent) as unknown as LearningFeedbackEvent[];
  const storedPatterns = list.filter(isPattern) as unknown as LearningPattern[];
  const patterns =
    patternsInput && patternsInput.length ? patternsInput : storedPatterns.length ? storedPatterns : derivePatternsFromEvents(events);

  if (!events.length && !patterns.length) {
    return {
      available: false,
      eventCount: null,
      patternCount: null,
      emerging: [],
      trusted: [],
      rejected: [],
      fieldsMostCorrected: [],
      documentTypesWithMostErrors: [],
      recentEvents: [],
    };
  }

  const fieldCounts = new Map<string, number>();
  const typeCounts = new Map<string, number>();
  for (const ev of events) {
    if (ev.correctionType === 'USER_CONFIRMED') continue;
    const f = String(ev.fieldName || 'unknown');
    const t = String(ev.documentType || 'GENERIC_DOCUMENT');
    fieldCounts.set(f, (fieldCounts.get(f) || 0) + 1);
    typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
  }

  const fieldsMostCorrected = [...fieldCounts.entries()]
    .map(([fieldName, count]) => ({ fieldName, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const documentTypesWithMostErrors = [...typeCounts.entries()]
    .map(([documentType, count]) => ({ documentType, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const recentEvents = [...events]
    .sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')))
    .slice(0, 40);

  return {
    available: true,
    eventCount: events.length,
    patternCount: patterns.length,
    emerging: patterns.filter((p) => p.status === PATTERN_STATUS.EMERGING),
    trusted: patterns.filter((p) => p.status === PATTERN_STATUS.TRUSTED),
    rejected: patterns.filter((p) => p.status === PATTERN_STATUS.REJECTED),
    fieldsMostCorrected,
    documentTypesWithMostErrors,
    recentEvents,
  };
}
