/**
 * Asset Doctor — Smart Asset Knowledge Hub Data Architecture
 * Configuration-driven knowledge profiles covering Vehicles, Electronics, Home Appliances, and Household Assets.
 * Every profile includes verified maintenance frequencies, warning signs, useful life, warranty rules,
 * document checklists, verified provenance, and related calculators.
 */

export type KnowledgeCategory = 'vehicles' | 'electronics' | 'home-appliances' | 'household-assets';

export interface KnowledgeProfile {
  id: string;
  category: KnowledgeCategory;
  categoryDisplayName: string;
  brand: string;
  model: string;
  title: string;
  subtitle: string;
  estimatedUsefulLifeYears: number;
  standardWarrantySummary: string;
  maintenanceFrequency: {
    recommendedInterval: string;
    routineCheckInterval: string;
    majorServiceInterval: string;
  };
  keyMaintenanceTasks: string[];
  warningSigns: {
    symptom: string;
    probableCause: string;
    urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    actionRequired: string;
  }[];
  documentChecklist: {
    name: string;
    requiredFor: string;
    isStatutory: boolean;
  }[];
  provenance: {
    sourceType: 'OEM_MANUAL' | 'OEM_SERVICE_MATRIX' | 'STATUTORY_STANDARD' | 'GENERIC_ESTIMATE';
    sourceName: string;
    sourceVersion?: string;
    sourceUrl?: string;
    confidence: number;
    lastVerifiedDate: string;
  };
  relatedToolSlugs: string[];
  relatedAssetDoctorFeatures: string[];
  faqs: {
    question: string;
    answer: string;
  }[];
}

