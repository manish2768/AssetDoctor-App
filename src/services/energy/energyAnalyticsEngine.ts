/**
 * Asset Doctor — Energy Doctor Analytics Engine
 *
 * Pure, deterministic calculation engine for household electricity intelligence:
 * - Month-over-Month bill & consumption change percentages
 * - Daily consumption (kWh/day) & cost per unit (₹/kWh)
 * - Transparent 3-tier color logic (Green, Yellow, Red) with causal explanation
 * - Deterministic Energy Health Score (0 - 100) or "Building your score"
 * - Honest Smart Insights (zero fabricated appliance claims)
 * - Bill forecast estimate range (explicitly marked as estimate only)
 * - Due date monitoring
 */

import { ElectricityBillRecord, EnergyAnalytics } from './electricityBillSchema';

function parseIsoDate(d?: string | null): Date | null {
  if (!d) return null;
  const t = new Date(d).getTime();
  return isNaN(t) ? null : new Date(d);
}

function round(val: number, decimals: number = 1): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

function formatDisplayMonth(yearMonth: string): string {
  if (!yearMonth) return '';
  const parts = yearMonth.split('-');
  if (parts.length < 2) return yearMonth;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const yearShort = parts[0].slice(-2);
  if (monthIdx >= 0 && monthIdx < 12) {
    return `${monthNames[monthIdx]} '${yearShort}`;
  }
  return yearMonth;
}

export class EnergyAnalyticsEngine {
  /**
   * Sorts bills chronologically ascending by billingMonth or billDate.
   */
  public static sortBills(bills: ElectricityBillRecord[]): ElectricityBillRecord[] {
    return [...bills].sort((a, b) => {
      const mA = a.billingMonth || a.billDate || '';
      const mB = b.billingMonth || b.billDate || '';
      return mA.localeCompare(mB);
    });
  }

  /**
   * Filter bills strictly by month (YYYY-MM).
   * Guarantees: September NEVER returns August data.
   */
  public static filterBillsByMonth(
    bills: ElectricityBillRecord[],
    targetMonth: string
  ): ElectricityBillRecord[] {
    if (!targetMonth) return [];
    return bills.filter((b) => (b.billingMonth || '').trim() === targetMonth.trim());
  }

  /**
   * Computes comprehensive Energy Doctor analytics.
   */
  public static computeEnergyAnalytics(
    bills: ElectricityBillRecord[],
    selectedMonth?: string
  ): EnergyAnalytics {
    const sorted = this.sortBills(bills);

    if (sorted.length === 0) {
      return this.buildEmptyAnalytics();
    }

    // Determine target record
    let targetIdx = sorted.length - 1;
    if (selectedMonth) {
      const foundIdx = sorted.findIndex((b) => b.billingMonth === selectedMonth);
      if (foundIdx !== -1) {
        targetIdx = foundIdx;
      }
    }

    const current = sorted[targetIdx];
    const previous = targetIdx > 0 ? sorted[targetIdx - 1] : null;

    const currentBill = Number(current.currentBillAmount) || 0;
    const previousBill = previous ? Number(previous.currentBillAmount) || 0 : null;
    const billChangePercent =
      previousBill != null && previousBill > 0
        ? round(((currentBill - previousBill) / previousBill) * 100, 1)
        : null;

    const currentUnits = Number(current.unitsConsumedKwh) || 0;
    const previousUnits = previous ? Number(previous.unitsConsumedKwh) || 0 : null;
    const consumptionChangePercent =
      previousUnits != null && previousUnits > 0
        ? round(((currentUnits - previousUnits) / previousUnits) * 100, 1)
        : null;

    const billingDays = Math.max(1, Number(current.billingDays) || 30);
    const previousBillingDays = previous ? Math.max(1, Number(previous.billingDays) || 30) : null;

    const dailyConsumption = round(currentUnits / billingDays, 1);
    const previousDailyConsumption =
      previousUnits != null && previousBillingDays != null
        ? round(previousUnits / previousBillingDays, 1)
        : null;
    const dailyConsumptionChangePercent =
      previousDailyConsumption != null && previousDailyConsumption > 0
        ? round(((dailyConsumption - previousDailyConsumption) / previousDailyConsumption) * 100, 1)
        : null;

    const costPerUnit = currentUnits > 0 ? round(currentBill / currentUnits, 2) : 0;

    // Determine status color and explanation
    const { statusColor, statusLabel, statusSummary, explanation } = this.determineStatusAndExplanation(
      currentBill,
      previousBill,
      billChangePercent,
      currentUnits,
      previousUnits,
      consumptionChangePercent,
      billingDays,
      previousBillingDays,
      dailyConsumptionChangePercent
    );

    // Generate honest, non-fabricated insights
    const insights = this.generateHonestInsights(
      currentBill,
      previousBill,
      billChangePercent,
      currentUnits,
      previousUnits,
      consumptionChangePercent,
      dailyConsumption,
      previousDailyConsumption,
      billingDays,
      previousBillingDays,
      costPerUnit
    );

    // Deterministic Energy Health Score
    const { healthScore, healthScoreLabel } = this.calculateHealthScore(
      sorted,
      targetIdx,
      consumptionChangePercent,
      dailyConsumptionChangePercent,
      costPerUnit
    );

    // Forecast estimate
    const forecast = this.calculateForecast(sorted, targetIdx);

    // Due date alert
    const dueStatus = this.calculateDueStatus(current.dueDate);

    // 6-month history trend
    const recentSlice = sorted.slice(Math.max(0, targetIdx - 5), targetIdx + 1);
    const historyTrend = recentSlice.map((b) => {
      const days = Math.max(1, Number(b.billingDays) || 30);
      const units = Number(b.unitsConsumedKwh) || 0;
      return {
        month: b.billingMonth,
        displayMonth: formatDisplayMonth(b.billingMonth),
        billAmount: Number(b.currentBillAmount) || 0,
        unitsConsumed: units,
        dailyKwh: round(units / days, 1),
      };
    });

    return {
      currentBill,
      previousBill,
      billChangePercent,
      currentUnits,
      previousUnits,
      consumptionChangePercent,
      billingDays,
      previousBillingDays,
      dailyConsumption,
      previousDailyConsumption,
      dailyConsumptionChangePercent,
      costPerUnit,
      statusColor,
      statusLabel,
      statusSummary,
      explanation,
      insights,
      healthScore,
      healthScoreLabel,
      forecast,
      dueStatus,
      historyTrend,
    };
  }

