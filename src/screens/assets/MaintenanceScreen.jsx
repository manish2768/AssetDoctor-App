/**
 * Service & Maintenance History — schedule tracking + cost analysis
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { useAuth } from '../../context/AuthProvider';
import { useUiFeedback } from '../../context/UiFeedbackProvider';
import { useAssets } from '../../context/AssetProvider';
import {
  ServiceScheduleService,
  RepairLogService,
  pickNextServiceDue,
  summarizeMaintenanceCost,
} from '../../services/maintenance/MaintenanceService';
import { COLORS } from '../../theme/branding';
import { formatINR, formatINRExact } from '../../utils/format';
import { Haptics } from '../../services/haptics';
import { openLogin } from '../../navigation/authGate';
import { CompleteMaintenanceSheet } from '../../components/CompleteMaintenanceSheet';
import { HIT } from '../../theme/tokens';

const SERVICE_TYPES = [
  { id: 'periodic', label: 'Periodic' },
  { id: 'oil', label: 'Oil change' },
  { id: 'tyre', label: 'Tyre' },
  { id: 'battery', label: 'Battery' },
  { id: 'ac', label: 'AC service' },
  { id: 'other', label: 'Other' },
];

export function MaintenanceScreen({ route, navigation }) {
  const assetId = route?.params?.assetId;
  const { user } = useAuth();
  const { getAsset } = useAssets();
  const ui = useUiFeedback();
  const asset = getAsset(assetId);
  const uid = user?.uid;
  const id = asset?.assetId || asset?.id || assetId;

  const [tab, setTab] = useState('schedule'); // schedule | cost | add
  const [schedules, setSchedules] = useState([]);
  const [logs, setLogs] = useState([]);
  const [busy, setBusy] = useState(false);

  // Schedule form
  const [title, setTitle] = useState('Next service');
  const [serviceType, setServiceType] = useState('periodic');
  const [dueDate, setDueDate] = useState('');
  const [workshop, setWorkshop] = useState('');
  const [odometerKm, setOdometerKm] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');

  // Cost log form
  const [logTitle, setLogTitle] = useState('');
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [logCost, setLogCost] = useState('');
  const [logVendor, setLogVendor] = useState('');
  const [logNotes, setLogNotes] = useState('');
  const [completeTarget, setCompleteTarget] = useState(null);

  useEffect(() => {
    if (!uid || !id) return undefined;
    const unsubS = ServiceScheduleService.listen(uid, id, setSchedules);
    const unsubL = RepairLogService.listen(uid, id, setLogs);
    return () => {
      unsubS?.();
      unsubL?.();
    };
  }, [uid, id]);

  const nextInfo = useMemo(() => pickNextServiceDue(schedules), [schedules]);
  const costSummary = useMemo(() => summarizeMaintenanceCost(logs), [logs]);

  if (!asset) {
    return (
      <View style={styles.root}>
        <Text style={styles.missing}>Asset not found</Text>
      </View>
    );
  }

  const onAddSchedule = async () => {
    if (!uid) {
      openLogin(navigation);
      return;
    }
    if (!dueDate.trim()) {
      ui.info('Service schedule', 'Due date required (YYYY-MM-DD)');
      return;
    }
    setBusy(true);
    const result = await ServiceScheduleService.create(uid, id, {
      title: title.trim() || 'Service',
      serviceType,
      dueDate: dueDate.trim(),
      workshop: workshop.trim(),
      odometerKm,
      estimatedCostInr: estimatedCost,
    });
    setBusy(false);
    if (!result.success) {
      ui.error('Failed', result.error || 'Could not save schedule');
      return;
    }
    setDueDate('');
    setEstimatedCost('');
    setTab('schedule');
    ui.success('Next service date tracked.');
  };

  const onComplete = (schedule) => {
    Haptics.tap();
    setCompleteTarget(schedule);
  };

  const finishElsewhere = async () => {
    const schedule = completeTarget;
    setCompleteTarget(null);
    if (!schedule || !uid || !id) return;
    setBusy(true);
    const result = await ServiceScheduleService.markComplete(uid, id, schedule.id, {});
    setBusy(false);
    if (!result.success) {
      ui.error('Failed', result.error);
      return;
    }
    ui.success('Marked complete');
  };

  const finishInApp = () => {
    const schedule = completeTarget;
    setCompleteTarget(null);
    if (!schedule) return;
    setLogTitle(schedule.title || 'Service completed');
    setLogVendor(schedule.workshop || '');
    setLogCost(schedule.estimatedCostInr ? String(schedule.estimatedCostInr) : '');
    setTab('add');
  };

  const onAddLog = async () => {
    if (!uid) {
      openLogin(navigation);
      return;
    }
    if (!logTitle.trim()) {
      ui.info('Maintenance log', 'Title is required');
      return;
    }
    setBusy(true);
    const result = await RepairLogService.create(uid, id, {
      title: logTitle.trim(),
      repairDate: logDate.trim() || new Date().toISOString().slice(0, 10),
      costInr: logCost,
      vendor: logVendor.trim(),
      notes: logNotes.trim(),
      category: 'maintenance',
    });
    setBusy(false);
    if (!result.success) {
      ui.error('Failed', result.error || 'Could not save log');
      return;
    }
    setLogTitle('');
    setLogCost('');
    setLogNotes('');
    setTab('cost');
    ui.success('Maintenance expense logged.');
  };

  const onDeleteSchedule = async (s) => {
    const ok = await ui.confirm({
      title: 'Delete schedule?',
      message: s.title,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) ServiceScheduleService.remove(uid, id, s.id);
  };

  const onDeleteLog = async (row) => {
    const ok = await ui.confirm({
      title: 'Delete log?',
      message: row.title,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) RepairLogService.remove(uid, id, row.id);
  };

  const daysLabel = (days) => {
    if (days == null) return '—';
    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days === 0) return 'Due today';
    return `${days}d left`;
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Service & Maintenance</Text>
      <Text style={styles.sub}>
        {asset.icon || '📦'} {asset.assetName}
        {asset.nextServiceDue ? ` · Next due ${asset.nextServiceDue}` : ''}
      </Text>

      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Next service</Text>
        <Text style={styles.heroValue}>
          {nextInfo.next?.dueDate || asset.nextServiceDue || 'Not scheduled'}
        </Text>
        <Text style={styles.heroMeta}>
          {nextInfo.next
            ? `${nextInfo.next.title} · ${daysLabel(nextInfo.daysLeft)}`
            : 'Add a due date to track reminders'}
        </Text>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Total maintenance spend</Text>
        <Text style={[styles.heroValue, { color: COLORS.emerald }]}>
          {formatINR(costSummary.totalCostInr)}
        </Text>
        <Text style={styles.heroMeta}>
          {costSummary.count} log(s) · avg {formatINRExact(costSummary.averageCostInr)}
        </Text>
      </View>

      <View style={styles.tabs}>
        {[
          { id: 'schedule', label: 'Schedule' },
          { id: 'cost', label: 'Cost log' },
          { id: 'add', label: 'Add' },
        ].map((t) => (
          <Pressable
            key={t.id}
            onPress={() => {
              Haptics.select();
              setTab(t.id);
            }}
            style={[styles.tab, tab === t.id && styles.tabOn]}
          >
            <Text style={[styles.tabText, tab === t.id && styles.tabTextOn]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'schedule' ? (
        <View>
          <Text style={styles.section}>Upcoming / history</Text>
          {schedules.length === 0 ? (
            <Text style={styles.sub}>No service schedules yet.</Text>
          ) : (
            schedules.map((s) => {
              const days = pickNextServiceDue([s]).daysLeft;
              const done = s.status === 'completed';
              return (
                <View key={s.id} style={styles.card}>
                  <Text style={styles.cardTitle}>
                    {s.title} {done ? '✅' : ''}
                  </Text>
                  <Text style={styles.sub}>
                    Due {s.dueDate}
                    {!done ? ` · ${daysLabel(days)}` : ''}
                    {s.workshop ? ` · ${s.workshop}` : ''}
                    {s.estimatedCostInr ? ` · est ${formatINR(s.estimatedCostInr)}` : ''}
                  </Text>
                  {!done ? (
                    <View style={styles.row}>
                      <Pressable style={styles.smallBtn} onPress={() => onComplete(s)} disabled={busy}>
                        <Text style={styles.smallBtnText}>Mark done</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.smallBtn, styles.dangerBtn]}
                        onPress={() => onDeleteSchedule(s)}
                      >
                        <Text style={styles.smallBtnText}>Delete</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}

          <Text style={[styles.section, { marginTop: 18 }]}>Add next service due</Text>
          <Field label="Title" value={title} onChangeText={setTitle} placeholder="Periodic service" />
          <Text style={styles.label}>Type</Text>
          <View style={styles.chips}>
            {SERVICE_TYPES.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => setServiceType(t.id)}
                style={[styles.chip, serviceType === t.id && styles.chipOn]}
              >
                <Text style={styles.chipText}>{t.label}</Text>
              </Pressable>
            ))}
          </View>
          <Field label="Due date (YYYY-MM-DD)" value={dueDate} onChangeText={setDueDate} placeholder="2026-09-15" />
          <Field label="Workshop / garage" value={workshop} onChangeText={setWorkshop} />
          <Field label="Odometer (km)" value={odometerKm} onChangeText={setOdometerKm} keyboardType="numeric" />
          <Field label="Estimated cost (₹)" value={estimatedCost} onChangeText={setEstimatedCost} keyboardType="numeric" />
          <Pressable style={styles.primary} onPress={onAddSchedule} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Save schedule</Text>}
          </Pressable>
        </View>
      ) : null}

      {tab === 'cost' ? (
        <View>
          <Text style={styles.section}>Cost analysis</Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Lifetime spend</Text>
            <Text style={styles.bigMoney}>{formatINR(costSummary.totalCostInr)}</Text>
            <Text style={styles.sub}>{costSummary.count} maintenance entries</Text>
            {Object.keys(costSummary.byYear || {}).length ? (
              <View style={{ marginTop: 10 }}>
                {Object.entries(costSummary.byYear)
                  .sort((a, b) => String(b[0]).localeCompare(String(a[0])))
                  .map(([year, amount]) => (
                    <Text key={year} style={styles.sub}>
                      {year}: {formatINR(amount)}
                    </Text>
                  ))}
              </View>
            ) : null}
          </View>

          <Text style={[styles.section, { marginTop: 14 }]}>History</Text>
          {logs.length === 0 ? (
            <Text style={styles.sub}>No maintenance expenses logged yet.</Text>
          ) : (
            logs.map((row) => (
              <View key={row.id} style={styles.card}>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardTitle}>{row.title}</Text>
                  <Text style={styles.money}>{formatINR(row.costInr)}</Text>
                </View>
                <Text style={styles.sub}>
                  {row.repairDate}
                  {row.vendor ? ` · ${row.vendor}` : ''}
                  {row.category ? ` · ${row.category}` : ''}
                </Text>
                {row.notes ? <Text style={styles.sub}>{row.notes}</Text> : null}
                <Pressable
                  onPress={() => onDeleteLog(row)}
                  style={{ marginTop: 8 }}
                >
                  <Text style={{ color: COLORS.rose, fontWeight: '700', fontSize: 12 }}>Delete</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>
      ) : null}

      {tab === 'add' ? (
        <View>
          <Text style={styles.section}>Log maintenance expense</Text>
          <Field label="What was done" value={logTitle} onChangeText={setLogTitle} placeholder="Oil + filter change" />
          <Field label="Date (YYYY-MM-DD)" value={logDate} onChangeText={setLogDate} />
          <Field label="Cost (₹)" value={logCost} onChangeText={setLogCost} keyboardType="numeric" />
          <Field label="Workshop / vendor" value={logVendor} onChangeText={setLogVendor} />
          <Field label="Notes" value={logNotes} onChangeText={setLogNotes} placeholder="Parts, warranty, etc." />
          <Pressable style={styles.primary} onPress={onAddLog} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Save expense</Text>}
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

function Field({ label, ...props }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor="#6B7280" style={styles.input} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20, paddingBottom: 48 },
  title: { color: COLORS.text, fontSize: 22, fontWeight: '800' },
  sub: { color: COLORS.muted, fontSize: 12, marginTop: 4, marginBottom: 8 },
  missing: { color: COLORS.muted, textAlign: 'center', marginTop: 40 },
  hero: {
    marginTop: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,245,160,0.28)',
    backgroundColor: 'rgba(0,245,160,0.08)',
  },
  heroLabel: { color: COLORS.emerald, fontSize: 11, fontWeight: '800' },
  heroValue: { color: COLORS.text, fontSize: 22, fontWeight: '900', marginTop: 4 },
  heroMeta: { color: COLORS.muted, fontSize: 12, marginTop: 4 },
  tabs: { flexDirection: 'row', gap: 8, marginVertical: 14 },
  tab: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabOn: { backgroundColor: 'rgba(59,130,246,0.25)', borderColor: COLORS.neonBlue },
  tabText: { color: COLORS.muted, fontWeight: '700', fontSize: 12 },
  tabTextOn: { color: COLORS.text },
  section: { color: COLORS.muted, fontSize: 10, fontWeight: '800', marginBottom: 8 },
  card: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: 10,
  },
  cardTitle: { color: COLORS.text, fontWeight: '800', fontSize: 14 },
  bigMoney: { color: COLORS.emerald, fontSize: 28, fontWeight: '900', marginTop: 4 },
  money: { color: COLORS.emerald, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 8, marginTop: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  smallBtn: {
    flex: 1,
    backgroundColor: COLORS.neonBlue,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  dangerBtn: { backgroundColor: 'rgba(244,63,94,0.85)' },
  smallBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  label: { color: COLORS.muted, fontSize: 10, fontWeight: '800', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.text,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  chipOn: { borderColor: COLORS.neonBlue, backgroundColor: 'rgba(59,130,246,0.22)' },
  chipText: { color: COLORS.text, fontSize: 12, fontWeight: '600' },
  primary: {
    marginTop: 8,
    backgroundColor: COLORS.neonBlue,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '800' },
});

export default MaintenanceScreen;
