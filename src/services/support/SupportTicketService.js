/**
 * Support Ticket Service — Asset Doctor Support & Help Desk
 * Manages user support tickets, status updates, priority tags, and conversation threads.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const TICKETS_STORAGE_KEY = 'asset_doctor_support_tickets_v1';

export const TICKET_STATUS = Object.freeze({
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  WAITING_FOR_USER: 'waiting_for_user',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
});

export const TICKET_PRIORITY = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
});

export const TICKET_CATEGORY = Object.freeze({
  OCR_ISSUE: 'ocr_issue',
  DOCUMENT_UPLOAD: 'document_upload',
  SERVICE_REMINDER: 'service_reminder',
  WARRANTY_TRACKING: 'warranty_tracking',
  ACCOUNT_SECURITY: 'account_security',
  BILLING_PLAN: 'billing_plan',
  GENERAL_FEEDBACK: 'general_feedback',
});

function generateTicketId() {
  const y = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `TICK-${y}-${rand}`;
}

export const SupportTicketService = {
  /**
   * Create a new support ticket
   */
  async createTicket({
    userId,
    userEmail,
    userName,
    userPhone,
    assetId = null,
    assetName = null,
    category = TICKET_CATEGORY.GENERAL_FEEDBACK,
    subject,
    description,
    priority = TICKET_PRIORITY.MEDIUM,
  }) {
    if (!userId || !subject || !description) {
      throw new Error('Missing required ticket fields: userId, subject, description');
    }

    const ticketId = generateTicketId();
    const now = new Date().toISOString();

    const newTicket = {
      ticketId,
      userId,
      userEmail: userEmail || '',
      userName: userName || '',
      userPhone: userPhone || '',
      assetId: assetId || null,
      assetName: assetName || null,
      category,
      subject: String(subject).trim(),
      description: String(description).trim(),
      priority,
      status: TICKET_STATUS.OPEN,
      createdAt: now,
      updatedAt: now,
      assignedAdmin: null,
      messages: [
        {
          id: `msg-${Date.now()}-1`,
          sender: 'user',
          senderName: userName || 'User',
          message: String(description).trim(),
          timestamp: now,
        },
      ],
    };

    const existing = await this.getAllTickets();
    const updated = [newTicket, ...existing];
    await AsyncStorage.setItem(TICKETS_STORAGE_KEY, JSON.stringify(updated));

    return newTicket;
  },

  /**
   * Get all tickets for a specific user
   */
  async getUserTickets(userId) {
    if (!userId) return [];
    const all = await this.getAllTickets();
    return all.filter((t) => t.userId === userId);
  },

  /**
   * Get all tickets across all users (for Admin console)
   */
  async getAllTickets() {
    try {
      const raw = await AsyncStorage.getItem(TICKETS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  /**
   * Get single ticket by ID
   */
  async getTicketById(ticketId) {
    const all = await this.getAllTickets();
    return all.find((t) => t.ticketId === ticketId) || null;
  },

  /**
   * Add a message / reply to an existing ticket
   */
  async addMessage(ticketId, { sender, senderName, message }) {
    if (!ticketId || !message) return null;
    const all = await this.getAllTickets();
    const idx = all.findIndex((t) => t.ticketId === ticketId);
    if (idx === -1) return null;

    const now = new Date().toISOString();
    const msg = {
      id: `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      sender: sender || 'user',
      senderName: senderName || 'User',
      message: String(message).trim(),
      timestamp: now,
    };

    all[idx].messages = [...(all[idx].messages || []), msg];
    all[idx].updatedAt = now;

    if (sender === 'admin' && all[idx].status === TICKET_STATUS.OPEN) {
      all[idx].status = TICKET_STATUS.WAITING_FOR_USER;
    } else if (sender === 'user' && all[idx].status === TICKET_STATUS.WAITING_FOR_USER) {
      all[idx].status = TICKET_STATUS.IN_PROGRESS;
    }

    await AsyncStorage.setItem(TICKETS_STORAGE_KEY, JSON.stringify(all));
    return all[idx];
  },

  /**
   * Update ticket status (e.g. resolve or close)
   */
  async updateStatus(ticketId, nextStatus, adminId = null) {
    const all = await this.getAllTickets();
    const idx = all.findIndex((t) => t.ticketId === ticketId);
    if (idx === -1) return null;

    const now = new Date().toISOString();
    all[idx].status = nextStatus;
    all[idx].updatedAt = now;
    if (adminId) all[idx].assignedAdmin = adminId;

    await AsyncStorage.setItem(TICKETS_STORAGE_KEY, JSON.stringify(all));
    return all[idx];
  },
};

export default SupportTicketService;
