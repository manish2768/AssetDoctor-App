/**
 * Asset Doctor — Feature Flag Service
 * Controls progressive rollout of modules, experimental features, and tier-gated capabilities.
 */

export type FeatureFlagKey =
  | 'universal_document_analyzer'
  | 'repair_vs_replace_calculator'
  | 'family_asset_wallet'
  | 'p2b_partner_portal'
  | 'ai_vision_scam_guard'
  | 'smart_countdown_widget'
  | 'industrial_asset_module'
  | 'solar_energy_telemetry';

export interface FeatureFlagDefinition {
  key: FeatureFlagKey;
  label: string;
  description: string;
  enabled: boolean;
  stage: 'STABLE' | 'BETA' | 'PREMIUM' | 'PARTNER_ONLY' | 'ADMIN_ONLY';
}

const DEFAULT_FLAGS: Record<FeatureFlagKey, FeatureFlagDefinition> = {
  universal_document_analyzer: {
    key: 'universal_document_analyzer',
    label: 'Smart Document Analyzer',
    description: 'Instant OCR & intelligence extraction across all Indian vehicle and asset bills',
    enabled: true,
    stage: 'STABLE'
  },
  repair_vs_replace_calculator: {
    key: 'repair_vs_replace_calculator',
    label: 'Repair vs Replace Decision Engine',
    description: 'Calculates asset depreciation curve against projected repair expense',
    enabled: true,
    stage: 'STABLE'
  },
  family_asset_wallet: {
    key: 'family_asset_wallet',
    label: 'Family Asset Wallet',
    description: 'Shared household asset dashboard with delegated permissions',
    enabled: true,
    stage: 'STABLE'
  },
  ai_vision_scam_guard: {
    key: 'ai_vision_scam_guard',
    label: 'Gemini AI Vision & Scam Guard',
    description: 'Detects GSTIN anomalies and inflated merchant invoice items',
    enabled: true,
    stage: 'STABLE'
  },
  smart_countdown_widget: {
    key: 'smart_countdown_widget',
    label: 'Smart Expiry Countdown Widget',
    description: 'Real-time countdown to warranty, insurance, and service due milestones',
    enabled: true,
    stage: 'STABLE'
  },
  p2b_partner_portal: {
    key: 'p2b_partner_portal',
    label: 'P2B / B2B Workshop & Dealer Portal',
    description: 'Direct integration for verified service centers and automotive dealers',
    enabled: false,
    stage: 'PARTNER_ONLY'
  },
  industrial_asset_module: {
    key: 'industrial_asset_module',
    label: 'Industrial & Heavy Equipment Module',
    description: 'Telemetry, runtime hours, and preventive maintenance for heavy machinery',
    enabled: false,
    stage: 'BETA'
  },
  solar_energy_telemetry: {
    key: 'solar_energy_telemetry',
    label: 'Solar & Inverter Battery Telemetry',
    description: 'Tracks solar panel warranty, inverter battery cycles, and degradation',
    enabled: false,
    stage: 'BETA'
  }
};

class FeatureFlagService {
  private flags: Map<FeatureFlagKey, FeatureFlagDefinition> = new Map();

  constructor() {
    Object.values(DEFAULT_FLAGS).forEach(f => this.flags.set(f.key, f));
  }

  public isEnabled(key: FeatureFlagKey, userRole: string = 'OWNER'): boolean {
    const flag = this.flags.get(key);
    if (!flag) return false;
    if (flag.enabled) return true;
    if (userRole === 'SUPER_ADMIN') return true;
    return false;
  }

  public getAllFlags(): FeatureFlagDefinition[] {
    return Array.from(this.flags.values());
  }

  public setFlag(key: FeatureFlagKey, enabled: boolean): void {
    const flag = this.flags.get(key);
    if (flag) {
      flag.enabled = enabled;
    }
  }
}

export const featureFlagService = new FeatureFlagService();
