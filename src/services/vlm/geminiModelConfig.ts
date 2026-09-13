/**
 * Asset Doctor — Gemini VLM Model Configuration
 *
 * Centralized model constants and failover strategy for Document Intelligence:
 * - Primary: 'gemini-1.5-flash' (stable active Google multi-modal model)
 * - Fallbacks: 'gemini-1.5-flash-8b', 'gemini-2.0-flash'
 *
 * Enforces per-request timeout to prevent infinite stalls on slow networks.
 */

import { GoogleGenerativeAI, GenerativeModel, ModelParams } from '@google/generative-ai';

export const PRIMARY_GEMINI_VLM_MODEL = 'gemini-2.0-flash';
export const FALLBACK_GEMINI_VLM_MODELS = ['gemini-1.5-flash', 'gemini-1.5-flash-8b'];

/**
 * Robust JSON extraction from LLM/VLM text responses.
 * Strips markdown code fences (```json ... ```) and extracts the valid JSON object/array.
 */
export function safeParseGeminiJson<T = any>(rawText: string | null | undefined): T {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Empty JSON response from AI');
  }
  let cleaned = rawText.trim();
  // Strip markdown fences
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
  cleaned = cleaned.replace(/\s*```$/i, '');
  cleaned = cleaned.trim();

  // Find bounding braces if wrapped in extraneous text
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  } else {
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      cleaned = cleaned.slice(firstBracket, lastBracket + 1);
    }
  }

  return JSON.parse(cleaned) as T;
}

/**
 * Creates a generative model instance using the primary model.
 */
export function getGeminiVlmModel(
  genAI: GoogleGenerativeAI,
  params: Omit<ModelParams, 'model'>,
): GenerativeModel {
  return genAI.getGenerativeModel({
    ...params,
    model: PRIMARY_GEMINI_VLM_MODEL,
  });
}

/**
 * Executes generateContent with automatic model failover and strict timeout per attempt.
 */
export async function generateContentWithFailover(
  genAI: GoogleGenerativeAI,
  modelParams: Omit<ModelParams, 'model'>,
  contents: Parameters<GenerativeModel['generateContent']>[0],
  timeoutMs: number = 15000,
): Promise<ReturnType<GenerativeModel['generateContent']>> {
  const modelsToTry = [PRIMARY_GEMINI_VLM_MODEL, ...FALLBACK_GEMINI_VLM_MODELS];
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    for (let attempt = 0; attempt < 1; attempt++) {
      try {
        const model = genAI.getGenerativeModel({
          ...modelParams,
          model: modelName,
        });

        let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(
            () => reject(new Error(`Gemini request timeout after ${timeoutMs}ms (${modelName})`)),
            timeoutMs,
          );
        });

        try {
          const res = await Promise.race([
            model.generateContent(contents),
            timeoutPromise,
          ]);

          (res as any).modelUsed = modelName;
          return res;
        } finally {
          if (timeoutHandle) clearTimeout(timeoutHandle);
        }
      } catch (err: any) {
        lastError = err;
        const msg = err?.message || String(err);

        // On quota/rate-limit (429), fail over immediately to the next model without burning backoff time
        if (msg.includes('429') || msg.includes('quota') || msg.includes('rate limit')) {
          console.warn(`[GeminiVlm] Model ${modelName} 429 quota exhausted, switching to next model immediately...`);
          break;
        }

        // On timeout, fail over immediately to next model or let caller fallback to deterministic OCR
        if (msg.includes('timeout')) {
          console.warn(`[GeminiVlm] Model ${modelName} timed out (${timeoutMs}ms), skipping retries...`);
          break;
        }

        if (
          msg.includes('503') ||
          msg.includes('high demand') ||
          msg.includes('overloaded')
        ) {
          console.warn(
            `[GeminiVlm] Model ${modelName} spike (attempt ${attempt + 1}/1): ${msg.slice(0, 100)}, switching model...`,
          );
          break;
        }
        // If 404 or unsupported model, skip immediate retry and try next model
        if (msg.includes('404') || msg.includes('not found') || msg.includes('no longer available')) {
          console.warn(`[GeminiVlm] Model ${modelName} not available, trying next model in list...`);
          break;
        }
        throw err;
      }
    }
  }

  throw lastError;
}
