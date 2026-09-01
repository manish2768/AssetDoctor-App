const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

const db = admin.firestore();

const REGION = 'asia-south1';

const TICKET_STATUS = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  WAITING_FOR_USER: 'WAITING_FOR_USER',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
};

const TICKET_PRIORITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
};

function clean(value, max = 2000) {
  return String(value ?? '').trim().slice(0, max);
}

function requireAuth(request) {
  if (!request.auth?.uid) {
    throw new HttpsError(
      'unauthenticated',
      'You must be signed in to create a support ticket.'
    );
  }

  return request.auth.uid;
}

function isAdminRequest(request) {
  return (
    request.auth &&
    request.auth.token &&
    request.auth.token.super_admin === true
  );
}

function currentTimestamp() {
  return admin.firestore.FieldValue.serverTimestamp();
}

async function generateServerTicketId() {
  const counterRef = db.collection('system_counters').doc('support_tickets');

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);

    const current = snap.exists
      ? Number(snap.data()?.lastNumber || 0)
      : 0;

    const next = current + 1;

    tx.set(
      counterRef,
      {
        lastNumber: next,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return `TICK-${String(next).padStart(6, '0')}`;
  });
}

exports.createSupportTicket = onCall(
  { region: REGION },
  async (request) => {
    const userId = requireAuth(request);

    const data = request.data || {};

    const subject = clean(data.subject, 200);
    const description = clean(data.description, 5000);

    if (!subject || !description) {
      throw new HttpsError(
        'invalid-argument',
        'subject and description are required.'
      );
    }

    const category = clean(data.category, 100) || 'GENERAL';
    const priority =
      Object.values(TICKET_PRIORITY).includes(data.priority)
        ? data.priority
        : TICKET_PRIORITY.MEDIUM;

    const ticketId = await generateServerTicketId();

    const now = admin.firestore.FieldValue.serverTimestamp();

    const ticket = {
      ticketId,
      userId,

      // Never trust these as identity/security fields.
      userName: clean(data.userName, 150),
      userEmail: clean(data.userEmail, 250),

      assetId: clean(data.assetId, 200) || null,
      assetName: clean(data.assetName, 200) || null,

      category,
      subject,
      description,
      priority,

      status: TICKET_STATUS.OPEN,

      assignedAdmin: null,

      createdAt: now,
      updatedAt: now,

      source: 'MOBILE_APP',

      messages: [
        {
          id: `msg-${Date.now()}`,
          sender: 'user',
          senderName: clean(data.userName, 150) || 'User',
          message: description,
          timestamp: new Date().toISOString(),
        },
      ],
    };

    const ref = db.collection('support_tickets').doc(ticketId);

    await ref.create(ticket);

    return {
      success: true,
      ticketId,
      status: TICKET_STATUS.OPEN,
    };
  }
);

exports.updateSupportTicketStatus = onCall(
  { region: REGION },
  async (request) => {
    const adminUid = requireAuth(request);

    // Only admins may mutate a ticket's status / assignment.
    if (!isAdminRequest(request)) {
      throw new HttpsError(
        'permission-denied',
        'Only admin users can update support ticket status.'
      );
    }

    const data = request.data || {};
    const ticketId = clean(data.ticketId, 100);
    const nextStatus = clean(data.status, 50);

    if (!ticketId || !nextStatus) {
      throw new HttpsError(
        'invalid-argument',
        'ticketId and status are required.'
      );
    }

    if (!Object.values(TICKET_STATUS).includes(nextStatus)) {
      throw new HttpsError(
        'invalid-argument',
        'Invalid ticket status.'
      );
    }

    const ref = db.collection('support_tickets').doc(ticketId);
    const snap = await ref.get();

    if (!snap.exists) {
      throw new HttpsError(
        'not-found',
        'Support ticket not found.'
      );
    }

    await ref.update({
      status: nextStatus,
      assignedAdmin: adminUid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      ticketId,
      status: nextStatus,
    };
  }
);


/**
 * Add a reply message to a support ticket.
 *
 * Authorization:
 * - A signed-in user may reply only to their OWN ticket (owner isolation).
 * - An admin (super_admin claim) may reply to any ticket.
 *
 * Identity is taken from Firebase Auth, never from client-supplied fields.
 */
exports.addSupportTicketMessage = onCall(
  { region: REGION },
  async (request) => {
    const uid = requireAuth(request);
    const isAdmin = isAdminRequest(request);

    const data = request.data || {};
    const ticketId = clean(data.ticketId, 100);
    const message = clean(data.message, 5000);

    if (!ticketId || !message) {
      throw new HttpsError(
        'invalid-argument',
        'ticketId and message are required.'
      );
    }

    const ref = db.collection('support_tickets').doc(ticketId);
    const snap = await ref.get();

    if (!snap.exists) {
      throw new HttpsError('not-found', 'Support ticket not found.');
    }

    const ticket = snap.data() || {};

    // Owner isolation: non-admins may only touch their own tickets.
    if (!isAdmin && ticket.userId !== uid) {
      throw new HttpsError(
        'permission-denied',
        'You can only reply to your own support tickets.'
      );
    }

    const existing = Array.isArray(ticket.messages) ? ticket.messages : [];
    const nextMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sender: isAdmin ? 'admin' : 'user',
      senderName: isAdmin
        ? clean(data.senderName, 150) || 'Support Team'
        : clean(ticket.userName, 150) || 'User',
      message,
      timestamp: new Date().toISOString(),
    };

    const patch = {
      messages: [...existing, nextMessage],
      updatedAt: currentTimestamp(),
    };

    // A user replying flips the ticket back to admin action if it was waiting on them.
    if (!isAdmin && ticket.status === TICKET_STATUS.WAITING_FOR_USER) {
      patch.status = TICKET_STATUS.IN_PROGRESS;
    }

    await ref.update(patch);

    return {
      success: true,
      ticketId,
      message: nextMessage,
    };
  }
);
