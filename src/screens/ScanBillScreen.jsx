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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrivacyVaultTag } from '../components/PrivacyVaultTag';
import { COLORS, RADIUS, SPACING } from '../theme/branding';
import { GlassButton, Screen } from '../components/ui/Glass';
import { Haptics } from '../services/haptics';
import { CloudVisionOcrService } from '../services/ocr/CloudVisionOcrService';
import { ConsumerAssetVlmService } from '../services/vlm/ConsumerAssetVlmService';
import { MultiDocumentRouter } from '../services/vlm/MultiDocumentRouter';
import {
  isVehicleDocument,
  normalizeToCanonicalDocType,
} from '../types/assetDocumentTypes';
import { normalizeDocumentByCanonicalType } from '../services/ocr/UnifiedDocumentNormalizer';
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
import { openReviewInvoice, navigationRef, safeNavigate } from '../navigation/navActions';
import { markScanSession, setActiveScanSessionId } from '../utils/scanNavGuard';
import { getRouteForCanonicalDocType } from '../types/assetDocumentTypes';

const AUTO_OPEN_MS = 280;
const SCREEN_H = Dimensions.get('window').height;
const FRAME_HEIGHT = Math.round(SCREEN_H * 0.46);
/** ImagePicker fallback when ML Kit document scanner is unavailable. */
const PICKER_OPTIONS = {
  mediaTypes: ['images'],
  quality: 0.92,
  allowsEditing: false,
  base64: false,
  exif: true,
};