  private static determineStatusAndExplanation(
    currentBill: number,
    previousBill: number | null,
    billChangePercent: number | null,
    currentUnits: number,
    previousUnits: number | null,
    consumptionChangePercent: number | null,
    billingDays: number,
    previousBillingDays: number | null,
    dailyConsumptionChangePercent: number | null
  ) {
    if (previousUnits == null || consumptionChangePercent == null) {
      return {
        statusColor: 'GREEN' as const,
        statusLabel: 'Baseline Recorded',
        statusSummary: 'First electricity bill logged for this account',
        explanation: {
          billChangeText: `Current bill is ₹${currentBill.toLocaleString('en-IN')}.`,
          consumptionChangeText: `Total consumption is ${currentUnits} kWh across ${billingDays} days.`,
          billingDaysText: `${billingDays} billing days recorded.`,
          conclusionText: 'Next month we will begin comparative energy intelligence.',
        },
      };
    }

    const daysDiff = previousBillingDays != null ? billingDays - previousBillingDays : 0;
    const daysText =
      Math.abs(daysDiff) <= 1
        ? 'Billing days were similar.'
        : daysDiff > 1
        ? `This billing period was ${daysDiff} days longer (${billingDays} vs ${previousBillingDays} days).`
        : `This billing period was ${Math.abs(daysDiff)} days shorter (${billingDays} vs ${previousBillingDays} days).`;

    const billDir = (billChangePercent ?? 0) < 0 ? 'decreased' : 'increased';
    const consDir = consumptionChangePercent < 0 ? 'decreased' : 'increased';

    const billChangeText = `Your bill ${billDir} by ${Math.abs(billChangePercent ?? 0)}%.`;
    const consumptionChangeText = `Consumption ${consDir} by ${Math.abs(consumptionChangePercent)}%.`;

    let statusColor: 'GREEN' | 'YELLOW' | 'RED' = 'YELLOW';
    let statusLabel = 'Stable';
    let statusSummary = 'Energy consumption remained stable';
    let conclusionText = 'Consumption and billing remained close to last month.';

    // Logic:
    // Green: meaningful improvement (consumption down by >= 3% or bill down with flat consumption)
    if (consumptionChangePercent <= -3) {
      statusColor = 'GREEN';
      statusLabel = 'Good';
      statusSummary = 'Energy usage is improving';
      conclusionText = 'Therefore the reduction is primarily due to lower electricity consumption.';
    } else if (consumptionChangePercent >= 15 || (dailyConsumptionChangePercent != null && dailyConsumptionChangePercent >= 15)) {
      // Red: significant increase (consumption jumped >= 15%)
      statusColor = 'RED';
      statusLabel = 'Energy Alert';
      statusSummary = 'Consumption increased significantly';
      if (Math.abs(daysDiff) >= 4 && (dailyConsumptionChangePercent == null || dailyConsumptionChangePercent < 8)) {
        conclusionText = 'The bill increase is partly driven by a longer billing period rather than higher daily intensity.';
      } else {
        conclusionText = 'Higher daily electricity consumption drove this increase.';
      }
    } else if ((billChangePercent ?? 0) > 10 && Math.abs(consumptionChangePercent) <= 4) {
      // Bill up but consumption stable
      statusColor = 'YELLOW';
      statusLabel = 'Stable';
      statusSummary = 'Bill increased while consumption stayed flat';
      conclusionText = 'Consumption was nearly unchanged; the difference may reflect tariff slab rates or fixed charge adjustments.';
    } else if (Math.abs(consumptionChangePercent) < 3) {
      statusColor = 'YELLOW';
      statusLabel = 'Stable';
      statusSummary = 'Energy consumption remained steady';
      conclusionText = 'Household energy demand was consistent with the previous cycle.';
    } else {
      statusColor = consumptionChangePercent < 0 ? 'GREEN' : 'YELLOW';
      statusLabel = consumptionChangePercent < 0 ? 'Good' : 'Stable';
      statusSummary = consumptionChangePercent < 0 ? 'Energy usage improved' : 'Moderate increase in usage';
      conclusionText = `Consumption ${consDir} moderately.`;
    }

    return {
      statusColor,
      statusLabel,
      statusSummary,
      explanation: {
        billChangeText,
        consumptionChangeText,
        billingDaysText: daysText,
        conclusionText,
      },
    };
  }

