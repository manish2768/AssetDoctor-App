/**
 * Asset Doctor — Universal Daily Utility Tools Engine
 * Mathematical and algorithmic models for all 7 asset utility calculators.
 * Decoupled, unit-testable, and configuration-driven.
 */

export interface RepairVsReplaceInput {
  assetType: 'VEHICLE' | 'ELECTRONICS' | 'APPLIANCE' | 'HOUSEHOLD' | 'OTHER';
  purchasePrice: number;
  ageYears: number;
  currentEstimatedValue?: number;
  repairCost: number;
  expectedAnnualUsage?: number;
  previousRepairCount: number;
  warrantyStatus: 'ACTIVE' | 'EXPIRED' | 'EXTENDED';
}

export interface RepairVsReplaceResult {
  recommendation: 'REPAIR' | 'REPLACE' | 'MONITOR';
  score: number; // 0 to 100
  repairCostRatio: number; // Percentage of current value
  fairMarketValue: number;
  financialImpactSummary: string;
  reasoning: string[];
  assumptions: string[];
  disclaimer: string;
}

export interface DepreciationResult {
  currentValue: number;
  totalDepreciation: number;
  annualDepreciationRatePercent: number;
  salvageValue: number;
  yearlySchedule: {
    year: number;
    openingValue: number;
    depreciationAmount: number;
    closingValue: number;
  }[];
}

export interface WarrantyExpiryResult {
  expiryDate: string;
  daysRemaining: number;
  status: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED';
  statusLabel: string;
  guidance: string;
}

export interface MaintenanceIntervalResult {
  nextServiceMetric: number;
  remainingMetric: number;
  estimatedDueDate: string;
  isUrgent: boolean;
  statusLabel: string;
}

export interface TcoResult {
  totalCostOfOwnership: number;
  monthlyAverageCost: number;
  dailyCost: number;
  capitalCostPercent: number;
  operatingCostPercent: number;
  breakdown: {
    purchasePrice: number;
    totalMaintenance: number;
    totalEnergyOrFuel: number;
    totalInsuranceAndCompliance: number;
  };
}

