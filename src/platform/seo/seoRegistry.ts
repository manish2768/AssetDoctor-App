/**
 * Asset Doctor — Advanced SEO & Keyword Registry Engine
 * Scalable data-driven SEO architecture mapping user search intent to real interactive tools and structured knowledge.
 */

export interface KeywordRecord {
  keyword: string;
  country: 'IN' | 'GLOBAL';
  language: 'en' | 'hi';
  intent: 'INFORMATIONAL' | 'COMMERCIAL' | 'TRANSACTIONAL' | 'NAVIGATIONAL';
  category: 'VEHICLE' | 'APPLIANCE' | 'ELECTRONICS' | 'UNIVERSAL';
  priority: 'P1' | 'P2' | 'P3';
  targetUrl: string;
  contentType: 'INTERACTIVE_TOOL' | 'CALCULATOR' | 'KNOWLEDGE_GUIDE' | 'CATEGORY_HUB';
  lastChecked: string;
}

export interface SeoPageDefinition {
  slug: string;
  canonicalUrl: string;
  category: 'VEHICLE' | 'APPLIANCE' | 'ELECTRONICS' | 'UNIVERSAL';
  title: string;
  metaDescription: string;
  h1: string;
  intro: string;
  toolType: 'WARRANTY_CHECKER' | 'REPAIR_VS_REPLACE' | 'DOCUMENT_ANALYZER' | 'HEALTH_CHECK' | 'PASSPORT' | 'VEHICLE_CALCULATOR' | 'AC_CARE' | 'PHONE_HEALTH' | 'UNIVERSAL_EXPLORER';
  supportingContent: {
    sectionTitle: string;
    paragraphs: string[];
    keyTakeaways?: string[];
  }[];
  faq: {
    question: string;
    answer: string;
  }[];
  relatedToolSlugs: string[];
  relatedAssetCategories: string[];
  updatedAt: string;
}

export class SeoRegistry {
  public static readonly KEYWORD_DATABASE: KeywordRecord[] = [
    // 1. Vehicle Cluster
    { keyword: 'car service calculator', country: 'IN', language: 'en', intent: 'COMMERCIAL', category: 'VEHICLE', priority: 'P1', targetUrl: '/tools/vehicle-service-calculator', contentType: 'CALCULATOR', lastChecked: '2026-08-25' },
    { keyword: 'bike maintenance schedule', country: 'IN', language: 'en', intent: 'INFORMATIONAL', category: 'VEHICLE', priority: 'P1', targetUrl: '/tools/vehicle-service-calculator', contentType: 'CALCULATOR', lastChecked: '2026-08-25' },
    { keyword: 'tvs ronin service interval', country: 'IN', language: 'en', intent: 'INFORMATIONAL', category: 'VEHICLE', priority: 'P2', targetUrl: '/tools/vehicle-service-calculator', contentType: 'KNOWLEDGE_GUIDE', lastChecked: '2026-08-25' },
    { keyword: 'vehicle warranty tracker', country: 'IN', language: 'en', intent: 'COMMERCIAL', category: 'VEHICLE', priority: 'P1', targetUrl: '/tools/warranty-checker', contentType: 'INTERACTIVE_TOOL', lastChecked: '2026-08-25' },

    // 2. Home Appliance Cluster
    { keyword: 'ac filter cleaning guide', country: 'IN', language: 'en', intent: 'INFORMATIONAL', category: 'APPLIANCE', priority: 'P1', targetUrl: '/tools/ac-maintenance-guide', contentType: 'INTERACTIVE_TOOL', lastChecked: '2026-08-25' },
    { keyword: 'ac electricity consumption calculator', country: 'IN', language: 'en', intent: 'COMMERCIAL', category: 'APPLIANCE', priority: 'P1', targetUrl: '/tools/ac-maintenance-guide', contentType: 'CALCULATOR', lastChecked: '2026-08-25' },
    { keyword: 'geyser maintenance anode rod', country: 'IN', language: 'en', intent: 'INFORMATIONAL', category: 'APPLIANCE', priority: 'P2', targetUrl: '/tools/ac-maintenance-guide', contentType: 'KNOWLEDGE_GUIDE', lastChecked: '2026-08-25' },

    // 3. Electronics Cluster
    { keyword: 'phone warranty check', country: 'IN', language: 'en', intent: 'TRANSACTIONAL', category: 'ELECTRONICS', priority: 'P1', targetUrl: '/tools/warranty-checker', contentType: 'INTERACTIVE_TOOL', lastChecked: '2026-08-25' },
    { keyword: 'phone battery health diagnostic', country: 'IN', language: 'en', intent: 'INFORMATIONAL', category: 'ELECTRONICS', priority: 'P1', targetUrl: '/tools/phone-battery-health', contentType: 'INTERACTIVE_TOOL', lastChecked: '2026-08-25' },
    { keyword: 'repair or replace laptop calculator', country: 'IN', language: 'en', intent: 'COMMERCIAL', category: 'ELECTRONICS', priority: 'P1', targetUrl: '/tools/repair-or-replace', contentType: 'CALCULATOR', lastChecked: '2026-08-25' },

    // 4. Universal Cluster
    { keyword: 'warranty tracker app', country: 'IN', language: 'en', intent: 'COMMERCIAL', category: 'UNIVERSAL', priority: 'P1', targetUrl: '/tools/warranty-checker', contentType: 'INTERACTIVE_TOOL', lastChecked: '2026-08-25' },
    { keyword: 'repair vs replace calculator', country: 'IN', language: 'en', intent: 'COMMERCIAL', category: 'UNIVERSAL', priority: 'P1', targetUrl: '/tools/repair-or-replace', contentType: 'CALCULATOR', lastChecked: '2026-08-25' },
    { keyword: 'bill invoice analyzer ocr', country: 'IN', language: 'en', intent: 'TRANSACTIONAL', category: 'UNIVERSAL', priority: 'P1', targetUrl: '/tools/document-analyzer', contentType: 'INTERACTIVE_TOOL', lastChecked: '2026-08-25' },
    { keyword: 'digital asset passport qr', country: 'IN', language: 'en', intent: 'COMMERCIAL', category: 'UNIVERSAL', priority: 'P2', targetUrl: '/tools/asset-passport', contentType: 'INTERACTIVE_TOOL', lastChecked: '2026-08-25' }
  ];

