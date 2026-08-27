import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '20mb' }));

// Initialize Gemini Client safely
let aiClient: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  aiClient = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// OCR Receipt Scanning Endpoint
app.post('/api/scan-receipt', async (req, res) => {
  try {
    const { base64Image, mimeType = 'image/jpeg', textContent, sampleType } = req.body;

    // Handle preset simulated samples if requested directly
    if (sampleType === 'flipkart_multi_item' || sampleType === 'flipkart_nothing_3a' || sampleType === 'flipkart_cmf_buds') {
      return res.json({
        success: true,
        source: 'preset_ocr',
        data: {
          vendor: 'Flipkart India Pvt Ltd',
          purchaseDate: '2026-02-14',
          totalAmount: 27298,
          gstin: '29AABCU9603R1ZM',
          items: [
            {
              itemName: 'Nothing Phone (3a) Lite (128GB, White)',
              brand: 'Nothing',
              price: 23999,
              warrantyMonths: 12,
              category: 'Gadgets',
              serialNumber: 'NT-PH3A-884102',
              notes: 'Flipkart Tax Invoice - 1 Year Nothing Brand Warranty & Screen Protection',
              selected: true,
            },
            {
              itemName: 'CMF Buds 2 Plus ANC Wireless Earbuds',
              brand: 'CMF by Nothing',
              price: 3299,
              warrantyMonths: 12,
              category: 'Gadgets',
              serialNumber: 'CMF-BD2P-99120',
              notes: 'Flipkart Verified Order - 50dB ANC Wireless Earbuds with 1 Year Warranty',
              selected: true,
            },
          ],
        },
      });
    } else if (sampleType === 'croma_tv') {
      return res.json({
        success: true,
        source: 'preset_ocr',
        data: {
          vendor: 'Croma Megastore (Infiniti Retail Ltd)',
          purchaseDate: '2025-06-18',
          totalAmount: 115000,
          gstin: '27AAACI0348E1Z8',
          items: [
            {
              itemName: 'LG 65" QNED 4K Smart Mini-LED TV',
              brand: 'LG',
              price: 115000,
              warrantyMonths: 24,
              category: 'Electronics',
              serialNumber: 'SN-LGC-65QNED-2025',
              notes: '2-Year On-Site Manufacturer Warranty + Zero Bright Dot Panel Protection.',
              selected: true,
            },
          ],
        },
      });
    }

    if (!aiClient) {
      return res.status(503).json({
        success: false,
        error: 'Gemini OCR service is unconfigured on server (GEMINI_API_KEY missing).',
      });
    }

    // Call Gemini for OCR parsing
    const parts: any[] = [];

    if (base64Image) {
      let detectedMime = mimeType || 'image/jpeg';
      let cleanedBase64 = base64Image;

      const dataUrlMatch = base64Image.match(/^data:([^;]+);base64,(.+)$/s);
      if (dataUrlMatch) {
        detectedMime = dataUrlMatch[1];
        cleanedBase64 = dataUrlMatch[2];
      } else {
        cleanedBase64 = base64Image.replace(/^data:[^;]+;base64,/, '');
      }

      parts.push({
        inlineData: {
          mimeType: detectedMime,
          data: cleanedBase64,
        },
      });
    }

    const promptText = `You are a strict, zero-hallucination document intelligence engine for Asset Doctor.
CRITICAL ZERO-HALLUCINATION RULES:
1. ONLY extract fields and values physically printed on the document.
2. DO NOT invent, assume, or default any field. If not printed, return null or empty string.
3. NEVER assume warranty is 12 months unless explicitly printed.
4. NEVER invent serial numbers, chassis numbers, odometer readings, or registration numbers.
5. NEVER invent dates. If purchase date is not visible, return null.

Return ONLY structured JSON matching this schema:
{
  "vendor": string | null,
  "purchaseDate": string | null,
  "totalAmount": number | null,
  "gstin": string | null,
  "items": [
    {
      "itemName": string,
      "brand": string | null,
      "price": number | null,
      "warrantyMonths": number | null,
      "category": string,
      "serialNumber": string | null,
      "notes": string | null
    }
  ]
}
${textContent ? `Invoice text content:\n${textContent}` : ''}`;

    parts.push({ text: promptText });

    const response = await aiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsedText = response.text || '{}';
    const jsonResult = JSON.parse(parsedText);

    const extractedItems = (jsonResult.items || []).map((item: any, idx: number) => ({
      itemName: item.itemName || `Item ${idx + 1}`,
      brand: item.brand || null,
      price: typeof item.price === 'number' && Number.isFinite(item.price) ? item.price : null,
      warrantyMonths: typeof item.warrantyMonths === 'number' && Number.isFinite(item.warrantyMonths) ? item.warrantyMonths : null,
      category: ['Electronics', 'Vehicles', 'Appliances', 'Gadgets', 'Home', 'Other'].includes(item.category)
        ? item.category
        : 'Other',
      serialNumber: item.serialNumber || null,
      notes: item.notes || null,
      selected: true,
    }));

    const calculatedTotal = extractedItems.reduce((acc: number, cur: any) => acc + (cur.price || 0), 0);

    return res.json({
      success: true,
      source: 'gemini_ocr',
      data: {
        vendor: jsonResult.vendor || null,
        purchaseDate: jsonResult.purchaseDate || null,
        totalAmount: typeof jsonResult.totalAmount === 'number' ? jsonResult.totalAmount : (calculatedTotal > 0 ? calculatedTotal : null),
        gstin: jsonResult.gstin || null,
        items: extractedItems,
      },
    });
  } catch (err: any) {
    console.error('OCR Scan error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to scan receipt invoice',
    });
  }
});

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', app: 'AssetDoctor ServiVault' });
});