  private static generateHonestInsights(
    currentBill: number,
    previousBill: number | null,
    billChangePercent: number | null,
    currentUnits: number,
    previousUnits: number | null,
    consumptionChangePercent: number | null,
    dailyConsumption: number,
    previousDailyConsumption: number | null,
    billingDays: number,
    previousBillingDays: number | null,
    costPerUnit: number
  ): string[] {
    const list: string[] = [];

    if (previousUnits != null && consumptionChangePercent != null) {
      if (consumptionChangePercent < 0) {
        list.push(`💡 Your electricity consumption is ${Math.abs(consumptionChangePercent)}% lower than last month.`);
      } else if (consumptionChangePercent > 0) {
        list.push(`💡 Your electricity consumption is ${consumptionChangePercent}% higher than last month.`);
      } else {
        list.push('💡 Your electricity consumption remained exactly the same as last month.');
      }
    }

    if (previousDailyConsumption != null) {
      if (Math.abs(dailyConsumption - previousDailyConsumption) >= 0.2) {
        list.push(
          `💡 Your average daily consumption changed from ${previousDailyConsumption} to ${dailyConsumption} kWh/day.`
        );
      } else {
        list.push(`💡 Daily energy intensity held steady at ~${dailyConsumption} kWh/day.`);
      }
    } else {
      list.push(`💡 Your average daily electricity consumption is ${dailyConsumption} kWh/day.`);
    }

    if (previousBillingDays != null && Math.abs(billingDays - previousBillingDays) >= 3) {
      list.push(
        `💡 This month's billing cycle is ${Math.abs(billingDays - previousBillingDays)} days ${
          billingDays > previousBillingDays ? 'longer' : 'shorter'
        } (${billingDays} vs ${previousBillingDays} days), which impacts total units billed.`
      );
    }

    if (costPerUnit > 0) {
      list.push(`💡 Effective electricity cost this month is ₹${costPerUnit}/kWh.`);
    }

    return list;
  }

