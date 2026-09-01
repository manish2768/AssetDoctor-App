/**
 * Phase 13 — Pattern memory.
 * One correction = CANDIDATE signal, never a global production rule.
 * Repeated independent evidence → EMERGING; sufficient evidence → TRUSTED.
 */

import {
  PATTERN_STATUS,
  PROMOTION,
  type LearningFeedbackEvent,
  type LearningPattern,
  type PatternStatus,
} from './types.ts';
import { patternKey } from './valueShape.ts';

export interface EvidenceRef {
  userId: string;
  documentFingerprint: string;
  eventId: string;
}

function independentKey(userId: string, fingerprint: string): string {
  return `${userId}::${fingerprint}`;
}

export class PatternMemory {
  private patterns = new Map<string, LearningPattern>();
  private evidence = new Map<string, Set<string>>();
  private eventIds = new Set<string>();
  private events: LearningFeedbackEvent[] = [];

  constructor(seed: LearningPattern[] = []) {
    for (const p of seed) this.patterns.set(p.patternId, { ...p });
  }

  listPatterns(): LearningPattern[] {
    return [...this.patterns.values()].map((p) => ({ ...p }));
  }

  listEvents(): LearningFeedbackEvent[] {
    return this.events.map((e) => ({ ...e }));
  }

  getPattern(id: string): LearningPattern | null {
    return this.patterns.get(id) ? { ...this.patterns.get(id)! } : null;
  }

  /**
   * Customers cannot force TRUSTED. System promotion only.
   */
  ingestEvent(event: LearningFeedbackEvent, opts: { allowTrustedPromotion?: boolean } = {}): LearningPattern[] {
    if (!event?.eventId) return this.listPatterns();
    if (this.eventIds.has(event.eventId)) return this.listPatterns();
    this.eventIds.add(event.eventId);
    this.events.push(event);

    if (event.correctionType === 'USER_CONFIRMED') {
      return this.listPatterns();
    }

    const now = event.timestamp || new Date().toISOString();
    const rejectName = `REJECT_${event.originalValueShape}_AS_${String(event.fieldName).toUpperCase()}`;
    const preferName = `PREFER_${event.correctedValueShape}_FOR_${String(event.fieldName).toUpperCase()}`;

    const touched = [
      this.bumpPattern({
        documentType: event.documentType,
        fieldName: event.fieldName,
        normalizedPattern: rejectName,
        semanticLabel: rejectName,
        layoutSignal: event.contextSignals?.nearbyLabels?.slice(0, 6).join('|') || null,
        event,
        now,
        allowTrusted: opts.allowTrustedPromotion !== false,
      }),
      this.bumpPattern({
        documentType: event.documentType,
        fieldName: event.fieldName,
        normalizedPattern: preferName,
        semanticLabel: preferName,
        layoutSignal: event.contextSignals?.nearbyLabels?.slice(0, 6).join('|') || null,
        event,
        now,
        allowTrusted: opts.allowTrustedPromotion !== false,
      }),
    ];
    return touched;
  }

  private bumpPattern(opts: {
    documentType: string;
    fieldName: string;
    normalizedPattern: string;
    semanticLabel: string;
    layoutSignal: string | null;
    event: LearningFeedbackEvent;
    now: string;
    allowTrusted: boolean;
  }): LearningPattern {
    const id = patternKey(opts.documentType, opts.fieldName, opts.normalizedPattern);
    const existing = this.patterns.get(id);
    const evSet = this.evidence.get(id) || new Set<string>();
    evSet.add(independentKey(opts.event.userId, opts.event.documentFingerprint));
    this.evidence.set(id, evSet);
    const independentEvidence = evSet.size;
    const supportCount = (existing?.supportCount || 0) + 1;
    const status = this.promote(independentEvidence, existing?.status, opts.allowTrusted);
    const confidence = Math.min(0.98, 0.2 + independentEvidence * 0.12);
    const next: LearningPattern = {
      patternId: id,
      recordType: 'PATTERN',
      documentType: opts.documentType,
      fieldName: opts.fieldName,
      semanticLabel: opts.semanticLabel,
      normalizedPattern: opts.normalizedPattern,
      layoutSignal: opts.layoutSignal,
      supportCount,
      independentEvidence,
      confidence,
      status,
      createdAt: existing?.createdAt || opts.now,
      updatedAt: opts.now,
      rejectedCount: existing?.rejectedCount || 0,
    };
    this.patterns.set(id, next);
    return next;
  }

  private promote(independent: number, previous: PatternStatus | undefined, allowTrusted: boolean): PatternStatus {
    if (previous === PATTERN_STATUS.REJECTED) return PATTERN_STATUS.REJECTED;
    if (independent >= PROMOTION.TRUSTED_EVIDENCE && allowTrusted) return PATTERN_STATUS.TRUSTED;
    if (independent >= PROMOTION.EMERGING_EVIDENCE) return PATTERN_STATUS.EMERGING;
    return PATTERN_STATUS.CANDIDATE;
  }

  /**
   * Admin/system only.
   */
  promotePattern(patternId: string, status: PatternStatus, actor: 'admin' | 'system' = 'system'): LearningPattern | null {
    const p = this.patterns.get(patternId);
    if (!p) return null;
    if (actor !== 'admin' && actor !== 'system') return p;
    const next = { ...p, status, updatedAt: new Date().toISOString() };
    this.patterns.set(patternId, next);
    return { ...next };
  }

  rejectPattern(patternId: string): LearningPattern | null {
    return this.promotePattern(patternId, PATTERN_STATUS.REJECTED, 'admin');
  }

  serialize(): { patterns: LearningPattern[]; eventIds: string[] } {
    return { patterns: this.listPatterns(), eventIds: [...this.eventIds] };
  }

  static fromSerialized(data: { patterns?: LearningPattern[]; eventIds?: string[] } | null): PatternMemory {
    const mem = new PatternMemory(data?.patterns || []);
    for (const id of data?.eventIds || []) mem.eventIds.add(id);
    return mem;
  }
}
