/**
 * ServiceRecord foundation — normalized view over RepairLogs / serviceHistory.
 * Does not replace MaintenanceService; adds a stable shape for matching + timeline.
 */

import { RepairLogService } from '../maintenance/MaintenanceService';

/**
 * Normalize any service/repair payload → ServiceRecord.
 */
export function toServiceRecord(raw = {}, assetId = '', ownerUid = '') {
  return {
    id: raw.id || raw.repairId || raw.historyId || `svc_${Date.now()}`,
    ownerUid: ownerUid || raw.ownerUid || '',
    assetId: assetId || raw.assetId || '',
    serviceDate: raw.serviceDate || raw.repairDate || raw.date || null,
    serviceType: raw.serviceType || raw.category || raw.title || 'service',
    serviceProvider: raw.serviceProvider || raw.vendor || raw.storeName || '',
    technician: raw.technician || '',
    description: raw.description || raw.workDone || raw.title || '',
    complaint: raw.complaint || '',
    workPerformed: raw.workPerformed || raw.workDone || '',
    partsReplaced: raw.partsReplaced || raw.parts || [],
    labourCost: Number(raw.labourCost) || 0,
    partsCost: Number(raw.partsCost) || 0,
    tax: Number(raw.tax) || 0,
    cgst: Number(raw.cgst) || 0,
    sgst: Number(raw.sgst) || 0,
    igst: Number(raw.igst) || 0,
    totalAmount: Number(raw.totalAmount ?? raw.costInr ?? raw.cost) || 0,
    odometer:
      raw.odometer != null
        ? Number(raw.odometer)
        : raw.odometerKm != null
          ? Number(raw.odometerKm)
          : null,
    customerName: raw.customerName || raw.buyerName || '',
    invoiceNumber: raw.invoiceNumber || raw.invoiceNo || '',
    registration: raw.registration || raw.vehicleRegistration || '',
    documentId: raw.documentId || raw.invoiceDocId || null,
    nextServiceDate: raw.nextServiceDate || null,
    warrantyOnRepair: raw.warrantyOnRepair || null,
    notes: raw.notes || '',
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
  };
}

export class ServiceRecordService {
  static async add(userId, assetId, record = {}) {
    const normalized = toServiceRecord(record, assetId, userId);
    const noteParts = [
      normalized.workPerformed,
      normalized.labourCost ? `Labour: ₹${normalized.labourCost}` : '',
      normalized.partsCost ? `Parts: ₹${normalized.partsCost}` : '',
      normalized.tax ? `Tax: ₹${normalized.tax}` : '',
      normalized.notes && normalized.notes !== normalized.workPerformed ? normalized.notes : '',
    ].filter(Boolean);

    const result = await RepairLogService.create(userId, assetId, {
      title: normalized.serviceType || 'Service',
      category: normalized.serviceType,
      repairDate: normalized.serviceDate,
      costInr: normalized.totalAmount,
      vendor: normalized.serviceProvider,
      odometerKm: normalized.odometer,
      parts: normalized.partsReplaced,
      labourCost: normalized.labourCost,
      partsCost: normalized.partsCost,
      tax: normalized.tax,
      cgst: normalized.cgst,
      sgst: normalized.sgst,
      igst: normalized.igst,
      customerName: normalized.customerName || '',
      invoiceNumber: normalized.invoiceNumber || '',
      registration: normalized.registration || '',
      invoiceDocId: normalized.documentId,
      notes: noteParts.join('\n'),
    });
    return {
      ...result,
      serviceRecord: {
        ...normalized,
        id: result.id || normalized.id,
      },
    };
  }

  static async list(userId, assetId) {
    const analysis = await RepairLogService.getCostAnalysis(userId, assetId);
    const logs = analysis.logs || [];
    return logs.map((row) => toServiceRecord(row, assetId, userId));
  }
}

export default ServiceRecordService;
