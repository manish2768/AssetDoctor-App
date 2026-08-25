/**
 * User Export Service — Asset Doctor Data Privacy & Portability
 * Consolidates user account, assets, documents metadata, service logs, and tickets into an exportable JSON package.
 */

import { DocumentVaultService } from '../documents/DocumentVaultService';
import { SupportTicketService } from '../support/SupportTicketService';
import { AuditLogService, AUDIT_ACTIONS } from '../audit/AuditLogService';

export const UserExportService = {
  /**
   * Generates a complete GDPR / DPDP compliant personal data archive
   */
  async generateUserDataExport({ user, profile, assets = [] }) {
    const userId = user?.uid || profile?.userId || 'guest_user';

    let userDocs = [];
    let userTickets = [];
    let userAuditLogs = [];

    try {
      if (user?.uid) {
        userDocs = await DocumentVaultService.getAllUserDocuments(user.uid);
      }
    } catch {
      userDocs = [];
    }

    try {
      userTickets = await SupportTicketService.getUserTickets(userId);
    } catch {
      userTickets = [];
    }

    try {
      userAuditLogs = await AuditLogService.getUserLogs(userId);
    } catch {
      userAuditLogs = [];
    }

    const exportPackage = {
      exportMetadata: {
        application: 'Asset Doctor',
        version: '1.0.60',
        generatedAt: new Date().toISOString(),
        userId,
        accountEmail: user?.email || profile?.email || '',
        accountPhone: user?.phoneNumber || profile?.phone || '',
      },
      userProfile: {
        name: profile?.name || user?.displayName || '',
        email: profile?.email || user?.email || '',
        phone: profile?.phone || profile?.phoneNumber || user?.phoneNumber || '',
        city: profile?.city || '',
        address: profile?.address || '',
        pincode: profile?.pincode || '',
        photoURL: profile?.photoURL || user?.photoURL || '',
        gender: profile?.gender || '',
        createdAt: user?.metadata?.creationTime || profile?.createdAt || null,
        lastLoginAt: user?.metadata?.lastSignInTime || profile?.lastLoginAt || null,
      },
      assets: assets.map((a) => ({
        id: a.id,
        name: a.name,
        category: a.category || a.categoryLabel,
        brand: a.brand || '',
        model: a.model || '',
        registrationNumber: a.registrationNumber || null,
        vin: a.vin || null,
        engineNumber: a.engineNumber || null,
        purchaseDate: a.purchaseDate || null,
        purchasePrice: a.purchasePrice || a.price || null,
        warrantyExpiry: a.warrantyExpiry || null,
        insuranceExpiry: a.insuranceExpiry || null,
        pucExpiry: a.pucExpiry || null,
        nextServiceDue: a.nextServiceDue || null,
        currentOdometer: a.odometerKm || a.currentKm || null,
        healthScore: a.healthScore || 100,
        createdAt: a.createdAt || null,
        updatedAt: a.updatedAt || null,
      })),
      documents: userDocs.map((d) => ({
        id: d.docId || d.id,
        assetId: d.assetId,
        type: d.type,
        fileName: d.fileName || d.name,
        uploadDate: d.uploadDate || d.createdAt,
        verified: Boolean(d.verified),
        ocrStatus: d.ocrStatus || 'processed',
      })),
      supportTickets: userTickets,
      securityAuditTrail: userAuditLogs,
    };

    // Log the data export event for audit compliance
    await AuditLogService.log({
      actorId: userId,
      actorRole: 'user',
      targetUserId: userId,
      action: AUDIT_ACTIONS.ACCOUNT_EXPORT_REQUESTED,
      reason: 'User requested personal data archive export',
    });

    return exportPackage;
  },
};

export default UserExportService;
