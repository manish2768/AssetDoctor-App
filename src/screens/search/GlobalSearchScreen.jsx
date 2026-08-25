/**
 * Global search — assets, documents metadata, service cues, providers.
 * Respects in-memory vault only (no cross-user data).
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAssets } from '../../context/AssetProvider';
import { useAuth } from '../../context/AuthProvider';
import { useThemeColors } from '../../context/ThemeProvider';
import { EmptyState, FilterChip } from '../../components/ui/DesignSystem';
import { SPACING, TYPE, RADIUS, HIT } from '../../theme/tokens';
import { Haptics } from '../../services/haptics';
import { cleanAssetDisplayName } from '../../utils/displayAssetName';

const SCOPES = [
  { id: 'all', label: 'All' },
  { id: 'assets', label: 'Assets' },
  { id: 'documents', label: 'Documents' },
  { id: 'service', label: 'Service' },
  { id: 'providers', label: 'Providers' },
];

function scoreMatch(hay, q) {
  const h = String(hay || '').toLowerCase();
  if (!q) return 0;
  if (h === q) return 100;
  if (h.startsWith(q)) return 80;
  if (h.includes(q)) return 50;
  return 0;
}

export function GlobalSearchScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { assets } = useAssets();
  const { isAuthenticated } = useAuth();
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('all');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    const rows = [];

    for (const asset of assets || []) {
      if (asset.deletedAt) continue;
      const name = cleanAssetDisplayName(asset.assetName || asset.nickname, {
        registration: asset.registration,
      });
      const nick = asset.nickname || '';
      const loc = asset.locationPath || asset.locationLabel || '';
      const brand = asset.brandName || '';
      const cat = asset.categoryLabel || asset.category || '';
      const reg = asset.registration || '';
      const serial = asset.serialNumber || '';
      const provider = asset.preferredVendor || asset.storeName || '';
      const blob = `${name} ${nick} ${loc} ${brand} ${cat} ${reg} ${serial} ${provider} ${asset.publicAssetId || ''}`;
      const assetScore = scoreMatch(blob, q);
      if (assetScore && (scope === 'all' || scope === 'assets')) {
        rows.push({
          id: `asset-${asset.assetId || asset.id}`,
          kind: 'asset',
          title: nick || name || 'Asset',
          subtitle: [cat, loc].filter(Boolean).join(' · ') || 'Asset',
          score: assetScore,
          assetId: asset.assetId || asset.id,
        });
      }

      if (scope === 'all' || scope === 'documents') {
        const docs = asset.documents || asset.documentMeta || [];
        const docList = Array.isArray(docs) ? docs : [];
        for (const doc of docList) {
          const dtype = doc.type || doc.documentType || 'document';
          const dblob = `${dtype} ${doc.label || ''} ${name} ${nick}`;
          if (scoreMatch(dblob, q)) {
            rows.push({
              id: `doc-${asset.assetId}-${doc.id || dtype}`,
              kind: 'document',
              title: doc.label || String(dtype).toUpperCase(),
              subtitle: nick || name,
              score: 40,
              assetId: asset.assetId || asset.id,
            });
          }
        }
        // Field-level document cues
        ['insurance', 'puc', 'warranty', 'rc'].forEach((key) => {
          if (asset[`${key}Expiry`] || asset[key]) {
            const label = key.toUpperCase();
            if (scoreMatch(`${label} ${name} ${nick} ${loc}`, q)) {
              rows.push({
                id: `field-${asset.assetId}-${key}`,
                kind: 'document',
                title: label,
                subtitle: nick || name,
                score: 35,
                assetId: asset.assetId || asset.id,
              });
            }
          }
        });
      }

      if ((scope === 'all' || scope === 'service') && asset.nextServiceDue) {
        if (scoreMatch(`service ${name} ${nick} ${loc}`, q)) {
          rows.push({
            id: `svc-${asset.assetId}`,
            kind: 'service',
            title: 'Service due',
            subtitle: `${nick || name} · ${String(asset.nextServiceDue).slice(0, 10)}`,
            score: 45,
            assetId: asset.assetId || asset.id,
            screen: 'Maintenance',
          });
        }
      }

      if ((scope === 'all' || scope === 'providers') && provider) {
        if (scoreMatch(provider, q)) {
          rows.push({
            id: `prov-${asset.assetId}-${provider}`,
            kind: 'provider',
            title: provider,
            subtitle: nick || name,
            score: 55,
            assetId: asset.assetId || asset.id,
          });
        }
      }
    }

    rows.sort((a, b) => b.score - a.score);
    // Dedupe by id
    const seen = new Set();
    return rows.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    }).slice(0, 40);
  }, [assets, query, scope]);

  const openRow = (row) => {
    Haptics.tap();
    if (!row.assetId) return;
    if (row.screen === 'Maintenance') {
      navigation.navigate('Maintenance', { assetId: row.assetId });
      return;
    }
    if (row.kind === 'document') {
      navigation.navigate('DocumentsVault', { assetId: row.assetId });
      return;
    }
    navigation.navigate('AssetPassport', { assetId: row.assetId });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search assets, documents, service…"
          placeholderTextColor={colors.textMuted}
          style={[
            styles.input,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              color: colors.text,
            },
          ]}
          autoFocus
          returnKeyType="search"
          accessibilityLabel="Global search"
        />
        <Pressable
          onPress={() => navigation.goBack()}
          style={{ minHeight: HIT.min, justifyContent: 'center', paddingHorizontal: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Close search"
        >
          <Text style={[TYPE.bodyStrong, { color: colors.primary }]}>Close</Text>
        </Pressable>
      </View>

      <View style={styles.chips}>
        {SCOPES.map((s) => (
          <FilterChip
            key={s.id}
            label={s.label}
            selected={scope === s.id}
            onPress={() => setScope(s.id)}
          />
        ))}
      </View>

      {!isAuthenticated ? (
        <Text style={[TYPE.caption, { color: colors.textMuted, paddingHorizontal: SPACING.md }]}>
          Showing vault on this device. Sign in to sync shared household data.
        </Text>
      ) : null}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: SPACING.md, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <EmptyState
            icon="🔎"
            title={query.trim().length < 2 ? 'Search your vault' : 'No matches'}
            message={
              query.trim().length < 2
                ? 'Try a room name, asset nickname, registration, or provider.'
                : 'Try another keyword or clear filters.'
            }
          />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openRow(item)}
            style={[
              styles.row,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${item.kind}: ${item.title}`}
          >
            <View style={[styles.kind, { backgroundColor: colors.infoSoft }]}>
              <Text style={[TYPE.micro, { color: colors.info }]}>{item.kind}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[TYPE.bodyStrong, { color: colors.text }]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={[TYPE.caption, { color: colors.textMuted }]} numberOfLines={1}>
                {item.subtitle}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: HIT.min,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: 8,
    minHeight: HIT.min,
  },
  kind: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
});

export default GlobalSearchScreen;
