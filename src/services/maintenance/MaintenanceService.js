/**
 * Asset Doctor — Service Schedules & Repair / Maintenance Logs (Firestore)
 */

import firestore from '@react-native-firebase/firestore';

import { COLLECTIONS } from '../constants';
import { Haptics, triggerHaptic } from '../haptics/triggerHaptic';
import { OfflineQueue } from '../offline/OfflineQueue';
import { OfflineVaultCache } from '../offline/OfflineVaultCache';
import { ConnectivityService } from '../offline/ConnectivityService';
import { SYNC_STATUS, SYNC_ENTITY, makeOperationId } from '../offline/syncConstants';
import { toErrorMessage } from '../../utils/errors';

function isTransientError(error) {
  return /network|offline|unavailable|timeout|timed out|connection|retry-limit|unknown/i.test(
    `${error?.code || ''} ${error?.message || error || ''}`,
  );
}

function assetRef(userId, assetId) {
  return firestore()
    .collection(COLLECTIONS.USERS)
    .doc(userId)
    .collection(COLLECTIONS.ASSETS)
    .doc(assetId);
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const due = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(due.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

export function summarizeMaintenanceCost(logs = []) {
  const totalCostInr = logs.reduce((sum, row) => sum + (Number(row.costInr) || 0), 0);
  const count = logs.length;
  const byYear = {};
  for (const row of logs) {
    const year = String(row.repairDate || row.serviceDate || '').slice(0, 4) || 'Unknown';
    byYear[year] = (byYear[year] || 0) + (Number(row.costInr) || 0);
  }
  return {
    totalCostInr,
    count,
    averageCostInr: count ? totalCostInr / count : 0,
    byYear,
  };
}

export function pickNextServiceDue(schedules = []) {
  const upcoming = schedules
    .filter((s) => s.status !== 'completed' && s.dueDate)
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
  const next = upcoming[0] || null;
  return {
    next,
    daysLeft: next ? daysUntil(next.dueDate) : null,
    upcoming,
  };
}

export class ServiceScheduleService {
  /**
   * Create a service schedule under an asset.
   */
  static async create(userId, assetId, payload = {}) {
    triggerHaptic('impactMedium');
    try {
      if (!userId || !assetId) throw new Error('userId and assetId required');
      if (!payload.dueDate) throw new Error('dueDate is required (YYYY-MM-DD)');

      const ref = assetRef(userId, assetId).collection('ServiceSchedules').doc();
      const doc = {
        scheduleId: ref.id,
        assetId,
        title: payload.title || 'Service',
        serviceType: payload.serviceType || 'periodic',
        dueDate: payload.dueDate,
        odometerKm: Number(payload.odometerKm) || null,
        workshop: payload.workshop || '',
        estimatedCostInr: Number(payload.estimatedCostInr) || 0,
        notes: payload.notes || '',
        status: 'upcoming',
        remindDaysBefore: payload.remindDaysBefore || [30, 14, 7, 3, 1],
        lastNotifiedAt: null,
        completedAt: null,
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };

      await ref.set(doc);
      await this.syncNextServiceDue(userId, assetId);

      Haptics.success();
      return { success: true, id: ref.id, schedule: doc };
    } catch (error) {
      Haptics.error();
      return { success: false, error: error?.message || 'Failed to create schedule' };
    }
  }

  static listen(userId, assetId, onUpdate) {
    if (!userId || !assetId) {
      onUpdate([]);
      return () => {};
    }
    return assetRef(userId, assetId)
      .collection('ServiceSchedules')
      .orderBy('dueDate', 'asc')
      .onSnapshot(
        (snap) => onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        () => onUpdate([]),
      );
  }

  static async syncNextServiceDue(userId, assetId) {
    const snap = await assetRef(userId, assetId)
      .collection('ServiceSchedules')
      .where('status', '==', 'upcoming')
      .get();
    const rows = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((r) => r.dueDate)
      .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
    const nextDue = rows[0]?.dueDate || null;
    await assetRef(userId, assetId).set(
      {
        nextServiceDue: nextDue,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return nextDue;
  }

  /**
   * Mark schedule complete; optionally log cost into RepairLogs.
   */
  static async markComplete(userId, assetId, scheduleId, extras = {}) {
    Haptics.tap();
    try {
      const scheduleSnap = await assetRef(userId, assetId)
        .collection('ServiceSchedules')
        .doc(scheduleId)
        .get();
      const schedule = scheduleSnap.data() || {};

      await assetRef(userId, assetId)
        .collection('ServiceSchedules')
        .doc(scheduleId)
        .set(
          {
            status: 'completed',
            completedAt: firestore.FieldValue.serverTimestamp(),
            actualCostInr: Number(extras.costInr) || schedule.estimatedCostInr || 0,
            updatedAt: firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );

      const cost = Number(extras.costInr);
      if (Number.isFinite(cost) && cost > 0) {
        await RepairLogService.create(userId, assetId, {
          title: extras.title || schedule.title || 'Service completed',
          repairDate: extras.repairDate || new Date().toISOString().slice(0, 10),
          costInr: cost,
          vendor: extras.workshop || schedule.workshop || '',
          odometerKm: extras.odometerKm ?? schedule.odometerKm,
          notes: extras.notes || `Completed schedule ${scheduleId}`,
          category: 'service',
        });
      }

      await this.syncNextServiceDue(userId, assetId);
      Haptics.success();
      return { success: true };
    } catch (error) {
      Haptics.error();
      return { success: false, error: error?.message || 'Update failed' };
    }
  }

  static async remove(userId, assetId, scheduleId) {
    Haptics.tap();
    try {
      await assetRef(userId, assetId).collection('ServiceSchedules').doc(scheduleId).delete();
      await this.syncNextServiceDue(userId, assetId);
      Haptics.success();
      return { success: true };
    } catch (error) {
      Haptics.error();
      return { success: false, error: error?.message || 'Delete failed' };
    }
  }
}

export class RepairLogService {
  static async create(userId, assetId, payload = {}) {
    triggerHaptic('impactMedium');
    const skipQueue = payload.skipOfflineQueue === true;
    const stableId =
      payload.repairId ||
      payload.id ||
      `repair_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const docBody = {
      repairId: stableId,
      assetId,
      title: payload.title || 'Maintenance',
      category: payload.category || 'repair',
      repairDate: payload.repairDate || new Date().toISOString().slice(0, 10),
      costInr: Number(payload.costInr) || 0,
      vendor: payload.vendor || '',
      odometerKm: Number(payload.odometerKm) || null,
      parts: Array.isArray(payload.parts) ? payload.parts : [],
      invoiceDocId: payload.invoiceDocId || null,
      invoiceUrl: payload.invoiceUrl || '',
      notes: payload.notes || '',
      operationId:
        payload.operationId ||
        makeOperationId(SYNC_ENTITY.EXPENSE, stableId, 'CREATE'),
    };

    const queueLocal = async () => {
      const operationId = docBody.operationId;
      await OfflineVaultCache.upsertRepairLog(userId, assetId, {
        ...docBody,
        id: stableId,
        syncStatus: SYNC_STATUS.PENDING_CREATE,
        pendingSync: true,
      });
      await OfflineQueue.enqueue({
        type: 'createRepairLog',
        entityType: SYNC_ENTITY.EXPENSE,
        entityId: stableId,
        operationType: 'CREATE',
        operationId,
        payload: {
          userId,
          assetId,
          repair: docBody,
          operationId,
          entityType: SYNC_ENTITY.EXPENSE,
          entityId: stableId,
        },
      });
      Haptics.success();
      return {
        success: true,
        id: stableId,
        repair: docBody,
        queuedOffline: true,
      };
    };

    try {
      if (!userId || !assetId) throw new Error('userId and assetId required');

      if (!skipQueue) {
        const online = await ConnectivityService.isOnline();
        if (!online) {
          const queued = await queueLocal();
          await RepairLogService.refreshExpenseRollups(userId, assetId).catch(() => {});
          return queued;
        }
      }

      const ref = assetRef(userId, assetId).collection('RepairLogs').doc(stableId);
      const doc = {
        ...docBody,
        syncStatus: SYNC_STATUS.SYNCED,
        pendingSync: false,
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };
      // Idempotent merge — retries must not create duplicates
      await ref.set(doc, { merge: true });
      await OfflineVaultCache.upsertRepairLog(userId, assetId, {
        ...docBody,
        id: stableId,
        syncStatus: SYNC_STATUS.SYNCED,
        pendingSync: false,
      });
      await RepairLogService.refreshExpenseRollups(userId, assetId).catch(() => {});
      Haptics.success();
      return { success: true, id: ref.id, repair: doc };
    } catch (error) {
      Haptics.error();
      if (!skipQueue && isTransientError(error)) {
        try {
          return await queueLocal();
        } catch {
          /* ignore */
        }
      }
      return {
        success: false,
        error: toErrorMessage(error, 'Failed to save repair log'),
      };
    }
  }

  /** Persist expense bucket totals on the asset from real RepairLogs (no invented amounts). */
  static async refreshExpenseRollups(userId, assetId) {
    if (!userId || !assetId) return { success: false };
    let logs = [];
    try {
      const snap = await assetRef(userId, assetId).collection('RepairLogs').get();
      logs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch {
      logs = await OfflineVaultCache.listRepairLogs(userId, assetId);
    }
    const cached = await OfflineVaultCache.listRepairLogs(userId, assetId);
    const map = new Map();
    for (const row of [...cached, ...logs]) {
      map.set(row.repairId || row.id, row);
    }
    const { sumExpenseBuckets } = require('../finance/ownershipCostEngine');
    const buckets = sumExpenseBuckets([...map.values()]);
    const patch = {
      serviceCostTotal: buckets.service || 0,
      repairCostTotal: buckets.repair || 0,
      insurancePremiumTotal: buckets.insurance || 0,
      energyCostTotal: buckets.energy || 0,
      accessoriesCostTotal: buckets.accessories || 0,
      fuelCostTotal: buckets.fuel || 0,
      chargingCostTotal: buckets.charging || 0,
      otherCostTotal: buckets.other || 0,
      repairCount: buckets.expenseCount || 0,
      expenseRollupsUpdatedAt: new Date().toISOString(),
    };
    try {
      await assetRef(userId, assetId).set(patch, { merge: true });
    } catch {
      /* offline */
    }
    if (typeof OfflineVaultCache.upsertAsset === 'function') {
      await OfflineVaultCache.upsertAsset(userId, {
        assetId,
        id: assetId,
        ...patch,
      }).catch(() => {});
    }
    return { success: true, buckets: patch };
  }

  static listen(userId, assetId, onUpdate) {
    if (!userId || !assetId) {
      onUpdate([]);
      return () => {};
    }
    // Warm local cache immediately
    OfflineVaultCache.listRepairLogs(userId, assetId)
      .then((cached) => {
        if (cached?.length) onUpdate(cached);
      })
      .catch(() => {});
    return assetRef(userId, assetId)
      .collection('RepairLogs')
      .orderBy('repairDate', 'desc')
      .onSnapshot(
        (snap) => {
          const remote = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          OfflineVaultCache.listRepairLogs(userId, assetId)
            .then((cached) => {
              const map = new Map();
              for (const row of [...cached, ...remote]) {
                const key = row.repairId || row.id;
                map.set(key, { ...map.get(key), ...row });
              }
              onUpdate([...map.values()]);
            })
            .catch(() => onUpdate(remote));
        },
        async () => {
          const cached = await OfflineVaultCache.listRepairLogs(userId, assetId);
          onUpdate(cached);
        },
      );
  }

  static async getCostAnalysis(userId, assetId) {
    try {
      const snap = await assetRef(userId, assetId)
        .collection('RepairLogs')
        .orderBy('repairDate', 'desc')
        .get();
      const logs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return { success: true, logs, summary: summarizeMaintenanceCost(logs) };
    } catch (error) {
      const cached = await OfflineVaultCache.listRepairLogs(userId, assetId);
      if (cached.length) {
        return {
          success: true,
          offline: true,
          logs: cached,
          summary: summarizeMaintenanceCost(cached),
        };
      }
      return {
        success: false,
        error: error?.message || 'Cost analysis failed',
        logs: [],
        summary: summarizeMaintenanceCost([]),
      };
    }
  }

  static async remove(userId, assetId, repairId) {
    Haptics.tap();
    try {
      await assetRef(userId, assetId).collection('RepairLogs').doc(repairId).delete();
      Haptics.success();
      return { success: true };
    } catch (error) {
      Haptics.error();
      return { success: false, error: error?.message || 'Delete failed' };
    }
  }
}

export class ServiceHistoryService {
  /**
   * Logbook entry: date, cost, mechanicContact, workDone
   */
  static async create(userId, assetId, payload = {}) {
    triggerHaptic('impactMedium');
    try {
      if (!userId || !assetId) throw new Error('userId and assetId required');
      const ref = assetRef(userId, assetId).collection('serviceHistory').doc();
      const doc = {
        historyId: ref.id,
        assetId,
        date: payload.date || payload.serviceDate || new Date().toISOString().slice(0, 10),
        cost: Number(payload.cost ?? payload.costInr) || 0,
        mechanicContact: payload.mechanicContact || payload.vendor || '',
        workDone: payload.workDone || payload.title || payload.notes || '',
        odometerKm: Number(payload.odometerKm) || null,
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };
      await ref.set(doc);
      // Keep RepairLogs mirror for existing Maintenance UI
      await RepairLogService.create(userId, assetId, {
        title: doc.workDone || 'Service',
        repairDate: doc.date,
        costInr: doc.cost,
        vendor: doc.mechanicContact,
        odometerKm: doc.odometerKm,
        notes: doc.workDone,
        category: 'service_history',
      }).catch(() => {});
      Haptics.success();
      return { success: true, id: ref.id, entry: doc };
    } catch (error) {
      Haptics.error();
      return { success: false, error: error?.message || 'Failed to save service history' };
    }
  }

  static listen(userId, assetId, onUpdate) {
    if (!userId || !assetId) {
      onUpdate([]);
      return () => {};
    }
    return assetRef(userId, assetId)
      .collection('serviceHistory')
      .orderBy('date', 'desc')
      .onSnapshot(
        (snap) => onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        () => onUpdate([]),
      );
  }
}

/** Friendly alias used by UI */
export const MaintenanceService = {
  createSchedule: (...args) => ServiceScheduleService.create(...args),
  listenSchedules: (...args) => ServiceScheduleService.listen(...args),
  completeSchedule: (...args) => ServiceScheduleService.markComplete(...args),
  removeSchedule: (...args) => ServiceScheduleService.remove(...args),
  logExpense: (...args) => RepairLogService.create(...args),
  listenLogs: (...args) => RepairLogService.listen(...args),
  costAnalysis: (...args) => RepairLogService.getCostAnalysis(...args),
  removeLog: (...args) => RepairLogService.remove(...args),
  addServiceHistory: (...args) => ServiceHistoryService.create(...args),
  listenServiceHistory: (...args) => ServiceHistoryService.listen(...args),
  summarize: summarizeMaintenanceCost,
  pickNext: pickNextServiceDue,
};

export default {
  ServiceScheduleService,
  RepairLogService,
  ServiceHistoryService,
  MaintenanceService,
};
