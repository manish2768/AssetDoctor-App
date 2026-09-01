/**
 * Bill / document scanner — permission-gated capture + OCR + Gemini.
 * Never opens camera without permission; errors stay recoverable (no white screen).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Animated,
  Easing,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrivacyVaultTag } from '../components/PrivacyVaultTag';
import { COLORS, RADIUS, SPACING } from '../theme/branding';
import { GlassButton, Screen } from '../components/ui/Glass';
import { Haptics } from '../services/haptics';
import { CloudVisionOcrService } from '../services/ocr/CloudVisionOcrService';
import {
  captureDocumentImage,
  ensureCameraPermission,
  ensureLibraryPermission,
  getCameraPermissionStatus,
  openAppSettings,
  pickGalleryImage,
} from '../services/ocr/DocumentScannerService';
import { getImagePicker } from '../utils/safeNativeModules';
import { runSweetBillChecker } from '../services/SweetBillChecker';
import { InvoiceOfflineCache } from '../services/ocr/InvoiceOfflineCache';
import {
  isDuplicateBill,
  saveParsedBillDraft,
} from '../utils/billParser';
import { useAuth } from '../context/AuthProvider';
import { useAssets } from '../context/AssetProvider';
import { useUiFeedback } from '../context/UiFeedbackProvider';
import { ScanErrorBoundary } from '../components/ScanErrorBoundary';
import { ReviewAssetModal } from '../components/ReviewAssetModal';
import { openReviewInvoice, navigationRef, safeNavigate } from '../navigation/navActions';
import { markScanSession } from '../utils/scanNavGuard';

const AUTO_OPEN_MS = 280;
const SCREEN_H = Dimensions.get('window').height;
const FRAME_HEIGHT = Math.round(SCREEN_H * 0.46);
/** ImagePicker fallback when ML Kit document scanner is unavailable. */
const PICKER_OPTIONS = {
  mediaTypes: ['images'],
  quality: 0.92,
  allowsEditing: false,
  base64: false,
  exif: false,
};

function friendlyCaptureMessage(error) {
  try {
    const { toFriendlyError } = require('../utils/friendlyErrors');
    return toFriendlyError(error, "Couldn't scan clearly, please try again");
  } catch {
    const raw = String(error?.message || error || '').trim();
    if (!raw) return "Couldn't scan clearly, please try again";
    if (/permission/i.test(raw)) return raw;
    if (/cancel/i.test(raw)) return 'Capture cancelled. Tap Scan document to try again.';
    if (/network|timeout|offline/i.test(raw)) return 'Network taking time, saved locally';
    if (raw.length > 160) return "Couldn't scan clearly, please try again";
    return raw;
  }
}

/** Log scan errors — prefer inline lastError over native Alert. */
function reportScanError(error) {
  console.error('[ScanBillScreen Error]:', error);
  return friendlyCaptureMessage(error);
}

/**
 * Canonical preprocess + base64 for Vision (no extra JPEG when already preprocessed).
 * alreadyPreprocessed means capture already ran scanImagePreprocess.
 */
async function prepareScanImage(capturedUri, opts = {}) {
  const { prepareScanImageForOcr } = require('../services/ocr/scanImagePreprocess');
  return prepareScanImageForOcr(capturedUri, opts);
}

/** Map OCR payload → review fields with null-safe defaults (never crash). */
function mapOcrToInvoiceFields(parsedData = {}) {
  const src = parsedData && typeof parsedData === 'object' ? parsedData : {};
  const extract =
    src.ocrExtract && typeof src.ocrExtract === 'object' ? src.ocrExtract : {};
  let productName = '';
  try {
    const { resolveProductName } = require('../utils/productNameSanitizer');
    productName = resolveProductName({
      product_name: src.product_name || extract.product_name,
      productName: src.productName,
      asset_name: extract.asset_name || src.asset_name,
      assetName: src.assetName,
      item_name: src.item_name || extract.item_name,
      itemName: src.itemName,
      title: src.title,
      items: src.items,
    });
  } catch {
    productName =
      src.productName ||
      src.product_name ||
      src.assetName ||
      src.item_name ||
      extract.asset_name ||
      '';
  }
  return {
    ...src,
    productName,
    totalAmount:
      src.totalAmount ??
      src.amount ??
      extract.total_amount ??
      null,
    invoiceDate:
      src.invoiceDate ||
      src.date ||
      src.purchaseDate ||
      src.purchase_date ||
      extract.purchase_or_issue_date ||
      extract.purchase_date ||
      '',
    shopName:
      src.shopName ||
      src.seller_name ||
      src.vendor ||
      src.vendor_dealer_name ||
      extract.vendor_dealer_name ||
      extract.seller_name ||
      extract.vendor ||
      '',
    customerName:
      src.customerName ||
      src.buyer_name ||
      src.buyerName ||
      src.owner_buyer_name ||
      extract.owner_buyer_name ||
      extract.buyer_name ||
      '',
    invoiceNumber:
      src.invoiceNumber ||
      src.invoice_number ||
      extract.invoice_or_policy_no ||
      extract.invoice_number ||
      '',
    serialNumber:
      src.serialNumber ||
      src.serial_number ||
      extract.serial_number ||
      '',
    imei: src.imei || extract.imei || '',
    registration:
      src.registration ||
      extract.vehicle_registration_number ||
      extract.registration_number ||
      src.vehicle_registration_number ||
      '',
    warrantyExpiry:
      src.warrantyExpiry ||
      extract.expiry_date ||
      '',
    insuranceExpiry: src.insuranceExpiry || src.policyEndDate || '',
    pucExpiry: src.pucExpiry || '',
    chassisNumber: src.chassisNumber || extract.chassis_or_frame_no || '',
    engineNumber: src.engineNumber || extract.engine_number || '',
    odometerKm: src.odometerKm ?? src.odometerReading ?? extract.odometer_reading ?? null,
    odometerReading: src.odometerReading ?? src.odometerKm ?? extract.odometer_reading ?? null,
    workshopName: src.workshopName || src.shopName || '',
    idv: src.idv ?? extract.idv ?? null,
    premium: src.premium ?? extract.premium ?? null,
    policyNumber: src.policyNumber || extract.policy_number || '',
    policyStartDate: src.policyStartDate || extract.policy_start_date || '',
    policyEndDate: src.policyEndDate || extract.policy_end_date || '',
    serviceData: src.serviceData || null,
    insuranceData: src.insuranceData || null,
    purchaseData: src.purchaseData || null,
    universalOcr: src.universalOcr || null,
    classification: src.classification || null,
    fieldConfidenceMap: src.fieldConfidenceMap || null,
    confidence: src.confidence ?? null,
    needsManualReview: Boolean(src.needsManualReview),
    category: src.category || src.smartCategory || extract.category || '',
    smartCategory: src.smartCategory || '',
    purchaseCategory: src.purchaseCategory || '',
    items: Array.isArray(src.items) ? src.items : [],
    ocrExtract: extract,
  };
}

