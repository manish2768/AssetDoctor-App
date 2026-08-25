/**
 * Asset Doctor — Universal Daily Utility Tools Registry
 * Architecture Model:
 * Tool
 *  ├── id
 *  ├── slug
 *  ├── category
 *  ├── title
 *  ├── description
 *  ├── badge
 *  ├── icon
 *  ├── calculationEngine
 *  ├── inputs
 *  ├── faq
 *  ├── seo
 *  └── relatedTools
 */

export interface ToolInputField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'date';
  placeholder?: string;
  defaultValue?: string | number;
  options?: { label: string; value: string }[];
  helperText?: string;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}

export interface ToolFaq {
  question: string;
  answer: string;
}

export interface ToolDefinition {
  id: string;
  slug: string;
  category: 'WARRANTY' | 'MAINTENANCE' | 'VALUATION' | 'LIFECYCLE' | 'DOCUMENTS' | 'FINANCIAL';
  title: string;
  shortDescription: string;
  fullDescription: string;
  badge: string;
  iconName: string;
  accentColor: string; // Tailwind color token
  inputs: ToolInputField[];
  provenanceNotice?: string;
  faq: ToolFaq[];
  relatedToolSlugs: string[];
}

export class ToolRegistry {
  public static readonly TOOLS: ToolDefinition[] = [
    // 1. Warranty Expiry Calculator
    {
      id: 'tool-warranty-expiry',
      slug: 'warranty-expiry-calculator',
      category: 'WARRANTY',
      title: 'Warranty Expiry & Coverage Calculator',
      shortDescription: 'Calculate exact remaining warranty days, coverage status, and claim deadlines.',
      fullDescription: 'Never forfeit free manufacturer repairs or replacements. Enter your asset purchase details to project warranty validity, extended warranty eligibility, and claim support channels.',
      badge: 'POPULAR UTILITY',
      iconName: 'shield-check',
      accentColor: 'emerald',
      inputs: [
        {
          id: 'assetCategory',
          label: 'Asset Category',
          type: 'select',
          defaultValue: 'ELECTRONICS',
          options: [
            { label: 'Electronics (Phones, Laptops, TVs)', value: 'ELECTRONICS' },
            { label: 'Home Appliances (AC, Fridge, Washer)', value: 'APPLIANCE' },
            { label: 'Vehicles (Cars, Bikes, EVs)', value: 'VEHICLE' },
            { label: 'Home & Energy (Solar, Inverters)', value: 'SOLAR' },
            { label: 'Business & Office Equipment', value: 'BUSINESS' }
          ]
        },
        {
          id: 'purchaseDate',
          label: 'Purchase Date',
          type: 'date',
          defaultValue: '2025-01-15'
        },
        {
          id: 'warrantyMonths',
          label: 'Standard Warranty Duration (Months)',
          type: 'number',
          defaultValue: 12,
          min: 1,
          max: 120,
          suffix: 'mo'
        },
        {
          id: 'extendedWarrantyMonths',
          label: 'Extended Warranty / AMC (Months)',
          type: 'number',
          defaultValue: 0,
          min: 0,
          max: 120,
          suffix: 'mo'
        }
      ],
      faq: [
        {
          question: 'What happens if I lose my physical warranty card?',
          answer: 'Most modern manufacturers honor purchase date verification via GST invoice, serial number, or IMEI lookup. Vaulting your invoice in Asset Doctor guarantees verifiable proof of purchase.'
        },
        {
          question: 'Can I claim warranty on replacement parts?',
          answer: 'Authorized OEM repairs typically extend a 90-day to 180-day discrete warranty specifically on replaced genuine components.'
        }
      ],
      relatedToolSlugs: ['repair-vs-replace', 'document-expiry', 'depreciation-calculator']
    },

    // 2. Service Due & Maintenance Interval Calculator
    {
      id: 'tool-service-due',
      slug: 'service-due-calculator',
      category: 'MAINTENANCE',
      title: 'Service Due & Preventative Maintenance Calculator',
      shortDescription: 'Compute upcoming service milestones based on odometer, runtime, or calendar age.',
      fullDescription: 'Prevent unexpected breakdowns and mechanical wear. Compute upcoming inspection milestones, filter renewals, and fluid change schedules based on manufacturer parameters.',
      badge: 'PREVENTATIVE CARE',
      iconName: 'wrench',
      accentColor: 'cyan',
      inputs: [
        {
          id: 'assetType',
          label: 'Asset Sector',
          type: 'select',
          defaultValue: 'VEHICLE',
          options: [
            { label: 'Car / 4-Wheeler', value: 'CAR' },
            { label: 'Bike / Scooter / 2-Wheeler', value: 'BIKE' },
            { label: 'Electric Vehicle (EV)', value: 'EV' },
            { label: 'Air Conditioner (AC)', value: 'AC' },
            { label: 'RO Water Purifier', value: 'RO_PURIFIER' },
            { label: 'Solar Power Inverter', value: 'SOLAR_INVERTER' }
          ]
        },
        {
          id: 'currentMetric',
          label: 'Current Reading (Km / Running Hours)',
          type: 'number',
          defaultValue: 18500,
          min: 0,
          suffix: 'km/hrs'
        },
        {
          id: 'lastServiceMetric',
          label: 'Reading at Last Service',
          type: 'number',
          defaultValue: 10000,
          min: 0,
          suffix: 'km/hrs'
        },
        {
          id: 'monthlyUsageEstimate',
          label: 'Estimated Monthly Usage',
          type: 'number',
          defaultValue: 1200,
          min: 50,
          suffix: 'km/hrs/mo'
        }
      ],
      faq: [
        {
          question: 'What if I drive very few kilometers annually?',
          answer: 'Maintenance schedules are dual-gated (e.g. 10,000 km or 12 months, whichever comes first). Engine oil and cooling fluids chemically oxidize over time even if the vehicle sits idle.'
        }
      ],
      relatedToolSlugs: ['maintenance-interval-calculator', 'service-cost-tracker', 'ownership-cost']
    },

    // 3. Maintenance Interval Calculator
    {
      id: 'tool-maintenance-interval',
      slug: 'maintenance-interval-calculator',
      category: 'MAINTENANCE',
      title: 'Universal Maintenance Interval & Checklist Engine',
      shortDescription: 'Category-specific maintenance schedule and preventative checklist engine.',
      fullDescription: 'Customized maintenance matrices for HVAC systems, automotive powertrains, battery storage, and major appliances.',
      badge: 'LIFECYCLE ENGINE',
      iconName: 'calendar-check',
      accentColor: 'blue',
      inputs: [
        {
          id: 'equipmentType',
          label: 'Equipment Category',
          type: 'select',
          defaultValue: 'AC',
          options: [
            { label: 'Split / Inverter AC', value: 'AC' },
            { label: 'Automotive Engine & Powertrain', value: 'AUTO' },
            { label: 'Solar Panel Array', value: 'SOLAR' },
            { label: 'Lead-Acid / Tubular Battery', value: 'BATTERY' },
            { label: 'Commercial Laser Printer', value: 'PRINTER' }
          ]
        },
        {
          id: 'installationYear',
          label: 'Installation / Commission Year',
          type: 'number',
          defaultValue: 2023,
          min: 2000,
          max: 2026
        }
      ],
      faq: [
        {
          question: 'How often should AC filters be washed?',
          answer: 'Indoor mesh filters require washing every 15–30 days in urban environments to maintain cooling efficiency and prevent compressor overload.'
        }
      ],
      relatedToolSlugs: ['service-due-calculator', 'repair-vs-replace']
    },

    // 4. Asset Depreciation Calculator
    {
      id: 'tool-depreciation',
      slug: 'depreciation-calculator',
      category: 'VALUATION',
      title: 'Asset Depreciation & Value Loss Engine',
      shortDescription: 'Project declining market value and salvage equity across 10-year timelines.',
      fullDescription: 'Understand how your assets lose value over time using Written Down Value (WDV / Declining Balance) and Straight-Line models tailored to Indian market benchmarks.',
      badge: 'FINANCIAL INTELLIGENCE',
      iconName: 'trending-down',
      accentColor: 'amber',
      inputs: [
        {
          id: 'purchasePrice',
          label: 'Original Purchase Price (₹)',
          type: 'number',
          defaultValue: 85000,
          min: 1000,
          suffix: '₹'
        },
        {
          id: 'assetAgeYears',
          label: 'Asset Age (Years)',
          type: 'number',
          defaultValue: 2.5,
          min: 0.1,
          max: 25,
          step: 0.5,
          suffix: 'yrs'
        },
        {
          id: 'assetCategory',
          label: 'Asset Category',
          type: 'select',
          defaultValue: 'ELECTRONICS',
          options: [
            { label: 'Consumer Electronics (Phones, Laptops)', value: 'ELECTRONICS' },
            { label: 'Automobiles & Vehicles', value: 'VEHICLE' },
            { label: 'Home Appliances (AC, Fridge)', value: 'APPLIANCE' },
            { label: 'Furniture & Living Assets', value: 'HOUSEHOLD' },
            { label: 'Business Hardware & Machinery', value: 'OTHER' }
          ]
        },
        {
          id: 'calculationMethod',
          label: 'Depreciation Method',
          type: 'select',
          defaultValue: 'DECLINING_BALANCE',
          options: [
            { label: 'Declining Balance / WDV (Market Reality)', value: 'DECLINING_BALANCE' },
            { label: 'Straight Line (Standard Accounting)', value: 'STRAIGHT_LINE' }
          ]
        }
      ],
      faq: [
        {
          question: 'Why do smartphones depreciate faster than home appliances?',
          answer: 'Rapid silicon generation releases, lithium battery cycle degradation, and annual software cycle deprecation cause electronics to lose 25–30% value annually.'
        }
      ],
      relatedToolSlugs: ['asset-value-estimator', 'repair-vs-replace', 'ownership-cost']
    },

    // 5. Repair vs Replace Calculator
    {
      id: 'tool-repair-vs-replace',
      slug: 'repair-vs-replace',
      category: 'LIFECYCLE',
      title: 'Repair vs. Replace Decision Engine',
      shortDescription: 'Algorithmic assessment of repair estimates against fair equity and lifecycle stage.',
      fullDescription: 'Stop pouring money into aging equipment. Evaluate repair quotes against the 50% economic rule, historical breakdown frequency, and modern replacement efficiency.',
      badge: 'SMART DECISION ENGINE',
      iconName: 'scale',
      accentColor: 'indigo',
      inputs: [
        {
          id: 'assetType',
          label: 'Asset Universe',
          type: 'select',
          defaultValue: 'APPLIANCE',
          options: [
            { label: 'Home Appliance (AC, Fridge, Washer)', value: 'APPLIANCE' },
            { label: 'Consumer Electronics (Phone, Laptop)', value: 'ELECTRONICS' },
            { label: 'Vehicle (Car, Bike, EV)', value: 'VEHICLE' },
            { label: 'Household & Living Equipment', value: 'HOUSEHOLD' },
            { label: 'Business / Machinery', value: 'OTHER' }
          ]
        },
        {
          id: 'purchasePrice',
          label: 'Original Purchase Price (₹)',
          type: 'number',
          defaultValue: 42000,
          min: 1000,
          suffix: '₹'
        },
        {
          id: 'ageYears',
          label: 'Current Age (Years)',
          type: 'number',
          defaultValue: 5.5,
          min: 0.1,
          max: 20,
          suffix: 'yrs'
        },
        {
          id: 'repairCost',
          label: 'Estimated Repair Quote (₹)',
          type: 'number',
          defaultValue: 16500,
          min: 0,
          suffix: '₹'
        },
        {
          id: 'previousRepairCount',
          label: 'Prior Repairs in Past 12 Months',
          type: 'number',
          defaultValue: 2,
          min: 0,
          max: 20
        },
        {
          id: 'warrantyStatus',
          label: 'Current Warranty Status',
          type: 'select',
          defaultValue: 'EXPIRED',
          options: [
            { label: 'Expired', value: 'EXPIRED' },
            { label: 'Active Standard Warranty', value: 'ACTIVE' },
            { label: 'Active Extended Warranty / AMC', value: 'EXTENDED' }
          ]
        }
      ],
      faq: [
        {
          question: 'What is the 50% Rule in Asset Management?',
          answer: 'If the repair cost exceeds 50% of the asset current fair market value and the asset has passed 50% of its expected lifespan, replacement is mathematically superior.'
        }
      ],
      relatedToolSlugs: ['depreciation-calculator', 'asset-value-estimator', 'warranty-expiry-calculator']
    },

    // 6. Ownership Cost (TCO) Calculator
    {
      id: 'tool-ownership-cost',
      slug: 'ownership-cost',
      category: 'FINANCIAL',
      title: 'Total Cost of Ownership (TCO) Analyzer',
      shortDescription: 'Calculate complete lifecycle expenditure: Purchase + Fuel/Energy + Maintenance + Insurance.',
      fullDescription: 'Discover the real cost of owning any major asset. Quantify daily and monthly operational overhead beyond the initial showroom purchase invoice.',
      badge: 'LIFECYCLE TCO',
      iconName: 'wallet',
      accentColor: 'teal',
      inputs: [
        {
          id: 'purchasePrice',
          label: 'Showroom / Purchase Price (₹)',
          type: 'number',
          defaultValue: 1150000,
          min: 5000,
          suffix: '₹'
        },
        {
          id: 'yearsOwned',
          label: 'Years of Projected Ownership',
          type: 'number',
          defaultValue: 5,
          min: 1,
          max: 15,
          suffix: 'yrs'
        },
        {
          id: 'annualMaintenance',
          label: 'Estimated Annual Service & Maintenance (₹)',
          type: 'number',
          defaultValue: 18000,
          min: 0,
          suffix: '₹/yr'
        },
        {
          id: 'annualEnergyOrFuel',
          label: 'Annual Fuel / Electricity / Charging (₹)',
          type: 'number',
          defaultValue: 72000,
          min: 0,
          suffix: '₹/yr'
        },
        {
          id: 'annualInsuranceAndTaxes',
          label: 'Annual Insurance, AMC & Compliance (₹)',
          type: 'number',
          defaultValue: 28000,
          min: 0,
          suffix: '₹/yr'
        }
      ],
      faq: [
        {
          question: 'Why does operating cost frequently exceed capital cost?',
          answer: 'Over a 5 to 7 year horizon, recurring expenses (fuel, insurance, preventative servicing) often comprise 55% to 70% of total cash outflow.'
        }
      ],
      relatedToolSlugs: ['depreciation-calculator', 'service-cost-tracker', 'repair-vs-replace']
    },

    // 7. Asset Value Estimator
    {
      id: 'tool-asset-value-estimator',
      slug: 'asset-value-estimator',
      category: 'VALUATION',
      title: 'Asset Fair Market Value & Resale Estimator',
      shortDescription: 'Estimate instant second-hand market value and optimal resale timing.',
      fullDescription: 'Determine realistic fair market equity before listing an asset on resale marketplaces or trading in at dealerships.',
      badge: 'RESALE EQUITY',
      iconName: 'badge-percent',
      accentColor: 'violet',
      inputs: [
        {
          id: 'purchasePrice',
          label: 'Original Purchase Price (₹)',
          type: 'number',
          defaultValue: 65000,
          min: 1000,
          suffix: '₹'
        },
        {
          id: 'assetCategory',
          label: 'Asset Category',
          type: 'select',
          defaultValue: 'ELECTRONICS',
          options: [
            { label: 'Smartphones & Mobile Devices', value: 'ELECTRONICS' },
            { label: 'Laptops & Computers', value: 'ELECTRONICS' },
            { label: 'Cars & Four-Wheelers', value: 'VEHICLE' },
            { label: 'Two-Wheelers & Bikes', value: 'VEHICLE' },
            { label: 'Air Conditioners & Appliances', value: 'APPLIANCE' }
          ]
        },
        {
          id: 'ageMonths',
          label: 'Age in Months',
          type: 'number',
          defaultValue: 24,
          min: 1,
          max: 180,
          suffix: 'mo'
        },
        {
          id: 'condition',
          label: 'Physical & Functional Condition',
          type: 'select',
          defaultValue: 'GOOD',
          options: [
            { label: 'Flawless / Like New (Box & Bill)', value: 'EXCELLENT' },
            { label: 'Good / Normal Cosmetic Wear', value: 'GOOD' },
            { label: 'Fair / Functional Minor Defects', value: 'FAIR' },
            { label: 'Poor / Requires Repairs', value: 'POOR' }
          ]
        }
      ],
      faq: [
        {
          question: 'Does having complete original documentation increase resale value?',
          answer: 'Yes. Assets accompanied by GST invoice, warranty papers, and organized service history command 12% to 20% higher resale liquidity.'
        }
      ],
      relatedToolSlugs: ['depreciation-calculator', 'warranty-expiry-calculator', 'document-expiry']
    },

    // 8. Document Expiry & Compliance Tracker
    {
      id: 'tool-document-expiry',
      slug: 'document-expiry',
      category: 'DOCUMENTS',
      title: 'Document Expiry & Compliance Deadline Tracker',
      shortDescription: 'Calculate renewal deadlines for Insurance, Pollution (PUC), AMC, and Registration.',
      fullDescription: 'Never drive with expired insurance or risk PUC regulatory fines. Track document expiration timelines with structured lead-time alerts.',
      badge: 'COMPLIANCE AUDIT',
      iconName: 'file-text',
      accentColor: 'rose',
      inputs: [
        {
          id: 'documentType',
          label: 'Document Type',
          type: 'select',
          defaultValue: 'INSURANCE',
          options: [
            { label: 'Comprehensive Motor Insurance Policy', value: 'INSURANCE' },
            { label: 'Pollution Under Control (PUC) Certificate', value: 'PUC' },
            { label: 'Appliance AMC / Service Contract', value: 'AMC' },
            { label: 'Fitness Certificate (Commercial)', value: 'FITNESS' },
            { label: 'Extended Warranty Certificate', value: 'WARRANTY_CERT' }
          ]
        },
        {
          id: 'issueDate',
          label: 'Issue / Start Date',
          type: 'date',
          defaultValue: '2025-09-01'
        },
        {
          id: 'validityMonths',
          label: 'Validity Duration (Months)',
          type: 'number',
          defaultValue: 12,
          min: 1,
          max: 60,
          suffix: 'mo'
        }
      ],
      faq: [
        {
          question: 'What is the penalty for an expired PUC certificate in India?',
          answer: 'Under Section 190(2) of the Motor Vehicles Act, driving without a valid PUC invites a penalty of ₹10,000 and possible license suspension for 3 months.'
        }
      ],
      relatedToolSlugs: ['warranty-expiry-calculator', 'service-due-calculator']
    },

    // 9. Service Cost Tracker
    {
      id: 'tool-service-cost-tracker',
      slug: 'service-cost-tracker',
      category: 'MAINTENANCE',
      title: 'Asset Service Cost & Maintenance Log Analyzer',
      shortDescription: 'Analyze maintenance expenditure trends and spot abnormal repair inflation.',
      fullDescription: 'Track recurring repair bills and workshop invoices to detect component fatigue before catastrophic mechanical failure occurs.',
      badge: 'WORKSHOP AUDIT',
      iconName: 'receipt',
      accentColor: 'emerald',
      inputs: [
        {
          id: 'assetCategory',
          label: 'Asset Category',
          type: 'select',
          defaultValue: 'VEHICLE',
          options: [
            { label: 'Automotive / Vehicle', value: 'VEHICLE' },
            { label: 'HVAC & Home Appliances', value: 'APPLIANCE' },
            { label: 'Consumer Electronics', value: 'ELECTRONICS' }
          ]
        },
        {
          id: 'totalInvoicedPastYear',
          label: 'Total Service Invoiced in Last 12 Months (₹)',
          type: 'number',
          defaultValue: 24500,
          min: 0,
          suffix: '₹'
        },
        {
          id: 'serviceVisitsCount',
          label: 'Number of Workshop / Technician Visits',
          type: 'number',
          defaultValue: 3,
          min: 1,
          max: 24
        }
      ],
      faq: [
        {
          question: 'What is normal annual maintenance expenditure for a car?',
          answer: 'For passenger cars, normal preventative servicing averages 1.5% to 2.5% of showroom price annually during the first 5 years.'
        }
      ],
      relatedToolSlugs: ['ownership-cost', 'repair-vs-replace', 'service-due-calculator']
    },

    // 10. Asset Lifetime Cost Calculator
    {
      id: 'tool-asset-lifetime-cost',
      slug: 'asset-lifetime-cost',
      category: 'FINANCIAL',
      title: 'Asset Lifetime Operational Cost Engine',
      shortDescription: 'Project 10-year cumulative maintenance, energy, and component replacement costs.',
      fullDescription: 'Quantify cumulative lifetime operational cost from acquisition to terminal salvage disposal across all major asset categories.',
      badge: '10-YEAR LIFECYCLE',
      iconName: 'line-chart',
      accentColor: 'sky',
      inputs: [
        {
          id: 'purchasePrice',
          label: 'Asset Acquisition Cost (₹)',
          type: 'number',
          defaultValue: 55000,
          min: 1000,
          suffix: '₹'
        },
        {
          id: 'expectedLifespanYears',
          label: 'Expected Lifespan (Years)',
          type: 'number',
          defaultValue: 8,
          min: 2,
          max: 25,
          suffix: 'yrs'
        },
        {
          id: 'annualOperatingCost',
          label: 'Estimated Annual Operational & Maintenance Cost (₹)',
          type: 'number',
          defaultValue: 6500,
          min: 0,
          suffix: '₹/yr'
        }
      ],
      faq: [
        {
          question: 'How do preventative tune-ups reduce lifetime cost?',
          answer: 'Timely fluid renewals and filter cleanings prevent severe component failure, reducing lifetime catastrophic repair costs by up to 45%.'
        }
      ],
      relatedToolSlugs: ['ownership-cost', 'depreciation-calculator', 'repair-vs-replace']
    }
  ];

  public static getTool(slug: string): ToolDefinition | undefined {
    return this.TOOLS.find(t => t.slug === slug || t.id === slug);
  }

  public static getToolsByCategory(category: ToolDefinition['category']): ToolDefinition[] {
    return this.TOOLS.filter(t => t.category === category);
  }
}
