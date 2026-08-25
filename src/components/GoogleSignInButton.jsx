/**
 * Highlighted Google Sign-In CTA — white card + multicolor Google accents.
 */

import React from 'react';
import { Pressable, Text, View, StyleSheet, ActivityIndicator } from 'react-native';

import { RADIUS, SPACING } from '../theme/branding';
import { Haptics } from '../services/haptics';

export function GoogleSignInButton({
  title = 'Continue with Google',
  onPress,
  loading = false,
  disabled = false,
  style,
}) {
  return (
    <Pressable
      disabled={disabled || loading}
      onPress={() => {
        Haptics.tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.btn,
        (disabled || loading) && { opacity: 0.6 },
        pressed && { transform: [{ scale: 0.98 }], backgroundColor: '#EEF3FF' },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#4285F4" />
      ) : (
        <View style={styles.row}>
          <View style={styles.logoBox}>
            <Text style={styles.gBlue}>G</Text>
            <View style={styles.colorBar}>
              <View style={[styles.barSeg, { backgroundColor: '#4285F4' }]} />
              <View style={[styles.barSeg, { backgroundColor: '#EA4335' }]} />
              <View style={[styles.barSeg, { backgroundColor: '#FBBC05' }]} />
              <View style={[styles.barSeg, { backgroundColor: '#34A853' }]} />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.sub}>Gmail · secure Google login</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.md,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderWidth: 2,
    borderColor: '#4285F4',
    shadowColor: '#4285F4',
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
    minHeight: 56,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F8FAFF',
    borderWidth: 1,
    borderColor: '#D2E3FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gBlue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#4285F4',
    marginTop: -4,
  },
  colorBar: {
    position: 'absolute',
    bottom: 5,
    left: 7,
    right: 7,
    height: 3,
    borderRadius: 2,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  barSeg: { flex: 1, height: 3 },
  title: {
    color: '#202124',
    fontWeight: '800',
    fontSize: 15,
  },
  sub: {
    color: '#5F6368',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
});

export default GoogleSignInButton;
