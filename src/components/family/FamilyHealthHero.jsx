/**
 * Asset Doctor — Family Health Hero
 * 
 * Displays aggregate family asset health, active shared assets, total documents,
 * and pending attention items.
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../../theme/branding';

export function FamilyHealthHero({
  vaultName = 'Family Vault',
  memberCount = 0,
  assetCount = 0,
  documentCount = 0,
  attentionItems = [],
  sharedAssets = [],
}) {
  // Compute aggregate health score across shared assets
  const averageHealth = useMemo(() => {
    if (!sharedAssets || sharedAssets.length === 0) return 95;
    const total = sharedAssets.reduce((sum, a) => sum + (Number(a.healthScore) || 90), 0);
    return Math.round(total / sharedAssets.length);
  }, [sharedAssets]);

  const healthGrade = averageHealth >= 85 ? 'GOOD' : averageHealth >= 70 ? 'FAIR' : 'NEEDS ATTENTION';
  const healthColor = averageHealth >= 85 ? '#14B8A6' : averageHealth >= 70 ? '#F59E0B' : '#EF4444';

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.vaultTitle}>{vaultName.toUpperCase()}</Text>
          <Text style={styles.subtitle}>Family Asset Intelligence</Text>
        </View>
        <View style={[styles.scoreBadge, { borderColor: healthColor }]}>
          <Text style={[styles.scoreNum, { color: healthColor }]}>{averageHealth}</Text>
          <Text style={styles.scoreMax}>/100</Text>
        </View>
      </View>

      {/* Metric Counters Grid */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{memberCount}</Text>
          <Text style={styles.statLabel}>Members</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{assetCount}</Text>
          <Text style={styles.statLabel}>Shared Assets</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{documentCount}</Text>
          <Text style={styles.statLabel}>Documents</Text>
        </View>
      </View>

      {/* Attention banner if any items are due */}
      {attentionItems.length > 0 ? (
        <View style={styles.attentionBanner}>
          <Text style={styles.alertIcon}>⚠️</Text>
          <View style={styles.alertTextContainer}>
            <Text style={styles.alertHeading}>{attentionItems.length} Items Need Attention</Text>
            <Text style={styles.alertDetail} numberOfLines={1}>
              {attentionItems[0]}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.healthyBanner}>
          <Text style={styles.healthyIcon}>🛡️</Text>
          <Text style={styles.healthyText}>All family assets protected & up to date</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  vaultTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderWidth: 1.5,
  },
  scoreNum: {
    fontSize: 20,
    fontWeight: '900',
  },
  scoreMax: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '700',
    marginLeft: 2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#334155',
  },
  attentionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  alertIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  alertTextContainer: {
    flex: 1,
  },
  alertHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FBBF24',
  },
  alertDetail: {
    fontSize: 11,
    color: '#FDE68A',
    marginTop: 1,
  },
  healthyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 184, 166, 0.1)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(20, 184, 166, 0.2)',
  },
  healthyIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  healthyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2DD4BF',
  },
});

export default FamilyHealthHero;