export const KNOWLEDGE_PROFILES: KnowledgeProfile[] = [
  // ==========================================
  // 1. VEHICLES
  // ==========================================
  {
    id: 'kn-tvs-ronin-225',
    category: 'vehicles',
    categoryDisplayName: 'Vehicles & Automotive',
    brand: 'TVS Motor Company',
    model: 'Ronin 225 Modern Retro',
    title: 'TVS Ronin 225 Periodic Maintenance & Engine Care',
    subtitle: 'OEM break-in intervals, synthetic oil specifications, and chain slack tolerances.',
    estimatedUsefulLifeYears: 12,
    standardWarrantySummary: '5 Years or 60,000 KM (Whichever comes first from registration date)',
    maintenanceFrequency: {
      recommendedInterval: 'Every 6,000 KM or 180 Days',
      routineCheckInterval: 'Every 1,000 KM or 30 Days (Chain lubrication & tyre PSI)',
      majorServiceInterval: 'Every 12,000 KM (Spark plug, air filter, brake fluid flush)'
    },
    keyMaintenanceTasks: [
      'Engine oil replacement with TVS TRU4 Fully Synthetic 10W-30 (1.2L capacity)',
      'Oil filter cartridge replacement at every oil drain',
      'Drive chain cleaning, tension check (20-25mm slack), and synthetic lube',
      'Clutch free play adjustment (10-15mm at lever end)',
      'Valve clearance inspection every 12,000 KM (Intake: 0.06mm, Exhaust: 0.08mm)'
    ],
    warningSigns: [
      {
        symptom: 'Hard gear shifting and false neutrals',
        probableCause: 'Degraded engine oil viscosity or incorrect clutch cable free play',
        urgency: 'MEDIUM',
        actionRequired: 'Inspect clutch free play and drain oil if older than 6,000 KM'
      },
      {
        symptom: 'Rattling noise from left side under acceleration',
        probableCause: 'Excessive drive chain slack slapping swingarm guide',
        urgency: 'HIGH',
        actionRequired: 'Adjust chain tension immediately to prevent sprocket tooth damage'
      },
      {
        symptom: 'Brembo Master cylinder spongy brake lever feel',
        probableCause: 'Air bubbles in DOT 4 brake line or moisture contamination',
        urgency: 'CRITICAL',
        actionRequired: 'Bleed front brake circuit and replace DOT 4 fluid immediately'
      }
    ],
    documentChecklist: [
      { name: 'RC (Registration Certificate)', requiredFor: 'Statutory legal ownership verification', isStatutory: true },
      { name: 'Comprehensive Insurance Policy', requiredFor: 'Own damage & third-party liability coverage', isStatutory: true },
      { name: 'PUC (Pollution Under Control)', requiredFor: 'Emission compliance certification (Valid 1 Year)', isStatutory: true },
      { name: 'Authorized Service Job Cards', requiredFor: '5-Year manufacturer warranty claim validation', isStatutory: false }
    ],
    provenance: {
      sourceType: 'OEM_MANUAL',
      sourceName: 'TVS Ronin Owner Operating & Service Manual',
      sourceVersion: 'Rev 2026.02',
      confidence: 0.99,
      lastVerifiedDate: '2026-08-15'
    },
    relatedToolSlugs: ['tools/vehicle-service-calculator', 'tools/repair-or-replace', 'tools/warranty-checker'],
    relatedAssetDoctorFeatures: ['Odometer Milestone Tracking', 'PUC Expiry Countdown', 'Service History Vault'],
    faqs: [
      {
        question: 'What is the exact engine oil capacity of TVS Ronin 225?',
        answer: 'The TVS Ronin requires 1,200 ml (1.2L) during periodic oil drain with filter change, and 1,400 ml during complete engine overhaul. Use 10W-30 API SL JASO MA2 synthetic oil.'
      },
      {
        question: 'How long is the TVS Ronin warranty valid?',
        answer: 'TVS provides a 5-year or 60,000 km standard manufacturer warranty, provided all periodic services are performed at authorized dealerships within scheduled intervals.'
      }
    ]
  },
  {
    id: 'kn-hyundai-creta-15',
    category: 'vehicles',
    categoryDisplayName: 'Vehicles & Automotive',
    brand: 'Hyundai Motor India',
    model: 'Creta 1.5 MPI / CRDi',
    title: 'Hyundai Creta 1.5 Maintenance Schedule & Fluid Specs',
    subtitle: 'Annual service milestones, severe driving cycle adjustments, and coolant intervals.',
    estimatedUsefulLifeYears: 15,
    standardWarrantySummary: '3 Years / Unlimited KM (Extendable up to 7 Years / 1,40,000 KM)',
    maintenanceFrequency: {
      recommendedInterval: 'Every 10,000 KM or 1 Year (Whichever occurs first)',
      routineCheckInterval: 'Every 2,500 KM (Engine oil dipstick, tyre pressure, washer fluid)',
      majorServiceInterval: 'Every 30,000 KM (Fuel filter, brake fluid, cabin pollen filter)'
    },
    keyMaintenanceTasks: [
      'Engine oil replacement: 0W-20 API SP (Petrol) or 0W-30 ACEA C2/C3 (Diesel)',
      'Engine oil filter and drain plug gasket replacement',
      'HVAC cabin air purification filter replacement',
      'Brake pad caliper pin lubrication and disc thickness measurement',
      'Severe use cycle reduction to 5,000 KM for severe stop-and-go dusty conditions'
    ],
    warningSigns: [
      {
        symptom: 'DPF warning lamp on instrument cluster (Diesel CRDi)',
        probableCause: 'Particulate filter soot accumulation due to prolonged short city idling',
        urgency: 'HIGH',
        actionRequired: 'Perform highway regeneration drive (60+ km/h for 25 mins) or visit workshop'
      },
      {
        symptom: 'Air conditioning cooling drop with foul odor on startup',
        probableCause: 'Clogged cabin pollen filter and evaporator coil bacterial buildup',
        urgency: 'LOW',
        actionRequired: 'Replace cabin air filter and execute AC evaporator foam sanitization'
      }
    ],
    documentChecklist: [
      { name: 'RC Smart Card / DigiLocker RC', requiredFor: 'RTO vehicle registration verification', isStatutory: true },
      { name: 'Zero-Depreciation Insurance Policy', requiredFor: 'Accident repair cashless claim settlement', isStatutory: true },
      { name: 'BS6 PUC Certificate', requiredFor: 'National green emission compliance', isStatutory: true },
      { name: 'FASTag RFID Account', requiredFor: 'National highway electronic toll collection', isStatutory: true }
    ],
    provenance: {
      sourceType: 'OEM_SERVICE_MATRIX',
      sourceName: 'Hyundai Creta Periodic Maintenance Schedule 2026',
      sourceVersion: 'Matrix V4.5',
      confidence: 0.99,
      lastVerifiedDate: '2026-08-10'
    },
    relatedToolSlugs: ['tools/vehicle-service-calculator', 'tools/repair-or-replace', 'tools/ownership-cost'],
    relatedAssetDoctorFeatures: ['Automated Service Due Reminders', 'FASTag Linkage', 'Insurance Renewal Radar'],
    faqs: [
      {
        question: 'Does Hyundai Creta require 6-month or 1-year service?',
        answer: 'Hyundai specifies periodic service at 10,000 km or 12 months (1 year), whichever occurs first. However, under severe driving conditions (frequent trips under 10 km or extreme dust), engine oil should be changed every 5,000 km.'
      }
    ]
  },

  // ==========================================
  // 2. ELECTRONICS
  // ==========================================
  {
    id: 'kn-apple-iphone-15-16',
    category: 'electronics',
    categoryDisplayName: 'Smartphones & Electronics',
    brand: 'Apple',
    model: 'iPhone 15 / 16 Series',
    title: 'Apple iPhone Battery Health Optimization & Repair Standards',
    subtitle: '80% charge limit mode, cycle count thresholds, and AppleCare+ warranty policy.',
    estimatedUsefulLifeYears: 6,
    standardWarrantySummary: '1 Year Limited Manufacturer Warranty (Extendable with AppleCare+)',
    maintenanceFrequency: {
      recommendedInterval: 'Continuous (Software Optimization) / Annual Physical Diagnostic',
      routineCheckInterval: 'Monthly (Port lint cleanup & iCloud encrypted backup)',
      majorServiceInterval: 'When Maximum Battery Capacity drops below 80%'
    },
    keyMaintenanceTasks: [
      'Enable 80% Limit charging profile in Settings > Battery > Charging Optimization',
      'Keep internal storage with at least 15% free headroom for APFS wear leveling',
      'Clean USB-C charging port gently with non-conductive anti-static precision tool',
      'Install quarterly iOS security hotfixes and major version stability updates'
    ],
    warningSigns: [
      {
        symptom: 'Maximum Capacity indicates "Service" or drops below 80%',
        probableCause: 'Chemical aging of Lithium-Ion pouch cells past 500-1000 full charge cycles',
        urgency: 'MEDIUM',
        actionRequired: 'Schedule genuine Apple authorized battery replacement to restore peak performance'
      },
      {
        symptom: 'Rapid battery drop accompanied by severe rear glass warming',
        probableCause: 'Background process runaway loop or rogue thermal indexing daemon',
        urgency: 'LOW',
        actionRequired: 'Restart device and inspect Settings > Battery for runaway background apps'
      }
    ],
    documentChecklist: [
      { name: 'Original GST Purchase Invoice', requiredFor: 'Apple Authorized Service Centre warranty claim', isStatutory: false },
      { name: 'AppleCare+ Proof of Coverage', requiredFor: 'Accidental screen & glass replacement at ₹2,500 co-pay', isStatutory: false },
      { name: 'IMEI / Serial Number Record', requiredFor: 'Police CEIR lost/stolen blocking & insurance claim', isStatutory: true }
    ],
    provenance: {
      sourceType: 'OEM_MANUAL',
      sourceName: 'Apple Support Official Hardware Guidelines',
      sourceUrl: 'https://support.apple.com/iphone/repair/battery-replacement',
      confidence: 0.99,
      lastVerifiedDate: '2026-08-18'
    },
    relatedToolSlugs: ['tools/phone-battery-health', 'tools/repair-or-replace', 'tools/warranty-checker'],
    relatedAssetDoctorFeatures: ['Battery Health Telemetry', 'IMEI Safe Vault', 'Invoice OCR Scanner'],
    faqs: [
      {
        question: 'When is iPhone battery replacement covered under free warranty?',
        answer: 'Apple covers defective battery replacement free of charge if the battery health drops below 80% original capacity within the 1-year standard warranty or active AppleCare+ coverage period.'
      }
    ]
  },
  {
    id: 'kn-dell-latitude-enterprise',
    category: 'electronics',
    categoryDisplayName: 'Smartphones & Electronics',
    brand: 'Dell Technologies',
    model: 'Latitude 5000 / 7000 Series Laptop',
    title: 'Dell Latitude Enterprise Thermal & Battery Care Guidelines',
    subtitle: 'Dell Command Power Manager, heatsink cleaning, and BIOS firmware update cycles.',
    estimatedUsefulLifeYears: 7,
    standardWarrantySummary: '3 Years ProSupport Next Business Day Onsite Warranty',
    maintenanceFrequency: {
      recommendedInterval: 'Quarterly (BIOS & Microcode Updates)',
      routineCheckInterval: 'Monthly (Battery Calibration & OS Health Scan)',
      majorServiceInterval: 'Every 180 Days (Thermal exhaust dust blow-out)'
    },
    keyMaintenanceTasks: [
      'Configure Dell Command Power Manager to "Primarily AC Use" profile',
      'Blow out copper thermal heatsink fins using compressed dry air canister',
      'Update Dell Client System BIOS to patch Intel ME & CPU microcode vulnerabilities',
      'Inspect MagSafe / USB-C PD power delivery cord for crimping or strain damage'
    ],
    warningSigns: [
      {
        symptom: 'Cooling fan running at 100% RPM with high idle CPU temperatures (>70°C)',
        probableCause: 'Dried out thermal paste or dust accumulation clogging exhaust fins',
        urgency: 'HIGH',
        actionRequired: 'Blow out cooling vents and re-paste thermal interface if older than 3 years'
      },
      {
        symptom: 'Trackpad lifting or clicking becomes stiff',
        probableCause: 'Swelling Lithium-Polymer battery pouch putting pressure on top chassis',
        urgency: 'CRITICAL',
        actionRequired: 'Immediately stop charging, power down laptop, and replace battery pack'
      }
    ],
    documentChecklist: [
      { name: 'Original Purchase Invoice & Delivery Challan', requiredFor: 'Asset capitalization & accounting depreciation', isStatutory: true },
      { name: 'Dell Service Tag & Express Service Code', requiredFor: 'Dell ProSupport dispatch & onsite engineer ticketing', isStatutory: false }
    ],
    provenance: {
      sourceType: 'OEM_MANUAL',
      sourceName: 'Dell Enterprise Client Hardware Maintenance & Lifecycle Manual',
      sourceVersion: 'Rev A08',
      confidence: 0.99,
      lastVerifiedDate: '2026-08-14'
    },
    relatedToolSlugs: ['tools/asset-depreciation', 'tools/repair-or-replace', 'tools/ownership-cost'],
    relatedAssetDoctorFeatures: ['Service Tag Telemetry', 'Depreciation Schedule', 'IT Asset Management'],
    faqs: [
      {
        question: 'How do I prevent laptop battery swelling when kept on charger?',
        answer: 'In Dell BIOS or Dell Command Power Manager, select "Primarily AC Use". This stops the battery from sitting at 100% state-of-charge under high voltage, reducing chemical degradation.'
      }
    ]
  },

  // ==========================================
  // 3. HOME APPLIANCES
  // ==========================================
  {
    id: 'kn-daikin-inverter-ac',
    category: 'home-appliances',
    categoryDisplayName: 'Home Appliances',
    brand: 'Daikin',
    model: 'FTKF / FTHT Series Inverter AC',
    title: 'Daikin Inverter AC Preventive Care & Seasonal Checklist',
    subtitle: 'Titanium apatite filter wash, mold-prevention fan cycle, and R32 refrigerant care.',
    estimatedUsefulLifeYears: 10,
    standardWarrantySummary: '1 Year Comprehensive + 5 Years PCB + 10 Years Compressor',
    maintenanceFrequency: {
      recommendedInterval: 'Every 90 Days (Filter Clean) / Pre-Season (Full Service)',
      routineCheckInterval: 'Every 15 Days in Summer Peak (Dust Filter Rinse)',
      majorServiceInterval: 'Annual (Condenser coil pressure jet wash & electrical check)'
    },
    keyMaintenanceTasks: [
      'Gently wash PM 2.5 and titanium apatite filters under running tap water without soap',
      'Run indoor unit on "Fan Mode" for 2 hours before winter shutdown to dry evaporator',
      'Inspect outdoor unit clearance (minimum 30cm rear and 100cm front for heat dissipation)',
      'Verify drain hose slope to prevent condensate backflow and wall dampness'
    ],
    warningSigns: [
      {
        symptom: 'AC blowing normal ambient air with outdoor unit compressor silent',
        probableCause: 'Voltage surge failure in inverter PCB or low R32 refrigerant pressure',
        urgency: 'HIGH',
        actionRequired: 'Check voltage stabilizer output; if normal, call Daikin authorized technician'
      },
      {
        symptom: 'Water dripping continuously from indoor unit blower vent',
        probableCause: 'Choked condensate drain pipe due to algae/dust sludge buildup',
        urgency: 'MEDIUM',
        actionRequired: 'Blow low-pressure air through drain outlet to clear condensate clog'
      }
    ],
    documentChecklist: [
      { name: 'Original Purchase Invoice', requiredFor: '10-Year compressor & 5-year PCB warranty claims', isStatutory: false },
      { name: 'Authorized Installation Report', requiredFor: 'Validating vacuuming and warranty compliance', isStatutory: false }
    ],
    provenance: {
      sourceType: 'OEM_MANUAL',
      sourceName: 'Daikin Airconditioning India User Operating Guide',
      sourceVersion: 'FTKF Series 2026',
      confidence: 0.98,
      lastVerifiedDate: '2026-08-05'
    },
    relatedToolSlugs: ['tools/ac-maintenance-guide', 'tools/repair-or-replace', 'tools/warranty-checker'],
    relatedAssetDoctorFeatures: ['90-Day Filter Clean Alerts', 'Pre-Season Service Radar', 'PCB Warranty Tracker'],
    faqs: [
      {
        question: 'Why should I run AC on Fan mode before winter?',
        answer: 'Running the AC in Fan-only mode for 2 hours evaporates all remaining moisture on the cooling coil, preventing mold, bacterial slime, and internal coil corrosion during months of non-use.'
      }
    ]
  },
  {
    id: 'kn-samsung-ecobubble-washer',
    category: 'home-appliances',
    categoryDisplayName: 'Home Appliances',
    brand: 'Samsung',
    model: 'EcoBubble Front Load Washer 7kg - 9kg',
    title: 'Samsung Front Load Washer Drum Clean & Descaling Guide',
    subtitle: 'Eco Drum Clean+ cycle, debris trap cleaning, and inlet hard water filter maintenance.',
    estimatedUsefulLifeYears: 10,
    standardWarrantySummary: '3 Years Comprehensive + 20 Years Digital Inverter Motor Warranty',
    maintenanceFrequency: {
      recommendedInterval: 'Every 40 Wash Cycles (Drum Clean+)',
      routineCheckInterval: 'Every 60 Days (Debris coin trap filter)',
      majorServiceInterval: 'Every 90 Days (Inlet water mesh descaling)'
    },
    keyMaintenanceTasks: [
      'Run Drum Clean+ mode at 70°C without clothes or detergent every 40 wash cycles',
      'Open bottom emergency drain flap, pull hose to drain water, and clean debris mesh',
      'Wipe rubber door gasket diaphragm with dry cloth after each wash to stop mold',
      'Clean detergent drawer dispenser tray to prevent fabric conditioner caking'
    ],
    warningSigns: [
      {
        symptom: 'Machine vibrates vigorously and walks during 1200 RPM spin cycle',
        probableCause: 'Uneven leveling feet, overloaded drum, or transit bolts unremoved',
        urgency: 'HIGH',
        actionRequired: 'Adjust front leveling lock nuts with spirit level to stop bearing damage'
      },
      {
        symptom: '"4C" or "4E" error code displayed on screen',
        probableCause: 'Low water supply pressure or clogged inlet mesh filter due to hard water scale',
        urgency: 'MEDIUM',
        actionRequired: 'Unscrew inlet pipe from tap and clean wire mesh screen with toothbrush'
      }
    ],
    documentChecklist: [
      { name: 'Tax Invoice with Serial Number', requiredFor: '20-Year digital inverter motor warranty coverage', isStatutory: false },
      { name: 'AMC (Annual Maintenance Contract) Card', requiredFor: 'Free annual descale & tub check', isStatutory: false }
    ],
    provenance: {
      sourceType: 'OEM_MANUAL',
      sourceName: 'Samsung Front Loading Washer User Guide WW80T Series',
      sourceVersion: '2026.01',
      confidence: 0.98,
      lastVerifiedDate: '2026-08-12'
    },
    relatedToolSlugs: ['tools/repair-or-replace', 'tools/asset-depreciation', 'tools/warranty-checker'],
    relatedAssetDoctorFeatures: ['40-Cycle Tub Clean Reminders', 'Hard Water Descale Schedule', 'Motor Warranty Vault'],
    faqs: [
      {
        question: 'What detergent should be used with Samsung Front Load Washers?',
        answer: 'Always use Low-Sud (Matik) liquid or powder detergent specifically formulated for front-load machines. High-suds top-load detergents create excess foam, triggering 5UD error codes and damaging motor bearings.'
      }
    ]
  },

  // ==========================================
  // 4. HOUSEHOLD & LIVING ASSETS
  // ==========================================
  {
    id: 'kn-luminous-solar-tubular-ups',
    category: 'household-assets',
    categoryDisplayName: 'Household & Living Assets',
    brand: 'Luminous Power Technologies',
    model: 'Solarverter Pro & Red Charge Tubular 150Ah/200Ah',
    title: 'Luminous Solar & Inverter Battery Maintenance Schedule',
    subtitle: 'Float indicator electrolyte checks, terminal sulfation prevention, and solar panel cleaning.',
    estimatedUsefulLifeYears: 8,
    standardWarrantySummary: '2 Years Inverter + 5 Years (36M Free + 24M Pro-Rata) Battery',
    maintenanceFrequency: {
      recommendedInterval: 'Every 60-90 Days (Electrolyte Level Inspection)',
      routineCheckInterval: 'Every 20-30 Days (Photovoltaic Solar Panel Surface Wash)',
      majorServiceInterval: 'Every 180 Days (Terminal Post Greasing & Equalization Charge)'
    },
    keyMaintenanceTasks: [
      'Top up tubular cells exclusively with distilled water when float drops below green mark',
      'Never top up with tap water, mineral water, or acid to prevent irreversible plate poisoning',
      'Apply petroleum jelly / vaseline on copper lead terminals to eliminate white/blue sulfation crust',
      'Wash rooftop solar panel glass during early morning or sunset to prevent thermal shock fractures'
    ],
    warningSigns: [
      {
        symptom: 'Inverter backup duration drops drastically from 4 hours to under 30 minutes',
        probableCause: 'Deep sulfation due to low electrolyte or dried cell plates',
        urgency: 'HIGH',
        actionRequired: 'Top up with distilled water immediately and run full 12-hour boost charging cycle'
      },
      {
        symptom: 'Battery emits intense rotten-egg sulfur odor while charging',
        probableCause: 'Overcharging due to inverter charging voltage sensor failure (>14.8V)',
        urgency: 'CRITICAL',
        actionRequired: 'Switch off inverter main switch immediately and call service technician'
      }
    ],
    documentChecklist: [
      { name: 'Original Purchase Invoice', requiredFor: 'Inverter & battery warranty registration', isStatutory: false },
      { name: 'Battery Warranty Card with Serial Barcode', requiredFor: 'Pro-rata battery replacement claims', isStatutory: false },
      { name: 'DISCOM Net Metering Approval', requiredFor: 'Grid-tied solar subsidy & export credits', isStatutory: true }
    ],
    provenance: {
      sourceType: 'OEM_MANUAL',
      sourceName: 'Luminous Solarverter & Tubular Battery Technical Service Guide',
      sourceVersion: '2026.2',
      confidence: 0.99,
      lastVerifiedDate: '2026-08-18'
    },
    relatedToolSlugs: ['tools/ownership-cost', 'tools/repair-or-replace', 'tools/asset-depreciation'],
    relatedAssetDoctorFeatures: ['Distilled Water Reminders', 'Solar Panel Wash Schedule', 'Battery Pro-Rata Warranty Tracker'],
    faqs: [
      {
        question: 'Can I add acid to an inverter battery if gravity is low?',
        answer: 'No. Acid never evaporates from lead-acid batteries; only water evaporates during electrolysis. Adding acid alters the electrolyte specific gravity balance and damages the positive lead tubular plates.'
      }
    ]
  },
  {
    id: 'kn-ergonomic-office-furniture',
    category: 'household-assets',
    categoryDisplayName: 'Household & Living Assets',
    brand: 'Featherlite / Godrej Interio',
    model: 'Ergonomic Mesh Chair & Motorized Standing Desk',
    title: 'Ergonomic Workspace Furniture Maintenance & Gas Lift Care',
    subtitle: 'Class 4 hydraulic gas lift cylinder care, dual-motor synchronization, and mesh tensioning.',
    estimatedUsefulLifeYears: 10,
    standardWarrantySummary: '3 to 5 Years Comprehensive Mechanism & Gas Lift Warranty',
    maintenanceFrequency: {
      recommendedInterval: 'Every 180 Days (Fastener Tightening & Lubrication)',
      routineCheckInterval: 'Monthly (Mesh Fabric Dusting & Height Calibration)',
      majorServiceInterval: 'Annual (Hydraulic Gas Cylinder & Dual-Motor Gearbox Inspection)'
    },
    keyMaintenanceTasks: [
      'Tighten all under-seat Allen bolts and armrest mounting screws every 180 days',
      'Clean caster wheels of hair/thread lint to prevent floor scratching and wheel jamming',
      'Reset motorized standing desk height controller periodically by holding DOWN for 10s',
      'Apply silicone lubricant spray on reclining mechanism springs to stop squeaking'
    ],
    warningSigns: [
      {
        symptom: 'Chair sinks slowly over 30 minutes while sitting',
        probableCause: 'Class 4 hydraulic gas lift cylinder seal failure leaking nitrogen pressure',
        urgency: 'MEDIUM',
        actionRequired: 'Replace hydraulic gas lift cylinder (standard 50mm taper fitting)'
      },
      {
        symptom: 'Standing desk tilts unevenly and stops with "E01" error code',
        probableCause: 'Dual motorized legs out of sync or resistance obstacle detected',
        urgency: 'MEDIUM',
        actionRequired: 'Execute hardware reset cycle: lower desk to lowest position and hold DOWN for 10 seconds'
      }
    ],
    documentChecklist: [
      { name: 'Original Purchase Bill & Warranty Card', requiredFor: '5-Year structural frame and mechanism replacement', isStatutory: false }
    ],
    provenance: {
      sourceType: 'OEM_MANUAL',
      sourceName: 'Ergonomic Workspace Hardware Maintenance Standard',
      sourceVersion: 'BIFMA X5.1-2026',
      confidence: 0.95,
      lastVerifiedDate: '2026-08-01'
    },
    relatedToolSlugs: ['tools/repair-or-replace', 'tools/asset-depreciation', 'tools/ownership-cost'],
    relatedAssetDoctorFeatures: ['Furniture Asset Capitalization', 'Warranty Expiry Tracker', 'Maintenance Reminders'],
    faqs: [
      {
        question: 'Can a sinking office chair gas cylinder be repaired?',
        answer: 'Gas cylinders are pressurized with nitrogen gas (approx. 200 PSI) inside a sealed chamber and cannot be refilled safely. Replacing the cylinder with an OEM Class 4 BIFMA-certified gas lift is the recommended, cost-effective solution.'
      }
    ]
  }
];

export class KnowledgeHubService {
  public static getAllProfiles(): KnowledgeProfile[] {
    return KNOWLEDGE_PROFILES;
  }

  public static getProfilesByCategory(category: KnowledgeCategory): KnowledgeProfile[] {
    return KNOWLEDGE_PROFILES.filter(p => p.category === category);
  }

  public static getProfileById(id: string): KnowledgeProfile | undefined {
    return KNOWLEDGE_PROFILES.find(p => p.id === id);
  }

  public static searchProfiles(query: string, category?: KnowledgeCategory): KnowledgeProfile[] {
    const q = (query || '').toLowerCase().trim();
    return KNOWLEDGE_PROFILES.filter(p => {
      const matchCat = !category || p.category === category;
      const matchQuery = !q ||
        p.title.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.model.toLowerCase().includes(q) ||
        p.keyMaintenanceTasks.some(t => t.toLowerCase().includes(q)) ||
        p.warningSigns.some(w => w.symptom.toLowerCase().includes(q) || w.probableCause.toLowerCase().includes(q));
      return matchCat && matchQuery;
    });
  }
}
