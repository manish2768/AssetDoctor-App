# Phase 14 / 14.1 — OCR Quality Report

**Date:** 2026-08-27  
**Scope:** Hardening layer above existing OCR + Phase 13 Learning Engine. Phase 14.1 is verification/cleanup, not an OCR rewrite.

This report does **not** invent production percentages.

---

## Production telemetry

| Metric | Value |
|---|---|
| CURRENT FAILURE RATE | TELEMETRY NOT AVAILABLE |
| AUTO ACCEPT RATE | TELEMETRY NOT AVAILABLE |
| REVIEW RATE | TELEMETRY NOT AVAILABLE |
| NOT FOUND RATE | TELEMETRY NOT AVAILABLE |
| PROVIDER DISAGREEMENT RATE | TELEMETRY NOT AVAILABLE |
| FIELD VALIDATION FAILURE RATE | TELEMETRY NOT AVAILABLE |
| ASSET MATCH CONFLICT RATE | TELEMETRY NOT AVAILABLE |

Admin Learning Center shows these counts **only when** `ocrReviewQueue`, vaulted documents, or `document_intelligence_feedback` rows exist. Empty state: **No data yet**.

---

## TEST VERIFIED (synthetic / unit)

`npm run test:phase14` — **50 passed / 0 failed**

| Case | Result |
|---|---|
| A. ₹23,999 never becomes IMEI | TEST VERIFIED |
| B. 23999 never becomes IMEI at 99% OCR confidence | TEST VERIFIED |
| C. Service invoice vehicle number extracted when present | TEST VERIFIED |
| D. Registration not replaced by labour/unrelated number | TEST VERIFIED |
| E. Invoice number is not a date | TEST VERIFIED |
| F. IMEI is not invoice amount | TEST VERIFIED |
| G. GSTIN is not arbitrary alphanumeric | TEST VERIFIED |
| H. Odometer is not invoice amount; plausible km kept | TEST VERIFIED |
| I. Exact IMEI links existing asset | TEST VERIFIED |
| J. Conflicting identifiers → ASSET_IDENTITY_CONFLICT | TEST VERIFIED |
| K. Missing fields stay NOT_FOUND | TEST VERIFIED |
| L. OCR confidence alone never creates VERIFIED | TEST VERIFIED |

Provider modes: empty → `PROVIDER_CANDIDATE_TELEMETRY_UNAVAILABLE`; winner-only → `WINNER_TEXT_ONLY`; two texts → `DUAL_PROVIDER`; three actual texts required for `MULTI_PROVIDER`. **No UI claims “3-engine consensus”.**

---

## PRODUCTION VERIFIED

**Not claimed.** No live camera, live Vision/Azure, or production Admin OCR queue was measured in this phase.

---

## Regression (executed 2026-08-27)

| Suite | Result |
|---|---|
| test:phase14 | 50 / 0 |
| test:phase13 | 73 / 0 |
| test:phase114 | 60 / 0 |
| test:phase93 | 36 / 0 |
| test:ocr | 43 / 43 |
| test:acceptance | 62 / 62 |
| test:whatsapp | 20 / 0 |
| test:phase11 | 37 / 0 |
| test:phase112 | 63 / 0 |
| test:phase113 | 33 / 0 |
| `npm run build` | PASS |

---

## TypeScript

`npx tsc --noEmit` reports **8 pre-existing errors** (not introduced by Phase 14 or 14.1):

- `services/intelligence/documentLearning/feedbackCapture.ts` (4)
- `services/ocr/__tests__/phase93ProductionHardening.test.ts` (2)
- `services/ocr/duplicateDetector.ts` (2)

Phase 14 / 14.1 source files typecheck clean.

---

## Known limitations (honest)

1. Image quality is still file-size / resolution heuristic, not pixel CV.
2. Azure still does not run after a successful Google read. Ensemble ranking only uses extra provider strings **when they were already captured**.
3. On-device learning is still the customer’s own pattern memory. Cloud Function / Firestore rules for learning were **not deployed**.
4. `ocrDiagnosticService` still bypasses Phase 14 (diagnostics only).
5. Thermal bills, handwritten notes, and live-camera glare still require real-document validation.

The objective remains **correct data**, not a successful-looking OCR score.
