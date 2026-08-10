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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

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
import { runSweetBillChecker } from '../services/SweetBillChecker';
import { InvoiceOfflineCache } from '../services/ocr/InvoiceOfflineCache';
import {
  isDuplicateBill,
  saveParsedBillDraft,
} from '../utils/billParser';
import { useAuth } from '../context/AuthProvider';
import { requireAuth } from '../navigation/authGate';
import { ScanErrorBoundary } from '../components/ScanErrorBoundary';
import { ReviewAssetModal } from '../components/ReviewAssetModal';
import { goHomeDashboard } from '../navigation/navActions';

const AUTO_FOCUS_MS = 2000;
const SCREEN_H = Dimensions.get('window').height;
const FRAME_HEIGHT = Math.round(SCREEN_H * 0.46);

function friendlyCaptureMessage(error) {
  const raw = String(error?.message || error || '').trim();
  if (!raw) return 'Could not capture image. Please try again.';
  if (/permission/i.test(raw)) return raw;
  if (/cancel/i.test(raw)) return 'Capture cancelled. Tap Scan document to try again.';
  if (raw.length > 160) return 'Could not capture image. Please try again.';
  return raw;
}

function ScanBillScreenInner({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated } = useAuth();
  const [cameraPermission, setCameraPermission] = useState('loading'); // loading|granted|denied|undetermined
  const [processing, setProcessing] = useState(false);
  const [processLabel, setProcessLabel] = useState('Reading invoice…');
  const [lastError, setLastError] = useState('');
  const [autoArmed, setAutoArmed] = useState(false);
  const [countdownMs, setCountdownMs] = useState(AUTO_FOCUS_MS);
  const [reviewPayload, setReviewPayload] = useState(null);
  const pulse = useRef(new Animated.Value(0.35)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const autoTimer = useRef(null);
  const tickTimer = useRef(null);
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
    autoTimer.current = null;
    tickTimer.current = null;
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
      try {
        let optimizedUri = uri;
        try {
          setProcessLabel('Optimizing image…');
          optimizedUri = await compressScanImage(uri, { maxWidth: 1600, compress: 0.7 });
        } catch (compressErr) {
          console.warn('[ScanBill] compress failed, using original:', compressErr?.message);
          optimizedUri = uri;
        }

        setProcessLabel('Running OCR + Gemini…');
        let ocr;
        try {
          ocr = await CloudVisionOcrService.recognizeInvoice(optimizedUri);
        } catch (ocrErr) {
          console.error('[ScanBill] OCR/Gemini threw:', ocrErr?.message || ocrErr);
          throw new Error(
            ocrErr?.message || 'Could not read this invoice. Please try again.',
          );
        }

        if (!ocr?.success) {
          Haptics.error();
          const msg = ocr?.error || 'Could not read this invoice. Please try again.';
          setLastError(msg);
          Alert.alert('Scan failed', msg, [
            { text: 'Try again' },
            {
              text: 'Go back',
              style: 'cancel',
              onPress: () => {
                if (navigation?.canGoBack?.()) navigation.goBack();
                else goHomeDashboard();
              },
            },
          ]);
          return;
        }

        setProcessLabel('Checking bill & preparing review…');
        const sweetBill = ocr.sweetBill || {};
        let dup = { isDuplicate: false };
        let audit = { flags: [], canSave: true };
        try {
          dup = await isDuplicateBill(sweetBill);
          audit = await runSweetBillChecker(ocr.data);
        } catch (auditErr) {
          console.warn('[ScanBill] audit skipped:', auditErr?.message);
        }
        if (dup.isDuplicate) {
          audit.isDuplicate = true;
          audit.canSave = false;
          audit.duplicateMessage =
            'Duplicate bill detected (GSTIN + Total + Date already scanned).';
          audit.flags = [...(audit.flags || []), 'duplicate_bill_fingerprint'];
        }

        try {
          await saveParsedBillDraft(sweetBill, {
            engine: ocr.engine,
            imageUri: optimizedUri,
            invoice: ocr.data,
          });
        } catch (draftErr) {
          console.warn('[ScanBill] draft save skipped:', draftErr?.message);
        }

        let cached = { scanId: `local_${Date.now()}`, localImageUri: optimizedUri };
        try {
          cached = await InvoiceOfflineCache.saveScan({
            userId: user?.uid,
            imageUri: optimizedUri,
            invoice: ocr.data,
            audit,
            rawText: ocr.rawText,
            engine: ocr.engine,
          });
        } catch (cacheErr) {
          console.warn('[ScanBill] cache save skipped:', cacheErr?.message);
        }

        Haptics.success();
        // Same Review modal for Camera + Gallery — never jump to Home.
        setReviewPayload({
          scanId: cached.scanId,
          imageUri: cached.localImageUri || optimizedUri,
          invoice: ocr.data || {},
          audit,
          engine: ocr.engine,
          energyHints: ocr.energyHints,
          sweetBill,
        });
      } catch (error) {
        Haptics.error();
        const msg = friendlyCaptureMessage(error);
        console.error('[ScanBill] processImageWithGemini:', msg);
        setLastError(msg);
        Alert.alert('Scan failed', msg, [
          { text: 'Stay & retry' },
          {
            text: 'Go back',
            onPress: () => {
              if (navigation?.canGoBack?.()) navigation.goBack();
              else goHomeDashboard();
            },
          },
        ]);
      } finally {
        setProcessing(false);
        capturing.current = false;
        setAutoArmed(false);
        clearAutoTimers();
        startedRef.current = false;
      }
    },
    [navigation, user?.uid, clearAutoTimers],
  );

  const launchCameraCapture = useCallback(async () => {
    if (capturing.current || processing) return;
    capturing.current = true;
    clearAutoTimers();
    setAutoArmed(false);
    setLastError('');

    try {
      const ok = cameraPermission === 'granted' ? true : await requestCameraAccess();
      if (!ok) {
        capturing.current = false;
        startedRef.current = false;
        setLastError('Camera permission is required to scan invoices.');
        return;
      }

      const uri = await captureDocumentImage('camera');
      if (!uri) {
        capturing.current = false;
        startedRef.current = false;
        setLastError('Capture cancelled. Tap Camera to try again.');
        return;
      }
      await processImageWithGemini(uri);
    } catch (error) {
      capturing.current = false;
      startedRef.current = false;
      const msg = friendlyCaptureMessage(error);
      console.error('[ScanBill] launchCameraCapture:', msg);
      setLastError(msg);
      Haptics.error();
      Alert.alert('Could not capture image', msg, [
        { text: 'OK' },
        {
          text: 'Go back',
          onPress: () => {
            if (navigation?.canGoBack?.()) navigation.goBack();
            else goHomeDashboard();
          },
        },
      ]);
    }
  }, [
    clearAutoTimers,
    processImageWithGemini,
    processing,
    cameraPermission,
    requestCameraAccess,
    navigation,
  ]);

  const launchGalleryPicker = useCallback(async () => {
    if (capturing.current || processing) return;
    capturing.current = true;
    clearAutoTimers();
    setAutoArmed(false);
    setLastError('');

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

      // Direct expo-image-picker (Images only + crop) — same as Camera path next step
      let uri = null;
      try {
        uri = await pickGalleryImage();
      } catch (pickErr) {
        console.warn('[ScanBill] pickGalleryImage:', pickErr?.message);
        const pick = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.85,
          exif: false,
          aspect: [3, 4],
        });
        if (!pick.canceled && pick.assets?.[0]?.uri) {
          uri = pick.assets[0].uri;
        } else if (/permission/i.test(String(pickErr?.message || ''))) {
          throw pickErr;
        }
      }

      if (!uri) {
        capturing.current = false;
        startedRef.current = false;
        setLastError('Gallery selection cancelled. Tap Browse Gallery to try again.');
        return;
      }

      // Exact same Gemini OCR → ReviewAssetModal pipeline as Camera
      await processImageWithGemini(uri);
    } catch (error) {
      capturing.current = false;
      startedRef.current = false;
      const msg = friendlyCaptureMessage(error);
      console.error('[ScanBill] launchGalleryPicker:', msg);
      setLastError(msg);
      Haptics.error();
      Alert.alert('Could not open gallery', msg, [
        { text: 'OK' },
        {
          text: 'Go back',
          onPress: () => {
            if (navigation?.canGoBack?.()) navigation.goBack();
            else goHomeDashboard();
          },
        },
      ]);
    }
  }, [clearAutoTimers, processImageWithGemini, processing, navigation]);

  const startAutoFocusCapture = useCallback(() => {
    requireAuth({
      isAuthenticated,
      navigation,
      message: 'Sign in to scan invoices into your vault.',
      onAuthed: async () => {
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
      },
    });
  }, [
    isAuthenticated,
    navigation,
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
    requireAuth({
      isAuthenticated,
      navigation,
      message: 'Sign in to scan invoices into your vault.',
      onAuthed: () => {
        clearAutoTimers();
        setAutoArmed(false);
        launchCameraCapture();
      },
    });
  }, [isAuthenticated, navigation, launchCameraCapture, clearAutoTimers]);

  const openGallery = useCallback(() => {
    requireAuth({
      isAuthenticated,
      navigation,
      message: 'Sign in to import an invoice photo.',
      onAuthed: () => {
        Haptics.tap();
        clearAutoTimers();
        setAutoArmed(false);
        launchGalleryPicker();
      },
    });
  }, [isAuthenticated, navigation, launchGalleryPicker, clearAutoTimers]);

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
        <Screen style={styles.root}>
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: Math.max(insets.bottom, 16) + 24, flexGrow: 1, justifyContent: 'center' },
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
                  else goHomeDashboard();
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
              <Text style={styles.processingTitle}>{processLabel}</Text>
            </View>
          ) : null}
        </Screen>
        {reviewModal}
      </>
    );
  }

  return (
    <>
    <Screen style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 16) + 24 },
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
                else goHomeDashboard();
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
          <Text style={styles.processingTitle}>{processLabel}</Text>
        </View>
      ) : null}
    </Screen>
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
    backgroundColor: 'rgba(248,250,252,0.86)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 20,
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