  private static calculateHealthScore(
    sorted: ElectricityBillRecord[],
    targetIdx: number,
    consumptionChangePercent: number | null,
    dailyConsumptionChangePercent: number | null,
    costPerUnit: number
  ): { healthScore: number | null; healthScoreLabel: string } {
    if (sorted.length < 2 || targetIdx < 1) {
      return {
        healthScore: null,
        healthScoreLabel: 'Building your Energy Health score',
      };
    }

    // Deterministic scoring algorithm out of 100 points
    let score = 75; // Baseline healthy score

    // 1. Consumption trend component (up to +/- 15 points)
    if (consumptionChangePercent != null) {
      if (consumptionChangePercent <= -10) {
        score += 15;
      } else if (consumptionChangePercent < 0) {
        score += 8;
      } else if (consumptionChangePercent <= 3) {
        score += 4;
      } else if (consumptionChangePercent <= 15) {
        score -= 6;
      } else {
        score -= 15;
      }
    }

    // 2. Daily intensity component (up to +/- 10 points)
    if (dailyConsumptionChangePercent != null) {
      if (dailyConsumptionChangePercent <= -5) {
        score += 10;
      } else if (dailyConsumptionChangePercent <= 0) {
        score += 5;
      } else if (dailyConsumptionChangePercent <= 5) {
        score += 2;
      } else {
        score -= 8;
      }
    }

    // 3. Billing consistency & data completeness (+5 points)
    const current = sorted[targetIdx];
    if (current.previousMeterReading > 0 && current.currentMeterReading > 0 && current.dueDate) {
      score += 5;
    }

    // Clamp score strictly between 10 and 100
    const finalScore = Math.min(100, Math.max(10, Math.round(score)));
    let label = 'Fair';
    if (finalScore >= 80) label = 'Good';
    else if (finalScore < 60) label = 'Attention Needed';

    return { healthScore: finalScore, healthScoreLabel: label };
  }

  private static calculateForecast(
    sorted: ElectricityBillRecord[],
    targetIdx: number
  ): {
    available: boolean;
    minAmount: number | null;
    maxAmount: number | null;
    disclaimer: string;
  } {
    if (sorted.length < 2 || targetIdx < 1) {
      return {
        available: false,
        minAmount: null,
        maxAmount: null,
        disclaimer: 'Need more monthly data to estimate your next bill.',
      };
    }

    const last2 = [sorted[targetIdx], sorted[targetIdx - 1]];
    const avgBill = (Number(last2[0].currentBillAmount) + Number(last2[1].currentBillAmount)) / 2;

    const minAmount = Math.round((avgBill * 0.94) / 10) * 10;
    const maxAmount = Math.round((avgBill * 1.06) / 10) * 10;

    return {
      available: true,
      minAmount,
      maxAmount,
      disclaimer: 'Based on recent consumption patterns. Estimate only.',
    };
  }

  private static calculateDueStatus(dueDateStr?: string): {
    isDueSoon: boolean;
    isOverdue: boolean;
    daysRemaining: number | null;
    message: string | null;
  } {
    if (!dueDateStr) {
      return { isDueSoon: false, isOverdue: false, daysRemaining: null, message: null };
    }

    const due = parseIsoDate(dueDateStr);
    if (!due) {
      return { isDueSoon: false, isOverdue: false, daysRemaining: null, message: null };
    }

    const now = new Date();
    // Normalize to midnight
    const dueMidnight = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
    const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const diffDays = Math.ceil((dueMidnight - nowMidnight) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        isDueSoon: false,
        isOverdue: true,
        daysRemaining: diffDays,
        message: '🔴 Electricity bill overdue.',
      };
    }

    if (diffDays <= 7) {
      const dayText = diffDays === 0 ? 'today' : diffDays === 1 ? 'tomorrow' : `in ${diffDays} days`;
      return {
        isDueSoon: true,
        isOverdue: false,
        daysRemaining: diffDays,
        message: `🔔 Electricity bill due ${dayText}.`,
      };
    }

    return {
      isDueSoon: false,
      isOverdue: false,
      daysRemaining: diffDays,
      message: null,
    };
  }

  private static buildEmptyAnalytics(): EnergyAnalytics {
    return {
      currentBill: 0,
      previousBill: null,
      billChangePercent: null,
      currentUnits: 0,
      previousUnits: null,
      consumptionChangePercent: null,
      billingDays: 30,
      previousBillingDays: null,
      dailyConsumption: 0,
      previousDailyConsumption: null,
      dailyConsumptionChangePercent: null,
      costPerUnit: 0,
      statusColor: 'GREEN',
      statusLabel: 'No Bills Yet',
      statusSummary: 'Scan your first electricity bill to unlock Energy Doctor',
      explanation: {
        billChangeText: 'No electricity bill recorded.',
        consumptionChangeText: 'Scan an electricity bill to track consumption.',
        billingDaysText: '',
        conclusionText: 'Your energy intelligence will appear here.',
      },
      insights: ['💡 Scan your electricity bill to track consumption, predict costs, and monitor energy health.'],
      healthScore: null,
      healthScoreLabel: 'Building your Energy Health score',
      forecast: {
        available: false,
        minAmount: null,
        maxAmount: null,
        disclaimer: 'Need more monthly data to estimate your next bill.',
      },
      dueStatus: {
        isDueSoon: false,
        isOverdue: false,
        daysRemaining: null,
        message: null,
      },
      historyTrend: [],
    };
  }
}