export class CalculatorEngine {
  /**
   * 1. Advanced Multi-Factor Repair vs. Replace Engine
   */
  public static calculateRepairVsReplace(input: RepairVsReplaceInput): RepairVsReplaceResult {
    const price = Math.max(1, input.purchasePrice);
    const age = Math.max(0.1, input.ageYears);
    const repairCost = Math.max(0, input.repairCost);

    // 1. Calculate Fair Market Value (FMV) if not provided
    const depreciationRates: Record<string, number> = {
      VEHICLE: 0.15,
      ELECTRONICS: 0.25,
      APPLIANCE: 0.14,
      HOUSEHOLD: 0.10,
      OTHER: 0.15
    };
    const annualRate = depreciationRates[input.assetType] || 0.15;
    const computedFMV = input.currentEstimatedValue && input.currentEstimatedValue > 0
      ? input.currentEstimatedValue
      : Math.max(price * 0.10, Math.round(price * Math.pow(1 - annualRate, age)));

    const repairCostRatio = computedFMV > 0 ? Math.round((repairCost / computedFMV) * 100) : 100;

    // 2. Multi-factor Scoring Model
    let score = 70; // Baseline neutral score favoring repair

    // Factor A: 50% Rule (If repair cost > 50% of FMV, heavy replacement bias)
    if (repairCostRatio >= 75) {
      score -= 45;
    } else if (repairCostRatio >= 50) {
      score -= 30;
    } else if (repairCostRatio <= 20) {
      score += 15;
    }

    // Factor B: Age vs Category Expected Lifespan
    const categoryLifespans: Record<string, number> = {
      VEHICLE: 12,
      ELECTRONICS: 5,
      APPLIANCE: 9,
      HOUSEHOLD: 10,
      OTHER: 8
    };
    const maxLife = categoryLifespans[input.assetType] || 8;
    const lifeRatio = age / maxLife;

    if (lifeRatio >= 0.8) {
      score -= 25; // End of expected useful life
    } else if (lifeRatio <= 0.3) {
      score += 15; // Relatively new asset
    }

    // Factor C: Previous Repair Frequency Penalty
    if (input.previousRepairCount >= 4) {
      score -= 25; // Money pit syndrome
    } else if (input.previousRepairCount >= 2) {
      score -= 10;
    }

    // Factor D: Warranty Status
    if (input.warrantyStatus === 'ACTIVE' || input.warrantyStatus === 'EXTENDED') {
      score += 20; // Potential free OEM claim
    }

    // Clamp score between 0 and 100
    score = Math.max(0, Math.min(100, score));

    // Determine recommendation
    let recommendation: 'REPAIR' | 'REPLACE' | 'MONITOR' = 'MONITOR';
    if (score >= 65) {
      recommendation = 'REPAIR';
    } else if (score <= 40) {
      recommendation = 'REPLACE';
    } else {
      recommendation = 'MONITOR';
    }

    const reasoning: string[] = [];
    if (repairCostRatio >= 50) {
      reasoning.push(`Repair quote (₹${repairCost.toLocaleString('en-IN')}) exceeds 50% of current asset equity (₹${computedFMV.toLocaleString('en-IN')}).`);
    } else {
      reasoning.push(`Repair cost represents ${repairCostRatio}% of asset equity, well within the economic repair threshold.`);
    }

    if (lifeRatio >= 0.75) {
      reasoning.push(`Asset is in its mature lifecycle stage (${age} years of estimated ${maxLife}-year lifespan).`);
    } else {
      reasoning.push(`Asset has substantial remaining service life (${Math.round((maxLife - age) * 10) / 10} years remaining).`);
    }

    if (input.previousRepairCount >= 3) {
      reasoning.push(`High repair frequency (${input.previousRepairCount} prior repairs) suggests accelerating component fatigue.`);
    }

    if (input.warrantyStatus === 'ACTIVE') {
      reasoning.push('Active warranty detected. Check manufacturer coverage before approving paid repairs.');
    }

    const assumptions: string[] = [
      `Assumes replacement hardware carries modern energy/fuel efficiency advantages.`,
      `Depreciation modeled at ${(annualRate * 100)}% per annum for ${input.assetType}.`,
      `Threshold evaluated against standard 50% Fair Market Valuation economic rule.`
    ];

    const financialImpactSummary = recommendation === 'REPLACE'
      ? `Investing ₹${repairCost.toLocaleString('en-IN')} into an aging asset yielding ₹${computedFMV.toLocaleString('en-IN')} equity has negative expected ROI. Upgrading will lower ongoing maintenance overhead.`
      : recommendation === 'REPAIR'
      ? `Repairing for ₹${repairCost.toLocaleString('en-IN')} preserves ₹${computedFMV.toLocaleString('en-IN')} in working utility, delaying capital expenditure for new hardware.`
      : `Get a secondary diagnosis. If repair exceeds ₹${Math.round(computedFMV * 0.45).toLocaleString('en-IN')}, pivot to replacement.`;

    return {
      recommendation,
      score,
      repairCostRatio,
      fairMarketValue: computedFMV,
      financialImpactSummary,
      reasoning,
      assumptions,
      disclaimer: 'This recommendation is an algorithmic financial and operational estimate for informational purposes and does not constitute formal financial appraisal.'
    };
  }