// ====================================================
// Meta WhatsApp Cloud API Webhook Endpoints
// ====================================================

// Webhook Verification (Hub Challenge)
app.get('/api/webhook/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const expectedToken = process.env.META_WEBHOOK_VERIFY_TOKEN || 'assetdoctor_webhook_verify_secret';

  if (mode === 'subscribe' && token === expectedToken) {
    console.log('[Meta Webhook] Webhook subscription verified successfully.');
    return res.status(200).send(challenge);
  }

  console.warn('[Meta Webhook] Verification token mismatch or invalid mode.');
  return res.status(403).json({ error: 'Verification token mismatch' });
});

// Webhook Event Receiver (Message status updates: delivered, read, failed)
app.post('/api/webhook/whatsapp', async (req, res) => {
  try {
    const payload = req.body;

    // Validate payload existence
    if (!payload || !payload.entry) {
      return res.status(200).json({ status: 'ignored', reason: 'empty_payload' });
    }

    const deliveryStatus = payload?.entry?.[0]?.changes?.[0]?.value?.statuses?.[0]?.status;
    console.log('[WHATSAPP_TRACE] DELIVERY_WEBHOOK', deliveryStatus || 'no_status');

    // Update message status in notification engine
    try {
      const { handleWebhookStatusUpdate } = await import('./src/services/whatsapp/WhatsAppNotificationService.js');
      await handleWebhookStatusUpdate(payload);
    } catch (e: any) {
      console.warn('[Meta Webhook Status Process Error]', e?.message);
    }

    return res.status(200).json({ status: 'ok' });
  } catch (err: any) {
    console.error('[Meta Webhook Error]', err?.message || err);
    return res.status(200).json({ status: 'error_handled' });
  }
});

// ====================================================
// Integromat / Make OCR Scenario Webhook Endpoint
// ====================================================
app.post('/api/integromat/ocr-scenario', async (req, res) => {
  try {
    const { rawText, imageUrl, base64Image, existingAssets, metadata } = req.body || {};
    const { IntegromatScenarioEngine } = await import('./services/ocr/integromatScenarioEngine.ts');
    const result = await IntegromatScenarioEngine.executeScenario({
      rawText,
      imageUrl,
      base64Image,
      existingAssets,
      metadata,
    });
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('[Integromat Scenario Error]', err);
    return res.status(500).json({ success: false, error: err?.message || 'Integromat Scenario Execution Failed' });
  }
});

