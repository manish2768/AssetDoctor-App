/**
 * Smart Renewal Countdown widget — Home daily action cards
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';

import { COLORS } from '../theme/branding';
import { Haptics } from '../services/haptics';

const TONE = {
  critical: {
    dot: '🔴',
    border: 'rgba(244,63,94,0.55)',
    bg: 'rgba(244,63,94,0.12)',
    accent: COLORS.rose,
    bar: COLORS.rose,
  },
  warn: {
    dot: '🟡',
    border: 'rgba(245,158,11,0.55)',
    bg: 'rgba(245,158,11,0.12)',
    accent: COLORS.amber,
    bar: COLORS.amber,
  },
  ok: {
    dot: '🟢',
    border: 'rgba(0,245,160,0.45)',
    bg: 'rgba(0,245,160,0.10)',
    accent: COLORS.emerald,
    bar: COLORS.emerald,
  },
};

function urgencyFill(task) {
  if (task.kmRemaining != null) {
    const km = task.kmRemaining;
    if (km <= 0) return 1;
    return Math.max(0.12, Math.min(1, 1 - km / 500));
  }
  const days = task.days;
  if (days == null) return 0.35;
  if (days <= 0) return 1;
  return Math.max(0.12, Math.min(1, 1 - days / 30));
}

function CountdownCard({ task, index, onPress }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const tone = TONE[task.tone] || TONE.ok;

  useEffect(() => {
    if (task.tone !== 'critical') return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.02, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [task.tone, pulse]);

  const fill = urgencyFill(task);

  return (
    <Animated.View style={{ transform: [{ scale: pulse }], marginBottom: 10 }}>
      <Pressable
        onPress={() => {
          Haptics.tap();
          onPress?.(task);
        }}
        style={[styles.card, { borderColor: tone.border, backgroundColor: tone.bg }]}
      >
        <View style={styles.cardTop}>
          <Text style={styles.dot}>{tone.dot}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={2}>
              {task.emoji} {task.title}
            </Text>
            <Text style={[styles.subtitle, { color: tone.accent }]}>{task.subtitle}</Text>
            <Text style={styles.detail}>{task.detail}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${Math.round(fill * 100)}%`, backgroundColor: tone.bar }]} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function SmartCountdownWidget({ tasks = [], onPressTask }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.heading}>Smart Renewal Countdown</Text>
        <Text style={styles.caption}>Upcoming warranties, service, and document deadlines</Text>
      </View>

      {tasks.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>🟢 All clear for now</Text>
          <Text style={styles.emptyBody}>
            No warranty, service, or document deadlines in the next few weeks.
          </Text>
        </View>
      ) : (
        tasks.map((task, index) => (
          <CountdownCard
            key={task.id}
            task={task}
            index={index}
            onPress={onPressTask}
          />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 14 },
  header: { marginBottom: 10 },
  heading: { color: COLORS.text, fontWeight: '900', fontSize: 16 },
  caption: { color: COLORS.muted, fontSize: 11, marginTop: 2, fontWeight: '600' },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  dot: { fontSize: 14, marginTop: 2 },
  title: { color: COLORS.text, fontWeight: '800', fontSize: 13, lineHeight: 18 },
  subtitle: { fontWeight: '900', fontSize: 15, marginTop: 4 },
  detail: { color: COLORS.muted, fontSize: 11, marginTop: 3, fontWeight: '600' },
  chevron: { color: COLORS.muted, fontSize: 22, marginTop: -2 },
  barTrack: {
    marginTop: 10,
    height: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  barFill: { height: 4, borderRadius: 4 },
  empty: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,245,160,0.3)',
    backgroundColor: 'rgba(0,245,160,0.08)',
  },
  emptyTitle: { color: COLORS.emerald, fontWeight: '800' },
  emptyBody: { color: COLORS.muted, fontSize: 12, marginTop: 6, lineHeight: 18 },
});

export default SmartCountdownWidget;
