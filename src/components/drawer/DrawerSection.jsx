/**
 * Asset Doctor — Drawer Section Component
 * Organizes navigation groups with collapsible expand/collapse support.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useThemeColors } from '../../context/ThemeProvider';
import { Haptics } from '../../services/haptics';
import { FONTS } from '../../theme/branding';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function DrawerSection({
  title,
  subtitle,
  badge,
  isCollapsible = false,
  defaultExpanded = true,
  children,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const colors = useThemeColors();

  const toggleExpand = () => {
    if (!isCollapsible) return;
    Haptics.tap();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  };

  return (
    <View style={styles.sectionContainer}>
      <Pressable
        onPress={isCollapsible ? toggleExpand : undefined}
        disabled={!isCollapsible}
        style={styles.headerRow}
        accessibilityRole={isCollapsible ? 'button' : 'header'}
        accessibilityLabel={`${title} section, ${expanded ? 'expanded' : 'collapsed'}`}
      >
        <View style={styles.titleWrap}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted || '#64748B' }]}>
            {title.toUpperCase()}
          </Text>
          {badge ? (
            <View style={styles.badgeWrap}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>

        {isCollapsible ? (
          <Text style={[styles.collapseIcon, { color: colors.textMuted || '#94A3B8' }]}>
            {expanded ? '▾' : '▸'}
          </Text>
        ) : null}
      </Pressable>

      {expanded ? (
        <View style={styles.childrenWrap}>
          {children}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionContainer: {
    marginTop: 14,
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 6,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  badgeWrap: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    marginLeft: 6,
  },
  badgeText: {
    fontSize: 9.5,
    fontFamily: FONTS.bold,
    fontWeight: '700',
    color: '#475569',
  },
  collapseIcon: {
    fontSize: 14,
    fontWeight: '700',
  },
  childrenWrap: {
    paddingHorizontal: 10,
  },
});