const DOC_TYPE_GUIDES = {
  INVOICE: {
    eyebrow: '🧾 PURCHASE INVOICE',
    title: 'Scan purchase invoice',
    sub: 'Scan the complete purchase invoice. Hold document steady within frame.',
  },
  VEHICLE_SERVICE: {
    eyebrow: '🚗 VEHICLE SERVICE',
    title: 'Scan vehicle service bill',
    sub: 'Scan the complete service invoice or workshop job card.',
  },
  INSURANCE: {
    eyebrow: '🛡️ VEHICLE INSURANCE',
    title: 'Scan vehicle insurance policy',
    sub: 'Scan your motor vehicle insurance policy schedule or cover note.',
  },
  PUC: {
    eyebrow: '🟢 PUC CERTIFICATE',
    title: 'Scan PUC certificate',
    sub: 'Scan your Pollution Under Control certificate or emission test slip.',
  },
  ELECTRICITY_BILL: {
    eyebrow: '⚡ ELECTRICITY BILL',
    title: 'Scan electricity bill',
    sub: 'Scan the complete electricity power utility bill.',
  },
  UNKNOWN: {
    eyebrow: '📄 SMART SCANNER',
    title: 'Hold document in front of camera',
    sub: 'Edges detect automatically — AI classifies and extracts fields instantly.',
  },
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
 * Safe navigate to the appropriate review screen — never Home / Dashboard / MainTabs.
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

  // Always include aliases expected by review screens
  params.assetData = params.invoice || emptyFallbackInvoice();
  params.parsedData = params.assetData;
  params.hasOcrError = Boolean(payload.hasOcrError || payload.ocrFailed);

  const rawDocType =
    payload.documentType ||
    params.assetData?.documentType ||
    params.assetData?.classifiedDocumentType ||
    'UNKNOWN';
  const canonicalType = normalizeToCanonicalDocType(rawDocType);
  const targetRoute = getRouteForCanonicalDocType(canonicalType);

  params.documentType = canonicalType;
  params.reviewRoute = targetRoute;

  const populatedFieldCount = [
    params.assetData?.productName,
    params.assetData?.shopName,
    params.assetData?.totalAmount,
    params.assetData?.invoiceNumber,
    params.assetData?.invoiceDate,
  ].filter((v) => v != null && v !== '').length;

  console.log(
    `[OCR_TRACE_09_NAVIGATION] target=${targetRoute} docType=${canonicalType} populatedCount=${populatedFieldCount} hasError=${params.hasOcrError} ocrFailed=${params.ocrFailed} engine=${payload.engine || 'unknown'}`,
  );
  console.log(
    `[SCAN_NAV_DEBUG] ${canonicalType} → ${targetRoute} scanSessionId=${params.scanSessionId || 'none'}`,
  );

  // Persist Review so Activity recreation restores THIS review screen, not generic ReviewAsset
  markScanSession(targetRoute, {
    ...params,
    documentType: canonicalType,
    reviewRoute: targetRoute,
    scanSessionId: params.scanSessionId,
  }).catch(() => {});

  const tryLocal = () => {
    try {
      if (typeof navigation?.navigate === 'function') {
        navigation.navigate(targetRoute, params);
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
      if (targetRoute === 'ReviewAsset') {
        const opened = openReviewInvoice(params);
        if (opened) return true;
      } else {
        navigationRef.navigate(targetRoute, params);
        return true;
      }
    }
  } catch (error) {
    console.error('OCR Error / nav fallback:', error?.message || error);
  }

  // Navigator not initialized yet after Activity recreate — wait, never crash
  setTimeout(() => {
    try {
      if (tryLocal()) return;
      if (navigationRef.isReady()) {
        if (targetRoute === 'ReviewAsset') {
          openReviewInvoice(params);
        } else {
          navigationRef.navigate(targetRoute, params);
        }
        return;
      }
      safeNavigate(targetRoute, params).catch((err) => {
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
    'imageBase64',
    'dataUrl',
    'thumbnailBase64',
  ];
  for (const key of ban) {
    if (key in next) delete next[key];
  }
  if (typeof next.rawText === 'string' && next.rawText.length > 8000) {
    next.rawText = next.rawText.slice(0, 8000);
  }
  if (typeof next.rawOcrText === 'string' && next.rawOcrText.length > 8000) {
    next.rawOcrText = next.rawOcrText.slice(0, 8000);
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

function ScanBillScreenInner({ navigation, route }) {
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
    return () => {
      scanGenRef.current += 1;
      scanSessionIdRef.current = '';
    };
  }, []);

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

  const processImage = useCallback(
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
          setProcessLabel('Preparing image…');
          setProcessingStage('PREPROCESSING');
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

        console.log(
          `[OCR_TRACE_01_IMAGE] uri=${(optimizedUri || '').split('/').pop()} width=${imageWidth || 0} height=${imageHeight || 0} b64Chars=${(optimizedBase64 || '').length} source=${processOpts.source || 'scan'}`,
        );

        if (isStale()) return;

        let ocr = null;
        let ocrFailed = false;
        let ocrFailMessage = '';
        let quality = { ok: true };
        let vlmData = null;
        let routerResult = null;
        let vlmInsurance = null;
        let vlmPuc = null;
        let vlmElectricity = null;
        let vlmVehicleService = null;

        const selectedDocType =
          processOpts.forceDocumentType ||
          route?.params?.selectedDocType ||
          (route?.params?.isEnergyScan ? 'ELECTRICITY_BILL' : undefined);

        const canonicalTarget = normalizeToCanonicalDocType(selectedDocType);

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

          // =========================================================================
          // CANONICAL DIRECT-TO-GEMINI VISION PIPELINE (ZERO AZURE DEPENDENCY)
          // =========================================================================
          console.log('[OCR_PROVIDER] OCR_PROVIDER=GEMINI_DIRECT');
          console.log('[OCR_PROVIDER] GEMINI_START');
          setProcessLabel('Reading document with Gemini Vision…');
          setProcessingStage('EXTRACTING');

          if (optimizedBase64) {
            const vlmTimeoutMs = 15000;
            try {
              const vlmTimeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('VLM pipeline overall timeout (15s)')), vlmTimeoutMs)
              );
              routerResult = await Promise.race([
                MultiDocumentRouter.processDocument(
                  optimizedBase64,
                  'image/jpeg',
                  {
                    userSelectedType: selectedDocType,
                    forceDocumentType: processOpts.forceDocumentType || route?.params?.forceDocumentType,
                    skipSafetyCheck: Boolean(processOpts.skipSafetyCheck),
                  },
                ),
                vlmTimeout,
              ]);

              if (routerResult?.success && routerResult.extracted) {
                console.log('[OCR_PROVIDER] GEMINI_SUCCESS');
                setProcessLabel('Verifying fields & matching…');
                setProcessingStage('VERIFYING');
                const { type, payload } = routerResult.extracted;
                if (type === 'INVOICE') {
                  vlmData = payload;
                } else if (type === 'VEHICLE_SERVICE') {
                  vlmVehicleService = payload;
                } else if (type === 'INSURANCE') {
                  vlmInsurance = payload;
                } else if (type === 'PUC') {
                  vlmPuc = payload;
                } else if (type === 'ELECTRICITY_BILL') {
                  vlmElectricity = payload;
                }
              } else if (routerResult?.isTypeMismatch) {
                // Handle AI safety mismatch
                setProcessing(false);
                const detectedLabel = (routerResult.detectedType || '').replace('_', ' ');
                const selectedLabel = (selectedDocType || '').replace('_', ' ');
                Alert.alert(
                  "Document Mismatch",
                  `This document appears to be a ${detectedLabel} rather than a ${selectedLabel}. How would you like to proceed?`,
                  [
                    {
                      text: `Use ${detectedLabel} Scanner`,
                      onPress: () => {
                        processImage(optimizedUri, {
                          ...processOpts,
                          forceDocumentType: routerResult.detectedType,
                          skipSafetyCheck: true,
                        });
                      },
                    },
                    {
                      text: 'Scan Again',
                      style: 'cancel',
                      onPress: () => setPendingImageUri(''),
                    },
                    {
                      text: 'Continue Anyway',
                      onPress: () => {
                        processImage(optimizedUri, {
                          ...processOpts,
                          forceDocumentType: selectedDocType,
                          skipSafetyCheck: true,
                        });
                      },
                    },
                  ],
                );
                return;
              } else {
                console.warn('[OCR_PROVIDER] GEMINI_FAILURE (no extracted payload)');
              }
            } catch (vlmErr) {
              const isTimeout = /timeout/i.test(String(vlmErr?.message || ''));
              if (isTimeout) {
                console.warn('[OCR_PROVIDER] GEMINI_TIMEOUT (15s limit exceeded)');
                // Bounded single retry on transient network timeout
                if (!processOpts.isRetry) {
                  console.log('[OCR_PROVIDER] Retrying Gemini Vision extraction (attempt 2/2)...');
                  setProcessLabel('Retrying once…');
                  return processImage(optimizedUri, {
                    ...processOpts,
                    isRetry: true,
                  });
                }
              } else {
                console.warn('[OCR_PROVIDER] GEMINI_FAILURE exception:', vlmErr?.message || vlmErr);
              }
              routerResult = null;
            }
          }

          // Deterministic OCR fallback only if Gemini extraction yielded nothing
          if (!vlmData && !vlmInsurance && !vlmPuc && !vlmElectricity && !vlmVehicleService && !ocr) {
            setProcessLabel('Running text recognition…');
            setProcessingStage('OCR_EXTRACTING');
            const { collectVaultedDocsFromAssets } = require('../services/ocr/vaultedDocCollector');
            try {
              ocr = await CloudVisionOcrService.recognizeInvoice(optimizedUri, {
                base64: optimizedBase64,
                alreadyPreprocessed: Boolean(processOpts.alreadyPreprocessed),
                scanSessionId,
                existingAssets: assets || [],
                existingVaultedDocs: collectVaultedDocsFromAssets(assets || []),
                skipAi: false,
                t0ScanInitiated: t0,
              });
            } catch (rescueErr) {
              console.error('[OCR_PROVIDER] RESCUE_OCR_FAILURE:', rescueErr);
              ocrFailed = true;
              ocrFailMessage = rescueErr?.message || 'Could not auto-fill details, please enter manually';
            }
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

        const ocrRawText = ocr?.data?.rawText || ocr?.data?.rawOcrText || ocr?.rawText || '';
        const hasExtractedText = Boolean(
          vlmData ||
            vlmInsurance ||
            vlmPuc ||
            vlmElectricity ||
            vlmVehicleService ||
            (ocr?.success && ocrRawText && ocrRawText.trim().length >= 10),
        );

        if (!hasExtractedText && ocrFailed) {
          setProcessing(false);
          setProcessLabel('Failed');
          setProcessingStage('FAILED');
          setLastError(
            ocr?.error ||
            ocrFailMessage ||
            'Could not extract readable text from this document. Please ensure good lighting, avoid glare, or enter details manually.'
          );
          Haptics.error();
          return;
        }

        const classifiedDocType =
          routerResult?.documentType ||
          ocr?.data?.classifiedDocumentType ||
          ocr?.data?.documentType;
        const docIdentified = Boolean(
          classifiedDocType &&
          classifiedDocType !== 'UNKNOWN' &&
          classifiedDocType !== 'UNKNOWN_DOCUMENT' &&
          classifiedDocType !== 'UNREADABLE_DOCUMENT'
        );

        if (docIdentified) {
          setProcessLabel('Identifying document…');
          setProcessingStage('IDENTIFYING');
          if (isStale()) {
            console.log('[OCR] discarded stale session', scanSessionId);
            return;
          }
          setProcessLabel('Verifying fields & matching assets…');
          setProcessingStage('VERIFYING');
        } else {
          setProcessLabel('Reviewing extracted details…');
          setProcessingStage('REVIEWING');
        }

        const honestRouterConf = routerResult?.classification?.confidence != null
          ? Math.round(routerResult.classification.confidence <= 1 ? routerResult.classification.confidence * 100 : routerResult.classification.confidence)
          : null;
        const honestOcrConf = ocr?.confidence != null ? Math.round(ocr.confidence) : null;

        let mappedInvoice = null;
        if (vlmVehicleService) {
          mappedInvoice = {
            documentType: 'VEHICLE_SERVICE',
            classifiedDocumentType: 'VEHICLE_SERVICE',
            scanDocumentType: 'vehicle_service',
            serviceInvoiceNumber: vlmVehicleService.serviceInvoiceNumber,
            invoiceNumber: vlmVehicleService.serviceInvoiceNumber,
            serviceDate: vlmVehicleService.serviceDate,
            invoiceDate: vlmVehicleService.serviceDate,
            workshopName: vlmVehicleService.workshopName,
            shopName: vlmVehicleService.workshopName,
            vendor: vlmVehicleService.workshopName,
            customerName: vlmVehicleService.customerName,
            registration: vlmVehicleService.registrationNumber,
            vehicleRegistrationNumber: vlmVehicleService.registrationNumber,
            chassisNumber: vlmVehicleService.chassisNumber,
            chassisSuffix: vlmVehicleService.chassisSuffix,
            engineNumber: vlmVehicleService.engineNumber,
            engineSuffix: vlmVehicleService.engineSuffix,
            vehicleMake: vlmVehicleService.vehicleMake,
            vehicleModel: vlmVehicleService.vehicleModel,
            brand: vlmVehicleService.vehicleMake,
            model: vlmVehicleService.vehicleModel,
            variant: vlmVehicleService.variant,
            jobType: vlmVehicleService.jobType,
            odometerKm: vlmVehicleService.odometerKm,
            serviceItems: vlmVehicleService.serviceItems,
            labourAmount: vlmVehicleService.labourAmount,
            partsAmount: vlmVehicleService.partsAmount,
            taxAmount: vlmVehicleService.taxAmount,
            totalAmount: vlmVehicleService.totalAmount,
            purchaseAmount: vlmVehicleService.totalAmount,
            nextServiceDate: vlmVehicleService.nextServiceDate,
            nextServiceDue: vlmVehicleService.nextServiceDate,
            nextServiceKm: vlmVehicleService.nextServiceKm,
            productName: vlmVehicleService.vehicleMake
              ? `${vlmVehicleService.vehicleMake} ${vlmVehicleService.vehicleModel} Service`.trim()
              : 'Vehicle Service',
            confidence: honestRouterConf,
            needsManualReview: false,
            requiresVehicleLink: true,
            isAttachDoc: true,
            category: 'Vehicles',
            purchaseCategory: 'Vehicles',
          };
        } else if (vlmInsurance) {
          mappedInvoice = {
            documentType: 'INSURANCE',
            classifiedDocumentType: 'INSURANCE',
            policyNumber: vlmInsurance.policyNumber,
            invoiceNumber: vlmInsurance.policyNumber,
            insurer: vlmInsurance.insurerName,
            insurerName: vlmInsurance.insurerName,
            shopName: vlmInsurance.insurerName,
            vendor: vlmInsurance.insurerName,
            policyType: vlmInsurance.policyType,
            customerName: vlmInsurance.customerName,
            registration: vlmInsurance.vehicleRegistrationNumber,
            vehicleRegistrationNumber: vlmInsurance.vehicleRegistrationNumber,
            chassisNumber: vlmInsurance.chassisNumber,
            chassisSuffix: vlmInsurance.chassisSuffix,
            engineNumber: vlmInsurance.engineNumber,
            engineSuffix: vlmInsurance.engineSuffix,
            idv: vlmInsurance.idv,
            premium: vlmInsurance.premium,
            totalAmount: vlmInsurance.premium,
            purchaseAmount: vlmInsurance.premium,
            policyStartDate: vlmInsurance.policyStartDate,
            invoiceDate: vlmInsurance.policyStartDate,
            insuranceExpiry: vlmInsurance.policyExpiryDate,
            policyExpiryDate: vlmInsurance.policyExpiryDate,
            coverageDetails: vlmInsurance.coverageDetails,
            vehicleMake: vlmInsurance.vehicleMake,
            vehicleModel: vlmInsurance.vehicleModel,
            productName: vlmInsurance.vehicleMake
              ? `${vlmInsurance.vehicleMake} ${vlmInsurance.vehicleModel}`.trim()
              : 'Vehicle Insurance',
            brand: vlmInsurance.vehicleMake,
            model: vlmInsurance.vehicleModel,
            confidence: honestRouterConf,
            needsManualReview: false,
            requiresVehicleLink: true,
            isAttachDoc: true,
            category: 'Vehicles',
            purchaseCategory: 'Vehicles',
          };
        } else if (vlmPuc) {
          mappedInvoice = {
            documentType: 'PUC',
            classifiedDocumentType: 'PUC',
            certificateNumber: vlmPuc.certificateNumber,
            invoiceNumber: vlmPuc.certificateNumber,
            registration: vlmPuc.vehicleRegistrationNumber,
            vehicleRegistrationNumber: vlmPuc.vehicleRegistrationNumber,
            vehicleMake: vlmPuc.vehicleMake,
            vehicleModel: vlmPuc.vehicleModel,
            chassisNumber: vlmPuc.chassisNumber,
            chassisSuffix: vlmPuc.chassisSuffix,
            engineNumber: vlmPuc.engineNumber,
            engineSuffix: vlmPuc.engineSuffix,
            customerName: vlmPuc.ownerName,
            fuelType: vlmPuc.fuelType,
            invoiceDate: vlmPuc.testDate,
            testDate: vlmPuc.testDate,
            validUntil: vlmPuc.validUntil,
            pucExpiry: vlmPuc.validUntil,
            pucValidUntil: vlmPuc.validUntil,
            emissionValues: vlmPuc.emissionValues,
            shopName: vlmPuc.issuingAuthority,
            issuingAuthority: vlmPuc.issuingAuthority,
            productName: vlmPuc.vehicleMake
              ? `${vlmPuc.vehicleMake} ${vlmPuc.vehicleModel}`.trim()
              : 'Vehicle PUC Certificate',
            brand: vlmPuc.vehicleMake,
            model: vlmPuc.vehicleModel,
            confidence: honestRouterConf,
            needsManualReview: false,
            requiresVehicleLink: true,
            isAttachDoc: true,
            category: 'Vehicles',
            purchaseCategory: 'Vehicles',
          };
        } else if (vlmElectricity) {
          mappedInvoice = {
            documentType: 'ELECTRICITY_BILL',
            classifiedDocumentType: 'ELECTRICITY_BILL',
            isElectricityBill: true,
            electricityProvider: vlmElectricity.providerName,
            providerName: vlmElectricity.providerName,
            shopName: vlmElectricity.providerName,
            customerName: vlmElectricity.customerName,
            consumerId: vlmElectricity.consumerNumber,
            consumerNumber: vlmElectricity.consumerNumber,
            accountNumber: vlmElectricity.accountNumber,
            billNumber: vlmElectricity.billNumber,
            billMonthYear: vlmElectricity.billMonthYear,
            meterNumber: vlmElectricity.meterNumber,
            serviceAddress: vlmElectricity.serviceAddress,
            sanctionedLoad: vlmElectricity.sanctionedLoad,
            maximumDemand: vlmElectricity.maximumDemand,
            billingMonth: vlmElectricity.billingPeriod,
            billingPeriod: vlmElectricity.billingPeriod,
            billDate: vlmElectricity.billDate,
            invoiceDate: vlmElectricity.billDate,
            dueDate: vlmElectricity.dueDate,
            disconnectionDate: vlmElectricity.disconnectionDate,
            previousMeterReading: vlmElectricity.previousReading,
            currentMeterReading: vlmElectricity.currentReading,
            unitsConsumed: vlmElectricity.unitsConsumed,
            calculatedConsumption: vlmElectricity.calculatedConsumption,
            readingMismatch: vlmElectricity.readingMismatch,
            grossBillAmount: vlmElectricity.grossBillAmount,
            tariffSubsidy: vlmElectricity.tariffSubsidy,
            subsidy: vlmElectricity.tariffSubsidy,
            latePaymentSurcharge: vlmElectricity.latePaymentSurcharge,
            lpsc: vlmElectricity.latePaymentSurcharge,
            netCurrentBillAmount: vlmElectricity.netCurrentBillAmount,
            advancePayment: vlmElectricity.advancePayment,
            interestAmount: vlmElectricity.interestAmount,
            arrears: vlmElectricity.arrears,
            totalPayableAmount: vlmElectricity.totalPayableAmount,
            totalAmount: vlmElectricity.amountDue,
            amountDue: vlmElectricity.amountDue,
            currentBillAmount: vlmElectricity.netCurrentBillAmount || vlmElectricity.amountDue,
            confidence: honestRouterConf,
            needsManualReview: false,
          };
        } else if (vlmData) {
          mappedInvoice = {
            ...vlmData,
            documentType: 'INVOICE',
            classifiedDocumentType: 'INVOICE',
            confidence: honestRouterConf,
            needsManualReview: false,
            ocrExtract: {
              product_name: vlmData.productName,
              asset_name: vlmData.productName,
              brand: vlmData.brand,
              model: vlmData.model,
              serial_number: vlmData.serialNumber,
              chassis_or_frame_no: vlmData.chassisNumber,
              engine_number: vlmData.engineNumber,
              imei: vlmData.imei,
              vendor_dealer_name: vlmData.shopName,
              owner_buyer_name: vlmData.customerName,
              purchase_date: vlmData.invoiceDate,
              invoice_number: vlmData.invoiceNumber,
              total_amount: vlmData.totalAmount,
              warranty_period: vlmData.warrantyPeriod,
              expiry_date: vlmData.warrantyExpiry,
            },
          };
        } else {
          console.log('[OCR_DEBUG] classification_started', {
            selectedDocType,
            ocrDataDocType: ocr?.data?.classifiedDocumentType || ocr?.data?.documentType,
            routerDocType: routerResult?.documentType || routerResult?.classification?.documentType,
            rawTextLength: (ocrRawText || '').length,
          });

          // Check raw OCR text for definitive insurance signatures
          const isInsurancePolicy =
            /\b(policy\s*(?:no|number|#|certificate|schedule)|certificate\s*of\s*insurance|motor\s*insurance\s*policy|insured\s*declared\s*value|\bidv\b|own\s*damage|ncb|no\s*claim\s*bonus|imt[- ]?28|pa\s*cover|compulsory\s*pa|liability\s*paid\s*driver)\b/i.test(
              ocrRawText || '',
            ) ||
            /\b(icici\s*lombard|hdfc\s*ergo|bajaj\s*allianz|new\s*india\s*assurance|tata\s*aig|iffco\s*tokio|go\s*digit|united\s*india\s*insurance|national\s*insurance|sbi\s*general|reliance\s*general|cholamandalam)\b/i.test(
              ocrRawText || '',
            );

          let detectedDocType =
            ocr?.data?.classifiedDocumentType ||
            ocr?.data?.documentType ||
            routerResult?.documentType ||
            routerResult?.classification?.documentType ||
            selectedDocType;

          if (isInsurancePolicy && detectedDocType !== 'VEHICLE_SERVICE_BILL') {
            detectedDocType = 'VEHICLE_INSURANCE';
          }

          let canonicalTarget = normalizeToCanonicalDocType(detectedDocType);
          if (isInsurancePolicy && canonicalTarget !== 'VEHICLE_SERVICE_BILL') {
            canonicalTarget = 'VEHICLE_INSURANCE';
          }

          console.log(`[OCR_DEBUG] classification_result: ${canonicalTarget}`);
          console.log(`[OCR_DEBUG] review_route: ${getRouteForCanonicalDocType(canonicalTarget)}`);

          if (canonicalTarget === 'VEHICLE_SERVICE_BILL') {
            const { RealVehicleServiceExtractor } = require('../services/ocr/extractors/RealVehicleServiceExtractor');
            const srv = RealVehicleServiceExtractor.extract(ocrRawText);
            mappedInvoice = {
              documentType: 'VEHICLE_SERVICE_BILL',
              classifiedDocumentType: 'VEHICLE_SERVICE',
              workshopName: srv.workshopName || '',
              serviceInvoiceNumber: srv.invoiceNumber || srv.jobCardNumber || '',
              invoiceNumber: srv.invoiceNumber || srv.jobCardNumber || '',
              serviceDate: srv.invoiceDate || '',
              invoiceDate: srv.invoiceDate || '',
              registration: srv.registration || '',
              vehicleRegistrationNumber: srv.registration || '',
              odometerKm: srv.odometerKm,
              odometerReading: srv.odometerKm,
              labourAmount: srv.labourCharges,
              partsAmount: srv.partsTotal,
              taxAmount: srv.taxAmount,
              totalAmount: srv.totalAmount,
              nextServiceDue: srv.nextServiceDate,
              nextServiceDueDate: srv.nextServiceDate,
              nextServiceDueKm: srv.nextServiceOdometerKm,
              serviceType: 'Periodic Maintenance',
              requiresVehicleLink: true,
              isAttachDoc: true,
              confidence: honestOcrConf,
            };
          } else if (canonicalTarget === 'VEHICLE_INSURANCE') {
            const { InsuranceExtractor } = require('../ocr/extractors/InsuranceExtractor');
            const { normalizeInsurance } = require('../services/ocr/UnifiedDocumentNormalizer');
            const ins = InsuranceExtractor.extract(ocrRawText);
            const intermediate = {
              insurerName: ins.insurerName?.value || '',
              policyNumber: ins.policyNumber?.value || '',
              registration: ins.vehicleRegistration?.value || '',
              engineNumber: ins.engineNumber?.value || '',
              chassisNumber: ins.chassisNumber?.value || '',
              idv: ins.idvAmount?.value,
              premiumAmount: ins.premiumAmount?.value,
              policyStartDate: ins.policyStartDate?.value || '',
              policyExpiryDate: ins.policyEndDate?.value || '',
              insuredName: ins.insuredName?.value || '',
              policyType: ins.coverageType?.value || 'Comprehensive',
              confidence: honestOcrConf || 85,
            };
            const normIns = normalizeInsurance(intermediate);
            mappedInvoice = {
              ...normIns,
              documentType: 'VEHICLE_INSURANCE',
              classifiedDocumentType: 'INSURANCE',
              shopName: normIns.insurerName,
              invoiceNumber: normIns.policyNumber,
              vehicleRegistrationNumber: normIns.registration,
              insuranceExpiry: normIns.policyExpiryDate,
              customerName: normIns.insuredName,
              totalAmount: normIns.premiumAmount,
              price: normIns.premiumAmount,
              items: [],
              lineItems: [],
              requiresVehicleLink: true,
              isAttachDoc: true,
              confidence: honestOcrConf || 85,
            };
          } else if (canonicalTarget === 'VEHICLE_PUC') {
            const { PucExtractor } = require('../ocr/extractors/PucExtractor');
            const puc = PucExtractor.extract(ocrRawText);
            mappedInvoice = {
              documentType: 'VEHICLE_PUC',
              classifiedDocumentType: 'PUC',
              certificateNumber: puc.certificateNumber?.value || '',
              invoiceNumber: puc.certificateNumber?.value || '',
              registration: puc.vehicleRegistration?.value || '',
              vehicleRegistrationNumber: puc.vehicleRegistration?.value || '',
              issueDate: puc.issueDate?.value || '',
              invoiceDate: puc.issueDate?.value || '',
              validUntil: puc.expiryDate?.value || '',
              pucExpiry: puc.expiryDate?.value || '',
              emissionResult: puc.emissionResult?.value || 'PASS',
              fuelType: puc.fuelType?.value || puc.fuelType || '',
              requiresVehicleLink: true,
              isAttachDoc: true,
              confidence: honestOcrConf,
            };
          } else if (canonicalTarget === 'ELECTRICITY_BILL') {
            const { RealElectricityBillExtractor } = require('../services/ocr/extractors/RealElectricityBillExtractor');
            const elec = RealElectricityBillExtractor.extract(ocrRawText);
            mappedInvoice = {
              documentType: 'ELECTRICITY_BILL',
              classifiedDocumentType: 'ELECTRICITY_BILL',
              isElectricityBill: true,
              electricityProvider: elec.electricityProvider || '',
              providerName: elec.electricityProvider || '',
              shopName: elec.electricityProvider || '',
              consumerId: elec.consumerId || '',
              consumerNumber: elec.consumerId || '',
              accountNumber: elec.consumerId || '',
              billNumber: elec.billNumber || '',
              billMonthYear: elec.billingMonth || '',
              billingMonth: elec.billingMonth || '',
              billDate: elec.billDate || '',
              invoiceDate: elec.billDate || '',
              dueDate: elec.dueDate || '',
              meterNumber: elec.meterNumber || '',
              previousMeterReading: elec.previousMeterReading,
              previousReading: elec.previousMeterReading,
              currentMeterReading: elec.currentMeterReading,
              currentReading: elec.currentMeterReading,
              unitsConsumed: elec.unitsConsumedKwh,
              unitsConsumedKwh: elec.unitsConsumedKwh,
              currentBillAmount: elec.currentBillAmount,
              totalPayableAmount: elec.currentBillAmount,
              amountDue: elec.currentBillAmount,
              totalAmount: elec.currentBillAmount,
              confidence: honestOcrConf,
            };
          } else {
            mappedInvoice = mapOcrToInvoiceFields(ocr?.data || {});
          }
        }

        const isVlmExtracted = Boolean(vlmData || vlmInsurance || vlmPuc || vlmElectricity || vlmVehicleService);
        // Confidence gate — < 85% → Manual Review (never silent auto-trust)
        let confidence = Number(
          mappedInvoice.confidence ??
            ocr?.data?.confidence ??
            ocr?.confidence ??
            (isVlmExtracted ? (honestRouterConf || 0) : 0),
        );
        if (!isVlmExtracted) {
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
              audit.needsReview = true;
              audit.flags = [...(audit.flags || []), 'low_confidence_manual_review'];
              if (!mappedInvoice.productName && mappedInvoice.totalAmount == null && !mappedInvoice.shopName) {
                audit.manualEntry = true;
              }
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

        const canonicalType = normalizeToCanonicalDocType(
          mappedInvoice.documentType ||
          mappedInvoice.classifiedDocumentType ||
          routerResult?.documentType ||
          ocr?.data?.classifiedDocumentType ||
          selectedDocType ||
          'UNKNOWN'
        );

        mappedInvoice = normalizeDocumentByCanonicalType(canonicalType, mappedInvoice);

        // Guard against zero-field false success
        const meaningfulKeys = Object.keys(mappedInvoice || {}).filter(k => {
          if (['documentType', 'classifiedDocumentType', 'scanDocumentType', 'requiresVehicleLink', 'isAttachDoc', 'isElectricityBill', 'confidence', 'needsManualReview'].includes(k)) return false;
          const v = mappedInvoice[k];
          return v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);
        });

        if (meaningfulKeys.length === 0) {
          ocrFailed = true;
          ocrFailMessage = 'Could not auto-fill details, please enter manually';
          mappedInvoice.needsManualReview = true;
          audit.manualEntry = true;
          audit.needsReview = true;
          audit.flags = [...(audit.flags || []), 'zero_fields_extracted'];
        }

        if (__DEV__) {
          const nonEmptyFields = Object.keys(mappedInvoice).filter(k => {
            const v = mappedInvoice[k];
            return v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);
          });
          console.log('[Scan Router] Final Routing Decision:');
          console.log(`- Selected Category: ${selectedDocType || 'AUTO'}`);
          console.log(`- Classified Category: ${mappedInvoice.classifiedDocumentType || canonicalType}`);
          console.log(`- Chosen Screen: ${canonicalType}`);
          console.log(`- Extracted Field Count: ${nonEmptyFields.length}`);
          console.log(`- Non-empty Fields: ${JSON.stringify(nonEmptyFields)}`);
          console.log(`- Fallback Triggered: ${ocrFailed ? 'YES (OCR Failed)' : 'NO'}`);
          console.log(`- Confidence Score: ${mappedInvoice.confidence}%`);
          console.log(`- Raw OCR Provider: ${ocr?.engine || (ocrFailed ? 'manual' : 'unknown')}`);
          console.log(`- VLM Provider: ${isVlmExtracted ? 'gemini-1.5-flash' : 'NONE'}`);
        }

        const reviewPayload = {
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
          rawOcrText: ocrRawText,
          accountId: route?.params?.accountId,
        };

        const targetRoute = getRouteForCanonicalDocType(canonicalType);
        reviewPayload.documentType = canonicalType;
        reviewPayload.reviewRoute = targetRoute;
        reviewPayload.scanSessionId = scanSessionId;

        console.log(
          `[SCAN_NAV_DEBUG] OCR_COMPLETE → ${canonicalType} (reviewRoute=${targetRoute} scanSessionId=${scanSessionId})`,
        );

        // Persist specific review state before navigation
        markScanSession(targetRoute, {
          ...reviewPayload,
          documentType: canonicalType,
          reviewRoute: targetRoute,
          scanSessionId,
        }).catch(() => {});

        switch (canonicalType) {
          case 'VEHICLE_SERVICE_BILL':
            navigation.navigate('ReviewVehicleService', reviewPayload);
            break;
          case 'VEHICLE_INSURANCE':
            navigation.navigate('ReviewInsurance', reviewPayload);
            break;
          case 'VEHICLE_PUC':
            navigation.navigate('ReviewPuc', reviewPayload);
            break;
          case 'ELECTRICITY_BILL':
            navigation.navigate('ReviewElectricityBill', reviewPayload);
            break;
          case 'OTHER_DOCUMENT':
          case 'UNKNOWN':
            navigation.navigate('ReviewGenericDocument', reviewPayload);
            break;
          case 'VEHICLE_PURCHASE_INVOICE':
          default:
            goToReviewAsset(navigation, reviewPayload);
            break;
        }

        if (ocrFailed) {
          setProcessLabel('Review required');
          setLastError(ocrFailMessage);
        } else if (mappedInvoice.needsManualReview) {
          setProcessLabel('Review required');
        } else {
          setProcessLabel('Completed');
        }
        return;
      } catch (error) {
        console.error('OCR Error:', error);
        Haptics.error();
        const fallbackType = normalizeToCanonicalDocType(
          selectedDocType || (route?.params?.isEnergyScan ? 'ELECTRICITY_BILL' : 'UNKNOWN')
        );
        const fallbackPayload = {
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
          accountId: route?.params?.accountId,
        };

        const fallbackRoute = getRouteForCanonicalDocType(fallbackType);
        fallbackPayload.documentType = fallbackType;
        fallbackPayload.reviewRoute = fallbackRoute;
        fallbackPayload.scanSessionId = scanSessionId;

        console.log(
          `[SCAN_NAV_DEBUG] OCR_FALLBACK → ${fallbackType} (reviewRoute=${fallbackRoute} scanSessionId=${scanSessionId})`,
        );

        markScanSession(fallbackRoute, {
          ...fallbackPayload,
          documentType: fallbackType,
          reviewRoute: fallbackRoute,
          scanSessionId,
        }).catch(() => {});

        switch (fallbackType) {
          case 'VEHICLE_SERVICE_BILL':
            navigation.navigate('ReviewVehicleService', fallbackPayload);
            break;
          case 'VEHICLE_INSURANCE':
            navigation.navigate('ReviewInsurance', fallbackPayload);
            break;
          case 'VEHICLE_PUC':
            navigation.navigate('ReviewPuc', fallbackPayload);
            break;
          case 'ELECTRICITY_BILL':
            navigation.navigate('ReviewElectricityBill', fallbackPayload);
            break;
          case 'OTHER_DOCUMENT':
          case 'UNKNOWN':
            navigation.navigate('ReviewGenericDocument', fallbackPayload);
            break;
          case 'VEHICLE_PURCHASE_INVOICE':
          default:
            goToReviewAsset(navigation, fallbackPayload);
            break;
        }
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
          processImage(uri, { alreadyPreprocessed }).catch((error) => {
            console.error('OCR Error:', error);
            const fallbackType = normalizeToCanonicalDocType(
              route?.params?.selectedDocType ||
              (route?.params?.isEnergyScan ? 'ELECTRICITY_BILL' : 'UNKNOWN')
            );
            const fallbackPayload = {
              scanId: `local_${Date.now()}`,
              imageUri: uri,
              assetData: emptyFallbackInvoice(),
              invoice: emptyFallbackInvoice(),
              parsedData: emptyFallbackInvoice(),
              audit: { manualEntry: true, flags: ['scan_failed_local_exception'] },
              engine: 'failed_pipeline',
              ocrFailed: true,
              hasOcrError: true,
              needsManualReview: true,
            };

            switch (fallbackType) {
              case 'VEHICLE_SERVICE_BILL':
                navigation.replace('ReviewVehicleService', fallbackPayload);
                break;
              case 'VEHICLE_INSURANCE':
                navigation.replace('ReviewInsurance', fallbackPayload);
                break;
              case 'VEHICLE_PUC':
                navigation.replace('ReviewPuc', fallbackPayload);
                break;
              case 'VEHICLE_RC':
                navigation.replace('ReviewGenericDocument', fallbackPayload);
                break;
              case 'ELECTRICITY_BILL':
                navigation.replace('ReviewElectricityBill', fallbackPayload);
                break;
              case 'PURCHASE_BILL':
              default:
                navigation.replace('ReviewAsset', fallbackPayload);
                break;
            }
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
    [processImage, navigation],
  );

  const launchCameraCapture = useCallback(async () => {
    if (capturing.current || processing) return;
    capturing.current = true;
    scanGenRef.current += 1;
    clearAutoTimers();
    setAutoArmed(true);
    setLastError('');
    const newSessionId = `scan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    scanSessionIdRef.current = newSessionId;
    setActiveScanSessionId(newSessionId);

    // Mark before scanner/camera so Activity kill restores ScanBill (not Home)
    markScanSession('ScanBill', {
      scanSessionId: newSessionId,
      documentType: selectedDocType || null,
      reviewRoute: null,
    }).catch(() => {});

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
      scheduleOcrAfterPaint(uri, { alreadyPreprocessed: true });
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
    const newSessionId = `scan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    scanSessionIdRef.current = newSessionId;
    setActiveScanSessionId(newSessionId);

    // Mark before gallery so Activity kill restores ScanBill (not Home)
    markScanSession('ScanBill', {
      scanSessionId: newSessionId,
      documentType: selectedDocType || null,
      reviewRoute: null,
    }).catch(() => {});

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
          {(() => {
            const currentDocType =
              route?.params?.selectedDocType ||
              (route?.params?.isEnergyScan ? 'ELECTRICITY_BILL' : 'UNKNOWN');
            const guide = DOC_TYPE_GUIDES[currentDocType] || DOC_TYPE_GUIDES.UNKNOWN;
            return (
              <>
                <Text style={styles.eyebrow}>{guide.eyebrow}</Text>
                <Text style={styles.title}>{guide.title}</Text>
                <Text style={styles.sub}>{guide.sub}</Text>
              </>
            );
          })()}
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
            {lastError ? (
              <GlassButton
                title="Enter Details Manually"
                onPress={() => {
                  Haptics.select();
                  clearAutoTimers();
                  goToReviewAsset(navigation, {
                    scanId: `manual_${Date.now()}`,
                    imageUri: '',
                    assetData: emptyFallbackInvoice(),
                    invoice: emptyFallbackInvoice(),
                    extractedData: emptyFallbackInvoice(),
                    parsedData: emptyFallbackInvoice(),
                    audit: { manualEntry: true, flags: ['manual_entry_after_failed_scan'] },
                    engine: 'manual',
                    ocrFailed: true,
                    hasOcrError: true,
                    needsManualReview: true,
                  });
                }}
                style={[styles.actionBtn, { marginBottom: 8 }]}
              />
            ) : null}
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
                    processingStage === 'IDENTIFYING' ||
                    processingStage === 'VERIFYING' ||
                    processingStage === 'REVIEWING' ||
                    processingStage === 'COMPLETED'
                      ? COLORS.emerald
                      : processingStage === 'EXTRACTING' ||
                        processingStage === 'OCR_EXTRACTING' ||
                        processingStage === 'PREPROCESSING'
                      ? COLORS.text
                      : COLORS.muted,
                },
              ]}
            >
              {processingStage === 'PREPROCESSING'
                ? '● Preparing image…'
                : processingStage === 'OCR_EXTRACTING'
                ? '● Reading document…'
                : processingStage === 'EXTRACTING'
                ? '● Reading document with Gemini AI…'
                : processingStage === 'IDENTIFYING' ||
                  processingStage === 'VERIFYING' ||
                  processingStage === 'REVIEWING' ||
                  processingStage === 'COMPLETED'
                ? '✓ Details extracted'
                : '○ Extracting details'}
            </Text>
            <Text
              style={[
                styles.stageStepText,
                {
                  color:
                    processingStage === 'VERIFYING' || processingStage === 'COMPLETED'
                      ? COLORS.emerald
                      : processingStage === 'IDENTIFYING' || processingStage === 'REVIEWING'
                      ? COLORS.text
                      : COLORS.muted,
                },
              ]}
            >
              {processingStage === 'IDENTIFYING'
                ? '● Identifying document…'
                : processingStage === 'VERIFYING' || processingStage === 'COMPLETED'
                ? '✓ Document verified'
                : processingStage === 'REVIEWING'
                ? '○ Reviewing document'
                : '○ Identifying document'}
            </Text>
            <Text
              style={[
                styles.stageStepText,
                {
                  color:
                    processingStage === 'VERIFYING' || processingStage === 'COMPLETED'
                      ? COLORS.emerald
                      : COLORS.muted,
                },
              ]}
            >
              {processingStage === 'VERIFYING'
                ? '● Verifying fields & matching…'
                : processingStage === 'COMPLETED'
                ? '✓ Fields verified'
                : '○ Verifying fields'}
            </Text>
          </View>

          {processingDuration >= 8 ? (
            <View style={styles.longWaitCard}>
              <Text style={styles.longWaitTitle}>Taking longer than usual…</Text>
              <Text style={styles.longWaitSub}>
                Document processing is taking longer than expected.
              </Text>
              <View style={styles.longWaitActions}>
                <Pressable
                  onPress={() => {
                    Haptics.tap();
                    scanGenRef.current += 1;
                    scanSessionIdRef.current = '';
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
          <Pressable
            onPress={() => {
              Haptics.tap();
              scanGenRef.current += 1;
              scanSessionIdRef.current = '';
              setProcessing(false);
              clearAutoTimers();
              if (navigation?.canGoBack?.()) navigation.goBack();
            }}
            style={styles.overlayCancelBtn}
          >
            <Text style={styles.overlayCancelText}>Cancel</Text>
          </Pressable>
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
  overlayCancelBtn: {
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  overlayCancelText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
