/**
 * CollapsibleSection — progressive disclosure for Home / Passport.
 */

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';

import { useThemeColors } from '../../context/ThemeProvider';
import { RADIUS, SPACING, TYPE, HIT } from '../../theme/tokens';
import { Haptics } from '../../services/haptics';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function CollapsibleSection({
  title,
  subtitle,
  children,
  defaultOpen = false,
  badge,
  style,
}) {
  const colors = useThemeColors();
  const [open, setOpen] = useState(!!defaultOpen);

  const toggle = () => {
    Haptics.select();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((v) => !v);
  };

  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: colors.surface, borderColor: colors.border },
        style,
      ]}
    >
      <Pressable
        onPress={toggle}
        style={styles.header}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}. ${open ? 'Collapse' : 'Expand'}`}
      >
        <View style={{ flex: 1 }}>
          <Text style={[TYPE.h3, { color: colors.text, fontSize: 16 }]}>{title}</Text>
          {subtitle ? (
            <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {badge ? (
          <Text style={[TYPE.micro, { color: colors.primary, marginRight: 8 }]}>{badge}</Text>
        ) : null}
        <Text style={[TYPE.bodyStrong, { color: colors.textMuted }]}>{open ? '−' : '+'}</Text>
      </Pressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    minHeight: HIT.min,
  },
  body: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
});

export default CollapsibleSection;
