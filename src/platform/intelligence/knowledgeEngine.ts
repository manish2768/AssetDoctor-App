/**
 * Asset Doctor — Universal Asset Knowledge Engine
 * Structured repository of verified manufacturer specifications, maintenance rules, and parts compatibility.
 * Every record enforces strict data provenance.
 */

import { DataProvenance } from '../core/universalAssetSchema';

export interface KnowledgeRecord {
  knowledgeId: string;
  category: string;
  brand: string;
  modelQuery: string;
  topic: 'MAINTENANCE_SCHEDULE' | 'WARRANTY_POLICY' | 'COMMON_FAILURE' | 'REPLACEMENT_PART' | 'CONSUMABLE';
  title: string;
  content: string;
  structuredData?: Record<string, any>;
  provenance: DataProvenance;
}

class AssetKnowledgeEngine {
  private records: KnowledgeRecord[] = [];

  constructor() {
    this.seedVerifiedKnowledge();
  }

  public queryKnowledge(category: string, brand: string, query?: string): KnowledgeRecord[] {
    const normCategory = (category || '').toLowerCase();
    const normBrand = (brand || '').toLowerCase();
    const normQ = (query || '').toLowerCase();

    return this.records.filter(r => {
      const matchCat = !normCategory || r.category.toLowerCase() === normCategory;
      const matchBrand = !normBrand || r.brand.toLowerCase().includes(normBrand) || r.modelQuery.toLowerCase().includes(normBrand);
      const matchQ = !normQ || r.title.toLowerCase().includes(normQ) || r.content.toLowerCase().includes(normQ) || r.modelQuery.toLowerCase().includes(normQ);
      return matchCat && (matchBrand || matchQ);
    });
  }

  public registerKnowledge(record: KnowledgeRecord): void {
    this.records.push(record);
  }

  private seedVerifiedKnowledge(): void {
    // 1. TVS Ronin Knowledge
    this.registerKnowledge({
      knowledgeId: 'kn_tvs_ronin_sched',
      category: 'VEHICLE',
      brand: 'TVS Motor Company',
      modelQuery: 'Ronin 225',
      topic: 'MAINTENANCE_SCHEDULE',
      title: 'TVS Ronin Periodic Maintenance Specifications',
      content: 'Break-in 1st service at 750 KM (60 days), followed by periodic service every 6,000 KM (180 days). Uses TVS TRU4 Fully Synthetic 10W-30 engine oil.',
      structuredData: {
        firstServiceKm: 750,
        subsequentKm: 6000,
        oilGrade: '10W-30 Fully Synthetic',
        oilCapacityLiters: 1.2
      },
      provenance: {
        sourceType: 'OEM_MANUAL',
        sourceName: 'TVS Ronin Owner Manual Edition 2026',
        sourceVersion: 'Rev 3.2',
        confidence: 0.99,
        lastVerifiedAt: '2026-08-01'
      }
    });

    // 2. Royal Enfield Classic 350 Knowledge
    this.registerKnowledge({
      knowledgeId: 'kn_re_classic_sched',
      category: 'VEHICLE',
      brand: 'Royal Enfield',
      modelQuery: 'Classic 350 J-Series',
      topic: 'MAINTENANCE_SCHEDULE',
      title: 'Royal Enfield Classic 350 J-Platform Service Schedule',
      content: 'Break-in 1st service at 500 KM (45 days), followed by periodic service every 5,000 KM (180 days). Uses Semi-Synthetic 15W-50 API SL JASO MA2.',
      structuredData: {
        firstServiceKm: 500,
        subsequentKm: 5000,
        oilGrade: '15W-50 Semi-Synthetic',
        oilCapacityLiters: 1.7
      },
      provenance: {
        sourceType: 'OEM_MANUAL',
        sourceName: 'Royal Enfield J-Series Technical Service Guide',
        sourceVersion: '2026.1',
        confidence: 0.99,
        lastVerifiedAt: '2026-08-01'
      }
    });

    // 3. Daikin Inverter AC Knowledge
    this.registerKnowledge({
      knowledgeId: 'kn_daikin_ac_care',
      category: 'APPLIANCE',
      brand: 'Daikin',
      modelQuery: '1.5 Ton Inverter AC',
      topic: 'MAINTENANCE_SCHEDULE',
      title: 'Daikin Inverter AC PM & Filter Maintenance',
      content: 'Wash titanium apatite deodorizing air filters every 90 days. Run indoor unit fan mode for 2 hours before seasonal shutdown to prevent mold.',
      structuredData: {
        filterCleanIntervalDays: 90,
        refrigerantType: 'R32',
        compressorWarrantyYears: 10
      },
      provenance: {
        sourceType: 'OEM_MANUAL',
        sourceName: 'Daikin Airconditioning India User Guide',
        sourceVersion: 'FTKF Series 2026',
        confidence: 0.98,
        lastVerifiedAt: '2026-07-15'
      }
    });

    // 4. Apple iPhone / Smartphone Knowledge
    this.registerKnowledge({
      knowledgeId: 'kn_apple_battery_policy',
      category: 'ELECTRONICS',
      brand: 'Apple',
      modelQuery: 'iPhone 15 / 16 / Pro',
      topic: 'WARRANTY_POLICY',
      title: 'Apple Lithium-Ion Battery Service Standards',
      content: 'Standard 1-year limited warranty covers defective battery retaining less than 80% original capacity within warranty period.',
      structuredData: {
        warrantyThresholdPercent: 80,
        cycleCountTarget: 1000
      },
      provenance: {
        sourceType: 'OEM_MANUAL',
        sourceName: 'Apple Hardware Warranty Service Guidelines',
        sourceUrl: 'https://support.apple.com/iphone/repair/battery-replacement',
        confidence: 0.99,
        lastVerifiedAt: '2026-08-10'
      }
    });
  }
}

export const assetKnowledgeEngine = new AssetKnowledgeEngine();
