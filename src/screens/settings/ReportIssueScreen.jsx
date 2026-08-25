/**
 * Report Issue / Feedback — email, WhatsApp, optional Firestore queue
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Linking,
  Platform,
  Share,
} from 'react-native';
import Constants from 'expo-constants';

import { useAuth } from '../../context/AuthProvider';
import { Screen, GlassCard, GlassButton } from '../../components/ui/Glass';
import { BRAND, COLORS, SPACING } from '../../theme/branding';
import { Haptics } from '../../services/haptics';
import { FeedbackService } from '../../services/feedback/FeedbackService';
import { buildDeviceDiagnostics } from '../../services/diagnostics/DeviceDiagnostics';
import { CrashlyticsService } from '../../services/crashlytics/CrashlyticsService';
import { useTabSafeBottomPadding } from '../../utils/tabSafePadding';
import { useUiFeedback } from '../../context/UiFeedbackProvider';

const CATEGORIES = [
  { id: 'crash', label: 'App crash', emoji: '💥' },
  { id: 'bug', label: 'Bug / glitch', emoji: '🐛' },
  { id: 'scan', label: 'Scan / camera', emoji: '📷' },
  { id: 'login', label: 'Login / account', emoji: '🔑' },
  { id: 'idea', label: 'Feature idea', emoji: '💡' },
  { id: 'other', label: 'Other feedback', emoji: '💬' },
];

function buildDeviceBlock(user, profile) {
  return buildDeviceDiagnostics({ user, profile });
}

export function ReportIssueScreen({ route, navigation }) {
  const ui = useUiFeedback();
  const { user, profile, isAuthenticated } = useAuth();
  const bottomPad = useTabSafeBottomPadding({ extra: 24 });
  const preset = route?.params?.category || 'bug';
  const presetMessage = route?.params?.message || '';

  const [category, setCategory] = useState(preset);
  const [message, setMessage] = useState(presetMessage);
  const [contact, setContact] = useState(user?.email || profile?.phone || '');
  const [busy, setBusy] = useState(false);

  const deviceBlock = useMemo(
    () => buildDeviceBlock(user, profile),
    [user, profile],
  );

  const composeBody = () => {
    const cat = CATEGORIES.find((c) => c.id === category);
    return [
      `Category: ${cat?.emoji || ''} ${cat?.label || category}`,
      '',
      message.trim() || '(No details written)',
      '',
      '---',
      `Contact: ${contact.trim() || 'not provided'}`,
      `User: ${isAuthenticated ? user?.uid || profile?.email || 'signed-in' : 'guest'}`,
      deviceBlock,
      `Creator: ${BRAND.creatorCredit}`,
    ].join('\n');
  };

  const onEmail = async () => {
    if (!message.trim()) {
      ui.info('Report issue', 'Please write what went wrong (or your idea).');
      return;
    }
    Haptics.tap();
    setBusy(true);
    const subject = encodeURIComponent(
      `[Asset Doctor] ${CATEGORIES.find((c) => c.id === category)?.label || 'Report Error'}`,
    );
    const body = encodeURIComponent(composeBody());
    const url = `mailto:${BRAND.supportEmail}?subject=${subject}&body=${body}`;
    try {
      await FeedbackService.saveLocalDraft({ category, message, contact });
      CrashlyticsService.log?.(`Report Error: ${category} — ${message.slice(0, 120)}`);
      const can = await Linking.canOpenURL(url);
      if (can) await Linking.openURL(url);
      else await Share.share({ message: composeBody(), title: 'Asset Doctor Report Error' });
      Haptics.success();
    } catch (e) {
      ui.error('Email', e?.message || 'Could not open email app');
    } finally {
      setBusy(false);
    }
  };

  const onWhatsApp = async () => {
    if (!message.trim()) {
      ui.info('Report issue', 'Please write what went wrong (or your idea).');
      return;
    }
    Haptics.tap();
    setBusy(true);
    try {
      await FeedbackService.saveLocalDraft({ category, message, contact });
      const result = await FeedbackService.sendWhatsApp({
        phone: BRAND.supportWhatsApp,
        text: composeBody(),
      });
      if (!result.success) {
        ui.error('WhatsApp', result.error || 'Could not open WhatsApp');
      } else {
        Haptics.success();
      }
    } finally {
      setBusy(false);
    }
  };

  const onSaveCloud = async () => {
    if (!message.trim()) {
      ui.info('Report issue', 'Please write what went wrong (or your idea).');
      return;
    }
    if (!isAuthenticated || !user?.uid) {
      ui.info(
        'Sign in for cloud submit',
        'Guests can still send feedback by Email or WhatsApp. Sign in to save a protected cloud report.',
      );
      return;
    }
    Haptics.tap();
    setBusy(true);
    const result = await FeedbackService.submitToCloud({
      category,
      message: message.trim(),
      contact: contact.trim(),
      uid: user?.uid || null,
      device: deviceBlock,
    });
    setBusy(false);
    if (!result.success) {
      ui.info(
        'Saved offline',
        result.error ||
          'Could not reach cloud. Use Email or WhatsApp — your message is still ready to send.',
      );
      return;
    }
    Haptics.success();
    ui.success('Your report was sent to the Asset Doctor team.');
    navigation?.goBack?.();
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
        keyboardShouldPersistTaps="handled"
      >        <Text style={styles.title}>Report an issue</Text>
        <Text style={styles.sub}>
          Crash, bug, or idea — tell us. Your feedback helps Ashutosh make Asset Doctor better.
        </Text>

        <GlassCard glow style={{ marginTop: 12 }}>
          <Text style={styles.label}>What is this about?</Text>
          <View style={styles.chips}>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => {
                  Haptics.select();
                  setCategory(c.id);
                }}
                style={[styles.chip, category === c.id && styles.chipOn]}
              >
                <Text style={[styles.chipText, category === c.id && styles.chipTextOn]}>
                  {c.emoji} {c.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.label, { marginTop: 12 }]}>Describe the problem</Text>
          <TextInput
            style={styles.area}
            value={message}
            onChangeText={setMessage}
            placeholder="What happened? What were you trying to do?"
            placeholderTextColor={COLORS.muted}
            multiline
            textAlignVertical="top"
          />

          <Text style={[styles.label, { marginTop: 12 }]}>Your email / phone (optional)</Text>
          <TextInput
            style={styles.input}
            value={contact}
            onChangeText={setContact}
            placeholder="So we can reply"
            placeholderTextColor={COLORS.muted}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.device}>{deviceBlock}</Text>
        </GlassCard>

        <GlassButton
          title="📧 Report Error via Email"
          style={{ marginTop: 14 }}
          loading={busy}
          onPress={onEmail}
        />
        <GlassButton
          title="💬 Send via WhatsApp"
          style={{ marginTop: 10, backgroundColor: '#128C7E' }}
          loading={busy}
          onPress={onWhatsApp}
        />
        <GlassButton
          title={isAuthenticated ? '☁️ Submit to Asset Doctor cloud' : '🔒 Sign in for cloud submit'}
          variant="ghost"
          style={{ marginTop: 10 }}
          loading={busy}
          onPress={onSaveCloud}
        />

        <Text style={styles.help}>
          Support: {BRAND.supportEmail}
          {BRAND.supportWhatsApp ? `\nWhatsApp: +${BRAND.supportWhatsApp}` : ''}
        </Text>
      </ScrollView>
    </Screen>
  );
}

export default ReportIssueScreen;

const styles = StyleSheet.create({
  content: { padding: SPACING.lg },
  title: { color: COLORS.text, fontSize: 24, fontWeight: '900' },
  sub: { color: COLORS.muted, fontSize: 13, marginTop: 8, lineHeight: 19 },
  label: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  chipOn: {
    borderColor: COLORS.emerald,
    backgroundColor: 'rgba(0,245,160,0.12)',
  },
  chipText: { color: COLORS.muted, fontSize: 12, fontWeight: '700' },
  chipTextOn: { color: COLORS.emerald },
  area: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
    color: COLORS.text,
    backgroundColor: 'rgba(255,255,255,0.04)',
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: COLORS.text,
    backgroundColor: 'rgba(255,255,255,0.04)',
    fontSize: 14,
  },
  device: {
    marginTop: 12,
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 16,
  },
  help: {
    marginTop: 16,
    textAlign: 'center',
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 18,
  },
});
