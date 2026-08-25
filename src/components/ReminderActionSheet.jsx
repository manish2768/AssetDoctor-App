/**
 * Reminder action sheet — Book Service / Set Reminder from urgent cards.
 */

import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';

import { COLORS } from '../theme/branding';
import { Haptics } from '../services/haptics';

export function ReminderActionSheet({ visible, task, onClose, onOpenAsset, onBookService, onSetReminder }) {
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>{task?.title || 'Reminder'}</Text>
          <Text style={styles.sub}>{task?.subtitle || 'Choose an action'}</Text>

          <Pressable
            style={styles.btn}
            onPress={() => {
              Haptics.tap();
              onOpenAsset?.(task);
            }}
          >
            <Text style={styles.btnText}>Open asset details</Text>
          </Pressable>
          <Pressable
            style={styles.btn}
            onPress={() => {
              Haptics.tap();
              onBookService?.(task);
            }}
          >
            <Text style={styles.btnText}>Book Service</Text>
          </Pressable>
          <Pressable
            style={[styles.btn, styles.btnPrimary]}
            onPress={() => {
              Haptics.tap();
              onSetReminder?.(task);
            }}
          >
            <Text style={styles.btnTextDark}>Set Reminder</Text>
          </Pressable>
          <Pressable onPress={onClose} style={styles.cancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: { color: COLORS.text, fontWeight: '900', fontSize: 16 },
  sub: { color: COLORS.muted, marginTop: 4, marginBottom: 14, fontSize: 12 },
  btn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    backgroundColor: COLORS.bgDeep,
  },
  btnPrimary: { backgroundColor: COLORS.emerald, borderColor: COLORS.emerald },
  btnText: { color: COLORS.text, fontWeight: '800', textAlign: 'center' },
  btnTextDark: { color: COLORS.onPrimary, fontWeight: '900', textAlign: 'center' },
  cancel: { paddingVertical: 10, alignItems: 'center' },
  cancelText: { color: COLORS.muted, fontWeight: '700' },
});

export default ReminderActionSheet;
