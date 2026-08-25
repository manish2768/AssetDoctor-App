/**
 * Asset Doctor — AI Provider Abstraction
 * Decouples domain intelligence from external AI providers (Gemini, OpenAI, Claude, or local heuristics).
 */

export interface AIAnalysisRequest {
  task: 'DOCUMENT_UNDERSTANDING' | 'ASSET_CLASSIFICATION' | 'MAINTENANCE_EXPLANATION' | 'NATURAL_LANGUAGE_SEARCH';
  prompt: string;
  rawText?: string;
  context?: Record<string, any>;
}

export interface AIAnalysisResponse {
  provider: 'GEMINI' | 'OPENAI' | 'LOCAL_HEURISTICS';
  success: boolean;
  result: any;
  confidence: number;
  modelVersion: string;
  latencyMs: number;
}

export interface AIProviderInterface {
  name: string;
  isAvailable(): boolean;
  analyze(request: AIAnalysisRequest): Promise<AIAnalysisResponse>;
}

export class LocalHeuristicProvider implements AIProviderInterface {
  public name = 'LOCAL_HEURISTICS';

  public isAvailable(): boolean {
    return true; // Always available offline
  }

  public async analyze(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    const start = Date.now();
    const text = (request.rawText || request.prompt || '').toLowerCase();

    let result: any = {};
    if (request.task === 'ASSET_CLASSIFICATION') {
      if (text.includes('bike') || text.includes('car') || text.includes('ronin') || text.includes('creta') || text.includes('activa')) {
        result = { category: 'VEHICLE', confidence: 0.95 };
      } else if (text.includes('phone') || text.includes('laptop') || text.includes('iphone') || text.includes('galaxy')) {
        result = { category: 'ELECTRONICS', confidence: 0.95 };
      } else if (text.includes('ac') || text.includes('air conditioner') || text.includes('conditioner') || text.includes('geyser') || text.includes('refrigerator') || text.includes('fridge') || text.includes('ro') || text.includes('washing machine') || text.includes('daikin')) {
        result = { category: 'APPLIANCE', confidence: 0.95 };
      } else {
        result = { category: 'CUSTOM', confidence: 0.70 };
      }
    }

    return {
      provider: 'LOCAL_HEURISTICS',
      success: true,
      result,
      confidence: result.confidence || 0.85,
      modelVersion: 'deterministic-rules-v1.0',
      latencyMs: Date.now() - start
    };
  }
}

export class AIProviderManager {
  private activeProvider: AIProviderInterface = new LocalHeuristicProvider();

  public setProvider(provider: AIProviderInterface): void {
    this.activeProvider = provider;
  }

  public getActiveProvider(): AIProviderInterface {
    return this.activeProvider;
  }

  public async analyze(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    try {
      if (this.activeProvider.isAvailable()) {
        return await this.activeProvider.analyze(request);
      }
    } catch (err) {
      console.warn('[AIProvider] Active provider failed, falling back to local heuristics:', err);
    }
    // Fallback to local heuristic engine
    const fallback = new LocalHeuristicProvider();
    return await fallback.analyze(request);
  }
}

export const aiProvider = new AIProviderManager();