/** Empty manual-entry invoice when OCR fails — still open Review. */
function emptyFallbackInvoice() {
  return {
    productName: '',
    title: '',
    totalAmount: null,
    amount: '',
    invoiceDate: '',
    date: '',
    shopName: '',
    customerName: '',
    invoiceNumber: '',
    category: '',
    smartCategory: '',
    purchaseCategory: '',
    items: [],
    ocrExtract: {},
    classifiedDocumentType: 'UNREADABLE_DOCUMENT',
    geminiDocumentType: 'UNREADABLE_DOCUMENT',
    needsManualReview: true,
    fieldStatuses: {},
    fieldEvidence: {},
  };
}

/**
 * FORCE navigate to ReviewAsset — never Home / Dashboard / MainTabs / popToTop.
 * Safe after camera Activity recreate (navigator may not be ready yet).
 */
function goToReviewAsset(navigation, payload = {}) {
  const assetData =
    payload.assetData ||
    payload.invoice ||
    payload.extractedData ||
    payload.parsedData ||
    emptyFallbackInvoice();
  const params = buildSafeReviewParams({
    ...payload,
    invoice: assetData,
    extractedData: assetData,
    assetData,
    parsedData: assetData,
    hasOcrError: Boolean(payload.hasOcrError || payload.ocrFailed),
    ocrFailed: Boolean(payload.hasOcrError || payload.ocrFailed),
  });

  // Always include aliases expected by ReviewAssetScreen
  params.assetData = params.invoice || emptyFallbackInvoice();
  params.parsedData = params.assetData;
  params.hasOcrError = Boolean(payload.hasOcrError || payload.ocrFailed);

  // Persist Review so Activity recreation does not dump to Home
  markScanSession('ReviewAsset', params).catch(() => {});

  const tryLocal = () => {
    try {
      if (typeof navigation?.navigate === 'function') {
        navigation.navigate('ReviewAsset', params);
        return true;
      }
    } catch (error) {
      console.error('OCR Error / nav:', error?.message || error);
    }
    return false;
  };

  try {
    if (tryLocal()) return true;
  } catch (error) {
    console.error('OCR Error / nav:', error?.message || error);
  }

  try {
    if (navigationRef.isReady()) {
      const opened = openReviewInvoice(params);
      if (opened) return true;
    }
  } catch (error) {
    console.error('OCR Error / nav fallback:', error?.message || error);
  }

  // Navigator not initialized yet after Activity recreate — wait, never crash
  setTimeout(() => {
    try {
      if (tryLocal()) return;
      if (navigationRef.isReady()) {
        openReviewInvoice(params);
        return;
      }
      safeNavigate('ReviewAsset', params).catch((err) => {
        console.error('OCR Error / delayed nav:', err?.message || err);
      });
    } catch (error) {
      console.error('OCR Error / delayed nav:', error?.message || error);
    }
  }, 500);

  return false;
}

/** Strip base64 / giant blobs — navigation params must stay file-path only. */
function stripHeavyFields(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
  const next = { ...obj };
  const ban = [
    'base64',
    'billThumbDataUrl',
    'rawText',
    'rawOcrText',
    'imageBase64',
    'dataUrl',
    'thumbnailBase64',
  ];
  for (const key of ban) {
    if (key in next) delete next[key];
  }
  if (next.ocrExtract && typeof next.ocrExtract === 'object') {
    const extract = { ...next.ocrExtract };
    for (const key of ban) {
      if (key in extract) delete extract[key];
    }
    next.ocrExtract = extract;
  }
  return next;
}

/** Build a lean review payload — file URI only, no base64 / giant image objects. */
function buildSafeReviewParams({
  scanId,
  imageUri,
  invoice,
  audit,
  engine,
  energyHints,
  sweetBill,
  extractedData,
  ocrFailed,
}) {
  const uriOnly = typeof imageUri === 'string' && !imageUri.startsWith('data:') ? imageUri : '';
  const safeInvoice = stripHeavyFields(invoice);
  const safeExtracted = stripHeavyFields(extractedData || safeInvoice);
  return {
    scanId: scanId || `local_${Date.now()}`,
    imageUri: uriOnly,
    invoice: safeInvoice,
    extractedData: safeExtracted,
    assetData: safeInvoice,
    parsedData: safeInvoice,
    audit: audit && typeof audit === 'object' ? stripHeavyFields(audit) : { flags: [], canSave: false },
    engine: engine || 'unknown',
    energyHints: energyHints && typeof energyHints === 'object' ? energyHints : null,
    sweetBill: sweetBill && typeof sweetBill === 'object' ? stripHeavyFields(sweetBill) : {},
    ocrFailed: Boolean(ocrFailed),
    hasOcrError: Boolean(ocrFailed),
  };
}

/** Safe camera pick via ImagePicker — never throws to crash the screen. */
async function safeLaunchCameraAsync() {
  try {
    const ImagePicker = getImagePicker();
    if (!ImagePicker?.launchCameraAsync) {
      return { uri: null, canceled: true, error: new Error('Camera picker unavailable') };
    }
    const camPerm = await ImagePicker.requestCameraPermissionsAsync?.();
    if (camPerm && camPerm.granted === false) {
      return {
        uri: null,
        canceled: true,
        error: new Error('Camera permission denied. Enable Camera in Settings.'),
      };
    }
    const result = await ImagePicker.launchCameraAsync({ ...PICKER_OPTIONS });
    if (result?.canceled || !result?.assets?.[0]?.uri) {
      return { uri: null, canceled: true };
    }
    // Never keep asset.base64 from picker — compress ourselves next
    const compressed = await prepareScanImage(result.assets[0].uri);
    return { uri: compressed.uri, base64: compressed.base64, canceled: false };
  } catch (error) {
    console.error('[ScanBillScreen Error]:', error);
    return { uri: null, canceled: false, error };
  }
}

