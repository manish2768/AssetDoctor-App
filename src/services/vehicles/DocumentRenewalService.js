/**
 * Vehicle document renewal — archive prior Insurance/PUC/RC, activate new extract,
 * update expiry fields, and refresh expiry alerts (no hard overwrite of history).
 */

import firestore from '@react-native-firebase/firestore';

import { COLLECTIONS } from '../constants';
import { DocumentVaultService } from '../documents/DocumentVaultService';
import { AssetService } from '../assets/AssetService';
import { ExpiryAlertService } from '../notifications/ExpiryAlertService';
import { resolveVaultDocumentMeta } from '../ocr/documentTypeClassifier';
import { Haptics } from '../haptics';

export const DOC_STATUS = Object.freeze({
  ACTIVE_CURRENT: 'ACTIVE_CURRENT',
  EXPIRED_ARCHIVED: 'EXPIRED_ARCHIVED',
});

function assetRef(userId, assetId) {
  return firestore()
    .collection(COLLECTIONS.USERS)
    .doc(userId)
    .collection(COLLECTIONS.ASSETS)
    .doc(assetId);
}

function docsRef(userId, assetId) {
  return assetRef(userId, assetId).collection('Documents');
}

function historyRef(userId, assetId) {
  return assetRef(userId, assetId).collection('document_history');
}

function expiryFieldForType(docType) {
  if (docType === 'insurance') return 'insuranceExpiry';
  if (docType === 'puc') return 'pucExpiry';
  if (docType === 'warranty') return 'warrantyExpiry';
  return null;
}

/**
 * Archive ACTIVE_CURRENT docs of the same type into document_history.
 */
export async function archiveActiveDocumentsOfType(userId, assetId, docType) {
  if (!userId || !assetId || !docType) return { archived: 0 };

  const snap = await docsRef(userId, assetId)
    .where('type', '==', docType)
    .get();

  let archived = 0;
  const batch = firestore().batch();
  const now = firestore.FieldValue.serverTimestamp();

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const status = String(data.status || 'ACTIVE_CURRENT').toUpperCase();
    if (status === DOC_STATUS.EXPIRED_ARCHIVED) continue;

    const histId = `hist_${doc.id}_${Date.now()}`;
    const histRef = historyRef(userId, assetId).doc(histId);
    batch.set(histRef, {
      ...data,
      historyId: histId,
      sourceDocId: doc.id,
      status: DOC_STATUS.EXPIRED_ARCHIVED,
      archivedAt: now,
      archivedReason: 'renewed_by_new_scan',
    });
    batch.set(
      doc.ref,
      {
        status: DOC_STATUS.EXPIRED_ARCHIVED,
        archivedAt: now,
        updatedAt: now,
      },
      { merge: true },
    );
    archived += 1;
  }

  if (archived > 0) {
    await batch.commit();
  }
  return { archived };
}

/**
 * Write a new ACTIVE_CURRENT document metadata record (OCR JSON / optional thumb).
 * Optionally uploads a local file when provided.
 */
