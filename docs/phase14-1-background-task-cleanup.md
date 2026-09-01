# Phase 14.1 — Failed background task forensic audit

**Date:** 2026-08-27  
**Scope:** Inspection of leftovers from two failed background tasks, plus verification that Phase 13/14 OCR intelligence is internally consistent.

Failed tasks:

1. Logo / app-icon integration — timed out during Android AAB Gradle wait.
2. Phase 13.1 Passport delete + number wrap — stopped after repeated resume attempts.

**Nothing was deleted blindly.** Untracked APKs, branding masters, and Phase 13.1 delete/crypto files were left in place.

---

## 1. What the failed tasks left behind

### Branding / icon task — SAFE TO LEAVE

The branding agent wrote icon pipeline and splash/header colour updates, then died waiting on `bundleRelease`.

| Item | Verdict |
|---|---|
| `scripts/generate-app-icons.js` | Complete, points at approved masters. Not OCR. Leave. |
| Android mipmap / splash / notification PNGs | Generated assets. Not OCR. Leave. |
| `src/components/SplashScreen.tsx`, `AssetDoctorMark.tsx`, `AssetDoctorAppIcon.tsx`, `src/theme/brandAssets.js` | Branding only. Leave. |
| `assets/branding/*` masters, `icon.png`, `public/icon.png` | Untracked artwork. Leave. |
| `AssetDoctor-v1.0.62-117-release.apk` … `v1.0.65-120-release.apk` | Local release copies. Not source. Leave. |
| Root `icon.png` | Duplicate of branding export. Unused by OCR. Leave. |

**Unsafe if deleted:** these are the live launcher/splash resources. Removing them would regress branding, which is out of scope.

**OCR overlap:** none. Branding files do not import Phase 14 modules. Phase 14 files do not import brand assets.

### Phase 13.1 delete / Passport task — SAFE TO LEAVE

The agent finished the crypto/delete/formatting implementation and tests before the turn died. `npm run test:phase131` is **60 / 0**.

| Item | Verdict |
|---|---|
| `src/polyfills/softwareCsprng.js` | Required Android CSPRNG fallback. Leave. |
| `src/polyfills/installSecureCrypto.js` | Wraps throwing native `getRandomValues`. Leave. |
| `src/services/assets/assetDeleteFlow.js` | Soft-delete orchestration. Leave. |
| `src/utils/format.js` (`formatINRCompact`, `formatOwnershipDuration`) | Passport wrap fix. Leave. |
| `src/components/design-system/index.js` MetricCard nowrap | Passport wrap fix. Leave. |
| `src/services/assets/__tests__/phase131PassportDeleteHardening.test.ts` | Complete. Leave. |

**Unsafe if deleted:** would reintroduce the production “Native crypto module could not be used…” delete failure.

**OCR overlap:** delete/crypto files do not call OCR. Phase 14 does not call delete flow.

---

## 2. Suspicious files inspected (not deleted)

| File / area | Why it looked suspicious | Why it was left |
|---|---|---|
| `src/ocr/core/UniversalOcrPipeline.ts` | Second “Universal OCR” class | Historical extractors + `AssetMatcher`. Runtime OCR uses `services/ocr/universalPipeline.ts`. Phase 14 imports `AssetMatcher` from `src/ocr`. Deleting would break identity matching. |
| `src/services/ocr/ocrProviderOrchestrator.js` | Second orchestrator | Hybrid **winner** routing (Google/Azure/ML Kit). Phase 14 ranks already-captured texts. Complementary, not competing winners. |
| Multiple `classifyDocument*` functions | Duplicate classifiers | Keyword classifier remains the extraction-time hint. Phase 14 `documentTypeIntelligence` is the last non-forcing type decision. Historical modules still used by Universal pipeline tests. |
| `src/ocr/` vs `services/ocr/extractors/` | Duplicate extractors | Pre-Phase-14 architecture. Extraction still goes through `services/ocr/universalPipeline`. Do not collapse in a cleanup pass. |
| `public/assets/*` hashed deletions | Stale Vite chunks | Normal rebuild churn. Not failed-task debris. |
| `src/trust/protectionStatus.js` | Partial Phase 12 | Vault badge only. Not OCR. Leave. |
| `ocrOfflineQueue` | Looks like a second queue | Existing **OCR retry** queue for failed captures. Learning uses `OfflineQueue` + `documentIntelligenceFeedback`. Not duplicated learning. |

