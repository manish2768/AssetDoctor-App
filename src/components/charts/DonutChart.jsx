/**
 * Multi-slice donut chart — percentage share of energy use.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { G, Path, Circle } from 'react-native-svg';

import { CHART_PALETTE, COLORS } from '../../theme/branding';

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

/**
 * @param {{
 *  slices: Array<{ id: string, label: string, value: number, color?: string }>,
 *  size?: number,
 *  strokeWidth?: number,
 *  centerLabel?: string,
 *  centerSub?: string,
 * }} props
 */
export function DonutChart({
  slices = [],
  size = 180,
  strokeWidth = 22,
  centerLabel = '',
  centerSub = '',
}) {
  const prepared = useMemo(() => {
    const total = slices.reduce((s, row) => s + Math.max(0, Number(row.value) || 0), 0);
    if (!total) return { arcs: [], total: 0 };
    let cursor = 0;
    const arcs = slices
      .filter((row) => Number(row.value) > 0)
      .map((row, index) => {
        const value = Number(row.value) || 0;
        const pct = (value / total) * 100;
        const sweep = (value / total) * 360;
        const start = cursor;
        const end = cursor + Math.max(sweep, 0.8);
        cursor = end;
        return {
          ...row,
          pct,
          start,
          end: Math.min(end, 359.999),
          color: row.color || CHART_PALETTE[index % CHART_PALETTE.length],
        };
      });
    return { arcs, total };
  }, [slices]);

  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <View style={styles.wrap}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            stroke={COLORS.bgDeep}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <G>
            {prepared.arcs.map((arc) => (
              <Path
                key={arc.id}
                d={describeArc(cx, cy, r, arc.start, arc.end)}
                stroke={arc.color}
                strokeWidth={strokeWidth}
                strokeLinecap="butt"
                fill="none"
              />
            ))}
          </G>
        </Svg>
        <View style={[styles.center, { width: size, height: size }]} pointerEvents="none">
          {centerLabel ? <Text style={styles.centerLabel}>{centerLabel}</Text> : null}
          {centerSub ? <Text style={styles.centerSub}>{centerSub}</Text> : null}
        </View>
      </View>

      <View style={styles.legend}>
        {prepared.arcs.length ? (
          prepared.arcs.map((arc) => (
            <View key={arc.id} style={styles.legendRow}>
              <View style={[styles.dot, { backgroundColor: arc.color }]} />
              <Text style={styles.legendLabel} numberOfLines={1}>
                {arc.label}
              </Text>
              <Text style={styles.legendPct}>{Math.round(arc.pct)}%</Text>
            </View>
          ))
        ) : (
          <Text style={styles.empty}>No appliance usage yet</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  centerLabel: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  centerSub: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
  },
  legend: { flex: 1, gap: 8 },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    flex: 1,
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
  },
  legendPct: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  empty: { color: COLORS.muted, fontSize: 12 },
});

export default DonutChart;
