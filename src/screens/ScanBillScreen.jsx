/**
 * Bill / document scanner — document edge capture + OCR + Gemini.
 * Errors stay on this screen (no silent redirect to Home).
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

import { COLORS, RADIUS, SPACING } from '../theme/branding';
import { GlassButton, Screen } from '../components/ui/Glass';
import { Haptics } from '../services/haptics';
import { CloudVisionOcrService } from '../services/ocr/CloudVisionOcrService';
import { captureDocumentImage } from '../services/ocr/DocumentScannerService';
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
import { goHomeDashboard } from '../navigation/navActions';

const AUTO_FOCUS_MS = 2000;
const SCREEN_H = Dimensions.get('window').height;
const FRAME_HEIGHT = Math.round(SCREEN_H * 0.46);

function ScanBillScreenInner({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [processLabel, setProcessLabel] = useState('Reading invoice…');
  const [lastError, setLastError] = useState('');
  const [autoArmed, setAutoArmed] = useState(false);
  const [countdownMs, setCountdownMs] = useState(AUTO_FOCUS_MS);
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

  const processImage = useCallback(
    async (uri) => {
      if (!uri) return;
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
          throw new Error(ocrErr?.message || 'OCR failed. Please try another photo.');
        }

        if (!ocr?.success) {
          Haptics.error();
          const msg = ocr?.error || 'Could not read this invoice.';
          setLastError(msg);
          Alert.alert('Scan failed', msg, [
            { text: 'Try again' },
            { text: 'Home', style: 'cancel', onPress: () => goHomeDashboard() },
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
        navigation.navigate('ReviewAsset', {
          scanId: cached.scanId,
          imageUri: cached.localImageUri || optimizedUri,
          invoice: ocr.data,
          audit,
          engine: ocr.engine,
          energyHints: ocr.energyHints,
          sweetBill,
        });
      } catch (error) {
        Haptics.error();
        const msg = error?.message || 'Unexpected scanner error';
        console.error('[ScanBill] processImage:', msg);
        setLastError(msg);
        Alert.alert('Scan failed', msg, [
          { text: 'Stay & retry' },
          { text: 'Home', onPress: () => goHomeDashboard() },
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

  const launchCapture = useCallback(
    async (mode) => {
      if (capturing.current || processing) return;
      capturing.current = true;
      clearAutoTimers();
      setAutoArmed(false);
      setLastError('');

      try {
        const uri = await captureDocumentImage(mode);
        if (!uri) {
          capturing.current = false;
          startedRef.current = false;
          setLastError('Capture cancelled. Tap Scan document to try again.');
          return;
        }
        await processImage(uri);
      } catch (error) {
        capturing.current = false;
        startedRef.current = false;
        const msg = error?.message || 'Capture failed';
        console.error('[ScanBill] launchCapture:', msg);
        setLastError(msg);
        Haptics.error();
        Alert.alert('Camera', msg, [
          { text: 'OK' },
          { text: 'Home', onPress: () => goHomeDashboard() },
        ]);
      }
    },
    [clearAutoTimers, processImage, processing],
  );

  const startAutoFocusCapture = useCallback(() => {
    requireAuth({
      isAuthenticated,
      navigation,
      message: 'Sign in to scan invoices into your vault.',
      onAuthed: () => {
        if (capturing.current || processing) return;
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
          launchCapture('camera');
        }, AUTO_FOCUS_MS);
      },
    });
  }, [
    isAuthenticated,
    navigation,
    clearAutoTimers,
    progress,
    launchCapture,
    processing,
  ]);

  // Mount → arm auto-scan once (no Start button)
  useEffect(() => {
    if (startedRef.current || processing) return undefined;
    startedRef.current = true;
    const t = setTimeout(() => startAutoFocusCapture(), 350);
    return () => clearTimeout(t);
    // intentionally only on mount — avoid re-arm loops after OCR errors
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCamera = useCallback(() => {
    requireAuth({
      isAuthenticated,
      navigation,
      message: 'Sign in to scan invoices into your vault.',
      onAuthed: () => {
        clearAutoTimers();
        setAutoArmed(false);
        launchCapture('camera');
      },
    });
  }, [isAuthenticated, navigation, launchCapture, clearAutoTimers]);

  const openGallery = useCallback(() => {
    requireAuth({
      isAuthenticated,
      navigation,
      message: 'Sign in to import an invoice photo.',
      onAuthed: () => {
        Haptics.tap();
        clearAutoTimers();
        setAutoArmed(false);
        launchCapture('gallery');
      },
    });
  }, [isAuthenticated, navigation, launchCapture, clearAutoTimers]);

  const secondsLeft = Math.max(1, Math.ceil(countdownMs / 1000));
  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
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
            Hold steady for 2 seconds, or capture / import manually. Errors stay on this screen —
            you can retry or return Home safely.
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
          </View>
        </View>

        {processing ? (
          <View style={styles.processing}>
            <ActivityIndicator size="large" color={COLORS.emerald} />
            <Text style={styles.processingTitle}>{processLabel}</Text>
            <Text style={styles.processingSub}>
              Stay on this screen — we will open Review & Confirm when ready.
            </Text>
          </View>
        ) : (
          <View style={styles.actions}>
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
                title="Resume auto-capture (2s)"
                onPress={startAutoFocusCapture}
                style={styles.actionBtn}
              />
            )}
            <GlassButton
              title="Scan document now"
              onPress={openCamera}
              variant="ghost"
              style={styles.actionBtn}
            />
            <GlassButton
              title="Import from Gallery"
              onPress={openGallery}
              variant="ghost"
              style={styles.actionBtn}
            />
            <Pressable
              onPress={() => {
                Haptics.select();
                clearAutoTimers();
                navigation.navigate('MainTabs', {
                  screen: 'Assets',
                  params: { screen: 'AddAsset', params: { categoryId: 'appliance' } },
                });
              }}
              style={styles.manualWrap}
            >
              <Text style={styles.manualLink} numberOfLines={1}>
                Prefer manual entry?
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
