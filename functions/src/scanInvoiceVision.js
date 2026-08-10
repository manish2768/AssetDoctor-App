/**
 * HTTPS Cloud Function — Google Cloud Vision DOCUMENT_TEXT_DETECTION
 * Auth: Firebase ID token (Bearer). Vision key stays in Functions secret (never in the app).
 */

const { onRequest } = require('firebase-functions/v2/https');
const { getAuth } = require('firebase-admin/auth');
const { logger } = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');
const { GoogleAuth } = require('google-auth-library');

const VISION_API_KEY = defineSecret('VISION_API_KEY');
const MAX_BASE64_CHARS = 5_000_000;

async function extractTextWithVision(imageBase64, apiKey) {
  const body = JSON.stringify({
    requests: [
      {
        image: { content: imageBase64 },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
      },
    ],
  });

  let res;
  if (apiKey) {
    res = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      },
    );
  } else {
    // Fallback: Functions service account (Vision API must be enabled on the GCP project)
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    const client = await auth.getClient();
    const access = await client.getAccessToken();
    const token = access?.token || access;
    if (!token) throw new Error('Could not obtain Google access token for Vision API');

    res = await fetch('https://vision.googleapis.com/v1/images:annotate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body,
    });
  }

  const json = await res.json();
  if (!res.ok) {
    const msg = json?.error?.message || JSON.stringify(json).slice(0, 300);
    throw new Error(`Vision API error: ${msg}`);
  }

  const annotation = json?.responses?.[0];
  if (annotation?.error?.message) {
    throw new Error(annotation.error.message);
  }

  return (
    annotation?.fullTextAnnotation?.text ||
    annotation?.textAnnotations?.[0]?.description ||
    ''
  );
}

exports.scanInvoiceVision = onRequest(
  {
    region: 'asia-south1',
    timeoutSeconds: 60,
    memory: '512MiB',
    cors: true,
    invoker: 'public',
    secrets: [VISION_API_KEY],
  },
  async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    if (req.method !== 'POST') {
      res.status(405).json({ success: false, error: 'POST only' });
      return;
    }

    try {
      const authHeader = String(req.get('Authorization') || '');
      const idToken = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : '';
      if (!idToken) {
        res.status(401).json({ success: false, error: 'Missing Authorization Bearer token' });
        return;
      }

      await getAuth().verifyIdToken(idToken);

      const imageBase64 = String(req.body?.imageBase64 || '').replace(/^data:image\/\w+;base64,/, '');
      if (!imageBase64 || imageBase64.length < 32) {
        res.status(400).json({ success: false, error: 'imageBase64 is required' });
        return;
      }
      if (imageBase64.length > MAX_BASE64_CHARS) {
        res.status(413).json({ success: false, error: 'Image too large for OCR' });
        return;
      }

      const apiKey = VISION_API_KEY.value() || '';
      const text = await extractTextWithVision(imageBase64, apiKey);
      res.status(200).json({
        success: true,
        text,
        engine: apiKey ? 'cloud-vision-key' : 'cloud-vision-adc',
      });
    } catch (error) {
      logger.error('scanInvoiceVision failed', error);
      const message = error?.message || 'OCR failed';
      const status = /auth|token|unauthorized/i.test(message) ? 401 : 500;
      res.status(status).json({ success: false, error: message });
    }
  },
);