---

## 3. Authoritative OCR path (runtime)

```
ScanBillScreen
  → scanQualityGate (heuristic size/resolution)
  → CloudVisionOcrService.recognizeInvoice
       ML Kit candidate
       Google Vision (unless skipCloudOcr)
       Azure only on Google hard failure
       selectOcrRawText → ONE winner rawText
       UniversalOcrPipeline (services/ocr/universalPipeline)
       optional Gemini safe merge
       data.providerTexts = { google, azure, mlkit, winner }   // additive; may be null
  → classifyDocumentIntelligence (keyword family)
  → runDocumentIntelligence (amount / match hints)
  → Phase 13 applyStoredLearning
  → Phase 14 attachHardeningToInvoice / hardenOcrUnderstanding
  → ReviewAssetScreen
  → AssetService persistence / existing OfflineQueue
```

**Bypass found and repaired in 14.1:** `DocumentsVaultScreen` bill upload called Cloud Vision then opened Review **without** Phase 14. It now runs `attachHardeningToInvoice`.

**Bypass found and repaired in 14.1:** ScanBill nested Phase 14 inside the learning `try`. Learning failure skipped hardening. They are now independent.

**Remaining bypass (reported, not changed):** `ocrDiagnosticService` still calls `recognizeInvoice` for diagnostics only — not a customer save path.

---

## 4. Provider availability (honest)

| Provider | When text exists at runtime |
|---|---|
| Google | When Google succeeds (normal online path) |
| Azure | Only when Google **hard-fails** (empty/error) and budget remains |
| ML Kit | Fast on-device candidate; not a cloud skip |
| Winner | Always the selected `rawText` |

If Google succeeds, Azure raw text is typically **null**. Phase 14 will then report:

`WINNER_TEXT_ONLY` or `SINGLE_PROVIDER`

**Never** `MULTI_PROVIDER` / “3-engine consensus” unless three actual provider strings ≥ 8 chars exist.

Code: `describeProviderAvailability()` → `PROVIDER_CANDIDATE_TELEMETRY_UNAVAILABLE` when none are present.

---

## 5. Files removed

None.

---

## 6. Files repaired (Phase 14.1 only)

- `services/ocr/phase14/currencyProtection.ts` — alphanumeric identifiers (e.g. `UP32QU2187`) are not treated as money; odometer only vetoes currency glyphs/grouping.
- `services/ocr/phase14/hardeningOrchestrator.ts` — if a field is empty but a **valid in-document** candidate exists, promote as `REVIEW_RECOMMENDED` (not AUTO_ACCEPT, not invented).
- `services/ocr/phase14/crossFieldHardening.ts` — odometer equal to invoice total is not auto-accepted.
- `services/ocr/phase14/ensembleCandidates.ts` — honest provider availability modes.
- `src/services/intelligence/documentLearningClient.js` — `attachHardeningToInvoice`.
- `src/screens/ScanBillScreen.jsx` — Phase 14 runs even if learning throws.
- `src/screens/assets/DocumentsVaultScreen.jsx` — vault bill OCR now goes through Phase 14.
- `src/screens/ReviewAssetScreen.jsx` — OCR confidence alone cannot become HIGH_CONFIDENCE or Verified. Verified only from `userConfirmedFields`.

---

## 7. Intentionally untouched

Branding, logo, splash, WhatsApp, Firebase production config, Meta config, AAB/release versioning, Passport visual redesign beyond the already-landed 13.1 nowrap/delete work.
