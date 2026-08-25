import React, { useState } from 'react';
import {
  Car,
  Smartphone,
  Wrench,
  Sun,
  Home,
  Layers,
  FileText,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  ChevronRight
} from 'lucide-react';

interface ExploreYourAssetProps {
  onSelectKnowledge?: (profileId: string) => void;
  onSelectTool?: (toolSlug: string) => void;
}

export const ExploreYourAsset: React.FC<ExploreYourAssetProps> = ({
  onSelectKnowledge,
  onSelectTool
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('vehicles');

  const categories = [
    {
      id: 'vehicles',
      name: 'Vehicles',
      subtitle: 'Cars, Bikes, Scooters & EVs',
      icon: <Car className="w-5 h-5 text-emerald-400" />,
      subtypes: ['Petrol & Diesel Cars', 'Electric Vehicles (EV)', 'Motorcycles & Scooters', 'Commercial Fleets'],
      commonMaintenance: [
        'Periodic engine oil & filter drain (5,000 - 10,000 KM)',
        'Drive chain / serpentine belt tension check',
        'Brake pad wear & DOT 4 fluid flush',
        'Tyre rotation, wheel alignment & balancing'
      ],
      commonDocuments: ['RC Smart Card', 'Comprehensive / Zero-Dep Insurance', 'PUC Certificate (Valid 1 Year)', 'Service Job Cards'],
      warrantyNorms: '3-5 Years / 60,000 - 100,000 KM standard manufacturer warranty (Extendable to 7 Years).',
      commonProblems: [
        'DPF soot clogging on short city diesel drives',
        'Spongy brake lever due to moisture in brake fluid',
        'Hard gear shifting from degraded oil viscosity'
      ],
      featuredKnowledgeId: 'kn-tvs-ronin-225',
      featuredKnowledgeLabel: 'TVS Ronin 225 & Creta 1.5 Maintenance Guide',
      recommendedTool: 'tools/repair-or-replace'
    },
    {
      id: 'electronics',
      name: 'Phones & Electronics',
      subtitle: 'Smartphones, Laptops, TVs & Tablets',
      icon: <Smartphone className="w-5 h-5 text-cyan-400" />,
      subtypes: ['iOS & Android Smartphones', 'Enterprise & Gaming Laptops', '4K Smart TVs & Monitors', 'Tablets & Smartwatches'],
      commonMaintenance: [
        '80% charge limit mode to protect Lithium-Ion cycles',
        'Quarterly thermal exhaust fin dust blowout',
        'Keeping 15% internal flash storage headroom for wear leveling',
        'Encrypted cloud backup & OS security patch verification'
      ],
      commonDocuments: ['Original Tax Invoice with IMEI / Serial Number', 'Extended Warranty / Brand Care Policy', 'Police CEIR Stolen Device Registration'],
      warrantyNorms: '1-3 Years standard warranty. Battery health covered under warranty if below 80% within warranty period.',
      commonProblems: [
        'Battery capacity dropping below 80% maximum health',
        'Thermal throttling and fan whine due to dried thermal paste',
        'Chassis trackpad lift from swollen Li-Po pouch cells'
      ],
      featuredKnowledgeId: 'kn-apple-iphone-15-16',
      featuredKnowledgeLabel: 'iPhone Battery Health & Dell Thermal Standards',
      recommendedTool: 'tools/warranty-checker'
    },
    {
      id: 'appliances',
      name: 'Home Appliances',
      subtitle: 'AC, Refrigerator, Washing Machine, Geyser',
      icon: <Wrench className="w-5 h-5 text-teal-400" />,
      subtypes: ['Inverter Split & Window ACs', 'Front & Top Load Washing Machines', 'Frost-Free Refrigerators', 'Instant & Storage Geysers', 'RO Water Purifiers'],
      commonMaintenance: [
        'AC filter rinse every 15-30 days during summer peak',
        'Washer 40-cycle Eco Drum Clean+ and coin trap lint removal',
        'RO sediment and carbon pre-filter replacement every 6 months',
        'Annual condenser coil pressure wash before summer season'
      ],
      commonDocuments: ['Tax Invoice with Serial Number', 'Installation Handover Report', 'Annual Maintenance Contract (AMC) Card'],
      warrantyNorms: '1 Year Comprehensive + 5-10 Years Compressor/Motor + 5 Years Inverter PCB.',
      commonProblems: [
        'AC water dripping inside room due to blocked drain pipe',
        'Washer severe shaking during 1200 RPM spin cycle',
        'Low cooling from slow micro-leaks in copper coil'
      ],
      featuredKnowledgeId: 'kn-daikin-inverter-ac',
      featuredKnowledgeLabel: 'Daikin Inverter AC & Samsung Washer Service Guide',
      recommendedTool: 'tools/maintenance-checker'
    },
    {
      id: 'solar',
      name: 'Home & Solar',
      subtitle: 'Rooftop Solar PV, Inverters & Batteries',
      icon: <Sun className="w-5 h-5 text-amber-400" />,
      subtypes: ['On-Grid & Hybrid Solar Systems', 'Pure Sinewave Inverters', 'Tubular & Lithium Battery Banks', 'Solar MPPT Charge Controllers'],
      commonMaintenance: [
        'Tubular battery distilled water top-up every 60-90 days',
        'Rooftop PV panel surface wash during early morning or sunset',
        'Petroleum jelly application on lead terminals to prevent sulfation',
        'Inverter equalization charging every 180 days'
      ],
      commonDocuments: ['Solar Subsidies & DISCOM Net Metering Sanction', 'Battery Warranty Card with Serial Barcode', 'Inverter Tax Invoice'],
      warrantyNorms: '25 Years Linear Solar PV Output, 2 Years Inverter, 36-60 Months Battery (Pro-rata).',
      commonProblems: [
        'Backup time dropping under 30 mins from dried electrolyte',
        'Pungent sulfur odor from inverter overcharging',
        'Solar yield reduction of 20-30% from dust accumulation'
      ],
      featuredKnowledgeId: 'kn-luminous-solar-tubular-ups',
      featuredKnowledgeLabel: 'Luminous Solarverter & Tubular Battery Upkeep',
      recommendedTool: 'tools/ownership-cost'
    },
    {
      id: 'living',
      name: 'Home & Living',
      subtitle: 'Furniture, Gym Equipment, Kitchen & Audio',
      icon: <Home className="w-5 h-5 text-indigo-400" />,
      subtypes: ['Ergonomic Chairs & Motorized Standing Desks', 'Modular Kitchen Fittings', 'Fitness Equipment (Treadmill, Home Gym)', 'Audio Systems & Home Theaters'],
      commonMaintenance: [
        'Tightening of frame Allen bolts and mechanism screws every 180 days',
        'Silicone lubrication of chair reclining springs and treadmill belts',
        'Caster wheel lint cleanup to prevent floor scratching',
        'Motorized desk dual-leg synchronization reset'
      ],
      commonDocuments: ['Purchase Bill & Warranty Certificate', 'Structural Frame Guarantee Card'],
      warrantyNorms: '3-10 Years structural frame & mechanism warranty depending on manufacturer.',
      commonProblems: [
        'Office chair sinking slowly due to Class 4 gas lift seal failure',
        'Motorized standing desk halting with error code from sync mismatch',
        'Squeaking hinges and drawer channels from lack of lubrication'
      ],
      featuredKnowledgeId: 'kn-ergonomic-office-furniture',
      featuredKnowledgeLabel: 'Ergonomic Workspace & Living Asset Standards',
      recommendedTool: 'tools/asset-health-score'
    },
    {
      id: 'custom',
      name: 'Other Assets',
      subtitle: 'Tools, Cameras, Musical & Custom Assets',
      icon: <Layers className="w-5 h-5 text-purple-400" />,
      subtypes: ['Professional Cameras & Lenses', 'Musical Instruments', 'Power Tools & Workshop Hardware', 'Custom Personal Equipment'],
      commonMaintenance: [
        'Camera sensor blower cleaning & dry cabinet storage (<45% RH)',
        'Guitar fretboard conditioning and string replacement',
        'Battery pack storage at 50% state-of-charge when idle',
        'Annual safety calibration on precision tools'
      ],
      commonDocuments: ['Tax Invoice / Bill of Sale', 'Import & Serial Authenticity Documents'],
      warrantyNorms: '1-2 Years standard limited manufacturer warranty.',
      commonProblems: [
        'Camera lens fungus from humid storage (>60% humidity)',
        'Potentiometer crackle on audio gear from dust contamination'
      ],
      featuredKnowledgeId: 'kn-dell-latitude-enterprise',
      featuredKnowledgeLabel: 'Universal Custom Asset Tracking Standards',
      recommendedTool: 'tools/invoice-analyzer'
    }
  ];

  const currentCat = categories.find(c => c.id === activeCategory) || categories[0];

  return (
    <section className="w-full space-y-6">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-wider font-mono">
          <Layers className="w-3.5 h-3.5" />
          <span>Universal Asset Universe</span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
          Explore Your Asset
        </h2>
        <p className="text-xs sm:text-sm text-slate-400">
          Everything you need to maintain, protect, and maximize value for every category of physical asset you own.
        </p>
      </div>

      {/* Category Navigation Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin max-w-5xl mx-auto">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-4 py-3 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 border ${
              activeCategory === cat.id
                ? 'bg-emerald-500 text-slate-950 font-black border-emerald-400 shadow-lg shadow-emerald-500/20'
                : 'bg-slate-900/90 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
            }`}
          >
            {cat.icon}
            <span>{cat.name}</span>
          </button>
        ))}
      </div>

      {/* Category Content Box */}
      <div className="max-w-5xl mx-auto rounded-3xl bg-slate-900/90 border border-slate-800 p-6 sm:p-8 space-y-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <h3 className="text-xl font-black text-white flex items-center gap-2">
              {currentCat.icon}
              <span>{currentCat.name}</span>
            </h3>
            <p className="text-xs text-slate-400">{currentCat.subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {currentCat.subtypes.map((sub, idx) => (
              <span key={idx} className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-300 font-medium">
                {sub}
              </span>
            ))}
          </div>
        </div>

        {/* 2-Column Info Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
          {/* Column A: Maintenance & Documents */}
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider block">
                Common Preventive Maintenance
              </span>
              <div className="space-y-1.5 text-slate-300">
                {currentCat.commonMaintenance.map((m, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">•</span>
                    <span>{m}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-[10px] font-black uppercase text-cyan-400 tracking-wider block">
                Essential Document Checklist
              </span>
              <div className="space-y-1.5 text-slate-300">
                {currentCat.commonDocuments.map((d, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <FileText className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                    <span>{d}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Column B: Warranty & Common Issues */}
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-[10px] font-black uppercase text-teal-400 tracking-wider block">
                Standard Warranty Norms
              </span>
              <p className="text-slate-300 leading-relaxed">{currentCat.warrantyNorms}</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider block">
                Common Warning Signs & Pitfalls
              </span>
              <div className="space-y-1.5 text-slate-300">
                {currentCat.commonProblems.map((p, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>{p}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Real Navigation Links */}
        <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <button
            onClick={() => onSelectKnowledge && onSelectKnowledge(currentCat.featuredKnowledgeId)}
            className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <span>Read Verified Guide: {currentCat.featuredKnowledgeLabel}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => onSelectTool && onSelectTool(currentCat.recommendedTool)}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>Launch Category Tool</span>
            <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
          </button>
        </div>
      </div>
    </section>
  );
};
