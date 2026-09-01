import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { useThemeColors } from '../../context/ThemeProvider';
import { TYPE, SPACING } from '../../theme/tokens';
import { PremiumCard, SectionHeader } from '../../design-system/primitives';
import { classifyDocumentQuality, summarizeDocumentIntelligence } from '../../trust/protectionStatus';
import { DocumentQualityBadge } from './DocumentQualityBadge';

export function DocumentIntelligencePanel({ extracted, documentType, confidence, needsReview, needsManualReview }) {
  const colors = useThemeColors();
  const intel = summarizeDocumentIntelligence(extracted || {}, { documentType });
  const quality = classifyDocumentQuality({ confidence, needsReview, needsManualReview });

  return (
    <PremiumCard level={2} style={{ marginBottom: SPACING.md }}>
      <SectionHeader title="Document Intelligence" subtitle="From extracted fields only" />
      <View style={styles.row}>
        <DocumentQualityBadge quality={quality} />
        {confidence != null && Number.isFinite(Number(confidence)) ? (
          <Text style={[TYPE.micro, { color: colors.textMuted, marginLeft: 8 }]}>
            OCR Confidence: {Number(confidence) <= 1 ? Math.round(Number(confidence) * 100) : Math.round(Number(confidence))}%
          </Text>
        ) : null}
      </View>
      <Text style={[TYPE.body, { color: colors.text, marginTop: SPACING.sm }]}>{intel.summary}</Text>
      {intel.detected.length ? (
        <View style={{ marginTop: SPACING.sm }}>
          <Text style={[TYPE.label, { color: colors.textMuted }]}>DETECTED</Text>
          {intel.detected.map((row) => (
            <View key={row.key} style={styles.line}>
              <Text style={[TYPE.caption, { color: colors.textMuted, width: 120 }]}>{row.label}</Text>
              <Text style={[TYPE.caption, { color: colors.text, flex: 1, fontWeight: '600' }]}>{String(row.value)}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {intel.missing.length ? (
        <View style={{ marginTop: SPACING.sm }}>
          <Text style={[TYPE.label, { color: colors.textMuted }]}>MISSING</Text>
          {intel.missing.map((row) => (
            <Text key={row.key} style={[TYPE.caption, { color: colors.textMuted, marginTop: 4 }]}>
              {row.message}
            </Text>
          ))}
        </View>
      ) : null}
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.xs, flexWrap: 'wrap' },
  line: { flexDirection: 'row', marginTop: 6, alignItems: 'flex-start' },
});

export default DocumentIntelligencePanel;
