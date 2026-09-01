import React, { useMemo, useState, useRef } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, ScrollView, Switch } from 'react-native';
import * as Sharing from 'expo-sharing';

import { useThemeColors } from '../../context/ThemeProvider';
import { TYPE, SPACING, RADIUS, HIT } from '../../theme/tokens';
import { Haptics } from '../../services/haptics';
import {
  PASSPORT_SHARE_FIELDS,
  defaultShareSelection,
  buildPassportSharePreview,
} from '../../trust/protectionStatus';
import { RidePassportRenderer } from '../passport/RidePassportRenderer';

export function SharePassportSheet({ visible, onClose, asset, ui }) {
  const colors = useThemeColors();
  const passportRef = useRef(null);
  const [selected, setSelected] = useState(defaultShareSelection);
  const preview = useMemo(() => buildPassportSharePreview(asset || {}, selected), [asset, selected]);

  const onShare = async () => {
    Haptics.tap();
    try {
      if (passportRef.current && typeof passportRef.current.capture === 'function') {
        const uri = await passportRef.current.capture();
        if (uri && (await Sharing.isAvailableAsync())) {
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: `Share ${asset?.model || asset?.assetName || 'Vehicle'} Ride Passport`,
            UTI: 'public.png',
          });
          onClose?.();
          return;
        }
      }
    } catch (err) {
      console.warn('[SharePassportSheet] Image capture fallback to text:', err?.message || err);
    }

    // Text fallback
    const lines = preview.lines.map((l) => `${l.label}: ${l.value}`);
    const message = [
      'ASSET DOCTOR — RIDE PASSPORT',
      ...lines,
      '',
      'Shared from Asset Doctor.',
    ].join('\n');
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(message);
      }
      onClose?.();
    } catch {
      // cancelled
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[TYPE.h2, { color: colors.text }]}>Share Asset Passport</Text>
          <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 4 }]}>
            Private by default. Preview before sharing. No public URL is created.
          </Text>

          <ScrollView style={{ maxHeight: 360, marginTop: SPACING.md }}>
            {PASSPORT_SHARE_FIELDS.map((field) => (
              <View key={field.id} style={styles.row}>
                <Text style={[TYPE.body, { color: colors.text, flex: 1 }]}>{field.label}</Text>
                <Switch
                  value={!!selected[field.id]}
                  onValueChange={(v) => {
                    Haptics.select();
                    setSelected((prev) => ({ ...prev, [field.id]: v }));
                  }}
                  accessibilityLabel={field.label}
                />
              </View>
            ))}

            <Text style={[TYPE.label, { color: colors.textMuted, marginTop: SPACING.md, marginBottom: 8 }]}>PASSPORT IMAGE PREVIEW</Text>
            <View style={{ alignItems: 'center', marginVertical: 8 }}>
              <RidePassportRenderer
                ref={passportRef}
                asset={asset}
                options={{
                  maskRegistration: !selected.registrationNumber,
                  maskSpend: !selected.totalSpend,
                }}
              />
            </View>
            {preview.warnings.map((w) => (
              <Text key={w} style={[TYPE.caption, { color: colors.warning || '#F59E0B', marginTop: 4 }]}>
                {w}
              </Text>
            ))}
            <Text style={[TYPE.micro, { color: colors.textMuted, marginTop: SPACING.sm }]}>
              {preview.backendNote}
            </Text>
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              style={[styles.btn, { borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={[TYPE.caption, { color: colors.text }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onShare}
              style={[styles.btn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
              accessibilityRole="button"
              accessibilityLabel="Share preview"
            >
              <Text style={[TYPE.caption, { color: '#07111F', fontWeight: '800' }]}>Share preview</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5,10,15,0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: HIT.min,
    paddingVertical: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: SPACING.md,
  },
  btn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    minHeight: HIT.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default SharePassportSheet;
