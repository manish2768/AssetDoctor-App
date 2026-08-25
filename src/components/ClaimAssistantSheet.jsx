/**
 * AI Claim Assistant — bottom sheet chat powered by Gemini 1.5 Flash.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { COLORS } from '../theme/branding';
import { Haptics } from '../services/haptics';
import { claimAssistantReply } from '../services/gemini/geminiService';
import { resolveSupportContact } from '../constants/brandDirectory';

export function ClaimAssistantSheet({ visible, asset, onClose }) {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!visible) return;
    const support = resolveSupportContact(asset);
    const intro = support?.phone
      ? `I can help claim warranty/repair for ${asset?.assetName || 'this asset'}. Official line on file: ${support.label} ${support.phone}. What happened?`
      : `I can walk you through a warranty / repair claim for ${asset?.assetName || 'this asset'}. Describe the issue.`;
    setMessages([{ role: 'assistant', text: intro }]);
    setInput('');
  }, [visible, asset?.assetId, asset?.assetName]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    Haptics.tap();
    const nextHistory = [...messages, { role: 'user', text }];
    setMessages(nextHistory);
    setInput('');
    setBusy(true);
    const result = await claimAssistantReply({
      asset,
      userMessage: text,
      history: nextHistory,
    });
    setBusy(false);
    setMessages((prev) => [
      ...prev,
      { role: 'assistant', text: result.reply || result.error || 'Try again.' },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.dim} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>🛠️ How to Claim Warranty / Repair?</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {asset?.assetName || 'Asset'} · AI coach
          </Text>

          <ScrollView style={styles.chat} contentContainerStyle={{ paddingBottom: 12 }}>
            {messages.map((m, idx) => (
              <View
                key={`${m.role}-${idx}`}
                style={[styles.bubble, m.role === 'user' ? styles.userBubble : styles.aiBubble]}
              >
                <Text style={styles.bubbleText}>{m.text}</Text>
              </View>
            ))}
            {busy ? <ActivityIndicator color={COLORS.emerald} style={{ marginTop: 8 }} /> : null}
          </ScrollView>

          <View style={styles.composer}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="e.g. Screen flicker under warranty"
              placeholderTextColor={COLORS.muted}
              editable={!busy}
            />
            <Pressable style={styles.send} onPress={send} disabled={busy}>
              <Text style={styles.sendText}>Send</Text>
            </Pressable>
          </View>

          <Pressable onPress={onClose} style={styles.close}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  dim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.35)' },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 20,
    maxHeight: '78%',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 99,
    backgroundColor: COLORS.border,
    marginBottom: 10,
  },
  title: { color: COLORS.text, fontWeight: '900', fontSize: 16 },
  sub: { color: COLORS.muted, marginTop: 4, marginBottom: 10, fontSize: 12 },
  chat: { flexGrow: 0, maxHeight: 320 },
  bubble: {
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
    maxWidth: '92%',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.successSoft,
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.bgDeep,
  },
  bubbleText: { color: COLORS.text, fontSize: 13, lineHeight: 19 },
  composer: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 6 },
  input: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.text,
    backgroundColor: COLORS.bgDeep,
  },
  send: {
    backgroundColor: COLORS.emerald,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sendText: { color: COLORS.onPrimary, fontWeight: '800' },
  close: { alignItems: 'center', marginTop: 10, padding: 8 },
  closeText: { color: COLORS.muted, fontWeight: '700' },
});

export default ClaimAssistantSheet;
