const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const logger = require('firebase-functions/logger');

const db = admin.firestore();

const REGION = 'asia-south1';

function learningHash(input) {
  let h = 2166136261;
  const s = String(input || '');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Async pattern aggregation. Does not run on the client save path.
 * Duplicate event docs cannot double-count because onCreate fires once per id.
 */
exports.onDocumentIntelligenceFeedbackCreate = onDocumentCreated(
  {
    document: 'document_intelligence_feedback/{eventId}',
    region: REGION,
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const item = snap.data() || {};
    if (item.recordType !== 'EVENT') return;
    if (item.correctionType === 'USER_CONFIRMED') return;

    const documentType = String(item.documentType || 'GENERIC_DOCUMENT');
    const fieldName = String(item.fieldName || '');
    if (!fieldName) return;

    const rejectName = `REJECT_${item.originalValueShape || 'OTHER'}_AS_${fieldName.toUpperCase()}`;
    const preferName = `PREFER_${item.correctedValueShape || 'OTHER'}_FOR_${fieldName.toUpperCase()}`;
    const now = new Date().toISOString();

    async function bump(normalizedPattern) {
      const patternId = `pat_${learningHash(`${documentType}|${fieldName}|${normalizedPattern}`)}`;
      const ref = db.collection('document_intelligence_feedback').doc(patternId);
      await db.runTransaction(async (tx) => {
        const current = await tx.get(ref);
        const data = current.exists ? current.data() || {} : {};
        const seen = new Set(Array.isArray(data.evidenceKeys) ? data.evidenceKeys : []);
        const evidenceKey = `${item.userId || 'anon'}::${item.documentFingerprint || event.params.eventId}`;
        if (seen.has(evidenceKey)) return;
        seen.add(evidenceKey);
        const independent = seen.size;
        let status = 'CANDIDATE';
        if (independent >= 5) status = 'TRUSTED';
        else if (independent >= 3) status = 'EMERGING';
        tx.set(
          ref,
          {
            recordType: 'PATTERN',
            patternId,
            documentType,
            fieldName,
            semanticLabel: normalizedPattern,
            normalizedPattern,
            supportCount: Number(data.supportCount || 0) + 1,
            independentEvidence: independent,
            evidenceKeys: Array.from(seen).slice(-40),
            confidence: Math.min(0.98, 0.2 + independent * 0.12),
            status,
            createdAt: data.createdAt || now,
            updatedAt: now,
            promotedBy: 'system',
          },
          { merge: true },
        );
      });
    }

    try {
      await bump(rejectName);
      await bump(preferName);
    } catch (err) {
      logger.warn('document intelligence pattern aggregate failed', err?.message || err);
    }
  },
);