  /**
   * 2. Asset Depreciation Calculator (Declining Balance & Straight Line)
   */
  public static calculateDepreciation(
    purchasePrice: number,
    ageYears: number,
    category: 'VEHICLE' | 'ELECTRONICS' | 'APPLIANCE' | 'HOUSEHOLD' | 'OTHER' = 'VEHICLE',
    method: 'DECLINING_BALANCE' | 'STRAIGHT_LINE' = 'DECLINING_BALANCE'
  ): DepreciationResult {
    const price = Math.max(1, purchasePrice);
    const age = Math.max(0, ageYears);

    const rates: Record<string, { annualRate: number; usefulYears: number; salvagePct: number }> = {
      VEHICLE: { annualRate: 0.15, usefulYears: 12, salvagePct: 0.10 },
      ELECTRONICS: { annualRate: 0.25, usefulYears: 5, salvagePct: 0.05 },
      APPLIANCE: { annualRate: 0.14, usefulYears: 10, salvagePct: 0.08 },
      HOUSEHOLD: { annualRate: 0.10, usefulYears: 12, salvagePct: 0.15 },
      OTHER: { annualRate: 0.15, usefulYears: 8, salvagePct: 0.10 }
    };

    const config = rates[category] || rates.OTHER;
    const salvageValue = Math.round(price * config.salvagePct);

    let currentValue = price;
    const yearlySchedule: DepreciationResult['yearlySchedule'] = [];

    if (age === 0) {
      currentValue = price;
      let runningVal = price;
      for (let y = 1; y <= 5; y++) {
        const dep = Math.round(runningVal * config.annualRate);
        const closing = Math.max(salvageValue, runningVal - dep);
        yearlySchedule.push({
          year: y,
          openingValue: runningVal,
          depreciationAmount: dep,
          closingValue: closing
        });
        runningVal = closing;
      }
    } else if (method === 'DECLINING_BALANCE') {
      currentValue = Math.max(salvageValue, Math.round(price * Math.pow(1 - config.annualRate, age)));
      let runningVal = price;
      for (let y = 1; y <= Math.min(10, Math.ceil(age + 3)); y++) {
        const dep = Math.round(runningVal * config.annualRate);
        const closing = Math.max(salvageValue, runningVal - dep);
        yearlySchedule.push({
          year: y,
          openingValue: runningVal,
          depreciationAmount: dep,
          closingValue: closing
        });
        runningVal = closing;
      }
    } else {
      // STRAIGHT LINE (SLM)
      const annualSLM = (price - salvageValue) / config.usefulYears;
      currentValue = Math.max(salvageValue, Math.round(price - annualSLM * age));
      let runningVal = price;
      for (let y = 1; y <= Math.min(10, Math.ceil(age + 3)); y++) {
        const dep = Math.round(annualSLM);
        const closing = Math.max(salvageValue, runningVal - dep);
        yearlySchedule.push({
          year: y,
          openingValue: runningVal,
          depreciationAmount: dep,
          closingValue: closing
        });
        runningVal = closing;
      }
    }

    return {
      currentValue,
      totalDepreciation: price - currentValue,
      annualDepreciationRatePercent: Math.round(config.annualRate * 100),
      salvageValue,
      yearlySchedule
    };
  }

  /**
   * 3. Warranty Expiry Calculator
   */
  public static calculateWarranty(
    purchaseDateStr: string,
    warrantyMonths: number,
    extendedMonths: number = 0
  ): WarrantyExpiryResult {
    const pDate = new Date(purchaseDateStr || Date.now());
    const totalMonths = warrantyMonths + extendedMonths;
    const expiryDate = new Date(pDate);
    expiryDate.setMonth(expiryDate.getMonth() + totalMonths);

    const now = new Date();
    const diffMs = expiryDate.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    let status: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' = 'ACTIVE';
    let statusLabel = 'Active Coverage';
    let guidance = 'All manufacturing defects and covered hardware components are eligible for authorized OEM claims.';

    if (daysRemaining < 0) {
      status = 'EXPIRED';
      statusLabel = `Expired ${Math.abs(daysRemaining)} Days Ago`;
      guidance = 'Warranty has expired. Consider preventive maintenance or extended warranty AMC to cap out-of-pocket repair risks.';
    } else if (daysRemaining <= 30) {
      status = 'EXPIRING_SOON';
      statusLabel = `Expiring Soon (${daysRemaining} Days Left)`;
      guidance = 'Perform a complete hardware health check now. Claim any lingering defects before the warranty window closes.';
    } else {
      statusLabel = `Active (${daysRemaining} Days Remaining)`;
    }

    return {
      expiryDate: expiryDate.toISOString().split('T')[0],
      daysRemaining,
      status,
      statusLabel,
      guidance
    };
  }

  /**
   * 4. Total Cost of Ownership (TCO) Calculator
   */
  public static calculateTco(
    purchasePrice: number,
    annualMaintenance: number,
    annualEnergyOrFuel: number,
    annualInsurance: number,
    yearsOwned: number = 5
  ): TcoResult {
    const price = Math.max(0, purchasePrice);
    const years = Math.max(1, yearsOwned);
    const totalMaint = annualMaintenance * years;
    const totalEnergy = annualEnergyOrFuel * years;
    const totalIns = annualInsurance * years;
    const totalTco = price + totalMaint + totalEnergy + totalIns;

    const capitalPct = totalTco > 0 ? Math.round((price / totalTco) * 100) : 100;
    const operatingPct = 100 - capitalPct;

    const totalDays = years * 365.25;

    return {
      totalCostOfOwnership: totalTco,
      monthlyAverageCost: Math.round(totalTco / (years * 12)),
      dailyCost: Math.round(totalTco / totalDays),
      capitalCostPercent: capitalPct,
      operatingCostPercent: operatingPct,
      breakdown: {
        purchasePrice: price,
        totalMaintenance: totalMaint,
        totalEnergyOrFuel: totalEnergy,
        totalInsuranceAndCompliance: totalIns
      }
    };
  }

