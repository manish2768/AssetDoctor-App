/**
 * First-run onboarding — 2 sleek pages (Welcome + Never Miss an Expiry)
 */

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  Pressable,
} from 'react-native';

import { BRAND, COLORS, SPACING } from '../../theme/branding';
import { Haptics } from '../../services/haptics';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    key: 'welcome',
    icon: '📷',
    title: 'Welcome to Asset Doctor',
    body:
      'Zero manual typing. Automated 1-click scanning for Bills, RCs, Warranties, and Insurance — drop messy paperwork into a smart digital vault.',
  },
  {
    key: 'expiry',
    icon: '🔔',
    title: 'Never Miss an Expiry',
    body:
      'Instant WhatsApp document sharing, smart reminders for PUC, Insurance & Service, plus Family Locker access for your whole household.',
  },
];

export function OnboardingScreen({ onDone }) {
  const listRef = useRef(null);
  const [index, setIndex] = useState(0);

  const finish = () => {
    Haptics.success();
    onDone?.();
  };

  const next = () => {
    Haptics.tap();
    if (index >= SLIDES.length - 1) {
      finish();
      return;
    }
    const nextIndex = index + 1;
    listRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    setIndex(nextIndex);
  };

  return (
    <View style={styles.root}>
      <Text style={styles.brand}>{BRAND.name}</Text>
      <Text style={styles.tag}>{BRAND.tagline}</Text>
      <View style={styles.creatorBadge}>
        <Text style={styles.creatorText}>Crafted by Ashutosh (14) 🚀</Text>
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.key}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / width);
          setIndex(i);
        }}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <View style={styles.iconOrb}>
              <Text style={styles.icon}>{item.icon}</Text>
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
          </View>
        )}
      />

      <View style={styles.dots}>
        {SLIDES.map((s, i) => (
          <View key={s.key} style={[styles.dot, i === index && styles.dotOn]} />
        ))}
      </View>

      <Pressable style={styles.primary} onPress={next}>
        <Text style={styles.primaryText}>
          {index === SLIDES.length - 1 ? 'Get Started' : 'Next'}
        </Text>
      </Pressable>
      <Pressable onPress={finish} style={{ padding: 12 }}>
        <Text style={styles.skip}>Skip</Text>
      </Pressable>
      <Text style={styles.footer}>{BRAND.footer}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg, paddingTop: 56 },
  brand: { color: COLORS.text, fontSize: 28, fontWeight: '900', textAlign: 'center' },
  tag: {
    color: COLORS.emerald,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 24,
    fontWeight: '600',
    fontSize: 13,
  },
  creatorBadge: {
    alignSelf: 'center',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0,245,160,0.35)',
    backgroundColor: 'rgba(0,245,160,0.1)',
  },
  creatorText: { color: COLORS.emerald, fontWeight: '800', fontSize: 11 },
  slide: { width, paddingHorizontal: 32, alignItems: 'center', marginTop: 36 },
  iconOrb: {
    width: 96,
    height: 96,
    borderRadius: 32,
    backgroundColor: 'rgba(0,245,160,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(0,245,160,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  icon: { fontSize: 44 },
  title: { color: COLORS.text, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  body: {
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 23,
    fontSize: 15,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.border },
  dotOn: { backgroundColor: COLORS.emerald, width: 20 },
  primary: {
    marginHorizontal: SPACING.lg,
    backgroundColor: COLORS.emerald,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryText: { color: COLORS.onPrimary, fontWeight: '900', fontSize: 15 },
  skip: { color: COLORS.muted, textAlign: 'center', fontWeight: '700' },
  footer: {
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 28,
    fontSize: 11,
  },
});

export default OnboardingScreen;
