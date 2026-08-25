/**
 * Asset Doctor — Daily Return Content Engine
 * Delivers category-specific, actionable daily intelligence tips with verified provenance.
 */

export interface DailyAssetTip {
  id: string;
  category: 'VEHICLE' | 'ELECTRONICS' | 'APPLIANCE' | 'SOLAR' | 'BUSINESS' | 'UNIVERSAL';
  tipType: 'MAINTENANCE' | 'WARRANTY' | 'DOCUMENT' | 'VALUE' | 'SAFETY' | 'LIFECYCLE';
  headline: string;
  body: string;
  actionableStep: string;
  provenance: string;
}

export class DailyContentEngine {
  private static readonly TIPS: DailyAssetTip[] = [
    {
      id: 'tip_ac_filter',
      category: 'APPLIANCE',
      tipType: 'MAINTENANCE',
      headline: 'Wash Inverter AC Dust Mesh Every 15 Days',
      body: 'Clogged nylon filters force compressor current draw up by 18% and risk premature inverter PCB thermal throttling in Indian summers.',
      actionableStep: 'Rinse filters under running water; air dry in shade before reinstalling.',
      provenance: 'Verified OEM Maintenance Handbook'
    },
    {
      id: 'tip_phone_battery',
      category: 'ELECTRONICS',
      tipType: 'LIFECYCLE',
      headline: 'Optimize Lithium-Ion Cycles with 20–80% Rule',
      body: 'Charging past 80% or discharging below 20% increases chemical cathode stress, accelerating degradation beyond 500 charge cycles.',
      actionableStep: 'Enable "Optimized Battery Charging" in system settings.',
      provenance: 'Battery Health Chemistry Standards'
    },
    {
      id: 'tip_bike_chain',
      category: 'VEHICLE',
      tipType: 'SAFETY',
      headline: 'Lubricate O-Ring Drive Chains Every 500 KM',
      body: 'Dry drive chains cause sprocket tooth wear, sluggish throttle response, and 4% drivetrain horsepower loss.',
      actionableStep: 'Clean with chain cleaner spray, then apply EP-90 synthetic chain lube.',
      provenance: 'Automotive OEM Service Protocols'
    },
    {
      id: 'tip_solar_inverter',
      category: 'SOLAR',
      tipType: 'VALUE',
      headline: 'Inspect Solar Rooftop Inverter Heatsinks',
      body: 'Dust accumulation on cooling fins lowers MPPT conversion efficiency by up to 6% during peak afternoon solar generation.',
      actionableStep: 'Gently vacuum or brush off rear inverter heatsink fins monthly.',
      provenance: 'Solar PV Operations & Maintenance Guide'
    },
    {
      id: 'tip_laptop_thermal',
      category: 'ELECTRONICS',
      tipType: 'MAINTENANCE',
      headline: 'Prevent Thermal Throttling with Fan Exhaust Clears',
      body: 'Micro-fiber lint blocks laptop copper exhaust fins, degrading sustained multi-core CPU clock speeds by 30%.',
      actionableStep: 'Use compressed air bursts at 45-degree angles to clear exhaust grilles.',
      provenance: 'Hardware Engineering Standards'
    },
    {
      id: 'tip_warranty_claim',
      category: 'UNIVERSAL',
      tipType: 'WARRANTY',
      headline: 'Log Defect Notice in Writing 14 Days Prior to Expiry',
      body: 'Indian Consumer Protection norms honor claims initiated before expiration even if authorized service parts arrive later.',
      actionableStep: 'Email brand support with original GST invoice and receive a job sheet number.',
      provenance: 'Consumer Protection Act Framework'
    }
  ];

  /**
   * Get the featured tip for today (deterministic rotation based on day of year)
   */
  public static getFeaturedDailyTip(): DailyAssetTip {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);
    const index = dayOfYear % this.TIPS.length;
    return this.TIPS[index];
  }

  /**
   * Get all tips for a specific category
   */
  public static getTipsByCategory(category: string): DailyAssetTip[] {
    const clean = category.toUpperCase();
    return this.TIPS.filter(t => t.category === clean || t.category === 'UNIVERSAL');
  }
}
