/**
 * Asset Doctor — Microsoft Azure Computer Vision Read OCR Service
 * High-precision fallback when Google Cloud Vision confidence is below 80% or fails.
 *
 * SECURITY POLICY:
 * The Azure API Key MUST NEVER be hardcoded or shipped inside the client-side JavaScript/Android bundle.
 * On mobile/client, requests route through the authenticated Firebase Cloud Function backend proxy.
 * In server-side environments (Cloud Functions / backend / test runners), it reads from process.env.AZURE_VISION_KEY.
 */

const DEFAULT_AZURE_PROXY_URL =
  'https://asia-south1-assetdoctor-5fd25.cloudfunctions.net/scanInvoiceVision';

export class AzureOcrService {
  /**
   * Recognizes text from base64 image data using Azure Computer Vision Read API
   * @param {string} base64Image - raw base64 or data URI
   * @param {string} [authToken] - optional Firebase Auth bearer token
   * @returns {Promise<{ success: boolean, text: string, lines: string[], error?: string }>}
   */
  static async recognizeBase64(base64Image, authToken, opts = {}) {
    if (!base64Image) {
      return { success: false, text: '', lines: [], error: 'Empty image payload' };
    }

    const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

    // 1. SERVER-SIDE EXECUTION (Cloud Functions / Node Backend / Secure Test Runner)
    // Only available when running server-side where process.env.AZURE_VISION_KEY is injected into environment
    const serverKey = typeof process !== 'undefined' && process.env ? process.env.AZURE_VISION_KEY : null;
    const serverEndpoint = (typeof process !== 'undefined' && process.env && process.env.AZURE_VISION_ENDPOINT
      ? process.env.AZURE_VISION_ENDPOINT
      : 'https://ssetdoctorocr.cognitiveservices.azure.com/').replace(/\/+$/, '');

    if (serverKey) {
      return this._executeDirectAzureOcr(cleanBase64, serverEndpoint, serverKey);
    }

    // 2. CLIENT-SIDE EXECUTION (Android / React Native Client App)
    // Routes securely through authenticated Firebase Cloud Function backend proxy
    return this._executeViaCloudFunction(cleanBase64, authToken, opts);
  }

  /**
   * Client-side secure proxy call through Firebase Cloud Function
   * @private
   */
  static async _executeViaCloudFunction(cleanBase64, authToken, opts = {}) {
    const trimmed = cleanBase64.length > 4_500_000 ? cleanBase64.slice(0, 4_500_000) : cleanBase64;

    let token = authToken || null;
    if (!token) {
      try {
        const authMod = require('@react-native-firebase/auth');
        const auth = authMod?.default || authMod;
        const user = auth().currentUser;
        if (user) {
          token = await user.getIdToken();
        }
      } catch {
        // Offline or non-firebase environment
      }
    }

    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const proxyUrl =
      (typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_OCR_AZURE_URL) ||
      DEFAULT_AZURE_PROXY_URL;

    const timeoutMs = Math.max(1, Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : 12000);
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

    try {
      const res = await fetch(proxyUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          imageBase64: trimmed,
          engine: 'azure',
          fallback: true
        }),
        signal: controller ? controller.signal : undefined,
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        return {
          success: false,
          text: '',
          lines: [],
          error: json?.error || `Azure Proxy HTTP ${res.status}`,
        };
      }

      const text = String(json.text || '');
      const lines = text ? text.split('\n').filter(Boolean) : [];
      return { success: true, text, lines };
    } catch (err) {
      const aborted = /abort/i.test(String(err?.message || err || ''));
      return {
        success: false,
        text: '',
        lines: [],
        aborted,
        error: aborted ? 'aborted' : err?.message || 'Azure Cloud Function proxy call failed',
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /**
   * Direct Azure Computer Vision execution (Server-side / Backend ONLY)
   * @private
   */
  static async _executeDirectAzureOcr(cleanBase64, endpoint, apiKey) {
    try {
      let binaryData;
      if (typeof Buffer !== 'undefined') {
        binaryData = Buffer.from(cleanBase64, 'base64');
      } else {
        const raw = atob(cleanBase64);
        const uint8 = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) {
          uint8[i] = raw.charCodeAt(i);
        }
        binaryData = uint8;
      }

      // Modern Azure Computer Vision 4.0 synchronous Read API
      const syncUrl = `${endpoint}/computervision/imageanalysis:analyze?api-version=2024-02-01&features=read`;
      try {
        const syncRes = await fetch(syncUrl, {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': apiKey,
            'Content-Type': 'application/octet-stream'
          },
          body: binaryData
        });

        if (syncRes.ok) {
          const syncJson = await syncRes.json();
          const blocks = syncJson?.readResult?.blocks || [];
          const lines = [];
          for (const block of blocks) {
            for (const line of block.lines || []) {
              if (line.text) lines.push(line.text);
            }
          }
          if (lines.length > 0) {
            return {
              success: true,
              text: lines.join('\n'),
              lines
            };
          }
        }
      } catch (syncErr) {
        // Fallback to async if sync fails
      }

      // Fallback: Azure Computer Vision v3.2 Asynchronous Read API
      const asyncUrl = `${endpoint}/vision/v3.2/read/analyze`;
      const submitRes = await fetch(asyncUrl, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': apiKey,
          'Content-Type': 'application/octet-stream'
        },
        body: binaryData
      });

      if (submitRes.status !== 202) {
        const errBody = await submitRes.text();
        return {
          success: false,
          text: '',
          lines: [],
          error: `Azure submit failed (HTTP ${submitRes.status}): ${errBody}`
        };
      }

      const operationLocation = submitRes.headers.get('Operation-Location') || submitRes.headers.get('operation-location');
      if (!operationLocation) {
        return {
          success: false,
          text: '',
          lines: [],
          error: 'No Operation-Location header received from Azure'
        };
      }

      let attempts = 0;
      const maxAttempts = 15;
      const pollIntervalMs = 700;

      while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, pollIntervalMs));
        attempts++;

        const pollRes = await fetch(operationLocation, {
          method: 'GET',
          headers: {
            'Ocp-Apim-Subscription-Key': apiKey
          }
        });

        if (pollRes.ok) {
          const pollJson = await pollRes.json();
          const status = pollJson?.status;

          if (status === 'succeeded') {
            const readResults = pollJson?.analyzeResult?.readResults || [];
            const lines = [];
            for (const page of readResults) {
              for (const line of page.lines || []) {
                if (line.text) lines.push(line.text);
              }
            }
            return {
              success: true,
              text: lines.join('\n'),
              lines
            };
          }

          if (status === 'failed') {
            return {
              success: false,
              text: '',
              lines: [],
              error: 'Azure async OCR status returned failed'
            };
          }
        }
      }

      return {
        success: false,
        text: '',
        lines: [],
        error: 'Azure async OCR timed out after 15 polling attempts'
      };
    } catch (error) {
      return {
        success: false,
        text: '',
        lines: [],
        error: error?.message || 'Azure OCR execution failed'
      };
    }
  }
}

export default AzureOcrService;
