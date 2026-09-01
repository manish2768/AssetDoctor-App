import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore';

import { db } from '../../firebase';

const FUNCTIONS_REGION = 'asia-south1';

const functions = getFunctions(getApp(), FUNCTIONS_REGION);

const createSupportTicketCallable = httpsCallable(
  functions,
  'createSupportTicket'
);

const updateSupportTicketStatusCallable = httpsCallable(
  functions,
  'updateSupportTicketStatus'
);

const addSupportTicketMessageCallable = httpsCallable(
  functions,
  'addSupportTicketMessage'
);

export const TICKET_STATUS = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  WAITING_FOR_USER: 'WAITING_FOR_USER',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
};

export const TICKET_PRIORITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
};

function normalizeTicket(data, fallbackId = null) {
  if (!data) return null;

  return {
    ...data,
    id: data.id || fallbackId || data.ticketId || null,
    ticketId: data.ticketId || fallbackId || null,
    messages: Array.isArray(data.messages) ? data.messages : [],
  };
}

const SupportTicketService = {
  /**
   * Create a support ticket.
   *
   * IMPORTANT:
   * Ticket number is generated ONLY on the server.
   * Mobile app never generates ticket numbers.
   */
  async createTicket({
    userId,
    userEmail = '',
    userName = '',
    userPhone = '',
    assetId = null,
    assetName = null,
    category = 'GENERAL',
    subject,
    description,
    priority = TICKET_PRIORITY.MEDIUM,
  }) {
    if (!userId || !subject || !description) {
      throw new Error(
        'Missing required ticket fields: userId, subject, description'
      );
    }

    const result = await createSupportTicketCallable({
      userName: String(userName || '').trim(),
      userEmail: String(userEmail || '').trim(),

      assetId: assetId ? String(assetId).trim() : null,
      assetName: assetName ? String(assetName).trim() : null,

      category: String(category || 'GENERAL').trim(),
      subject: String(subject).trim(),
      description: String(description).trim(),
      priority,
    });

    const data = result?.data || {};

    if (!data.success || !data.ticketId) {
      throw new Error('Support ticket creation failed.');
    }

    /*
     * Return the same shape expected by the existing UI.
     * userId is retained locally in the returned object for compatibility,
     * but the server remains the source of truth.
     */
    return {
      ticketId: data.ticketId,
      userId,
      userEmail: String(userEmail || '').trim(),
      userName: String(userName || '').trim(),
      userPhone: String(userPhone || '').trim(),
      assetId: assetId || null,
      assetName: assetName || null,
      category: String(category || 'GENERAL').trim(),
      subject: String(subject).trim(),
      description: String(description).trim(),
      priority,
      status: data.status || TICKET_STATUS.OPEN,
      createdAt: null,
      updatedAt: null,
      assignedAdmin: null,
      messages: [],
    };
  },

  /**
   * Get all tickets for a specific user.
   *
   * Source of truth = Firestore.
   * No AsyncStorage.
   */
  async getUserTickets(userId) {
    if (!userId) return [];

    try {
      const ticketsRef = collection(db, 'support_tickets');

      const q = query(
        ticketsRef,
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);

      return snapshot.docs.map((ticketDoc) =>
        normalizeTicket(ticketDoc.data(), ticketDoc.id)
      );
    } catch (error) {
      console.error(
        '[SupportTicketService] getUserTickets failed:',
        error?.message || error
      );

      /*
       * Firestore may require an index for the query above.
       * Fall back to a simpler query so the app still works.
       */
      try {
        const fallbackQuery = query(
          collection(db, 'support_tickets'),
          where('userId', '==', userId)
        );

        const snapshot = await getDocs(fallbackQuery);

        const tickets = snapshot.docs.map((ticketDoc) =>
          normalizeTicket(ticketDoc.data(), ticketDoc.id)
        );

        return tickets.sort((a, b) => {
          const aTime = a.createdAt?.toMillis
            ? a.createdAt.toMillis()
            : 0;

          const bTime = b.createdAt?.toMillis
            ? b.createdAt.toMillis()
            : 0;

          return bTime - aTime;
        });
      } catch (fallbackError) {
        console.error(
          '[SupportTicketService] fallback query failed:',
          fallbackError?.message || fallbackError
        );

        return [];
      }
    }
  },

  /**
   * Get all tickets.
   *
   * Intended for admin-side usage.
   */
  async getAllTickets() {
    try {
      const snapshot = await getDocs(
        collection(db, 'support_tickets')
      );

      return snapshot.docs.map((ticketDoc) =>
        normalizeTicket(ticketDoc.data(), ticketDoc.id)
      );
    } catch (error) {
      console.error(
        '[SupportTicketService] getAllTickets failed:',
        error?.message || error
      );

      return [];
    }
  },

  /**
   * Get one ticket by server-generated ticket ID.
   */
  async getTicketById(ticketId) {
    if (!ticketId) return null;

    try {
      const ticketRef = doc(
        db,
        'support_tickets',
        String(ticketId)
      );

      const snapshot = await getDoc(ticketRef);

      if (!snapshot.exists()) {
        return null;
      }

      return normalizeTicket(snapshot.data(), snapshot.id);
    } catch (error) {
      console.error(
        '[SupportTicketService] getTicketById failed:',
        error?.message || error
      );

      return null;
    }
  },

  /**
   * Add a reply message through the backend.
   *
   * The Cloud Function enforces owner-isolation (a user may only reply to
   * their own ticket) and derives sender identity from Firebase Auth, never
   * from client-supplied fields.
   */
  async addMessage(ticketId, { sender, senderName, message }) {
    if (!ticketId || !message) {
      return null;
    }

    const result = await addSupportTicketMessageCallable({
      ticketId: String(ticketId),
      senderName: String(senderName || '').trim(),
      message: String(message).trim(),
    });

    const data = result?.data || {};

    if (!data.success) {
      throw new Error('Support ticket reply failed.');
    }

    return {
      ticketId: data.ticketId || ticketId,
      message: data.message || { sender, senderName, message },
    };
  },

  /**
   * Update ticket status through the backend.
   */
  async updateStatus(ticketId, nextStatus, adminId = null) {
    if (!ticketId || !nextStatus) {
      return null;
    }

    const result = await updateSupportTicketStatusCallable({
      ticketId: String(ticketId),
      status: String(nextStatus),
    });

    const data = result?.data || {};

    if (!data.success) {
      throw new Error('Support ticket status update failed.');
    }

    return {
      ticketId: data.ticketId || ticketId,
      status: data.status || nextStatus,
      assignedAdmin: adminId || null,
    };
  },
};

export default SupportTicketService;
