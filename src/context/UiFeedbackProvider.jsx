/**
 * Mobile UI feedback — ConfirmDialog + lightweight toast.
 * Replaces unnecessary Alert.alert for confirmations and info messages.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConfirmDialog } from '../components/ConfirmDialog';
import { useThemeColors } from './ThemeProvider';
import { RADIUS, SPACING, TYPE } from '../theme/tokens';
import { bindUiFeedbackBridge } from './uiFeedbackBridge';
import { TOAST_ABOVE_NAV_PX } from '../theme/tabMetrics';

const UiFeedbackContext = createContext(null);

export function UiFeedbackProvider({ children }) {
  const [confirmState, setConfirmState] = useState(null);
  const [toast, setToast] = useState(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef(null);

  const hideToast = useCallback(() => {
    Animated.timing(toastOpacity, {
      toValue: 0,
      duration: 160,
      useNativeDriver: true,
    }).start(() => setToast(null));
  }, [toastOpacity]);

  const showToast = useCallback(
    (message, tone = 'info') => {
      if (!message) return;
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToast({ message: String(message), tone });
      toastOpacity.setValue(0);
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
      toastTimer.current = setTimeout(hideToast, 2800);
    },
    [hideToast, toastOpacity],
  );

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      setConfirmState({
        title: options?.title || 'Confirm',
        message: options?.message || '',
        confirmLabel: options?.confirmLabel || 'Confirm',
        cancelLabel: options?.cancelLabel || 'Cancel',
        tone: options?.destructive || options?.tone === 'danger' ? 'danger' : options?.tone || 'primary',
        requireReason: !!options?.requireReason,
        resolve,
      });
    });
  }, []);

  const info = useCallback(
    (title, message) => {
      const text = message ? `${title}: ${message}` : title;
      showToast(text, 'info');
    },
    [showToast],
  );

  const success = useCallback(
    (message) => showToast(message, 'success'),
    [showToast],
  );

  const error = useCallback(
    (title, message) => {
      const text = message ? `${title}: ${message}` : title;
      showToast(text, 'error');
    },
    [showToast],
  );

  const value = useMemo(
    () => ({ confirm, info, success, error, showToast }),
    [confirm, info, success, error, showToast],
  );

  React.useEffect(() => {
    bindUiFeedbackBridge(value);
    return () => bindUiFeedbackBridge(null);
  }, [value]);

  return (
    <UiFeedbackContext.Provider value={value}>
      {children}
      <ConfirmDialog
        visible={!!confirmState}
        title={confirmState?.title}
        message={confirmState?.message}
        confirmLabel={confirmState?.confirmLabel}
        cancelLabel={confirmState?.cancelLabel}
        tone={confirmState?.tone}
        requireReason={confirmState?.requireReason}
        onCancel={() => {
          confirmState?.resolve?.(false);
          setConfirmState(null);
        }}
        onConfirm={() => {
          confirmState?.resolve?.(true);
          setConfirmState(null);
        }}
      />
      <ToastHost toast={toast} opacity={toastOpacity} />
    </UiFeedbackContext.Provider>
  );
}

function ToastHost({ toast, opacity }) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  if (!toast) return null;
  const bg =
    toast.tone === 'error'
      ? colors.error
      : toast.tone === 'success'
        ? colors.success
        : colors.text;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toastWrap,
        {
          opacity,
          bottom: Math.max(insets.bottom, 12) + TOAST_ABOVE_NAV_PX,
        },
      ]}
      accessibilityLiveRegion="polite"
    >
      <View style={[styles.toast, { backgroundColor: bg }]}>
        <Text style={[TYPE.caption, { color: '#fff', fontWeight: '700' }]} numberOfLines={3}>
          {toast.message}
        </Text>
      </View>
    </Animated.View>
  );
}

export function useUiFeedback() {
  const ctx = useContext(UiFeedbackContext);
  if (!ctx) {
    return {
      confirm: async () => false,
      info: () => {},
      success: () => {},
      error: () => {},
      showToast: () => {},
    };
  }
  return ctx;
}

const styles = StyleSheet.create({
  toastWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 20,
  },
  toast: {
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
});

export default UiFeedbackProvider;
