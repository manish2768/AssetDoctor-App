import { CONTEXTUAL_SURFACE, getContextualTint } from '../../theme/contextualBackgrounds';
/**
 * Digital Twin explorer — Home → Floors → Rooms → Assets (Phase E UI).
 * Uses DigitalTwinService + real vault assets. No fabricated energy.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../context/AuthProvider';
import { useAssets } from '../../context/AssetProvider';
import { DigitalTwinService } from '../../services/intelligence/DigitalTwinService';
import {
  attachAssetsToTwinTree,
  buildDigitalTwinTree,
  groupIdenticalAssetsByRoom,
  LOCATION_NODE_TYPE,
} from '../../services/intelligence/digitalTwinModel';
import { aggregateHomeEnergy } from '../../services/intelligence/HomeEnergyService';
import { computeExplainableHealth } from '../../services/intelligence/explainableHealth';
import { assetSupportsEnergyTracking } from '../../services/assets/assetCapabilities';
import { EmptyState, SectionHeader, StatusBadge } from '../../components/ui/DesignSystem';
import { useThemeColors } from '../../context/ThemeProvider';
import { SPACING, TYPE, RADIUS, HIT, elevation } from '../../theme/tokens';
import { Haptics } from '../../services/haptics';
import { openScanInvoice } from '../../navigation/navActions';

/** Flatten Home → Floor → Room into room nodes with optional floor label. */
function collectRooms(home) {
  const rooms = [];
  for (const child of home.children || []) {
    if (child.type === LOCATION_NODE_TYPE.ROOM) {
      rooms.push({ ...child, floorName: null });
    } else if (child.type === LOCATION_NODE_TYPE.FLOOR) {
      for (const room of child.children || []) {
        rooms.push({ ...room, floorName: child.name });
      }
      if ((child.assets || []).length) {
        rooms.push({ ...child, floorName: child.name, name: child.name || 'Floor assets' });
      }
    } else if ((child.assets || []).length || (child.children || []).length === 0) {
      rooms.push({ ...child, floorName: null });
    } else {
      for (const nested of child.children || []) {
        rooms.push({ ...nested, floorName: child.name });
      }
    }
  }
  return rooms;
}

