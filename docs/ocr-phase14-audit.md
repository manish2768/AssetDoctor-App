# Phase 14 — OCR / Document Intelligence Audit

**Date:** 2026-08-27  
**Scope:** Map the live pipeline. No branding, WhatsApp, or Passport UI. Phase 13 Learning Engine is already in production code.

This document describes the **actual** architecture as inspected. It does not invent telemetry percentages.

---

## 1. End-to-end map (production scan path)

```
ScanBillScreen (camera / gallery)
  → assessScanImageQuality / scoreScanQualitySignals   [heuristic size/resolution only]
  → Image preprocess (resize JPEG)
  → CloudVisionOcrService.recognizeInvoice
        1. ML Kit on-device (fast candidate; never skips cloud)
        2. Google Vision via Cloud Function (primary)
        3. Azure Vision only on Google HARD failure (empty/error)
        4. selectOcrRawText — ONE rawText winner
        5. UniversalOcrPipeline.process(winner rawText)
        6. InvoiceOcrParser + SweetBillChecker merge
        7. Optional Gemini (6s timeout) via mergeGeminiSafely
  → mapOcrToInvoiceFields
  → ocrSchemas.scoreExtractionConfidence / needsManualReview (< 85%)
  → fieldConfidence.scoreFieldConfidences
  → documentTypeClassifier + documentIntelligenceDecision
  → SmartAssetMapper / matchAssetForService
  → Phase 13 applyStoredLearning (candidate rank + pattern memory)
  → ReviewAssetScreen (edit / Use Candidate / save)
  → Firestore asset + documents  OR  OfflineQueue
  → Admin ocrReviewQueue + Phase 13 Learning Center
```

**Hard rule already present:** missing identifiers stay null. Gemini must not overwrite OCR evidence (`mergeGeminiSafely`).

---

## 2. Stage inventory

| Stage | Primary files | Notes |
|---|---|---|
| Camera / image | `ScanBillScreen.jsx`, `DocumentScannerService.js` | Android ML Kit document scanner when available |
| Quality | `scanQualityGate.js`, `src/ocr/preprocess/ImageQualityAnalyzer.ts` | **No native blur/glare CV.** Size/base64/resolution heuristics only. Analyzer score is largely file-length based. |
| OCR provider 1 | ML Kit `@react-native-ml-kit/text-recognition` via `CloudVisionOcrService` / `LocalOcrEngine` | Fast candidate |
| OCR provider 2 | Google Vision (`scanInvoiceVision` CF) | Always attempted unless skipCloud / offline |
| OCR provider 3 | Azure (`AzureOcrService` / `AzureVisionEngine`) | Only if Google is a hard failure |
| Hybrid routing | `ocrProviderOrchestrator.js` Phase 11.3 | Cloud winner preferred; ML Kit kept if cloud empty; conflict flags `needsReview` |
| Parallel TS pipeline | `src/ocr/core/OcrRouter.ts` + extractors | Separate from CloudVision path; used by `UniversalOcrPipeline` class wrapper |
| Universal extraction | `services/ocr/universalPipeline.ts` | 13 Indian doc categories, entity linking |
| Classification (duplicated) | `documentTypeClassifier.js`, `services/ocr/classifier.ts`, `src/ocr/core/OcrDocumentClassifier.ts`, `documentIntelligenceTypes.js` | Keyword/score based; multiple enum families (`bill` vs `SERVICE_INVOICE`) |
| Field extraction | Universal pipeline + `InvoiceOcrParser` + type extractors under `src/ocr/extractors/` and `services/ocr/extractors/` | **Duplicated extractor trees** |
| Normalization | `fieldNormalization.js`, `cleanAndValidateOCR.js`, `fieldValidators.js` (placeholders) | Placeholders → null |
| Candidates / learning | Phase 13 `services/intelligence/documentLearning/` | Ranked candidates, validators, cross-field, pattern memory |
| Validators (duplicated) | Phase 13 `fieldValidators.ts`, `fieldChecksumValidators.ts`, `fieldConfidence.js` IMEI Luhn, `fieldValidators.js` | Three layers; Phase 13 is the semantic source of truth |
| Review | `ReviewAssetScreen.jsx` | Phase 13 FieldReviewHint already wired |
| Persistence | AssetProvider + DocumentVaultService | Confirm-first; no silent auto-save |
| Offline | `ocrOfflineQueue.js`, `OfflineQueue` / `SyncEngine` (`documentIntelligenceFeedback`) | Phase 13 reuses existing queue |
| Admin | `ocrReviewQueue`, `admin-intelligence.js` `summarizeLearningCenter` | Real rows only; empty → “No learning data yet” |

---

## 3. Identified gaps (root causes)

### 3.1 Single-winner raw text (ensemble gap)

`selectOcrRawText` / `OcrRouter` keep **one** `rawText`. Google/Azure/ML Kit field-level candidates are **not** preserved for ranking.

