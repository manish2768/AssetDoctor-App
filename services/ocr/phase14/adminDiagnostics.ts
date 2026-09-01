/**
 * Phase 14 — Admin diagnostics from real OCR queue / documents / learning rows.
 * Never invents percentages. Empty → TELEMETRY NOT AVAILABLE / No data yet.
 */

export interface OcrHardeningDiagnostics {
  available: boolean;
  documentsProcessed: number | null;
  autoAcceptedFields: number | null;
  fieldsRequiringReview: number | null;
  humanCorrections: number | null;
  topFailureTypes: Array<{ code: string; count: number }>;
  topConfusedFields: Array<{ fieldName: string; count: number }>;
  providerDisagreement: number | null;
  classificationUnknown: number | null;
  assetMatchConflicts: number | null;
  patternSuccessRate: number | null;
  realDocumentTelemetry: string;
}

function isEmptyList(arr: unknown): boolean {
  return !Array.isArray(arr) || arr.length === 0;
}

export function summarizeOcrHardeningDiagnostics(input: {
  ocrQueue?: Array<Record<string, unknown>>;
  documents?: Array<Record<string, unknown>>;
  learningFeedback?: Array<Record<string, unknown>>;
  realDocumentLab?: Array<Record<string, unknown>>;
} = {}): OcrHardeningDiagnostics {
  const realLab = input.realDocumentLab || [];
  const realDocumentTelemetry = realLab.length
    ? `${realLab.length} redacted/lab document(s) recorded`
    : 'No real-document telemetry yet';
  const queue = input.ocrQueue || [];
  const docs = input.documents || [];
  const learning = input.learningFeedback || [];
  if (isEmptyList(queue) && isEmptyList(docs) && isEmptyList(learning)) {
    return {
      available: false,
      documentsProcessed: null,
      autoAcceptedFields: null,
      fieldsRequiringReview: null,
      humanCorrections: null,
      topFailureTypes: [],
      topConfusedFields: [],
      providerDisagreement: null,
      classificationUnknown: null,
      assetMatchConflicts: null,
      patternSuccessRate: null,
      realDocumentTelemetry,
    };
  }

  const processed = docs.length + queue.length;
  let review = 0;
  let auto = 0;
  let disagreement = 0;
  let unknownType = 0;
  let conflicts = 0;
  const fail: Record<string, number> = {};
  const confused: Record<string, number> = {};

  const bump = (map: Record<string, number>, key: string) => {
    if (!key) return;
    map[key] = (map[key] || 0) + 1;
  };

  for (const row of [...queue, ...docs]) {
    const needs = row.needsReview || row.needsManualReview || row.status === 'NEEDS_REVIEW';
    if (needs) review += 1;
    const p14 = row.phase14 && typeof row.phase14 === 'object' ? (row.phase14 as Record<string, unknown>) : null;
    const decisions = (row.fieldDecisions || p14?.fieldDecisions) as Record<string, { decision?: string; errorCodes?: string[] }> | undefined;
    if (decisions && typeof decisions === 'object') {
      for (const [field, d] of Object.entries(decisions)) {
        if (d?.decision === 'AUTO_ACCEPT') auto += 1;
        if (d?.decision === 'REVIEW_RECOMMENDED' || d?.decision === 'REJECT_CANDIDATE') {
          bump(confused, field);
        }
        for (const code of d?.errorCodes || []) bump(fail, String(code));
      }
    }
    const codes = (row.errorCodes || p14?.errorCodes || []) as string[];
    for (const code of codes) bump(fail, String(code));
    if (codes.includes('OCR_PROVIDER_DISAGREEMENT') || row.providerConflict) disagreement += 1;
    if (row.documentType === 'UNKNOWN_DOCUMENT_STRUCTURE' || row.classifiedDocumentType === 'UNKNOWN_DOCUMENT_STRUCTURE') {
      unknownType += 1;
    }
    if (row.assetIdentityConflict || codes.includes('OCR_ASSET_MATCH_CONFLICT')) conflicts += 1;
  }

  const events = learning.filter((r) => String(r.recordType || 'EVENT').toUpperCase() !== 'PATTERN');
  const corrections = events.filter((e) => e.correctionType && e.correctionType !== 'USER_CONFIRMED').length;
  const patterns = learning.filter((r) => String(r.recordType || '').toUpperCase() === 'PATTERN');
  const trusted = patterns.filter((p) => p.status === 'TRUSTED').length;
  const patternSuccessRate =
    patterns.length > 0 ? Math.round((trusted / patterns.length) * 1000) / 10 : null;

  const top = (map: Record<string, number>) =>
    Object.entries(map)
      .map(([k, count]) => ({ code: k, fieldName: k, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

  return {
    available: true,
    documentsProcessed: processed,
    autoAcceptedFields: auto || null,
    fieldsRequiringReview: review,
    humanCorrections: events.length ? corrections : null,
    topFailureTypes: top(fail).map(({ code, count }) => ({ code, count })),
    topConfusedFields: top(confused).map(({ fieldName, count }) => ({ fieldName, count })),
    providerDisagreement: disagreement || null,
    classificationUnknown: unknownType || null,
    assetMatchConflicts: conflicts || null,
    patternSuccessRate,
    realDocumentTelemetry,
  };
}

export function formatDiagnosticMetric(value: number | null | undefined): string {
  if (value == null) return 'No data yet';
  return String(value);
}
