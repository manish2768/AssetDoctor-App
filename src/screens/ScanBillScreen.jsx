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
  Alert,
  ScrollView,
  Dimensions,
} from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
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
import { compressScanImage } from '../utils/compressScanImage';
import { getImagePicker } from '../utils/safeNativeModules';
import { runSweetBillChecker } from '../services/SweetBillChecker';
import { InvoiceOfflineCache } from '../services/ocr/InvoiceOfflineCache';
import {
  isDuplicateBill,
  saveParsedBillDraft,
} from '../utils/billParser';
import { useAuth } from '../context/AuthProvider';
import { ScanErrorBoundary } from '../components/ScanErrorBoundary';
import { ReviewAssetModal } from '../components/ReviewAssetModal';
import { openReviewInvoice, navigationRef, safeNavigate } from '../navigation/navActions';
import { markScanSession } from '../utils/scanNavGuard';

const AUTO_FOCUS_MS = 2000;
const SCREEN_H = Dimensions.get('window').height;
const FRAME_HEIGHT = Math.round(SCREEN_H * 0.46);
/** Compress before OCR / base64 — keep memory low but readable for Gemini. */
const SCAN_MAX_WIDTH = 1200;
const SCAN_COMPRESS = 0.6;
/** Expo ImagePicker only — no ML Kit document scanner (avoids Activity destroy). */
const PICKER_OPTIONS = {
  mediaTypes: ['images'],
  quality: 0.5,
  allowsEditing: true,
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

/** Log + optional Alert — never rethrow (keeps ScanBillScreen alive). */
function reportScanError(error, { alertTitle = 'Scan failed', showAlert = true } = {}) {
  console.error('[ScanBillScreen Error]:', error);
  const msg = friendlyCaptureMessage(error);
  if (showAlert) {
    try {
      Alert.alert(alertTitle, msg, [{ text: 'OK' }]);
    } catch (alertErr) {
      console.error('[ScanBillScreen Error]:', alertErr);
    }
  }
  return msg;
}

/**
 * Compress BEFORE OCR — min width 1200 @ 0.6 JPEG (sharp for Gemini/Vision).
 * manipulateAsync also applies EXIF orientation so the image is upright.
 * Returns { uri, base64 } (uri for Review nav; base64 for OCR API).
 */
async function prepareScanImage(capturedUri) {
  if (!capturedUri) return { uri: '', base64: null };
  try {
    // Empty rotate-noop + resize: forces EXIF orientation bake-in for upright OCR
    const compressedImage = await manipulateAsync(
      capturedUri,
      [{ resize: { width: SCAN_MAX_WIDTH } }],
      { compress: SCAN_COMPRESS, format: SaveFormat.JPEG, base64: true },
    );
    return {
      uri: compressedImage?.uri || capturedUri,
      base64: compressedImage?.base64 || null,
    };
  } catch (error) {
    console.error('[ScanBillScreen Error]:', error);
    console.warn('[ScanBill] ImageManipulator failed, fallback compress:', error?.message);
  }
  try {
    const fallbackUri = await compressScanImage(capturedUri, {
      maxWidth: SCAN_MAX_WIDTH,
      compress: SCAN_COMPRESS,
    });
    return { uri: fallbackUri || capturedUri, base64: null };
  } catch (fallbackErr) {
    console.error('[ScanBillScreen Error]:', fallbackErr);
    return { uri: capturedUri, base64: null };
  }
}

/** Map OCR payload → review fields with null-safe defaults (never crash). */
function mapOcrToInvoiceFields(parsedData = {}) {
  const src = parsedData && typeof parsedData === 'object' ? parsedData : {};
  const extract =
    src.ocrExtract && typeof src.ocrExtract === 'object' ? src.ocrExtract : {};
  return {
    ...src,
    productName:
      src.productName ||
      src.title ||
      src.assetName ||
      src.item_name ||
      src.itemName ||
      extract.asset_name ||
      extract.item_name ||
      '',
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
      src.vendor ||
      src.vendor_dealer_name ||
      extract.vendor_dealer_name ||
      extract.vendor ||
      '',
    customerName:
      src.customerName ||
      src.buyer_name ||
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
    audit: audit && typeof audit === 'object' ? stripHeavyFields(audit) : { flags: [], canSave: true },
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
  // TODO: RE-ENABLE AUTH REQUIREMENT BEFORE PRODUCTION — isAuthenticated gate removed for scan testing
  const [cameraPermission, setCameraPermission] = useState('loading'); // loading|granted|denied|undetermined
  const [processing, setProcessing] = useState(false);
  const [processLabel, setProcessLabel] = useState('Reading invoice…');
  const [lastError, setLastError] = useState('');
  const [autoArmed, setAutoArmed] = useState(false);
  const [countdownMs, setCountdownMs] = useState(AUTO_FOCUS_MS);
  const [reviewPayload, setReviewPayload] = useState(null);
  /** Low-res file path only — set first so UI can paint before OCR. */
  const [pendingImageUri, setPendingImageUri] = useState('');
  const pulse = useRef(new Animated.Value(0.35)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const autoTimer = useRef(null);
  const tickTimer = useRef(null);
  const ocrTimer = useRef(null);
  const capturing = useRef(false);
  const startedRef = useRef(false);

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
    progress.stopAnimation();
    progress.setValue(0);
    setCountdownMs(AUTO_FOCUS_MS);
  }, [progress]);

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
        Alert.alert(
          'Camera permission needed',
          'Asset Doctor needs camera access to scan invoices. You can enable it in Settings.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => openAppSettings() },
          ],
        );
      }
      return result.granted;
    } catch (error) {
      setCameraPermission('denied');
      setLastError(friendlyCaptureMessage(error));
      return false;
    }
  }, []);

  const processImageWithGemini = useCallback(
    async (uri) => {
      if (!uri) {
        setLastError('Could not capture image. Please try again.');
        Alert.alert('Scan failed', 'Could not capture image. Please try again.');
        return;
      }
      setProcessing(true);
      setLastError('');
      setProcessLabel('Optimizing image…');
      Haptics.tap();

      let optimizedUri = uri;
      let optimizedBase64 = null;
      try {
        // Compress BEFORE OCR — width 1000 @ 0.5 JPEG (+ base64 for Vision/Gemini)
        try {
          setProcessLabel('Optimizing image…');
          const compressedImage = await prepareScanImage(uri);
          optimizedUri = compressedImage?.uri || uri;
          optimizedBase64 = compressedImage?.base64 || null;
        } catch (compressErr) {
          console.error('[ScanBillScreen Error]:', compressErr);
          optimizedUri = uri;
          optimizedBase64 = null;
        }

        setProcessLabel('Analyzing document with Gemini AI...');
        let ocr = null;
        let ocrFailed = false;
        let ocrFailMessage = '';

        // Pass compressed uri + base64 (prefer base64 so OCR skips re-reading full file)
        try {
          ocr = await CloudVisionOcrService.recognizeInvoice(optimizedUri, {
            base64: optimizedBase64,
          });
          if (!ocr?.success) {
            ocrFailed = true;
            ocrFailMessage =
              ocr?.error || 'Could not auto-fill details, please enter manually';
          }
        } catch (ocrErr) {
          console.error('[ScanBillScreen Error]:', ocrErr);
          ocrFailed = true;
          ocrFailMessage =
            ocrErr?.message || 'Could not auto-fill details, please enter manually';
        }

        const mappedInvoice = ocrFailed
          ? emptyFallbackInvoice()
          : mapOcrToInvoiceFields(ocr?.data || {});

        let audit = { flags: [], canSave: true, manualEntry: ocrFailed };
        let sweetBill = ocrFailed ? {} : ocr?.sweetBill || {};

        if (!ocrFailed) {
          try {
            const dup = await isDuplicateBill(sweetBill);
            audit = await runSweetBillChecker(ocr?.data || mappedInvoice);
            if (dup?.isDuplicate) {
              audit.isDuplicate = true;
              audit.canSave = false;
              audit.duplicateMessage =
                'Duplicate bill detected (GSTIN + Total + Date already scanned).';
              audit.flags = [...(audit.flags || []), 'duplicate_bill_fingerprint'];
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

        // 3) ALWAYS open ReviewAsset — success OR OCR failure. NEVER Home.
        Haptics.success();
        goToReviewAsset(navigation, {
          scanId: cached.scanId,
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
        });

        if (ocrFailed) {
          setLastError(ocrFailMessage);
          Alert.alert(
            'Manual entry',
            'Could not auto-fill details, please enter manually',
            [{ text: 'OK' }],
          );
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
          audit: { flags: ['ocr_failed'], canSave: true, manualEntry: true },
          engine: 'manual',
          energyHints: null,
          sweetBill: {},
          ocrFailed: true,
          hasOcrError: true,
        });
        Alert.alert(
          'Manual entry',
          'Could not auto-fill details, please enter manually',
          [{ text: 'OK' }],
        );
      } finally {
        setProcessing(false);
        setPendingImageUri('');
        capturing.current = false;
        setAutoArmed(false);
        clearAutoTimers();
        startedRef.current = false;
      }
    },
    [navigation, user?.uid, clearAutoTimers],
  );

  /**
   * Save low-res URI to state + show loading FIRST, then run OCR on next frame.
   * Avoids native OOM from sync heavy work right after ImagePicker returns.
   */
  const scheduleOcrAfterPaint = useCallback(
    (uri) => {
      if (!uri) {
        capturing.current = false;
        setLastError('Could not capture image. Please try again.');
        Alert.alert('Scan failed', 'Could not capture image. Please try again.');
        return;
      }
      setPendingImageUri(uri);
      setProcessing(true);
      setProcessLabel('Preparing image…');
      setLastError('');
      Haptics.tap();

      if (ocrTimer.current) clearTimeout(ocrTimer.current);
      ocrTimer.current = setTimeout(() => {
        const run = () => {
          processImageWithGemini(uri).catch((error) => {
            console.error('OCR Error:', error);
            // DO NOT NAVIGATE TO HOME — always ReviewAsset with empty fields
            goToReviewAsset(navigation, {
              scanId: `local_${Date.now()}`,
              imageUri: uri,
              assetData: emptyFallbackInvoice(),
              invoice: emptyFallbackInvoice(),
              parsedData: emptyFallbackInvoice(),
              audit: { flags: ['ocr_failed'], canSave: true, manualEntry: true },
              engine: 'manual',
              ocrFailed: true,
              hasOcrError: true,
            });
            Alert.alert(
              'Manual entry',
              'Could not auto-fill details, please enter manually',
              [{ text: 'OK' }],
            );
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
    clearAutoTimers();
    setAutoArmed(false);
    setLastError('');
    // Mark before camera so Activity kill restores ScanBill (not Home)
    markScanSession('ScanBill').catch(() => {});

    try {
      const ok = cameraPermission === 'granted' ? true : await requestCameraAccess();
      if (!ok) {
        capturing.current = false;
        startedRef.current = false;
        setLastError('Camera permission is required to scan invoices.');
        Alert.alert(
          'Camera permission needed',
          'Enable Camera in Settings to scan invoices.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => openAppSettings() },
          ],
        );
        return;
      }

      let uri = null;
      try {
        uri = await captureDocumentImage('camera');
      } catch (captureErr) {
        console.error('[ScanBillScreen Error]:', captureErr);
        // Fallback to direct ImagePicker.launchCameraAsync (still no ML Kit)
        const fallback = await safeLaunchCameraAsync();
        if (fallback.error && !fallback.canceled) {
          const msg = reportScanError(fallback.error, { alertTitle: 'Could not capture image' });
          capturing.current = false;
          startedRef.current = false;
          setLastError(msg);
          return;
        }
        if (fallback.canceled) {
          capturing.current = false;
          startedRef.current = false;
          setLastError('Capture cancelled. Tap Camera to try again.');
          return;
        }
        uri = fallback.uri;
      }

      // Cancelled camera — stay on ScanBillScreen (never Home / MainTabs)
      if (!uri) {
        capturing.current = false;
        startedRef.current = false;
        setLastError('Capture cancelled. Tap Camera to try again.');
        return;
      }

      let compressedUri = uri;
      try {
        const compressedImage = await prepareScanImage(uri);
        compressedUri = compressedImage?.uri || uri;
      } catch (compressErr) {
        console.error('[ScanBillScreen Error]:', compressErr);
        compressedUri = uri;
      }

      // Defer OCR — let loading UI paint first (prevents Android OOM)
      scheduleOcrAfterPaint(compressedUri);
    } catch (error) {
      capturing.current = false;
      startedRef.current = false;
      const msg = reportScanError(error, { alertTitle: 'Could not capture image' });
      setLastError(msg);
      Haptics.error();
    }
  }, [
    clearAutoTimers,
    scheduleOcrAfterPaint,
    processing,
    cameraPermission,
    requestCameraAccess,
  ]);

  const launchGalleryPicker = useCallback(async () => {
    if (capturing.current || processing) return;
    capturing.current = true;
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
        Alert.alert(
          'Photos permission needed',
          'Enable Photos access in Settings to import invoices from Gallery.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => openAppSettings() },
          ],
        );
        return;
      }

      let uri = null;
      try {
        uri = await pickGalleryImage();
      } catch (pickErr) {
        console.error('[ScanBillScreen Error]:', pickErr);
        const fallback = await safeLaunchLibraryAsync();
        if (fallback.error && !fallback.canceled) {
          const msg = reportScanError(fallback.error, { alertTitle: 'Could not open gallery' });
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
          const msg = reportScanError(direct.error, { alertTitle: 'Could not open gallery' });
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

      let compressedUri = uri;
      try {
        const compressedImage = await prepareScanImage(uri);
        compressedUri = compressedImage?.uri || uri;
      } catch (compressErr) {
        console.error('[ScanBillScreen Error]:', compressErr);
        Alert.alert(
          'Image processing failed',
          'Could not compress this photo. Trying original image…',
        );
        compressedUri = uri;
      }

      // Defer OCR — let loading UI paint first (prevents Android OOM)
      scheduleOcrAfterPaint(compressedUri);
    } catch (error) {
      capturing.current = false;
      startedRef.current = false;
      const msg = reportScanError(error, { alertTitle: 'Could not open gallery' });
      setLastError(msg);
      Haptics.error();
    }
  }, [clearAutoTimers, scheduleOcrAfterPaint, processing]);

  const startAutoFocusCapture = useCallback(() => {
    // TODO: RE-ENABLE AUTH REQUIREMENT BEFORE PRODUCTION
    // Was: requireAuth({ isAuthenticated, navigation, ... })
    (async () => {
      if (capturing.current || processing) return;
      const ok =
        cameraPermission === 'granted' ? true : await requestCameraAccess();
      if (!ok) return;

      Haptics.select();
      clearAutoTimers();
      setAutoArmed(true);
      setCountdownMs(AUTO_FOCUS_MS);
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration: AUTO_FOCUS_MS,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start();

      const started = Date.now();
      tickTimer.current = setInterval(() => {
        const left = Math.max(0, AUTO_FOCUS_MS - (Date.now() - started));
        setCountdownMs(left);
      }, 80);

      autoTimer.current = setTimeout(() => {
        launchCameraCapture();
      }, AUTO_FOCUS_MS);
    })();
  }, [
    clearAutoTimers,
    progress,
    launchCameraCapture,
    processing,
    cameraPermission,
    requestCameraAccess,
  ]);

  // Only auto-arm after permission is known + granted (never open camera blind)
  useEffect(() => {
    if (startedRef.current || processing) return undefined;
    if (cameraPermission !== 'granted') return undefined;
    if (reviewPayload) return undefined;
    startedRef.current = true;
    const t = setTimeout(() => startAutoFocusCapture(), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraPermission]);

  const openCamera = useCallback(() => {
    // TODO: RE-ENABLE AUTH REQUIREMENT BEFORE PRODUCTION
    // Was: requireAuth({ isAuthenticated, navigation, ... })
    clearAutoTimers();
    setAutoArmed(false);
    launchCameraCapture();
  }, [launchCameraCapture, clearAutoTimers]);

  const openGallery = useCallback(() => {
    // TODO: RE-ENABLE AUTH REQUIREMENT BEFORE PRODUCTION
    // Was: requireAuth({ isAuthenticated, navigation, ... })
    Haptics.tap();
    clearAutoTimers();
    setAutoArmed(false);
    launchGalleryPicker();
  }, [launchGalleryPicker, clearAutoTimers]);

  const secondsLeft = Math.max(1, Math.ceil(countdownMs / 1000));
  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

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
                  title="Camera"
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
          <Text style={styles.title}>Align invoice inside the frame</Text>
          <Text style={styles.sub}>
            Use Camera or Browse Gallery — both run the same Gemini OCR and open Review & Confirm.
          </Text>
          <PrivacyVaultTag style={{ marginTop: 10, alignSelf: 'flex-start' }} />

          {autoArmed && !processing ? (
            <View style={styles.countdownStrip}>
              <Text style={styles.countdownLabel}>Hold steady… {secondsLeft}s</Text>
              <View style={styles.progressTrack}>
                <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
              </View>
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
            <Text style={styles.previewHint}>Camera or Gallery → same OCR → Review</Text>
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
                title="Camera"
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
                title="Cancel auto-capture"
                onPress={() => {
                  clearAutoTimers();
                  setAutoArmed(false);
                  startedRef.current = false;
                  Haptics.tap();
                }}
                variant="ghost"
                style={styles.actionBtn}
              />
            ) : (
              <GlassButton
                title="Auto-capture (2s)"
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
          <Text style={styles.overlaySub}>Please wait — do not close the app.</Text>
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
});

export function ScanBillScreen(props) {
  return (
    <ScanErrorBoundary navigation={props.navigation}>
      <ScanBillScreenInner {...props} />
    </ScanErrorBoundary>
  );
}

export default ScanBillScreen;