  /**
   * 5. Asset Fair Market Value & Resale Estimator
   */
  public static calculateAssetValue(
    purchasePrice: number,
    ageMonths: number,
    category: 'ELECTRONICS' | 'VEHICLE' | 'APPLIANCE' | 'HOUSEHOLD' | 'OTHER' = 'ELECTRONICS',
    condition: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' = 'GOOD'
  ) {
    const price = Math.max(100, purchasePrice);
    const ageYears = Math.max(0.08, ageMonths / 12);

    const baseDepreciation = this.calculateDepreciation(price, ageYears, category, 'DECLINING_BALANCE');
    const conditionMultipliers: Record<string, number> = {
      EXCELLENT: 1.12,
      GOOD: 1.00,
      FAIR: 0.85,
      POOR: 0.65
    };
    const mult = conditionMultipliers[condition] || 1.0;
    const estimatedValue = Math.round(baseDepreciation.currentValue * mult);
    const resaleRetainedPct = Math.round((estimatedValue / price) * 100);

    return {
      estimatedValue,
      originalPrice: price,
      retainedPercentage: resaleRetainedPct,
      conditionBonus: condition === 'EXCELLENT' ? '+12% Premium for complete documentation & box' : condition === 'POOR' ? '-35% Penalty for cosmetic/functional defects' : 'Standard Market Baseline',
      liquidityRating: resaleRetainedPct > 50 ? 'HIGH LIQUIDITY' : resaleRetainedPct > 25 ? 'MODERATE LIQUIDITY' : 'LOW LIQUIDITY',
      optimalResaleWindow: ageMonths < 36 ? 'Sell within next 6–12 months before major generational price drop.' : 'Asset has stabilized near terminal residual equity.'
    };
  }

  /**
   * 6. Document Expiry & Compliance Tracker
   */
  public static calculateDocumentExpiry(
    issueDateStr: string,
    validityMonths: number,
    documentType: 'INSURANCE' | 'PUC' | 'AMC' | 'FITNESS' | 'WARRANTY_CERT' = 'INSURANCE'
  ) {
    const issueDate = new Date(issueDateStr || Date.now());
    const expiryDate = new Date(issueDate);
    expiryDate.setMonth(expiryDate.getMonth() + validityMonths);

    const now = new Date();
    const diffMs = expiryDate.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    let status: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' = 'VALID';
    let alertLevel: 'SUCCESS' | 'WARNING' | 'CRITICAL' = 'SUCCESS';
    let complianceNotice = 'Document is legally compliant and active.';

    if (daysRemaining < 0) {
      status = 'EXPIRED';
      alertLevel = 'CRITICAL';
      complianceNotice = documentType === 'INSURANCE'
        ? 'CRITICAL: Driving with expired motor insurance violates Section 146 of MV Act. Subject to ₹2,000–₹4,000 fine and legal liability.'
        : documentType === 'PUC'
        ? 'CRITICAL: Expired PUC attracts ₹10,000 penalty under Section 190(2) MV Act.'
        : 'Contract has expired. Renewal required to maintain preventative coverage.';
    } else if (daysRemaining <= 15) {
      status = 'EXPIRING_SOON';
      alertLevel = 'WARNING';
      complianceNotice = `Action required: Renew within ${daysRemaining} days to prevent policy lapse or regulatory penalties.`;
    }

    return {
      documentType,
      expiryDate: expiryDate.toISOString().split('T')[0],
      daysRemaining,
      status,
      alertLevel,
      complianceNotice
    };
  }

  /**
   * 7. Lifetime Operational Cost Engine
   */
  public static calculateLifetimeCost(
    purchasePrice: number,
    expectedLifespanYears: number,
    annualOperatingCost: number
  ) {
    const price = Math.max(1000, purchasePrice);
    const lifespan = Math.max(1, expectedLifespanYears);
    const cumulativeOperating = annualOperatingCost * lifespan;
    const totalLifetimeCost = price + cumulativeOperating;

    return {
      purchasePrice: price,
      lifespanYears: lifespan,
      annualOperatingCost,
      cumulativeOperatingCost: cumulativeOperating,
      totalLifetimeCost,
      operatingMultiplier: Math.round((cumulativeOperating / price) * 10) / 10,
      annualEquivalentCost: Math.round(totalLifetimeCost / lifespan),
      costEfficiencyRating: cumulativeOperating < price ? 'HIGH EFFICIENCY' : cumulativeOperating < price * 2 ? 'MODERATE OVERHEAD' : 'HIGH OPERATING OVERHEAD'
    };
  }
}
