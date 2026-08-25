/**
 * Scan / enter Asset QR — opens exact asset without PII in the payload.
 * Camera barcode requires a future native module; code paste/entry works now.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';

import { Screen, GlassCard, GlassButton } from '../../components/ui/Glass';
import { useAssets } from '../../context/AssetProvider';
import { useThemeColors } from '../../context/ThemeProvider';
import { SPACING, TYPE, RADIUS } from '../../theme/tokens';
import { parseAssetQrPayload } from '../../services/assets/assetIdentity';
import { Haptics } from '../../services/haptics';
import { EmptyState } from '../../components/ui/DesignSystem';

export function ScanAssetQrScreen({ navigation, route }) {
  const colors = useThemeColors();
  const { assets } = useAssets();
  const [raw, setRaw] = useState('');
  const prefillAssetId = route?.params?.assetId;

  const resolved = useMemo(() => {
    const parsed = parseAssetQrPayload(raw.trim());
    if (!parsed) return null;
    const match = (assets || []).find((a) => {
      const id = a.assetId || a.id;
      const code = String(a.publicAssetId || a.assetCode || '').toUpperCase();
      if (parsed.assetId && id === parsed.assetId) return true;
      if (parsed.publicAssetId && code === String(parsed.publicAssetId).toUpperCase()) return true;
      return false;
    });
    return { parsed, match };
  }, [raw, assets]);

  const openAsset = (asset) => {
    const assetId = asset.assetId || asset.id;
    if (!assetId) return;
    Haptics.success();
    navigation.replace('AssetPassport', {
      assetId,
      fromQr: true,
    });
  };

  const onLookup = () => {
    Haptics.tap();
    if (!resolved?.parsed) {
      Alert.alert(
        'Invalid code',
        'Paste an Asset Doctor QR payload or an AST- code (e.g. AST-AC-7F29A1).',
      );
      return;
    }
    if (!resolved.match) {
      Alert.alert(
        'Asset not in vault',
        'This code is valid but no matching asset was found on this device.',
      );
      return;
    }
    openAsset(resolved.match);
  };

  const quickActions = resolved?.match
    ? [
        {
          label: 'Add Service',
          onPress: () =>
            navigation.navigate('Maintenance', {
              assetId: resolved.match.assetId || resolved.match.id,
            }),
        },
        {
          label: 'View Documents',
          onPress: () =>
            navigation.navigate('DocumentsVault', {
              assetId: resolved.match.assetId || resolved.match.id,
            }),
        },
        {
          label: 'View History',
          onPress: () =>
            navigation.navigate('Maintenance', {
              assetId: resolved.match.assetId || resolved.match.id,
            }),
        },
      ]
    : [];

  return (
    <Screen style={{ backgroundColor: colors.background }}>
      <View style={styles.pad}>
        <GlassCard>
          <Text style={[TYPE.h2, { color: colors.text }]}>Scan Asset QR</Text>
          <Text style={[TYPE.body, { color: colors.textMuted, marginTop: 8 }]}>
            Enter or paste the asset code from a QR label. Codes never include phone, email, or
            address.
          </Text>
          <TextInput
            value={raw}
            onChangeText={setRaw}
            placeholder="AST-AC-7F29A1 or QR JSON"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            style={[
              styles.input,
              {
                backgroundColor: colors.backgroundDeep,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            accessibilityLabel="Asset QR code"
          />
          <GlassButton title="Open asset" onPress={onLookup} style={{ marginTop: 12 }} />
        </GlassCard>

        {resolved?.match ? (
          <GlassCard style={{ marginTop: SPACING.md }}>
            <Text style={[TYPE.h3, { color: colors.text }]}>
              {resolved.match.nickname || resolved.match.assetName}
            </Text>
            <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 4 }]}>
              {resolved.match.publicAssetId || resolved.match.assetCode || 'Matched'}
            </Text>
            <View style={styles.actions}>
              {quickActions.map((a) => (
                <Pressable
                  key={a.label}
                  onPress={() => {
                    Haptics.tap();
                    a.onPress();
                  }}
                  style={[styles.actionBtn, { borderColor: colors.border }]}
                  accessibilityRole="button"
                  accessibilityLabel={a.label}
                >
                  <Text style={[TYPE.caption, { color: colors.primary, fontWeight: '700' }]}>
                    {a.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </GlassCard>
        ) : null}

        {!raw && !prefillAssetId ? (
          <EmptyState
            style={{ marginTop: SPACING.lg }}
            icon="⬚"
            title="Find an asset fast"
            message="QR labels use permanent AST codes. Camera scanning can be enabled in a future build with the barcode module."
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { flex: 1, padding: SPACING.lg },
  input: {
    marginTop: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: SPACING.md },
  actionBtn: {
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});

export default ScanAssetQrScreen;