  public static readonly SEO_PAGES: Record<string, SeoPageDefinition> = {
    'warranty-checker': {
      slug: 'tools/warranty-checker',
      canonicalUrl: 'https://assetdoctor.in/tools/warranty-checker',
      category: 'UNIVERSAL',
      title: 'Free Warranty Checker & Expiry Tracker | Asset Doctor',
      metaDescription: 'Instant warranty check and expiry tracker for smartphones, home appliances, cars, and laptops. Never lose warranty protection or miss claim deadlines.',
      h1: 'Universal Warranty Checker & Expiry Tracker',
      intro: 'Track manufacturer warranty terms, AMC policies, and claim deadlines across all your personal, vehicle, and household assets.',
      toolType: 'WARRANTY_CHECKER',
      supportingContent: [
        {
          sectionTitle: 'Why Warranty Tracking Protects Asset Equity',
          paragraphs: [
            'Over 68% of Indian consumers miss warranty claim windows due to misplaced paper bills or forgotten purchase dates. When electronic hardware or appliances experience component failure, out-of-pocket repair costs can easily exceed 40% of the original asset value.',
            'Asset Doctor vaults purchase invoices, auto-calculates remaining warranty days, and generates actionable reminders before your coverage expires.'
          ],
          keyTakeaways: [
            'Automated countdown to warranty expiry',
            'Direct claim support directory for 50+ major brands',
            'Zero data lock-in with PDF certificate exports'
          ]
        }
      ],
      faq: [
        {
          question: 'How does Asset Doctor track warranty without a paper bill?',
          answer: 'You can upload an e-commerce invoice, photo of a warranty card, or enter the serial/IMEI number. Asset Doctor automatically extracts the purchase date and computes OEM warranty periods.'
        },
        {
          question: 'Can I track extended warranty and AMC contracts?',
          answer: 'Yes. Asset Doctor supports standard manufacturer warranties, brand extended warranties, and third-party AMC agreements with custom expiration dates.'
        }
      ],
      relatedToolSlugs: ['tools/repair-or-replace', 'tools/document-analyzer', 'tools/asset-health-check'],
      relatedAssetCategories: ['ELECTRONICS', 'APPLIANCE', 'VEHICLE'],
      updatedAt: '2026-08-25'
    },
    'repair-or-replace': {
      slug: 'tools/repair-or-replace',
      canonicalUrl: 'https://assetdoctor.in/tools/repair-or-replace',
      category: 'UNIVERSAL',
      title: 'Repair vs. Replace Calculator | Asset Doctor',
      metaDescription: 'Free economic decision calculator evaluating asset depreciation, remaining lifespan, and repair quote against current fair market valuation.',
      h1: 'Repair vs. Replace Decision Calculator',
      intro: 'Calculate whether repairing your damaged smartphone, appliance, or vehicle is financially rational or if upgrading is economically superior.',
      toolType: 'REPAIR_VS_REPLACE',
      supportingContent: [
        {
          sectionTitle: 'The 50% Fair Market Valuation Rule',
          paragraphs: [
            'When repair cost exceeds 50% of an asset’s current depreciated value—or when the asset has exceeded 70% of its expected design lifespan—further repair investments frequently result in poor capital retention.',
            'Our algorithmic index evaluates category-specific depreciation curves, hardware age, and repair estimates to deliver an objective recommendation.'
          ],
          keyTakeaways: [
            'Objective repair vs. replace scoring index (0 to 100)',
            'Category-calibrated depreciation curves',
            'Prevents sunk-cost traps on aging hardware'
          ]
        }
      ],
      faq: [
        {
          question: 'What formula is used for the Repair vs. Replace Index?',
          answer: 'We compute current fair market value using category depreciation models, compare projected repair cost against equity floor, and factor in expected residual lifecycle.'
        }
      ],
      relatedToolSlugs: ['tools/warranty-checker', 'tools/asset-health-check', 'tools/document-analyzer'],
      relatedAssetCategories: ['APPLIANCE', 'ELECTRONICS', 'VEHICLE'],
      updatedAt: '2026-08-25'
    },
    'document-analyzer': {
      slug: 'tools/document-analyzer',
      canonicalUrl: 'https://assetdoctor.in/tools/document-analyzer',
      category: 'UNIVERSAL',
      title: 'Smart Document & Service Bill Analyzer | Asset Doctor',
      metaDescription: 'Free instant OCR analyzer extracting odometer readings, GSTIN validation, service dates, and warranty milestones from Indian automotive and retail bills.',
      h1: 'Smart Document & Bill Intelligence Analyzer',
      intro: 'Instant automated extraction of odometer telemetry, invoice dates, vendor GSTIN, and parts replacement from bills and policies.',
      toolType: 'DOCUMENT_ANALYZER',
      supportingContent: [
        {
          sectionTitle: 'Automated Entity Extraction & Verification',
          paragraphs: [
            'Asset Doctor’s universal document pipeline accurately classifies service invoices, repair bills, insurance schedules, and purchase tax receipts without manual data entry.',
            'Telemetry extracted from service invoices automatically updates vehicle odometer milestones and calculates the next periodic maintenance schedule.'
          ]
        }
      ],
      faq: [
        {
          question: 'Are my uploaded documents secure and private?',
          answer: 'All documents are client-side encrypted and vaulted in private storage with tenant-level access isolation.'
        }
      ],
      relatedToolSlugs: ['tools/warranty-checker', 'tools/vehicle-service-calculator', 'tools/asset-passport'],
      relatedAssetCategories: ['VEHICLE', 'APPLIANCE', 'ELECTRONICS'],
      updatedAt: '2026-08-25'
    },
    'vehicle-service-calculator': {
      slug: 'tools/vehicle-service-calculator',
      canonicalUrl: 'https://assetdoctor.in/tools/vehicle-service-calculator',
      category: 'VEHICLE',
      title: 'Vehicle Service & Maintenance Calculator | Asset Doctor',
      metaDescription: 'Calculate periodic OEM service milestones, remaining distance, engine oil schedules, and maintenance cost estimates for 2-wheelers and cars.',
      h1: 'Vehicle Service & Maintenance Calculator',
      intro: 'Predict your next periodic vehicle service date and KM threshold using manufacturer-verified maintenance intervals.',
      toolType: 'VEHICLE_CALCULATOR',
      supportingContent: [
        {
          sectionTitle: 'Whichever-Comes-First Maintenance Engineering',
          paragraphs: [
            'Automotive manufacturers establish service schedules based on both cumulative odometer distance and elapsed calendar days. Engine oils degrade through oxidation over time even if mileage targets have not been reached.',
            'Asset Doctor evaluates daily usage velocity alongside official OEM tables to deliver proactive service due alerts.'
          ]
        }
      ],
      faq: [
        {
          question: 'Which automotive brands are supported?',
          answer: 'We support official schedules for TVS, Royal Enfield, Hyundai, Maruti Suzuki, Tata Motors, Honda, Bajaj, and Ather EV platforms.'
        }
      ],
      relatedToolSlugs: ['tools/document-analyzer', 'tools/warranty-checker', 'tools/repair-or-replace'],
      relatedAssetCategories: ['VEHICLE'],
      updatedAt: '2026-08-25'
    },
    'ac-maintenance-guide': {
      slug: 'tools/ac-maintenance-guide',
      canonicalUrl: 'https://assetdoctor.in/tools/ac-maintenance-guide',
      category: 'APPLIANCE',
      title: 'AC Maintenance & 90-Day Filter Clean Guide | Asset Doctor',
      metaDescription: 'Interactive guide and electricity consumption calculator for air conditioners. Learn 90-day filter cleaning and compressor preservation.',
      h1: 'Air Conditioner Maintenance & Power Efficiency Guide',
      intro: 'Preserve 100% cooling capacity and reduce electricity consumption by maintaining air conditioner filters on a 90-day cycle.',
      toolType: 'AC_CARE',
      supportingContent: [
        {
          sectionTitle: 'How Dirty Filters Increase Electricity Bills',
          paragraphs: [
            'A clogged mesh filter restricts airflow across the evaporator coil, causing the inverter compressor to run at elevated frequencies for longer durations. This increases power consumption by up to 15% and accelerates compressor wear.',
            'Cleaning filters every 90 days restores baseline efficiency and prevents costly refrigerant leaks.'
          ]
        }
      ],
      faq: [
        {
          question: 'How often should AC filters be cleaned in Indian cities?',
          answer: 'In dusty urban environments, mesh filters should be rinsed with water every 60 to 90 days, with professional wet coil cleaning once a year before summer.'
        }
      ],
      relatedToolSlugs: ['tools/repair-or-replace', 'tools/warranty-checker', 'tools/asset-health-check'],
      relatedAssetCategories: ['APPLIANCE'],
      updatedAt: '2026-08-25'
    },
    'depreciation-calculator': {
      slug: 'tools/depreciation-calculator',
      canonicalUrl: 'https://assetdoctor.in/tools/depreciation-calculator',
      category: 'UNIVERSAL',
      title: 'Asset Depreciation Calculator & WDV Loss Engine | Asset Doctor',
      metaDescription: 'Calculate annual depreciation schedules, written down values (WDV), and residual salvage equity for electronics, vehicles, appliances, and business equipment.',
      h1: 'Universal Asset Depreciation Calculator',
      intro: 'Project 10-year declining market values and salvage equity using Written Down Value and Straight-Line models tailored to Indian market benchmarks.',
      toolType: 'REPAIR_VS_REPLACE',
      supportingContent: [
        {
          sectionTitle: 'Understanding Asset Value Retention',
          paragraphs: [
            'Physical assets lose economic utility through calendar aging, wear and tear, and technological obsolescence. Consumer electronics depreciate at 25% annually, whereas automobiles lose ~15% per year.',
            'Tracking depreciation allows owners to identify the optimum replacement window before maintenance costs outstrip capital value.'
          ]
        }
      ],
      faq: [
        {
          question: 'What is the Written Down Value (WDV) method?',
          answer: 'The WDV method applies an annual depreciation percentage against the remaining book value of the asset at the beginning of each period, mirroring realistic market resale depreciation.'
        }
      ],
      relatedToolSlugs: ['tools/repair-or-replace', 'tools/warranty-checker', 'tools/ownership-cost'],
      relatedAssetCategories: ['ELECTRONICS', 'VEHICLE', 'APPLIANCE'],
      updatedAt: '2026-08-25'
    },
    'ownership-cost': {
      slug: 'tools/ownership-cost',
      canonicalUrl: 'https://assetdoctor.in/tools/ownership-cost',
      category: 'UNIVERSAL',
      title: 'Total Cost of Ownership (TCO) Calculator | Asset Doctor',
      metaDescription: 'Free Total Cost of Ownership calculator. Quantify fuel, energy, insurance, and maintenance expenses over multi-year asset lifecycles.',
      h1: 'Total Cost of Ownership (TCO) Analyzer',
      intro: 'Discover the real cost of owning any major asset. Quantify daily and monthly operational overhead beyond the initial showroom purchase invoice.',
      toolType: 'REPAIR_VS_REPLACE',
      supportingContent: [
        {
          sectionTitle: 'The Hidden Cost of Asset Ownership',
          paragraphs: [
            'Over a 5 to 7 year ownership horizon, recurring expenses including fuel/charging, preventative servicing, insurance premiums, and component replacements often represent 60% or more of total capital outlay.',
            'Quantifying true TCO empowers smarter acquisition, leasing, and upgrade decisions.'
          ]
        }
      ],
      faq: [
        {
          question: 'How is Total Cost of Ownership calculated?',
          answer: 'TCO combines initial purchase price with cumulative annual maintenance, energy/fuel consumption, insurance, AMC contracts, and regulatory compliance fees over the ownership duration.'
        }
      ],
      relatedToolSlugs: ['tools/depreciation-calculator', 'tools/repair-or-replace', 'tools/vehicle-service-calculator'],
      relatedAssetCategories: ['VEHICLE', 'APPLIANCE', 'ELECTRONICS'],
      updatedAt: '2026-08-25'
    }
  };

  public static getPage(slug: string): SeoPageDefinition | undefined {
    return this.SEO_PAGES[slug] || Object.values(this.SEO_PAGES).find(p => p.slug === slug);
  }

  public static listAllPages(): SeoPageDefinition[] {
    return Object.values(this.SEO_PAGES);
  }
}