export async function activateRenewalDocument(userId, assetId, form = {}, localImagePath = null) {
  const vaultMeta = resolveVaultDocumentMeta(form);
  const docType = vaultMeta.type;
  const docId = `doc_${docType}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const expiryField = expiryFieldForType(docType);
  const expiryValue =
    (expiryField && form[expiryField]) ||
    form.expiryDate ||
    form.ocrExtract?.expiry_date ||
    null;

  let fileUrl = '';
  let storagePath = '';
  if (localImagePath) {
    const uploaded = await DocumentVaultService.uploadDocument(userId, assetId, {
      docId,
      localPath: localImagePath,
      type: docType,
      label: vaultMeta.label,
    });
    if (uploaded?.success && uploaded.document) {
      fileUrl = uploaded.document.fileUrl || '';
      storagePath = uploaded.document.storagePath || '';
      // Ensure status ACTIVE_CURRENT on the uploaded record
      await docsRef(userId, assetId).doc(uploaded.document.docId || docId).set(
        {
          status: DOC_STATUS.ACTIVE_CURRENT,
          expiryDate: expiryValue || null,
          ocrExtract: form.ocrExtract || null,
          billThumbDataUrl: form.billThumbDataUrl || null,
          invoiceOrPolicyNo:
            form.invoiceNumber || form.ocrExtract?.invoice_or_policy_no || '',
          updatedAt: firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return {
        success: true,
        docId: uploaded.document.docId || docId,
        docType,
        expiryField,
        expiryValue,
        fileUrl,
        storagePath,
      };
    }
  }

  const record = {
    docId,
    type: docType,
    label: vaultMeta.label,
    status: DOC_STATUS.ACTIVE_CURRENT,
    fileUrl: '',
    storagePath: '',
    mimeType: 'application/json',
    expiryDate: expiryValue || null,
    ocrExtract: form.ocrExtract || null,
    billThumbDataUrl: form.billThumbDataUrl || null,
    invoiceOrPolicyNo: form.invoiceNumber || form.ocrExtract?.invoice_or_policy_no || '',
    pendingSync: false,
    createdAt: firestore.FieldValue.serverTimestamp(),
    updatedAt: firestore.FieldValue.serverTimestamp(),
  };
  await docsRef(userId, assetId).doc(docId).set(record);
  return { success: true, docId, docType, expiryField, expiryValue, fileUrl, storagePath };
}

/**
 * Full renewal pipeline for Insurance / PUC / RC onto an existing vehicle.
 */
export async function renewVehicleDocument({
  userId,
  assetId,
  form = {},
  localImagePath = null,
  existingAsset = null,
}) {
  if (!userId || !assetId) {
    return { success: false, error: 'userId and assetId are required' };
  }

  try {
    const vaultMeta = resolveVaultDocumentMeta(form);
    const docType = vaultMeta.type;

    // 1) Archive previous ACTIVE docs of same type (no hard overwrite)
    const { archived } = await archiveActiveDocumentsOfType(userId, assetId, docType);

    // 2) Activate new document record
    const activated = await activateRenewalDocument(userId, assetId, form, localImagePath);
    if (!activated.success) {
      return { success: false, error: 'Could not activate renewed document' };
    }

    // 3) Update main vehicle expiry + identifiers
    const expiryField = activated.expiryField;
    const updates = {
      ...(expiryField && activated.expiryValue
        ? { [expiryField]: activated.expiryValue }
        : {}),
      ...(form.chassisNumber ? { chassisNumber: form.chassisNumber } : {}),
      ...(form.engineNumber ? { engineNumber: form.engineNumber } : {}),
      ...(form.registration ? { registration: form.registration } : {}),
      ...(form.nextServiceDue ? { nextServiceDue: form.nextServiceDue } : {}),
      activeDocumentIds: {
        ...(existingAsset?.activeDocumentIds || {}),
        [docType]: activated.docId,
      },
    };

    const updated = await AssetService.updateAsset(userId, assetId, updates, null);
    if (!updated?.success) {
      return {
        success: false,
        error: updated?.error || 'Could not update vehicle passport',
      };
    }

    // 4) Clear stale EXPIRED/URGENT schedules and reschedule from new dates
    const mergedAsset = {
      ...(existingAsset || {}),
      ...(updated.asset || {}),
      ...updates,
      assetId,
      id: assetId,
    };
    try {
      await ExpiryAlertService.scheduleForAsset(mergedAsset);
      // Portfolio sync cancels fingerprints that no longer match
      await ExpiryAlertService.syncPortfolioAlerts([mergedAsset]).catch(() => {});
    } catch (alertErr) {
      console.warn('[DocumentRenewal] alert refresh skipped:', alertErr?.message);
    }

    Haptics.success();
    return {
      success: true,
      id: assetId,
      merged: true,
      renewed: true,
      archivedCount: archived,
      docType,
      docId: activated.docId,
      asset: mergedAsset,
    };
  } catch (error) {
    Haptics.error();
    return { success: false, error: error?.message || 'Document renewal failed' };
  }
}

export const DocumentRenewalService = {
  DOC_STATUS,
  archiveActiveDocumentsOfType,
  activateRenewalDocument,
  renewVehicleDocument,
};

export default DocumentRenewalService;
