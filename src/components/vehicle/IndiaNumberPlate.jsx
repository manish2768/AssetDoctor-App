/**
 * Realistic Indian HSRP-style high-security registration plate.
 */

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

import { formatIndiaPlate } from '../../utils/vehicleSpecs';

export function IndiaNumberPlate({ registration, style }) {
  const plate =
    formatIndiaPlate(registration) || String(registration || '').toUpperCase() || '— — — —';

  return (
    <View style={[styles.outer, style]}>
      <View style={styles.bevel}>
        <View style={styles.shell}>
          <View style={styles.indStrip}>
            <View style={styles.ashoka}>
              <View style={styles.ashokaRing} />
              <View style={styles.ashokaInner} />
            </View>
            <Text style={styles.indText}>IND</Text>
            <View style={styles.laserTag} />
          </View>
          <View style={styles.plateFace}>
            <View style={styles.hotStampRow}>
              <View style={styles.hotStampDot} />
              <View style={styles.hotStampDot} />
              <View style={styles.hotStampLine} />
            </View>
            <Text style={styles.plateText} numberOfLines={1} adjustsFontSizeToFit>
              {plate}
            </Text>
            <View style={styles.chromiumEdge} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignSelf: 'stretch',
    borderRadius: 8,
    padding: 2,
    backgroundColor: '#9CA3AF',
    ...Platform.select({
      ios: {
        shadowColor: '#0A1628',
        shadowOpacity: 0.28,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 6 },
    }),
  },
  bevel: {
    borderRadius: 6,
    padding: 1.5,
    backgroundColor: '#E5E7EB',
  },
  shell: {
    flexDirection: 'row',
    minHeight: 48,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: '#FAFAFA',
    borderWidth: 1.5,
    borderColor: '#111827',
  },
  indStrip: {
    width: 40,
    backgroundColor: '#1E3A8A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    gap: 3,
  },
  ashoka: {
    width: 16,
    height: 16,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ashokaRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 99,
    borderWidth: 1.5,
    borderColor: '#FBBF24',
  },
  ashokaInner: {
    width: 5,
    height: 5,
    borderRadius: 99,
    backgroundColor: '#FBBF24',
  },
  indText: {
    color: '#F8FAFC',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  laserTag: {
    width: 18,
    height: 3,
    borderRadius: 1,
    backgroundColor: 'rgba(251, 191, 36, 0.55)',
    marginTop: 2,
  },
  plateFace: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  hotStampRow: {
    position: 'absolute',
    top: 4,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    opacity: 0.35,
  },
  hotStampDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#111827',
  },
  hotStampLine: {
    width: 14,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#111827',
  },
  plateText: {
    color: '#111827',
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 1.6,
    fontVariant: ['tabular-nums'],
  },
  chromiumEdge: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: 'rgba(156, 163, 175, 0.45)',
  },
});

export default IndiaNumberPlate;