export function DigitalTwinScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { user, isAuthenticated } = useAuth();
  const { assets } = useAssets();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.uid) {
      setLocations([]);
      setLoading(false);
      return;
    }
    try {
      const list = await DigitalTwinService.listLocations(user.uid);
      setLocations(Array.isArray(list) ? list : list?.locations || []);
    } catch {
      setLocations([]);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    setLoading(true);
    load().catch(() => setLoading(false));
  }, [load]);

  const twin = useMemo(() => {
    const tree = buildDigitalTwinTree(locations);
    return attachAssetsToTwinTree(tree, assets || []);
  }, [locations, assets]);

  const energyEligible = useMemo(
    () => (assets || []).filter((a) => a && !a.deletedAt && assetSupportsEnergyTracking(a)),
    [assets],
  );
  const energy = useMemo(() => aggregateHomeEnergy(energyEligible, {}), [energyEligible]);
  const duplicates = useMemo(() => groupIdenticalAssetsByRoom(assets || []), [assets]);

  const homes = twin.homes || [];
  const orphanAssets = useMemo(() => {
    const placed = new Set();
    for (const home of homes) {
      for (const room of collectRooms(home)) {
        for (const leaf of room.assets || []) {
          if (leaf.assetId) placed.add(leaf.assetId);
        }
      }
    }
    return (assets || []).filter((a) => {
      if (!a || a.deletedAt) return false;
      const id = a.assetId || a.id;
      if (placed.has(id)) return false;
      return !!(a.locationLabel || a.locationPath || a.roomName);
    });
  }, [homes, assets]);

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.tap();
    await load();
    setRefreshing(false);
  };

  if (!isAuthenticated) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, padding: SPACING.lg }]}>
        <EmptyState
          icon="🏠"
          title="Sign in to view your home twin"
          message="Rooms and placed assets sync with your vault after login."
          ctaLabel="Go home"
          onCta={() => navigation?.navigate?.('Dashboard')}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        padding: SPACING.lg,
        paddingTop: Math.max(insets.top, 12) + 8,
        paddingBottom: Math.max(insets.bottom, 16) + 40,
      }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      accessibilityLabel="Home digital twin"
    >
      <Text style={[TYPE.h2, { color: colors.text }]}>Home Digital Twin</Text>
      <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 4 }]}>
        Home → Floors → Rooms → Assets. Counts and energy only when real data exists.
      </Text>

      {energy.assetsWithEnergy > 0 ? (
        <View
          style={[
            styles.summary,
            { backgroundColor: colors.surface, borderColor: colors.border },
            elevation(1, colors.shadow),
          ]}
        >
          <Text style={[TYPE.bodyStrong, { color: colors.text }]}>Energy snapshot</Text>
          <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 4 }]}>
            ~{energy.estimatedMonthlyConsumptionKWh} kWh · ~
            {Math.round(energy.estimatedMonthlyCost)} ₹/mo · {energy.assetsWithEnergy} asset(s)
            with usage data
          </Text>
        </View>
      ) : null}

      {duplicates.length ? (
        <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 10 }]}>
          {duplicates.length} product name(s) appear in multiple rooms — distinguished by room
          labels.
        </Text>
      ) : null}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      ) : !homes.length && !orphanAssets.length ? (
        <EmptyState
          style={{ marginTop: 16 }}
          icon="🛋️"
          title="No rooms yet"
          message="Place assets with a room or location label to build your twin. You can still browse the vault."
          ctaLabel="Scan a bill"
          onCta={() => openScanInvoice()}
        />
      ) : (
        <>
          {homes.map((home) => {
            const rooms = collectRooms(home);
            return (
              <View key={home.locationId || home.name} style={{ marginTop: 16 }}>
                <SectionHeader
                  title={home.name || 'Home'}
                  subtitle={`${rooms.length} room${rooms.length === 1 ? '' : 's'}`}
                />
                {rooms.length === 0 ? (
                  <Text style={[TYPE.caption, { color: colors.textMuted }]}>
                    No rooms under this home.
                  </Text>
                ) : (
                  rooms.map((room) => {
                    const roomAssets = room.assets || [];
                    const roomEnergy = (energy.byRoom || []).find(
                      (r) => String(r.roomId) === String(room.locationId),
                    );
                    const title = [room.floorName, room.name || 'Room'].filter(Boolean).join(' · ');
                    return (
                      <View
                        key={room.locationId || title}
                        style={[
                          styles.room,
                          { backgroundColor: colors.surface, borderColor: colors.border },
                        ]}
                      >
                        <View style={styles.roomHead}>
                          <Text
                            style={[TYPE.bodyStrong, { color: colors.text, flex: 1 }]}
                            numberOfLines={1}
                          >
                            {title}
                          </Text>
                          <StatusBadge
                            label={`${roomAssets.length} asset${roomAssets.length === 1 ? '' : 's'}`}
                            tone="info"
                          />
                        </View>
                        {roomEnergy?.monthlyKWh ? (
                          <Text style={[TYPE.micro, { color: colors.textMuted, marginTop: 4 }]}>
                            ~{roomEnergy.monthlyKWh} kWh/mo (from entered usage)
                          </Text>
                        ) : null}
                        {roomAssets.length === 0 ? (
                          <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 8 }]}>
                            Empty room
                          </Text>
                        ) : (
                          roomAssets.map((leaf) => {
                            const full = (assets || []).find(
                              (a) => (a.assetId || a.id) === leaf.assetId,
                            );
                            let healthLabel = null;
                            try {
                              if (full) {
                                const h = computeExplainableHealth(full);
                                healthLabel = `${h.score}`;
                              }
                            } catch {
                              /* ignore */
                            }
                            return (
                              <Pressable
                                key={leaf.assetId}
                                style={styles.assetRow}
                                onPress={() => {
                                  Haptics.tap();
                                  navigation?.navigate?.('AssetPassport', {
                                    assetId: leaf.assetId,
                                  });
                                }}
                                accessibilityRole="button"
                                accessibilityLabel={leaf.displayName}
                              >
                                <View style={{ flex: 1, minWidth: 0 }}>
                                  <Text
                                    style={[
                                      TYPE.caption,
                                      { color: colors.text, fontWeight: '700' },
                                    ]}
                                    numberOfLines={1}
                                  >
                                    {leaf.displayName}
                                  </Text>
                                  {leaf.locationLabel ? (
                                    <Text
                                      style={[TYPE.micro, { color: colors.textMuted }]}
                                      numberOfLines={1}
                                    >
                                      {leaf.locationLabel}
                                    </Text>
                                  ) : null}
                                </View>
                                {healthLabel ? (
                                  <StatusBadge label={`Health ${healthLabel}`} tone="success" />
                                ) : null}
                              </Pressable>
                            );
                          })
                        )}
                      </View>
                    );
                  })
                )}
              </View>
            );
          })}

          {orphanAssets.length ? (
            <View style={{ marginTop: 20 }}>
              <SectionHeader
                title="Located assets"
                subtitle="Have a room label but not linked to a twin room yet"
              />
              {orphanAssets.map((a) => (
                <Pressable
                  key={a.assetId || a.id}
                  style={[
                    styles.room,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                  onPress={() => {
                    Haptics.tap();
                    navigation?.navigate?.('AssetPassport', { assetId: a.assetId || a.id });
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={a.assetName || a.nickname}
                >
                  <Text style={[TYPE.bodyStrong, { color: colors.text }]} numberOfLines={1}>
                    {a.nickname || a.customAssetName || a.assetName || 'Asset'}
                  </Text>
                  <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 4 }]} numberOfLines={1}>
                    {a.locationLabel || a.locationPath || a.roomName}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

export default DigitalTwinScreen;

const styles = StyleSheet.create({
  root: { flex: 1 },
  summary: {
    marginTop: 14,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  room: {
    marginTop: 10,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  roomHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  assetRow: {
    marginTop: 10,
    paddingVertical: 8,
    minHeight: HIT.min,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(100,116,139,0.2)',
  },
});