// ====================================================
// Server-Side WhatsApp Production API Routes
// ====================================================

// Safe status check
app.get('/api/whatsapp/status', async (_req, res) => {
  try {
    const { getWhatsAppConfigStatus } = await import('./src/services/whatsapp/MetaWhatsAppService.js');
    return res.json({ success: true, ...getWhatsAppConfigStatus() });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Query approved templates
app.get('/api/whatsapp/templates', async (_req, res) => {
  try {
    const { getWhatsAppTemplates } = await import('./src/services/whatsapp/MetaWhatsAppService.js');
    const result = await getWhatsAppTemplates();
    return res.status(result.success ? 200 : 400).json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Trigger Welcome Notification (server-only; never expose Meta tokens to clients)
app.post('/api/whatsapp/welcome', async (req, res) => {
  try {
    const internalSecret = String(process.env.WHATSAPP_INTERNAL_SECRET || '').trim();
    const provided = String(req.headers['x-internal-secret'] || '').trim();
    if (!internalSecret || provided !== internalSecret) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const { userId, phone, userName } = req.body || {};
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Recipient phone number is required.' });
    }
    const { sendWelcomeNotification } = await import('./src/services/whatsapp/WhatsAppNotificationService.js');
    const result = await sendWelcomeNotification({ userId, phone, userName });
    return res.status(result.success ? 200 : 400).json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Trigger WhatsApp OTP
app.post('/api/whatsapp/otp/send', async (req, res) => {
  try {
    const { userId, phone, otp } = req.body || {};
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Recipient phone number is required.' });
    }
    const { sendOtpNotification } = await import('./src/services/whatsapp/WhatsAppNotificationService.js');
    const result = await sendOtpNotification({ userId, phone, otp });
    return res.status(result.success ? 200 : 400).json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Verify WhatsApp OTP
app.post('/api/whatsapp/otp/verify', async (req, res) => {
  try {
    const { phone, otp } = req.body || {};
    if (!phone || !otp) {
      return res.status(400).json({ success: false, error: 'Phone number and OTP code are required.' });
    }
    const { verifyWhatsAppOtp } = await import('./src/services/whatsapp/WhatsAppNotificationService.js');
    const result = await verifyWhatsAppOtp(phone, otp);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Trigger Document Expiry Reminder
app.post('/api/whatsapp/expiry', async (req, res) => {
  try {
    const { userId, phone, customerName, vehicleName, docType, expiryDate, assetId } = req.body || {};
    if (!phone || !expiryDate) {
      return res.status(400).json({ success: false, error: 'Phone number and expiryDate are required.' });
    }
    const { sendExpiryReminder } = await import('./src/services/whatsapp/WhatsAppNotificationService.js');
    const result = await sendExpiryReminder({
      userId,
      phone,
      customerName,
      vehicleName,
      docType,
      expiryDate,
      assetId,
    });
    return res.status(result.success ? 200 : 400).json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Trigger Service Reminder (Queue / Template Guard)
app.post('/api/whatsapp/service', async (req, res) => {
  try {
    const { userId, phone, userName, vehicleName, odometer, daysLeft } = req.body || {};
    const { sendServiceReminder } = await import('./src/services/whatsapp/WhatsAppNotificationService.js');
    const result = await sendServiceReminder({
      userId,
      phone,
      userName,
      vehicleName,
      odometer,
      daysLeft,
    });
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Retrieve Delivery Audit Logs (Masked)
app.get('/api/whatsapp/logs', async (req, res) => {
  try {
    const filterUserId = (req.query.userId as string) || null;
    const { getNotificationAuditLogs } = await import('./src/services/whatsapp/WhatsAppNotificationService.js');
    const logs = await getNotificationAuditLogs(filterUserId);
    return res.json({ success: true, count: logs.length, logs });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AssetDoctor ServiVault Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