Telemetry already stores `googleRawText` / `azureRawText` but they are **not** fed into field candidate ranking.

**Effect:** If Google OCR reads `23999` near IMEI and Azure would have read the 15-digit IMEI, Azure text is discarded unless Google hard-failed.

### 3.2 OCR confidence treated as semantic confidence

`ScanBillScreen` uses overall OCR/extraction confidence (`needsManualReview` if `< 85`). `fieldConfidence.js` mixes heuristics with OCR-ish scores.

Phase 13 already rejects INVALID/SUSPICIOUS values, but **high OCR confidence can still leave a currency-shaped IMEI in the form until review**.

**Rule needed:** `ocrConfidence ≠ semanticConfidence ≠ finalConfidence`.

### 3.3 Document-type misclassification

Classification is keyword-heavy (`documentTypeClassifier.js`, `classifier.ts`, `OcrDocumentClassifier.ts`). Low-confidence types are still forced into a family rather than `UNKNOWN_DOCUMENT_STRUCTURE`.

Mismatched enums (`bill` / `sales_invoice` vs `PURCHASE_INVOICE`) require adapters (`toDocTypeV2`, `normalizeLearningDocumentType`).

### 3.4 Duplicated parsers / overwrite risk

CloudVision merge order:

1. Universal pipeline invoice  
2. GST parser GSTIN / line items  
3. `preferPurchaseTotal` for amounts (skipped for insurance/PUC/RC)  
4. Gemini only fills missing names (safe merge)

Still: two extractor trees (`src/ocr/extractors` vs `services/ocr/extractors`) can disagree if both are invoked on different entry points.

### 3.5 Image quality is not real CV

`ImageQualityAnalyzer` and `scanQualityGate` cannot measure blur/brightness/rotation from pixels. They infer from file size, base64 length, and dimensions.

Honest user copy is possible (“image too small”, “low resolution”, “looks cropped”). Claiming “too dark” without pixel analysis would be invented.

### 3.6 Asset matching has two stacks

- `SmartAssetMapper` / `matchAssetForService` (JS, used on scan path)  
- `AssetMatcher` / `AssetIdentityResolver` (TS, used by `OcrRouter`)

Exact IMEI/registration matches are strong. Fuzzy model+date matches exist. Identifier **conflicts** (invoice UP32QU2187 vs matched asset UP32AB0001) are not always raised as `ASSET_IDENTITY_CONFLICT`.

### 3.7 Line items

`invoiceTableRows.js` / Universal pipeline preserve items when parsed. Low-confidence tables are not consistently marked `LINE_ITEM_REVIEW_REQUIRED`. Row mixing (IMEI vs qty vs price) remains a known failure mode.

### 3.8 Silent vs noisy failure

Scan always opens Review (good). Empty OCR enqueues `ocrOfflineQueue` (good). Generic “Could not read text” still appears when all providers fail — taxonomy codes are incomplete.

### 3.9 Learning Engine (Phase 13) — already correct direction

- One correction = CANDIDATE, not a global rule  
- EMERGING / TRUSTED after repeated independent evidence  
- Overrides only when current value is INVALID/SUSPICIOUS and a VALID in-document candidate exists  
- Never invents missing fields  
- Customer cannot write PATTERN docs  

**Remaining:** learned patterns must remain **below** hard validators. Ensemble provider texts are not yet inputs to ranking.

---

## 4. What Phase 14 must NOT do

- Replace Google / Azure / ML Kit  
- Change `shouldCallCloudOcr` / Azure-only-on-hard-failure routing  
- Create a second offline queue  
- Auto-accept from OCR confidence alone  
- Promote one customer correction to a global TRUSTED rule  
- Invent IMEI / registration / GSTIN / amounts  
- Touch branding, WhatsApp, Passport layout, AAB versioning  

---

## 5. Phase 14 insertion point (chosen)

A **hardening layer** `services/ocr/phase14/` that runs **after** Universal OCR + Phase 13 `applyDocumentIntelligence`:

```
existing OCR fields + rawText + optional providerTexts + assets + imageQuality
        ↓
document type intelligence (UNKNOWN if low confidence)
        ↓
ensemble candidates (winner text + unused provider texts if already captured)
        ↓
hard validators + currency protection
        ↓
cross-field + date/amount relations
        ↓
weighted asset match + identity conflict
        ↓
semantic / final confidence + review decision
        ↓
error taxonomy (no generic “OCR failed” when a code exists)
```

Providers stay intact. Winner `rawText` selection stays intact. Extra provider strings are **additive inputs** when already present.

---

## 6. Pre-implementation test baseline

Recorded after Phase 13 (not re-run in this audit document):

- `test:phase13` 73 pass  
- Other requested suites reported 427/0 with `npm run build` PASS  

Phase 14 will re-run the suites after implementation and separate pre-existing vs new failures.
