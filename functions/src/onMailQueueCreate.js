/**
 * Firestore trigger — welcome / verification emails (Resend | SendGrid)
 * Hardened: validates payload, secrets optional, never throws uncaught after catch.
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { logger } = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');

const RESEND_API_KEY = defineSecret('RESEND_API_KEY');
const SENDGRID_API_KEY = defineSecret('SENDGRID_API_KEY');
const EMAIL_FROM = defineSecret('EMAIL_FROM');

function buildEmail(job) {
  const name = String(job.data?.name || 'Asset Owner').slice(0, 80);
  const tagline = String(
    job.data?.tagline || 'Protect, Track & Save: The Smart Asset Vault',
  ).slice(0, 200);
  const appName = String(job.data?.appName || 'Asset Doctor').slice(0, 80);

  if (job.template === 'welcome') {
    return {
      subject: `Welcome to ${appName}`,
      html: `<h1>Welcome, ${name}!</h1><p>${tagline}</p>
        <p>Track warranties, PUC, insurance, service schedules, and repair logs in one vault.</p>`,
    };
  }

  if (job.template === 'reminder') {
    const subject = String(job.data?.subject || `${appName} reminder`).slice(0, 120);
    const body = String(job.data?.body || job.data?.message || '').slice(0, 2000);
    return {
      subject,
      html: `<h1>${subject}</h1><p>Hi ${name},</p><p>${body.replace(/\n/g, '<br/>')}</p>
        <p>— ${appName}</p>`,
    };
  }

  const link = String(job.data?.verifyLink || '#').slice(0, 500);
  return {
    subject: `Verify your ${appName} email`,
    html: `<h1>Verify your email</h1><p>Hi ${name},</p>
      <p><a href="${link}">Verify Email</a></p>`,
  };
}

async function sendWithResend({ to, from, subject, html, apiKey }) {
  if (!apiKey) throw new Error('RESEND_API_KEY not configured');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Resend error: ${text}`);
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function sendWithSendGrid({ to, from, subject, html, apiKey }) {
  if (!apiKey) throw new Error('SENDGRID_API_KEY not configured');
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from },
      subject,
      content: [{ type: 'text/html', value: html }],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`SendGrid error: ${text}`);
  }
  return true;
}

exports.onMailQueueCreate = onDocumentCreated(
  {
    document: 'mail_queue/{jobId}',
    region: 'asia-south1',
    secrets: [RESEND_API_KEY, SENDGRID_API_KEY, EMAIL_FROM],
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return null;

    let job;
    try {
      job = snap.data();
    } catch (err) {
      logger.error('mail_queue read failed', err);
      return null;
    }

    if (!job || job.status !== 'pending') return null;
    if (!job.to || typeof job.to !== 'string') {
      await snap.ref.set({ status: 'error', error: 'invalid to' }, { merge: true }).catch(() => null);
      return null;
    }

    const provider = String(job.provider || 'resend').toLowerCase();
    const from = EMAIL_FROM.value() || 'Asset Doctor <onboarding@resend.dev>';
    const { subject, html } = buildEmail(job);

    try {
      if (provider === 'sendgrid') {
        await sendWithSendGrid({
          to: job.to,
          from,
          subject,
          html,
          apiKey: SENDGRID_API_KEY.value(),
        });
      } else {
        await sendWithResend({
          to: job.to,
          from,
          subject,
          html,
          apiKey: RESEND_API_KEY.value(),
        });
      }

      await snap.ref.set(
        { status: 'sent', sentAt: FieldValue.serverTimestamp() },
        { merge: true },
      );

      if (job.template === 'welcome' && job.data?.uid) {
        await getFirestore()
          .collection('Users')
          .doc(String(job.data.uid))
          .set({ welcomeEmailSent: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
          .catch((err) => logger.warn('welcome flag failed', err));
      }

      logger.info('mail_queue sent', { to: job.to, template: job.template, provider });
    } catch (err) {
      logger.error('mail_queue failed', { err: String(err) });
      await snap.ref
        .set({ status: 'error', error: String(err.message || err) }, { merge: true })
        .catch(() => null);
    }

    return null;
  },
);
