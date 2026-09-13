/**
 * Scan & Add Modal — Intuitive Pre-Scan Document Type Selector.
 *
 * Provides clear document-specific scan choices before opening the camera:
 * 1. Purchase Bill / Invoice (INVOICE)
 * 2. Vehicle Service Bill (VEHICLE_SERVICE)
 * 3. Vehicle Insurance (INSURANCE)
 * 4. PUC Certificate (PUC)
 * 5. Electricity Bill (ELECTRICITY_BILL)
 * 6. Other Document (UNKNOWN)
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACING, FONTS } from '../../theme/branding';
import { Haptics } from '../../services/haptics';
import { navigationRef, openScanInvoice } from '../../navigation/navActions';

export const SCAN_DOCUMENT_CHOICES = [
  {
    id: 'INVOICE',
    icon: '🧾',
    title: 'Purchase Bill / Invoice',
    subtitle: 'Gadgets, electronics, appliances, vehicle purchase',
    badge: 'Assets',
    badgeColor: '#10B981',
  },
  {
    id: 'VEHICLE_SERVICE',
    icon: '🚗',
    title: 'Vehicle Service Bill',
    subtitle: 'Periodic maintenance, repairs, workshop job cards',
    badge: 'Service History',
    badgeColor: '#3B82F6',
  },
  {
    id: 'INSURANCE',
    icon: '🛡️',
    title: 'Vehicle Insurance',
    subtitle: 'Policy schedule, cover note, comprehensive / TP',
    badge: 'Passport',
    badgeColor: '#8B5CF6',
  },
  {
    id: 'PUC',
    icon: '🟢',
    title: 'PUC Certificate',
    subtitle: 'Pollution Under Control certificate & emission slip',
    badge: 'Passport',
    badgeColor: '#10B981',
  },
  {
    id: 'ELECTRICITY_BILL',
    icon: '⚡',
    title: 'Electricity Bill',
    subtitle: 'Power utility bills (BESCOM, Tata Power, BSES, etc.)',
    badge: 'Energy Doctor',
    badgeColor: '#F59E0B',
  },
  {
    id: 'UNKNOWN',
    icon: '📄',
    title: 'Other Document',
    subtitle: 'Warranty cards, tax slips, or generic receipts',
    badge: 'Auto Detect',
    badgeColor: '#6B7280',
  },
  {
    id: 'OCR_TEST_LAB',
    icon: '🧪',
    title: 'OCR Test Lab & Diagnostics',
    subtitle: 'Developer workspace, 8-stage inspection & sample fixtures',
    badge: 'Dev Test',
    badgeColor: '#0EA5E9',
  },
];

export function ScanAndAddModal({ visible, onClose, onSelectType }) {
  const insets = useSafeAreaInsets();

  const handleSelect = (docType) => {
    Haptics.select();
    if (onClose) onClose();
    if (docType === 'OCR_TEST_LAB') {
      navigationRef.navigate('OcrTest');
      return;
    }
    if (onSelectType) {
      onSelectType(docType);
    } else {
      openScanInvoice({ selectedDocType: docType });
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheetContainer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={styles.indicatorBar} />

          <View style={styles.header}>
            <Text style={styles.headerTitle}>Scan & Add</Text>
            <Text style={styles.headerSubtitle}>
              Select the type of document you are scanning for instant AI extraction
            </Text>
          </View>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {SCAN_DOCUMENT_CHOICES.map((choice) => (
              <Pressable
                key={choice.id}
                onPress={() => handleSelect(choice.id)}
                style={({ pressed }) => [
                  styles.card,
                  pressed && styles.cardPressed,
                ]}
              >
                <View style={styles.iconBox}>
                  <Text style={styles.iconText}>{choice.icon}</Text>
                </View>

                <View style={styles.cardContent}>
                  <View style={styles.titleRow}>
                    <Text style={styles.cardTitle}>{choice.title}</Text>
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: `${choice.badgeColor}20`, borderColor: choice.badgeColor },
                      ]}
                    >
                      <Text style={[styles.badgeText, { color: choice.badgeColor }]}>
                        {choice.badge}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.cardSubtitle}>{choice.subtitle}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable
            style={styles.cancelButton}
            onPress={() => {
              Haptics.light();
              onClose();
            }}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetContainer: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: RADIUS.xl || 24,
    borderTopRightRadius: RADIUS.xl || 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    maxHeight: '85%',
  },
  indicatorBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 12,
  },
  header: {
    paddingHorizontal: SPACING.lg || 20,
    marginBottom: SPACING.md || 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
    lineHeight: 18,
  },
  list: {
    paddingHorizontal: SPACING.md || 16,
  },
  listContent: {
    paddingBottom: SPACING.sm || 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: RADIUS.lg || 16,
    padding: SPACING.md || 14,
    marginBottom: SPACING.sm || 10,
  },
  cardPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    transform: [{ scale: 0.99 }],
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  iconText: {
    fontSize: 24,
  },
  cardContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 16,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    marginLeft: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cancelButton: {
    marginTop: SPACING.sm || 8,
    marginHorizontal: SPACING.md || 16,
    paddingVertical: 14,
    borderRadius: RADIUS.md || 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: '#94A3B8',
    fontSize: 15,
    fontWeight: '600',
  },
});
