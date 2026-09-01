/**
 * Asset Doctor — Google Cloud Vision Engine (DOCUMENT_TEXT_DETECTION)
 * Server-side authenticated Cloud Function proxy.
 * Client secrets are never bundled.
 */

export class GoogleVisionEngine {
  private static CLOUD_VISION_URL = 'https://asia-south1-assetdoctor-5fd25.cloudfunctions.net/scanInvoiceVision';

  public static async recognize(base64Image: string, authToken?: string): Promise<{ success: boolean; rawText: string; durationMs: number; error?: string }> {
    const startTime = Date.now();
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000); // 12s timeout budget

      const res = await fetch(this.CLOUD_VISION_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ imageBase64: base64Image }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`Google Vision Cloud Function error ${res.status}`);
      }

      const json = await res.json();
      return {
        success: Boolean(json.success && json.text),
        rawText: json.text || '',
        durationMs: Date.now() - startTime,
        error: json.error
      };
    } catch (e: any) {
      return {
        success: false,
        rawText: '',
        durationMs: Date.now() - startTime,
        error: e?.message || 'Google Vision recognition failed'
      };
    }
  }
}