/** Safe gallery pick via ImagePicker — never throws to crash the screen. */
async function safeLaunchLibraryAsync() {
  try {
    const ImagePicker = getImagePicker();
    if (!ImagePicker?.launchImageLibraryAsync) {
      return { uri: null, canceled: true, error: new Error('Photo picker unavailable') };
    }
    const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync?.();
    if (libPerm && libPerm.granted === false) {
      return {
        uri: null,
        canceled: true,
        error: new Error('Photo library permission denied. Enable Photos in Settings.'),
      };
    }
    const result = await ImagePicker.launchImageLibraryAsync({ ...PICKER_OPTIONS });
    if (result?.canceled || !result?.assets?.[0]?.uri) {
      return { uri: null, canceled: true };
    }
    const compressed = await prepareScanImage(result.assets[0].uri);
    return { uri: compressed.uri, base64: compressed.base64, canceled: false };
  } catch (error) {
    console.error('[ScanBillScreen Error]:', error);
    return { uri: null, canceled: false, error };
  }
}

function ScanBillScreenInner({ navigation }) {
  const { user } = useAuth();
  const { assets } = useAssets();
  const ui = useUiFeedback();
  // Dual-mode camera state: 'VAULT' (permanent archival) vs 'LIVE' (zero-storage fast fill)
  const [scannerMode, setScannerMode] = useState('VAULT');
  const [cameraPermission, setCameraPermission] = useState('loading'); // loading|granted|denied|undetermined
  const [processing, setProcessing] = useState(false);
  const [processLabel, setProcessLabel] = useState('Reading document…');
  const [processingStage, setProcessingStage] = useState('CAPTURED'); // CAPTURED | OCR_EXTRACTING | IDENTIFYING | VERIFYING
  const [processingDuration, setProcessingDuration] = useState(0);
  const [lastError, setLastError] = useState('');
  const [autoArmed, setAutoArmed] = useState(false);
  const [reviewPayload, setReviewPayload] = useState(null);
  /** Low-res file path only — set first so UI can paint before OCR. */
  const [pendingImageUri, setPendingImageUri] = useState('');
  const pulse = useRef(new Animated.Value(0.35)).current;
  const autoTimer = useRef(null);
  const tickTimer = useRef(null);
  const ocrTimer = useRef(null);
  const processingTimer = useRef(null);
  const capturing = useRef(false);
  const startedRef = useRef(false);
  const scanGenRef = useRef(0);
  const scanSessionIdRef = useRef('');

  useEffect(() => {
    if (processing) {
      setProcessingDuration(0);
      processingTimer.current = setInterval(() => {
        setProcessingDuration((d) => d + 1);
      }, 1000);
    } else {
      if (processingTimer.current) clearInterval(processingTimer.current);
      processingTimer.current = null;
    }
    return () => {
      if (processingTimer.current) clearInterval(processingTimer.current);
    };
  }, [processing]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const clearAutoTimers = useCallback(() => {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    if (tickTimer.current) clearInterval(tickTimer.current);
    if (ocrTimer.current) clearTimeout(ocrTimer.current);
    autoTimer.current = null;
    tickTimer.current = null;
    ocrTimer.current = null;
  }, []);

  useEffect(() => () => clearAutoTimers(), [clearAutoTimers]);

  // Check permission on mount — do NOT open camera until granted
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await getCameraPermissionStatus();
        if (!cancelled) setCameraPermission(status);
      } catch (error) {
        console.warn('[ScanBill] permission check failed:', error?.message || error);
        if (!cancelled) setCameraPermission('undetermined');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const requestCameraAccess = useCallback(async () => {
    try {
      setLastError('');
      const result = await ensureCameraPermission();
      setCameraPermission(result.granted ? 'granted' : 'denied');
      if (!result.granted) {
        setLastError('Camera permission is required to scan invoices.');
        const openSettings = await ui.confirm({
          title: 'Camera permission needed',
          message: 'Asset Doctor needs camera access to scan invoices. You can enable it in Settings.',
          confirmLabel: 'Open Settings',
          cancelLabel: 'Not now',
        });
        if (openSettings) openAppSettings();
      }
      return result.granted;
    } catch (error) {
      setCameraPermission('denied');
      setLastError(friendlyCaptureMessage(error));
      return false;
    }
  }, [ui]);

  const processImageWithGemini = useCallback(
    async (uri, processOpts = {}) => {
      if (!uri) {
        setLastError('Could not capture image. Please try again.');
        setProcessLabel('Failed');
        return;
      }
      const generation = ++scanGenRef.current;
      const scanSessionId =
        processOpts.scanSessionId ||
        `scan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      scanSessionIdRef.current = scanSessionId;
      const isStale = () =>
        generation !== scanGenRef.current || scanSessionIdRef.current !== scanSessionId;

      setProcessing(true);
      setLastError('');
      setProcessLabel('Image captured');
      setProcessingStage('CAPTURED');
      setProcessingDuration(0);
      Haptics.tap();

      let optimizedUri = uri;
      let optimizedBase64 = null;
      let imageWidth = null;
      let imageHeight = null;
      const t0 = Date.now();
      const preprocessStarted = Date.now();
      try {
        try {
          setProcessLabel('Extracting text…');
          setProcessingStage('OCR_EXTRACTING');
          const compressedImage = await prepareScanImage(uri, {
            alreadyPreprocessed: Boolean(processOpts.alreadyPreprocessed),
          });
          optimizedUri = compressedImage?.uri || uri;
          optimizedBase64 = compressedImage?.base64 || null;
          imageWidth = compressedImage?.width || null;
          imageHeight = compressedImage?.height || null;
        } catch (compressErr) {
          console.error('[ScanBillScreen Error]:', compressErr);
          optimizedUri = uri;
          optimizedBase64 = null;
        }
        const preprocessMs = Date.now() - preprocessStarted;

        if (isStale()) return;

        setProcessLabel('Extracting text…');
        setProcessingStage('OCR_EXTRACTING');

        let ocr = null;
        let ocrFailed = false;
        let ocrFailMessage = '';
        let quality = { ok: true };

        const ocrStarted = Date.now();
        try {
          const qualityMod = require('../services/ocr/scanQualityGate');
          quality = await qualityMod.assessScanImageQuality(optimizedUri, {
            base64: optimizedBase64,
            width: imageWidth,
            height: imageHeight,
          });
          if (quality && quality.ok === false) {
            setProcessing(false);
            setProcessLabel('Failed');
            const tips = (quality.tips || []).slice(0, 5).map((t) => `• ${t}`).join('\n');
            setLastError(
              `${quality.message || 'Image quality is too low to read this document clearly.'}${
                tips ? `\n${tips}` : ''
              }\nTap Scan document to retake.`,
            );
            Haptics.error();
            return;
          }

          const { collectVaultedDocsFromAssets } = require('../services/ocr/vaultedDocCollector');
          ocr = await CloudVisionOcrService.recognizeInvoice(optimizedUri, {
            base64: optimizedBase64,
            alreadyPreprocessed: Boolean(processOpts.alreadyPreprocessed),
            scanSessionId,
            existingAssets: assets || [],
            existingVaultedDocs: collectVaultedDocsFromAssets(assets || []),
            skipAi: false,
            t0ScanInitiated: t0,
          });
          try {
            const { appendOcrTrail } = require('../services/ocr/ocrDebugTrail');
            appendOcrTrail({
              stage: 'IMAGE_PREPROCESSING',
              imageQualityScore: quality.score,
              qualityCode: quality.code,
              preprocessMs,
              ocrMs: Date.now() - ocrStarted,
              scanSessionId,
            });
          } catch {
            /* optional */
          }
        } catch (ocrErr) {
          console.error('[ScanBillScreen Error]:', ocrErr);
          ocrFailed = true;
          ocrFailMessage =
            ocrErr?.message || 'Could not auto-fill details, please enter manually';
        }

        if (isStale()) {
          console.log('[OCR] discarded stale session', scanSessionId);
          return;
        }

        if (quality && quality.ok === false) {
          setProcessing(false);
          setProcessLabel('Failed');
          const tips = (quality.tips || []).slice(0, 5).map((t) => `• ${t}`).join('\n');
          setLastError(
            `${quality.message || 'Image quality is too low to read this document clearly.'}${
              tips ? `\n${tips}` : ''
            }\nTap Scan document to retake.`,
          );
          Haptics.error();
          return;
        }

        if (!ocrFailed && !ocr?.success) {
          ocrFailed = true;
          ocrFailMessage = ocr?.error || 'Could not auto-fill details, please enter manually';
        }

        setProcessLabel('Identifying document…');
        setProcessingStage('IDENTIFYING');
        if (isStale()) {
          console.log('[OCR] discarded stale session', scanSessionId);
          return;
        }
        setProcessLabel('Verifying fields & matching assets…');
        setProcessingStage('VERIFYING');

        const mappedInvoice = ocrFailed
          ? emptyFallbackInvoice()
          : mapOcrToInvoiceFields(ocr?.data || {});

        // Confidence gate — < 85% → Manual Review (never silent auto-trust)
        let confidence = Number(
          mappedInvoice.confidence ??
            ocr?.data?.confidence ??
            ocr?.confidence ??
            0,
        );
        try {
          const { scoreExtractionConfidence, needsManualReview, OCR_CONFIDENCE_THRESHOLD } =
            require('../services/ocr/ocrSchemas');
          if (!Number.isFinite(confidence) || confidence <= 0) {
            confidence = scoreExtractionConfidence(
              { ...mappedInvoice, ...(ocr?.data || {}) },
              mappedInvoice.document_type || ocr?.data?.document_type,
            );
          }
          mappedInvoice.confidence = confidence;
          mappedInvoice.needsManualReview = Boolean(
            ocrFailed ||
              needsManualReview(confidence, OCR_CONFIDENCE_THRESHOLD) ||
              ocr?.needsManualReview ||
              ocr?.data?.needsManualReview ||
              ocr?.data?.providerConflict,
          );
          if (ocr?.data?.fieldConfidence) {
            mappedInvoice.fieldConfidence = ocr.data.fieldConfidence;
            mappedInvoice.fieldConfidenceReasons = ocr.data.fieldConfidenceReasons || {};
            mappedInvoice.lowConfidenceFields = ocr.data.lowConfidenceFields || [];
          } else {
            mappedInvoice.needsManualReview = true;
          }
        } catch {
          mappedInvoice.confidence = confidence;
          mappedInvoice.needsManualReview = Boolean(
            ocrFailed ||
              confidence < 85 ||
              ocr?.needsManualReview ||
              ocr?.data?.needsManualReview,
          );
        }

        let audit = {
          flags: [],
          canSave: false,
          manualEntry: ocrFailed || Boolean(mappedInvoice.needsManualReview),
          confidence: mappedInvoice.confidence,
          needsManualReview: Boolean(mappedInvoice.needsManualReview),
        };
        let sweetBill = ocrFailed ? {} : ocr?.sweetBill || {};

        if (!ocrFailed) {
          try {
            const dup = await isDuplicateBill(sweetBill);
            audit = {
              ...(await runSweetBillChecker(ocr?.data || mappedInvoice)),
              confidence: mappedInvoice.confidence,
              needsManualReview: Boolean(mappedInvoice.needsManualReview),
            };
            if (mappedInvoice.needsManualReview) {
              audit.manualEntry = true;
              audit.flags = [...(audit.flags || []), 'low_confidence_manual_review'];
            }
            if (dup?.isDuplicate) {
              audit.isDuplicate = true;
              audit.canSave = false;
              audit.duplicateMessage =
                'Duplicate bill detected (GSTIN + Total + Date already scanned).';
              audit.flags = [...(audit.flags || []), 'duplicate_bill_fingerprint'];
            }
            const vaultDup = ocr?.data?.duplicateCheck || ocr?.data?.universalOcr?.duplicateCheck;
            if (vaultDup?.isDuplicate) {
              audit.isDuplicate = true;
              audit.canSave = false;
              audit.duplicateMessage = vaultDup.reason || 'This document already exists in your vault.';
              audit.flags = [...(audit.flags || []), 'vault_duplicate_identity'];
            }
          } catch (auditErr) {
            console.warn('[ScanBill] audit skipped:', auditErr?.message);
          }

          try {
            await saveParsedBillDraft(sweetBill, {
              engine: ocr?.engine,
              imageUri: optimizedUri,
              invoice: mappedInvoice,
            });
          } catch (draftErr) {
            console.warn('[ScanBill] draft save skipped:', draftErr?.message);
          }
        }

        let cached = { scanId: `local_${Date.now()}`, localImageUri: optimizedUri };
        try {
          cached = await InvoiceOfflineCache.saveScan({
            userId: user?.uid,
            imageUri: optimizedUri,
            invoice: stripHeavyFields(mappedInvoice),
            audit,
            rawText: String(ocr?.rawText || '').slice(0, 4000),
            engine: ocr?.engine || (ocrFailed ? 'manual' : 'unknown'),
          });
        } catch (cacheErr) {
          console.warn('[ScanBill] cache save skipped:', cacheErr?.message);
        }

        // Legacy document intelligence and adaptive hardening are diagnostics,
        // not extraction sources. They are intentionally excluded from the
        // save payload so learned guesses cannot overwrite OCR evidence.
        const documentIntelligence = null;

        // Offline: queue OCR retry when capture succeeded but engines failed
        if (ocrFailed && optimizedUri) {
          try {
            const { enqueueOcrJob } = require('../services/ocr/ocrOfflineQueue');
            await enqueueOcrJob({
              ownerUid: user?.uid,
              localImageUri: optimizedUri,
            });
          } catch {
            /* optional */
          }
        }

        // 3) ALWAYS open ReviewAsset — success OR OCR failure. NEVER Home.
        if (isStale()) {
          console.log('[OCR] discarded stale session', scanSessionId);
          return;
        }
        Haptics.success();
        goToReviewAsset(navigation, {
          scanId: scanSessionId || cached.scanId,
          imageUri: cached.localImageUri || optimizedUri,
          assetData: mappedInvoice,
          invoice: mappedInvoice,
          extractedData: mappedInvoice,
          parsedData: mappedInvoice,
          audit,
          engine: ocr?.engine || (ocrFailed ? 'manual' : 'unknown'),
          energyHints: ocrFailed ? null : ocr?.energyHints || null,
          sweetBill,
          ocrFailed: Boolean(ocrFailed),
          hasOcrError: Boolean(ocrFailed),
          needsManualReview: Boolean(mappedInvoice.needsManualReview),
          confidence: mappedInvoice.confidence,
          documentIntelligence,
        });

        if (ocrFailed) {
          setProcessLabel('Review required');
          setLastError(ocrFailMessage);
        } else if (mappedInvoice.needsManualReview) {
          setProcessLabel('Review required');
        } else {
          setProcessLabel('Completed');
        }
      } catch (error) {
        // Last-resort: STILL navigate to Review with empty fields — NEVER Home
        console.error('OCR Error:', error);
        Haptics.error();
        goToReviewAsset(navigation, {
          scanId: `local_${Date.now()}`,
          imageUri: optimizedUri || uri,
          assetData: emptyFallbackInvoice(),
          invoice: emptyFallbackInvoice(),
          extractedData: emptyFallbackInvoice(),
          parsedData: emptyFallbackInvoice(),
          audit: { flags: ['ocr_failed'], canSave: false, manualEntry: true },
          engine: 'manual',
          energyHints: null,
          sweetBill: {},
          ocrFailed: true,
          hasOcrError: true,
        });
        setProcessLabel('Failed');
        setLastError('Could not auto-fill details, please enter manually');
      } finally {
        setProcessing(false);
        setPendingImageUri('');
        capturing.current = false;
        setAutoArmed(false);
        clearAutoTimers();
        startedRef.current = false;
      }
    },
    [navigation, user?.uid, assets, clearAutoTimers],
  );

  /**
   * Save low-res URI to state + show loading FIRST, then run OCR on next frame.
   * Avoids native OOM from sync heavy work right after ImagePicker returns.
   */
  const scheduleOcrAfterPaint = useCallback(
    (uri, scheduleOpts = {}) => {
      if (!uri) {
        capturing.current = false;
        setLastError('Could not capture image. Please try again.');
        setProcessLabel('Failed');
        return;
      }
      setPendingImageUri(uri);
      setProcessing(true);
      setProcessLabel('Uploading…');
      setProcessLabel('Processing…');
      setLastError('');
      Haptics.tap();

      const alreadyPreprocessed =
        scheduleOpts.alreadyPreprocessed !== undefined
          ? Boolean(scheduleOpts.alreadyPreprocessed)
          : true;

      if (ocrTimer.current) clearTimeout(ocrTimer.current);
      ocrTimer.current = setTimeout(() => {
        const run = () => {
          processImageWithGemini(uri, { alreadyPreprocessed }).catch((error) => {
            console.error('OCR Error:', error);
            // DO NOT NAVIGATE TO HOME — always ReviewAsset with empty fields
            goToReviewAsset(navigation, {
              scanId: `local_${Date.now()}`,
              imageUri: uri,
              assetData: emptyFallbackInvoice(),
              invoice: emptyFallbackInvoice(),
              parsedData: emptyFallbackInvoice(),
              audit: { flags: ['ocr_failed'], canSave: false, manualEntry: true },
              engine: 'manual',
              ocrFailed: true,
              hasOcrError: true,
            });
            setProcessLabel('Failed');
            setLastError('Could not auto-fill details, please enter manually');
            setProcessing(false);
            setPendingImageUri('');
            capturing.current = false;
          });
        };
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => run());
        } else {
          run();
        }
      }, 80);
    },
    [processImageWithGemini, navigation],
  );

  const launchCameraCapture = useCallback(async () => {
    if (capturing.current || processing) return;
    capturing.current = true;
    scanGenRef.current += 1;
    clearAutoTimers();
    setAutoArmed(true);
    setLastError('');
    // Mark before scanner/camera so Activity kill restores ScanBill (not Home)
    markScanSession('ScanBill').catch(() => {});

    try {
      const ok = cameraPermission === 'granted' ? true : await requestCameraAccess();
      if (!ok) {
        capturing.current = false;
        startedRef.current = false;
        setAutoArmed(false);
        setLastError('Camera permission is required to scan invoices.');
        const openSettings = await ui.confirm({
          title: 'Camera permission needed',
          message: 'Enable Camera in Settings to scan invoices.',
          confirmLabel: 'Open Settings',
          cancelLabel: 'Not now',
        });
        if (openSettings) openAppSettings();
        return;
      }

      let uri = null;
      try {
        // ML Kit document scanner first (edge detect + auto capture)
        uri = await captureDocumentImage('auto');
      } catch (captureErr) {
        console.error('[ScanBillScreen Error]:', captureErr);
        const fallback = await safeLaunchCameraAsync();
        if (fallback.error && !fallback.canceled) {
          const msg = reportScanError(fallback.error);
          capturing.current = false;
          startedRef.current = false;
          setAutoArmed(false);
          setLastError(msg);
          return;
        }
        if (fallback.canceled) {
          capturing.current = false;
          startedRef.current = false;
          setAutoArmed(false);
          setLastError('Scan cancelled. Tap Scan document to try again.');
          return;
        }
        uri = fallback.uri;
      }

      // Cancelled scanner/camera — stay on ScanBillScreen (never Home / MainTabs)
      if (!uri) {
        capturing.current = false;
        startedRef.current = false;
        setAutoArmed(false);
        setLastError('Scan cancelled. Tap Scan document to try again.');
        return;
      }

      setAutoArmed(false);

      // URI is already canonically preprocessed (1800 / 0.88, never upscale):
      //   - captureDocumentImage → preprocessScanImage
      //   - safeLaunchCameraAsync fallback → prepareScanImageForOcr
      // alreadyPreprocessed means: do not JPEG re-encode; read base64 only.

      // Defer OCR — let loading UI paint first (prevents Android OOM)
      scheduleOcrAfterPaint(uri);
    } catch (error) {
      capturing.current = false;
      startedRef.current = false;
      setAutoArmed(false);
      const msg = reportScanError(error);
      setLastError(msg);
      Haptics.error();
    }
  }, [
    clearAutoTimers,
    scheduleOcrAfterPaint,
    processing,
    cameraPermission,
    requestCameraAccess,
    ui,
  ]);

  const launchGalleryPicker = useCallback(async () => {
    if (capturing.current || processing) return;
    capturing.current = true;
    scanGenRef.current += 1;
    clearAutoTimers();
    setAutoArmed(false);
    setLastError('');
    // Mark before gallery so Activity kill restores ScanBill (not Home)
    markScanSession('ScanBill').catch(() => {});

    try {
      const lib = await ensureLibraryPermission();
      if (!lib.granted) {
        capturing.current = false;
        startedRef.current = false;
        setLastError('Photo library permission is required to browse invoices.');
        const openSettings = await ui.confirm({
          title: 'Photos permission needed',
          message: 'Enable Photos access in Settings to import invoices from Gallery.',
          confirmLabel: 'Open Settings',
          cancelLabel: 'Not now',
        });
        if (openSettings) openAppSettings();
        return;
      }

      let uri = null;
      try {
        uri = await pickGalleryImage();
      } catch (pickErr) {
        console.error('[ScanBillScreen Error]:', pickErr);
        const fallback = await safeLaunchLibraryAsync();
        if (fallback.error && !fallback.canceled) {
          const msg = reportScanError(fallback.error);
          capturing.current = false;
          startedRef.current = false;
          setLastError(msg);
          return;
        }
        uri = fallback.uri;
      }

      if (!uri) {
        const direct = await safeLaunchLibraryAsync();
        if (direct.error && !direct.canceled) {
          const msg = reportScanError(direct.error);
          capturing.current = false;
          startedRef.current = false;
          setLastError(msg);
          return;
        }
        uri = direct.uri;
      }

      if (!uri) {
        capturing.current = false;
        startedRef.current = false;
        setLastError('Gallery selection cancelled. Tap Browse Gallery to try again.');
        return;
      }

      // Defer OCR — let loading UI paint first (prevents Android OOM)
      scheduleOcrAfterPaint(uri, { alreadyPreprocessed: true });
    } catch (error) {
      capturing.current = false;
      startedRef.current = false;
      const msg = reportScanError(error);
      setLastError(msg);
      Haptics.error();
    }
  }, [clearAutoTimers, scheduleOcrAfterPaint, processing, ui]);

  const startAutoFocusCapture = useCallback(() => {
    // TODO: RE-ENABLE AUTH REQUIREMENT BEFORE PRODUCTION
    (async () => {
      if (capturing.current || processing) return;
      const ok =
        cameraPermission === 'granted' ? true : await requestCameraAccess();
      if (!ok) return;

      Haptics.select();
      clearAutoTimers();
      setAutoArmed(true);
      // Open ML Kit document scanner almost immediately (doc in front → auto scan)
      autoTimer.current = setTimeout(() => {
        launchCameraCapture();
      }, AUTO_OPEN_MS);
    })();
  }, [
    clearAutoTimers,
    launchCameraCapture,
    processing,
    cameraPermission,
    requestCameraAccess,
  ]);

  // Auto-open document scanner once camera permission is granted
  useEffect(() => {
    if (startedRef.current || processing) return undefined;
    if (cameraPermission !== 'granted') return undefined;
    if (reviewPayload) return undefined;
    startedRef.current = true;
    const t = setTimeout(() => startAutoFocusCapture(), 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraPermission]);

  const openCamera = useCallback(() => {
    // TODO: RE-ENABLE AUTH REQUIREMENT BEFORE PRODUCTION
    clearAutoTimers();
    setAutoArmed(false);
    launchCameraCapture();
  }, [launchCameraCapture, clearAutoTimers]);

  const openGallery = useCallback(() => {
    // TODO: RE-ENABLE AUTH REQUIREMENT BEFORE PRODUCTION
    Haptics.tap();
    clearAutoTimers();
    setAutoArmed(false);
    launchGalleryPicker();
  }, [launchGalleryPicker, clearAutoTimers]);

  const cancelAutoOpen = useCallback(() => {
    clearAutoTimers();
    setAutoArmed(false);
    capturing.current = false;
    startedRef.current = true;
    Haptics.select();
  }, [clearAutoTimers]);

  const reviewModal = (
    <ReviewAssetModal
      visible={Boolean(reviewPayload)}
      imageUri={reviewPayload?.imageUri || ''}
      invoice={reviewPayload?.invoice || {}}
      audit={reviewPayload?.audit || null}
      onDismiss={() => setReviewPayload(null)}
      onRescan={() => {
        setReviewPayload(null);
        setLastError('');
        Haptics.select();
      }}
    />
  );

  if (cameraPermission === 'loading') {
    return (
      <>
        <Screen style={styles.root}>
          <View style={styles.permissionBox}>
            <ActivityIndicator size="large" color={COLORS.emerald} />
            <Text style={styles.processingTitle}>Checking camera permission…</Text>
            <Text style={styles.processingSub}>Asset Doctor will not open the camera until access is allowed.</Text>
          </View>
        </Screen>
        {reviewModal}
      </>
    );
  }

  if (cameraPermission === 'denied' || cameraPermission === 'undetermined') {
    return (
      <>
        <SafeAreaView style={styles.root} edges={['bottom']}>
          <Screen style={{ flex: 1, backgroundColor: 'transparent' }}>
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: 40, flexGrow: 1, justifyContent: 'center' },
            ]}
          >
            <Text style={styles.eyebrow}>SCAN INVOICE</Text>
            <Text style={styles.title}>Camera access needed</Text>
            <Text style={styles.sub}>
              Allow camera permission to scan bills. Nothing launches until you grant access — this
              prevents blank / crash screens.
            </Text>
            {lastError ? (
              <View style={styles.errorStrip}>
                <Text style={styles.errorText}>{lastError}</Text>
              </View>
            ) : null}
            <View style={styles.actions}>
              <GlassButton title="Allow camera" onPress={requestCameraAccess} style={styles.actionBtn} />
              <View style={styles.sourceRow}>
                <GlassButton
                  title="Scan document"
                  onPress={openCamera}
                  style={[styles.actionBtn, styles.sourceBtn]}
                />
                <GlassButton
                  title="Browse Gallery"
                  onPress={openGallery}
                  variant="ghost"
                  style={[styles.actionBtn, styles.sourceBtn]}
                />
              </View>
              <GlassButton
                title="Open Settings"
                onPress={() => openAppSettings()}
                variant="ghost"
                style={styles.actionBtn}
              />
              <Pressable
                onPress={() => {
                  Haptics.select();
                  if (navigation?.canGoBack?.()) navigation.goBack();
                }}
                style={styles.manualWrap}
              >
                <Text style={styles.manualLink}>Go back</Text>
              </Pressable>
            </View>
          </ScrollView>
          {processing ? (
            <View style={styles.blockingOverlay} pointerEvents="auto">
              <ActivityIndicator size="large" color={COLORS.emerald} />
              <Text style={styles.overlayTitle}>{processLabel}</Text>
              {pendingImageUri ? (
                <Text style={styles.overlaySub}>Low-res scan ready — reading fields…</Text>
              ) : null}
              <Text style={styles.overlaySub}>Please wait — do not close the app.</Text>
            </View>
          ) : null}
        </Screen>
        </SafeAreaView>
        {reviewModal}
      </>
    );
  }

  return (
    <>
    <SafeAreaView style={styles.root} edges={['bottom']}>
    <Screen style={{ flex: 1, backgroundColor: 'transparent' }}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 40 },
        ]}
        keyboardShouldPersistTaps="handled"
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerBlock}>
          <Text style={styles.eyebrow}>SCAN INVOICE</Text>
          <Text style={styles.title}>Hold document in front of camera</Text>
          <Text style={styles.sub}>
            Edges detect automatically — scan starts when the invoice is clear. Gallery works the same OCR path.
          </Text>
          <PrivacyVaultTag style={{ marginTop: 10, alignSelf: 'flex-start' }} />

          {/* Dual-Mode Camera Selector */}
          <View style={styles.modeSelector}>
            <Pressable
              style={[styles.modeTab, scannerMode === 'VAULT' && styles.modeTabActive]}
              onPress={() => {
                Haptics.tap();
                setScannerMode('VAULT');
              }}
            >
              <Text style={[styles.modeTabText, scannerMode === 'VAULT' && styles.modeTabTextActive]}>
                🗄️ Document Vault
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modeTab, scannerMode === 'LIVE' && styles.modeTabActive]}
              onPress={() => {
                Haptics.tap();
                setScannerMode('LIVE');
              }}
            >
              <Text style={[styles.modeTabText, scannerMode === 'LIVE' && styles.modeTabTextActive]}>
                ⚡ Live Fast Fill
              </Text>
            </Pressable>
          </View>
          <Text style={styles.modeDesc}>
            {scannerMode === 'VAULT'
              ? 'Permanent Archival — Auto-crops, deskews & stores securely in Document Vault.'
              : 'Zero-Storage Live Scan — Fills asset forms instantly without saving images.'}
          </Text>

          {autoArmed && !processing ? (
            <View style={styles.countdownStrip}>
              <Text style={styles.countdownLabel}>Opening document scanner…</Text>
            </View>
          ) : null}

          {lastError && !processing ? (
            <View style={styles.errorStrip}>
              <Text style={styles.errorText}>{lastError}</Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.stage, { height: FRAME_HEIGHT }]} pointerEvents="none">
          <Animated.View
            style={[
              styles.glowFrame,
              {
                opacity: pulse,
                borderColor: autoArmed ? COLORS.amber : COLORS.emerald,
                shadowColor: autoArmed ? COLORS.amber : COLORS.emerald,
              },
            ]}
          />
          <View style={styles.frameInner}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
            <Text style={styles.previewHint}>Doc in frame → auto scan → Review</Text>
          </View>
        </View>

        {processing ? (
          <View style={styles.processing}>
            <ActivityIndicator size="large" color={COLORS.emerald} />
            <Text style={styles.processingTitle}>{processLabel}</Text>
            <Text style={styles.processingSub}>
              Stay on this screen — Review & Confirm opens when ready.
            </Text>
          </View>
        ) : (
          <View style={styles.actions}>
            <View style={styles.sourceRow}>
              <GlassButton
                title="Scan document"
                onPress={openCamera}
                style={[styles.actionBtn, styles.sourceBtn]}
              />
              <GlassButton
                title="Browse Gallery"
                onPress={openGallery}
                variant="ghost"
                style={[styles.actionBtn, styles.sourceBtn]}
              />
            </View>
            {autoArmed ? (
              <GlassButton
                title="Cancel"
                onPress={cancelAutoOpen}
                variant="ghost"
                style={styles.actionBtn}
              />
            ) : (
              <GlassButton
                title="Scan again"
                onPress={startAutoFocusCapture}
                variant="ghost"
                style={styles.actionBtn}
              />
            )}
            <Pressable
              onPress={() => {
                Haptics.select();
                clearAutoTimers();
                if (navigation?.canGoBack?.()) navigation.goBack();
              }}
              style={styles.manualWrap}
            >
              <Text style={styles.manualLink} numberOfLines={1}>
                Go back
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {processing ? (
        <View style={styles.blockingOverlay} pointerEvents="auto">
          <ActivityIndicator size="large" color={COLORS.emerald} />
          <Text style={styles.overlayTitle}>{processLabel}</Text>
          
          {/* Progressive Stage Steps */}
          <View style={styles.stageProgressWrap}>
            <Text style={[styles.stageStepText, { color: COLORS.emerald }]}>
              ✓ Image captured
            </Text>
            <Text
              style={[
                styles.stageStepText,
                {
                  color:
                    processingStage === 'OCR_EXTRACTING' ||
                    processingStage === 'IDENTIFYING' ||
                    processingStage === 'VERIFYING'
                      ? COLORS.emerald
                      : COLORS.muted,
                },
              ]}
            >
              {processingStage === 'OCR_EXTRACTING' ? '● Extracting text…' : '✓ Text extracted'}
            </Text>
            <Text
              style={[
                styles.stageStepText,
                {
                  color:
                    processingStage === 'IDENTIFYING' || processingStage === 'VERIFYING'
                      ? COLORS.emerald
                      : COLORS.muted,
                },
              ]}
            >
              {processingStage === 'IDENTIFYING'
                ? '● Identifying document…'
                : processingStage === 'VERIFYING'
                ? '✓ Document identified'
                : '○ Identifying document'}
            </Text>
            <Text
              style={[
                styles.stageStepText,
                {
                  color: processingStage === 'VERIFYING' ? COLORS.emerald : COLORS.muted,
                },
              ]}
            >
              {processingStage === 'VERIFYING'
                ? '● Verifying fields & matching…'
                : '○ Verifying fields'}
            </Text>
          </View>

          {processingDuration >= 8 ? (
            <View style={styles.longWaitCard}>
              <Text style={styles.longWaitTitle}>Taking longer than usual…</Text>
              <Text style={styles.longWaitSub}>
                Network connection is slow. You can continue waiting or scan again.
              </Text>
              <View style={styles.longWaitActions}>
                <Pressable
                  onPress={() => {
                    Haptics.tap();
                    setProcessing(false);
                    startAutoFocusCapture();
                  }}
                  style={styles.longWaitRetryBtn}
                >
                  <Text style={styles.longWaitRetryText}>Scan again</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Text style={styles.overlaySub}>Please wait — do not close the app.</Text>
          )}
        </View>
      ) : null}
    </Screen>
    </SafeAreaView>
    {reviewModal}
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  permissionBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  headerBlock: {
    marginBottom: 16,
    zIndex: 2,
  },
  eyebrow: {
    color: COLORS.neonBlue,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  title: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
    lineHeight: 28,
  },
  sub: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  modeSelector: {
    flexDirection: 'row',
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: RADIUS.md || 12,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: (RADIUS.md || 12) - 4,
  },
  modeTabActive: {
    backgroundColor: COLORS.emerald || '#0F766E',
    shadowColor: COLORS.emerald || '#0F766E',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  modeTabText: {
    color: COLORS.muted || '#9CA3AF',
    fontSize: 13,
    fontWeight: '700',
  },
  modeTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  modeDesc: {
    marginTop: 8,
    color: COLORS.muted || '#9CA3AF',
    fontSize: 12,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  countdownStrip: {
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(212,162,76,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,162,76,0.35)',
  },
  countdownLabel: {
    color: COLORS.amber,
    fontWeight: '800',
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorStrip: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
  },
  errorText: { color: '#B91C1C', fontWeight: '700', fontSize: 13, lineHeight: 18 },
  stage: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  glowFrame: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '94%',
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    shadowOpacity: 0.55,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  frameInner: {
    width: '90%',
    height: '100%',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewHint: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: COLORS.emerald,
  },
  tl: { top: 14, left: 14, borderTopWidth: 3, borderLeftWidth: 3 },
  tr: { top: 14, right: 14, borderTopWidth: 3, borderRightWidth: 3 },
  bl: { bottom: 14, left: 14, borderBottomWidth: 3, borderLeftWidth: 3 },
  br: { bottom: 14, right: 14, borderBottomWidth: 3, borderRightWidth: 3 },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.amber,
  },
  processing: {
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 18,
  },
  processingTitle: { color: COLORS.text, fontWeight: '800', marginTop: 12, fontSize: 16 },
  processingSub: { color: COLORS.muted, marginTop: 4, fontSize: 12, textAlign: 'center' },
  blockingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    zIndex: 20,
  },
  overlayTitle: {
    color: '#F8FAFC',
    fontWeight: '800',
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  overlaySub: {
    color: 'rgba(248,250,252,0.72)',
    marginTop: 8,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  actions: {
    marginTop: 18,
    gap: 12,
    paddingTop: 4,
    paddingBottom: 12,
  },
  sourceRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sourceBtn: {
    flex: 1,
  },
  actionBtn: {
    minHeight: 48,
  },
  manualWrap: {
    marginTop: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  manualLink: {
    color: COLORS.muted,
    textAlign: 'center',
    textDecorationLine: 'underline',
    fontWeight: '600',
    fontSize: 14,
  },
  stageProgressWrap: {
    marginTop: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    alignItems: 'flex-start',
    gap: 6,
    width: '100%',
    maxWidth: 320,
  },
  stageStepText: {
    fontSize: 13,
    fontWeight: '600',
  },
  longWaitCard: {
    marginTop: 16,
    backgroundColor: 'rgba(217, 119, 6, 0.18)',
    borderColor: 'rgba(217, 119, 6, 0.4)',
    borderWidth: 1,
    padding: 14,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  longWaitTitle: {
    color: '#FBBF24',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  longWaitSub: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 16,
  },
  longWaitActions: {
    flexDirection: 'row',
    gap: 8,
  },
  longWaitRetryBtn: {
    backgroundColor: '#D97706',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
  },
  longWaitRetryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});

export function ScanBillScreen(props) {
  return (
    <ScanErrorBoundary navigation={props.navigation}>
      <ScanBillScreenInner {...props} />
    </ScanErrorBoundary>
  );
}

export default ScanBillScreen;
