/**
 * Asset Doctor — Support Tickets & Document Intelligence (Cloud Functions)
 * Independent codebase: asset-doctor-support
 *
 * This codebase contains ONLY functions that do NOT require WhatsApp Meta
 * secrets, so it can be deployed standalone without touching the WhatsApp
 * codebase (asset-doctor-whatsapp) or scanInvoiceVision (default namespace).
 *
 * Deploy:
 *   firebase deploy --project assetdoctor-5fd25 --only \
 *     "functions:asset-doctor-support:createSupportTicket,functions:asset-doctor-support:updateSupportTicketStatus,functions:asset-doctor-support:addSupportTicketMessage,functions:asset-doctor-support:onDocumentIntelligenceFeedbackCreate"
 */

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const supportTickets = require('./supportTickets');
const documentIntelligence = require('./documentIntelligence');

exports.createSupportTicket = supportTickets.createSupportTicket;
exports.updateSupportTicketStatus =
  supportTickets.updateSupportTicketStatus;
exports.addSupportTicketMessage = supportTickets.addSupportTicketMessage;
exports.onDocumentIntelligenceFeedbackCreate =
  documentIntelligence.onDocumentIntelligenceFeedbackCreate;
