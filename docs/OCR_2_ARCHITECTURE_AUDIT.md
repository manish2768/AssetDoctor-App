# ASSET DOCTOR — COMPLETE OCR 2.0 ARCHITECTURAL AUDIT
**Date**: 2026-08-25  
**Auditor**: Principal Full-Stack & OCR/Mobile Architect

---

## 1. Executive Summary & Audit Overview

This audit document maps the entire OCR, camera, document classification, extraction, latency, security, and asset-linking architecture of the Asset Doctor ecosystem across Mobile (React Native / Expo / Android Native) and Web/Admin layers.

---

## 2. Current Architecture Mapping

### 2.1 OCR Entry Points & Camera/Scanner Screens
- **`ScanBillScreen.jsx`**: Main camera capture & gallery import screen. Handles camera permissions, document scanning frame hints, quality gate evaluation (`assessScanImageQuality`), image preprocessing, and OCR dispatching.
- **`ReviewAssetScreen.jsx` / `ReviewInvoiceScreen.jsx`**: Hydrates extracted fields into review forms with confidence indicators, document-kind gating, and user editing controls.
- **`OcrDiagnosticScreen.jsx`**: Developer tool for benchmarking test fixtures and measuring OCR accuracy.
- **`DocumentScannerService.js`**: Bridge to native ML Kit Document Scanner on Android.

### 2.2 OCR Engine & Pipeline Architecture
- **`src/services/ocr/CloudVisionOcrService.js`**: Core OCR coordinator. Prioritizes:
  1. Authenticated Cloud Function proxy (`scanInvoiceVision`)
  2. Client API Key fallback (dev mode)
  3. On-Device ML Kit Text Recognition (`@react-native-ml-kit/text-recognition`)
  4. Multimodal Gemini Vision (`extractAssetWithGemini`)
  5. `UniversalOcrPipeline` & `runSemanticOcrPipeline` deterministic extraction
- **`services/ocr/universalPipeline.ts`**: Unified pipeline handling 13 Indian document categories, entity linking, cross-field validation, and semantic negative filtering.
- **`src/services/gemini/geminiService.js`**: Gemini 1.5/2.0 Flash multimodal extraction using structured JSON schemas.

### 2.3 Document Classification & Extraction Flow
```
Captured Image / Gallery
   │
   ▼
Image Preprocessing (1800px, 0.85 JPEG, contrast enhance)
   │
   ▼
Quality Gate (Image clarity & text readability)
   │
   ▼
Document Classification FIRST (13 Categories: Service, Sales, Insurance, RC, PUC, Appliance, etc.)
   │
   ▼
Category-Specific Isolated Extractor (Active extractor ONLY)
   │
   ▼
Smart Fusion Layer (Deterministic Facts + Multimodal AI)
   │
   ▼
Asset Identity Resolver (Registration / Chassis / Serial / IMEI / Fuzzy)
   │
   ▼
Dynamic Review Screen (User Confirmation)
   │
   ▼
Vault Storage & Asset Timeline (Idempotent Document & History Records)
```

---

## 3. Root Cause Analysis of Production Issues

| Problem | Root Cause | Permanent Architectural Solution |
| :--- | :--- | :--- |
| **Wrong Document Classification** | Classification running after generic field extraction | **Classification-First Architecture**: Classify into 10 base document classes before activating any extractor. |
| **Field Leakage (Service fields on Sales/Insurance)** | Single unified mapper passing all fields regardless of doc type | **Strict Field Gating**: Isolate extractors so insurance policies reject odometer/service KM, and sales bills reject engine/chassis numbers. |
| **Odometer Hallucination / Collision** | Regex capturing numeric tokens from phone numbers, GSTIN, job cards | **Semantic Negative Filtering**: Require explicit label provenance (`Current KM:`, `Odometer:`) and blacklist phone, GSTIN, total amount tokens. |
| **Fake Dates & Service Intervals** | Defaulting missing fields to fallback constants | **Strict Zero-Hallucination Policy**: Missing values return `null` with `NOT_FOUND` status. No fake defaults. |
| **Processing Latency (40–45s)** | Sequential timeouts, uncompressed high-res uploads, redundant AI retries | **Optimized Routing & Latency Budgets**: Parallel frame sampling, 15s timeout abort controllers, SHA-256 result caching, 1-2s Live Scanner target. |
| **Duplicate Asset Creation** | Weak fuzzy matching auto-creating duplicate assets | **Multi-Tier Identity Resolution**: Exact match on Registration, VIN, Engine, Serial, or IMEI. Unsafe fuzzy matches require explicit user confirmation. |

---

## 4. Two Scanner Modes Architecture

### Mode A: Document Vault
- **Purpose**: Permanent high-fidelity document archiving.
- **Flow**: Crop → Perspective Correction → Adaptive Compression → Full OCR → Asset Timeline → User Confirmation → Permanent Secure Vault Storage.
- **Storage**: Never writes permanent files until user presses "Save to Vault".

### Mode B: Live Scanner
- **Purpose**: Instant form-filling and fast metadata extraction.
- **Flow**: Local Frame Sampling → Document Stability Detection → On-Device ML Kit OCR → Instant Form Suggestions (Target: 1–2s).
- **Storage**: Zero permanent images saved, zero PDFs generated, zero Firestore document records created.

---

## 5. Security & Privacy Audit
- **Zero Client Credentials**: Google Cloud service-account private keys, Azure API keys, and Firebase Admin credentials remain strictly server-side.
- **PII Protection**: Sanitized logging ensures customer phone numbers, policy numbers, and chassis/IMEI details are excluded from telemetry trails.
- **Idempotency**: Document SHA-256 fingerprinting guarantees that scanning the same document multiple times will not duplicate asset records or vault entries.
