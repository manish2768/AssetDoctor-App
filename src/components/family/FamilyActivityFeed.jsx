/**
 * Asset Doctor — Family Activity Feed
 * 
 * Displays recent family actions (e.g. "Priya added Honda City insurance", "Manish logged fuel for Ronin").
 */

import React from 'react';
import { StyleSheet, Text, View, FlatList } from 'react-native';
import { COLORS } from '../../theme/branding';

function formatTimeAgo(timestamp) {
  if (!timestamp) return 'Recently';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function getActionIcon(action) {
  switch (action) {
    case 'FUEL_LOGGED':
      return '⛽';
    case 'DOC_UPLOADED':
      return '📄';
    case 'SERVICE_COMPLETED':
      return '🔧';
    case 'ASSET_ADDED':
      return '✨';
    case 'MEMBER_JOINED':
      return '👋';
    default:
      return '🛡️';
  }
}

export function FamilyActivityFeed({ activities = [] }) {
  if (!activities || activities.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No recent activity</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {activities.slice(0, 10).map((item) => {
        const icon = getActionIcon(item.action);
        const timeAgo = formatTimeAgo(item.timestamp);
        return (
          <View key={item.id || item.activityId} style={styles.activityRow}>
            <View style={styles.iconCircle}>
              <Text style={styles.icon}>{icon}</Text>
            </View>
            <View style={styles.content}>
              <Text style={styles.detailsText} numberOfLines={2}>
                <Text style={styles.actorName}>{item.actorName || 'Family Member'} </Text>
                {item.details || 'Updated vault records'}
              </Text>
              <Text style={styles.timeText}>{timeAgo}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  detailsText: {
    fontSize: 13,
    color: '#E2E8F0',
    lineHeight: 18,
  },
  actorName: {
    fontWeight: '700',
    color: '#38BDF8',
  },
  timeText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  emptyContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#64748B',
  },
});

export default FamilyActivityFeed;
