/**
 * Asset Doctor — Multi-Provider Field Candidate & Fusion Engine
 *
 * Implements field-level candidate tracking, validation, provider weighting,
 * consensus detection, and deterministic resolution:
 * - Collects candidates across Document AI, Cloud Vision, Azure, and ML Kit
 * - Evaluates candidates against strict field validators
 * - Boosts confidence upon multi-provider agreement
 * - Generates clear field status (FOUND / REVIEW / NOT_FOUND)
 */

export interface FieldCandidate<T = any> {
  field: string;
  value: T;
  normalizedValue: T;
  provider: 'DocumentAI' | 'GoogleVision' | 'Azure' | 'MlKit' | 'LayoutRegex' | 'Heuristic';
  rawEvidence: string;
  confidence: number;
  validationStatus: 'VALID' | 'NEEDS_REVIEW' | 'INVALID' | 'NOT_FOUND';
  boundingBox?: any;
}

export interface ResolvedField<T = any> {
  field: string;
  value: T | null;
  normalizedValue: T | null;
  confidence: number;
  status: 'VERIFIED' | 'HIGH_CONFIDENCE' | 'NEEDS_REVIEW' | 'NOT_FOUND';
  decision: 'AUTO_ACCEPT' | 'REVIEW_RECOMMENDED' | 'NOT_FOUND';
  provider: string;
  evidence: string;
  candidatesCount: number;
  agreementCount: number;
}

export class FieldCandidateEngine {
  private candidates: Map<string, FieldCandidate[]> = new Map();

  /**
   * Registers an extracted candidate for a given field.
   */
  public addCandidate<T = any>(candidate: FieldCandidate<T>): void {
    if (candidate.value == null || candidate.value === '') return;
    const list = this.candidates.get(candidate.field) || [];
    list.push(candidate);
    this.candidates.set(candidate.field, list);
  }

  public registerCandidate<T = any>(candidate: any): void {
    this.addCandidate({
      field: candidate.field,
      value: candidate.value,
      normalizedValue: candidate.normalizedValue ?? candidate.value,
      provider: candidate.provider || 'LayoutRegex',
      rawEvidence: candidate.rawEvidence || '',
      confidence: candidate.confidence ?? 0.9,
      validationStatus: candidate.validationStatus || 'VALID',
    });
  }

  /**
   * Returns all registered candidates for a field.
   */
  public getCandidates(field: string): FieldCandidate[] {
    return this.candidates.get(field) || [];
  }

  /**
   * Resolves the authoritative winning value for a field.
   */
  public resolveField<T = any>(
    field: string,
    validator?: (val: T) => { valid: boolean; normalized?: T; error?: string }
  ): ResolvedField<T> {
    const list = this.candidates.get(field) || [];
    if (list.length === 0) {
      return {
        field,
        value: null,
        normalizedValue: null,
        confidence: 0,
        status: 'NOT_FOUND',
        decision: 'NOT_FOUND',
        provider: 'none',
        evidence: 'Not found on document',
        candidatesCount: 0,
        agreementCount: 0,
      };
    }

    // Provider reliability multipliers
    const providerWeights: Record<string, number> = {
      DocumentAI: 1.25,
      GoogleVision: 1.15,
      Azure: 1.1,
      MlKit: 0.95,
      LayoutRegex: 1.0,
      Heuristic: 0.85,
    };

    // Score and validate each candidate
    const scored = list.map((c) => {
      let valid = c.validationStatus === 'VALID';
      let norm = c.normalizedValue;

      if (validator) {
        const valRes = validator(c.value);
        valid = valRes.valid;
        if (valRes.normalized !== undefined) norm = valRes.normalized;
      }

      const pWeight = providerWeights[c.provider] || 1.0;
      let score = c.confidence * pWeight;

      if (!valid) {
        score *= 0.3; // Heavy penalty for failing domain validator
      }

      return {
        candidate: c,
        valid,
        normalized: norm,
        score,
      };
    });

    // Sort scored candidates descending
    scored.sort((a, b) => b.score - a.score);
    const top = scored[0];

    // Check agreement across distinct providers
    const matchingNormalized = scored.filter(
      (s) => String(s.normalized).toLowerCase() === String(top.normalized).toLowerCase()
    );
    const distinctProviders = new Set(matchingNormalized.map((m) => m.candidate.provider));
    const agreementCount = distinctProviders.size;

    let finalConfidence = top.candidate.confidence;
    if (agreementCount >= 2 && top.valid) {
      finalConfidence = Math.min(0.99, finalConfidence + 0.08); // Multi-provider agreement boost
    }

    let status: ResolvedField['status'] = 'NEEDS_REVIEW';
    let decision: ResolvedField['decision'] = 'REVIEW_RECOMMENDED';

    if (top.valid && finalConfidence >= 0.88) {
      status = 'HIGH_CONFIDENCE';
      decision = 'AUTO_ACCEPT';
    } else if (top.valid && finalConfidence >= 0.7) {
      status = 'HIGH_CONFIDENCE';
      decision = 'AUTO_ACCEPT';
    } else if (!top.valid) {
      status = 'NEEDS_REVIEW';
      decision = 'REVIEW_RECOMMENDED';
    }

    return {
      field,
      value: top.candidate.value,
      normalizedValue: top.normalized,
      confidence: Math.round(finalConfidence * 100) / 100,
      status,
      decision,
      provider: top.candidate.provider,
      evidence: top.candidate.rawEvidence,
      candidatesCount: list.length,
      agreementCount,
    };
  }

  /**
   * Resolves a dictionary of all registered fields.
   */
  public resolveAll(validators: Record<string, (val: any) => { valid: boolean; normalized?: any }>): Record<string, ResolvedField> {
    const out: Record<string, ResolvedField> = {};
    for (const field of this.candidates.keys()) {
      out[field] = this.resolveField(field, validators[field]);
    }
    return out;
  }
}
