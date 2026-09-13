import React from 'react';
import {
  Wrench,
  Wind,
  Refrigerator,
  Flame,
  Droplets,
  Tv,
  Zap,
  Sparkles,
  ShieldCheck,
  Clock,
  FileText,
  AlertTriangle,
  ChevronRight,
  Download,
  QrCode,
  Bot
} from 'lucide-react';

export type ApplianceSubPage =
  | 'landing'
  | 'ac'
  | 'refrigerator'
  | 'washing-machine'
  | 'ro'
  | 'geyser'
  | 'microwave'
  | 'chimney';

interface ApplianceDoctorLandingProps {
  subPage?: ApplianceSubPage;
  onNavigate: (path: string) => void;
  onOpenVaultApp?: () => void;
}

export const ApplianceDoctorLanding: React.FC<ApplianceDoctorLandingProps> = ({
  subPage = 'landing',
  onNavigate,
  onOpenVaultApp
}) => {
  const CATEGORY_DATA: Record<ApplianceSubPage, {
    badge: string;
    title: string;
    subtitle: string;
    maintenanceSchedule: string;
    keyCheckpoints: string[];
    warrantyHighlights: string;
    relatedToolPath: string;
    relatedToolLabel: string;
    articleSlug: string;
    articleTitle: string;
  }> = {
    landing: {
      badge: 'Home Appliance Doctor Ecosystem',
      title: 'Appliance Doctor — Smart Digital Care for Every Home Machine',
      subtitle: 'Track invoices, 10-year compressor warranties, AMC coverage, filter clean reminders, and electricity efficiency across all your household equipment.',
      maintenanceSchedule: 'Quarterly filter check and annual deep servicing',
      keyCheckpoints: [
        'Mesh filter cleaning for ACs every 60-90 days',
        'Defrost and condenser coil cleaning for refrigerators',
        'Sediment and carbon cartridge changes for RO purifiers every 6 months',
        'Descaling tub cycle for front and top load washing machines',
        'Magnesium anode rod inspection for water heaters / geysers'
      ],
      warrantyHighlights: 'Split component warranties: 1-2 years comprehensive plus 10 years on motor/compressor.',
      relatedToolPath: '/tools/ac-electricity-calculator',
      relatedToolLabel: 'AC Electricity Calculator',
      articleSlug: 'ac-service-kitne-mahine-mein-karni-chahiye',
      articleTitle: 'AC Service कितने महीने में करनी चाहिए?'
    },
    ac: {
      badge: 'Air Conditioner Management',
      title: 'AC Lifecycle, Filter Cleaning & Power Cost Management',
      subtitle: 'Preserve 100% cooling capacity, track 10-year inverter compressor warranty, and prevent high power bills with 90-day mesh cleaning alerts.',
      maintenanceSchedule: 'Every 60-90 days (Mesh filters), Annual pre-summer coil deep clean',
      keyCheckpoints: [
        'Rinse nylon mesh dust filters with running water every 60 to 90 days',
        'Inspect outdoor condenser fins for dirt accumulation',
        'Clear condensate drain pipes to prevent room water leakages',
        'Test cooling temperature drop across evaporator grill (should be >10°C)'
      ],
      warrantyHighlights: '1 Year comprehensive, 5-10 years on inverter PCB & rotary compressor.',
      relatedToolPath: '/tools/ac-electricity-calculator',
      relatedToolLabel: 'AC Electricity Cost Calculator',
      articleSlug: 'ac-service-kitne-mahine-mein-karni-chahiye',
      articleTitle: 'AC Service कितने महीने में करनी चाहिए?'
    },
    refrigerator: {
      badge: 'Refrigerator Management',
      title: 'Refrigerator Care, Compressor Warranty & Cooling Health',
      subtitle: 'Keep food fresh and energy consumption low. Track inverter compressor warranty, condenser coil hygiene, and door gasket sealing.',
      maintenanceSchedule: 'Every 6 months condenser dust-off, monthly gasket wipe',
      keyCheckpoints: [
        'Wipe magnetic door rubber seal with warm water to maintain airtight insulation',
        'Vacuum condenser coils behind the fridge every 6 months to reduce compressor load',
        'Defrost freezer whenever frost accumulation exceeds 5mm',
        'Maintain 5 cm clearance from the wall for adequate heat dissipation'
      ],
      warrantyHighlights: '1 Year comprehensive product warranty, 10-20 years digital inverter compressor coverage.',
      relatedToolPath: '/tools/warranty-calculator',
      relatedToolLabel: 'Warranty Calculator',
      articleSlug: 'refrigerator-cooling-kam-kyo-karta-hai',
      articleTitle: 'Refrigerator Cooling कम क्यों करता है?'
    },
    'washing-machine': {
      badge: 'Washing Machine Care',
      title: 'Washing Machine Drum Care, Motor Warranty & Leak Prevention',
      subtitle: 'Eliminate violent spin vibration, musty odors, and drain blockages. Track motor warranties and monthly tub descaling cycles.',
      maintenanceSchedule: 'Monthly tub clean, Quarterly water inlet filter rinse',
      keyCheckpoints: [
        'Run monthly Tub Clean cycle using citric acid or descaling powder at 60°C',
        'Clean debris filter trap at the bottom front every 30-45 days',
        'Rinse water inlet mesh filter to remove municipal sediment deposits',
        'Level all 4 machine feet using a spirit level to stop loud spinning vibration'
      ],
      warrantyHighlights: '2 Years comprehensive warranty, 10 years on direct-drive / inverter wash motor.',
      relatedToolPath: '/tools/repair-vs-replace',
      relatedToolLabel: 'Repair vs Replace Calculator',
      articleSlug: 'washing-machine-vibration-kyo-karti-hai',
      articleTitle: 'Washing Machine Vibration क्यों करती है?'
    },
    ro: {
      badge: 'RO Water Purifier Care',
      title: 'RO Water Purifier Membrane & Filter Replacement Tracker',
      subtitle: 'Protect your family from drinking contaminated water. Track sediment, activated carbon, and RO membrane replacement schedules.',
      maintenanceSchedule: 'Sediment/Carbon: 6 Months, RO Membrane: 24 Months, UV Lamp: 12 Months',
      keyCheckpoints: [
        'Replace spun polypropylene pre-filter outer candle every 3-4 months',
        'Replace inline sediment and pre-carbon filter cartridges every 6-9 months',
        'Audit TDS level of output water against raw input water monthly',
        'Sanitize water storage tank every 6 months to eliminate microbial biofilm'
      ],
      warrantyHighlights: '1 Year comprehensive with membrane coverage terms and annual AMC options.',
      relatedToolPath: '/tools/service-due-calculator',
      relatedToolLabel: 'Service Due Calculator',
      articleSlug: 'ro-filter-kitne-mahine-mein-badalna-chahiye',
      articleTitle: 'RO Filter कितने महीने में बदलना चाहिए?'
    },
    geyser: {
      badge: 'Water Heater & Geyser',
      title: 'Geyser Anode Rod, Tank Warranty & Safety Tracker',
      subtitle: 'Prevent tank corrosion, electrical short circuits, and heating element failure with proactive descaling and sacrificial anode monitoring.',
      maintenanceSchedule: 'Annual pre-winter inspection, Anode replacement every 2-3 years',
      keyCheckpoints: [
        'Inspect sacrificial magnesium anode rod to stop hard-water galvanic tank corrosion',
        'Test pressure release safety valve (PRV) for free spring movement',
        'Drain tank sediment flush annually before winter heating season begins',
        'Verify proper home earthing connection to prevent electric shock hazards'
      ],
      warrantyHighlights: '2 Years heating element warranty, 5-7 years inner glass-lined tank warranty.',
      relatedToolPath: '/tools/warranty-calculator',
      relatedToolLabel: 'Warranty Calculator',
      articleSlug: 'product-warranty-kaise-check-kare',
      articleTitle: 'Product Warranty कैसे Check करें?'
    },
    microwave: {
      badge: 'Microwave Oven Management',
      title: 'Microwave Oven Magnetron Warranty & Maintenance Hub',
      subtitle: 'Ensure safe radiation-shielded cooking. Track magnetron warranty terms, waveguide cover replacement, and electrical safety.',
      maintenanceSchedule: 'Monthly interior wipe, inspect waveguide cover for grease burns',
      keyCheckpoints: [
        'Replace mica waveguide cover immediately if burnt, sparking, or discolored',
        'Clean splatter and grease spills immediately to prevent microwave arcing',
        'Never operate the appliance empty to protect the magnetron vacuum tube',
        'Verify door latch safety switches engage cleanly without gaps'
      ],
      warrantyHighlights: '1 Year comprehensive product warranty, 3-5 years on magnetron tube.',
      relatedToolPath: '/tools/repair-vs-replace',
      relatedToolLabel: 'Repair vs Replace Calculator',
      articleSlug: 'product-serial-number-kyo-zaroori-hai',
      articleTitle: 'Product Serial Number क्यों जरूरी है?'
    },
    chimney: {
      badge: 'Kitchen Chimney Management',
      title: 'Kitchen Chimney Baffle Filter Cleaning & Suction Care',
      subtitle: 'Maintain smoke extraction power and protect kitchen ceiling cabinets from grease buildup and fire hazards.',
      maintenanceSchedule: 'Clean baffle filters every 3-4 weeks for Indian deep frying',
      keyCheckpoints: [
        'Soak stainless steel baffle filters in hot water + baking soda/detergent monthly',
        'Empty and clean oil collector cup before it overflows into cooking surface',
        'Check motor blower duct for grease resistance or unusual whirring vibrations',
        'Inspect non-return valve flap at exhaust duct outlet for smooth opening'
      ],
      warrantyHighlights: '1-2 Years comprehensive, 5-10 years on copper motor.',
      relatedToolPath: '/tools/service-due-calculator',
      relatedToolLabel: 'Service Due Calculator',
      articleSlug: 'home-appliances-ki-warranty-kaise-manage-kare',
      articleTitle: 'Home Appliances की Warranty कैसे Manage करें?'
    }
  };

  const current = CATEGORY_DATA[subPage] || CATEGORY_DATA.landing;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-12">
      {/* Category Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin border-b border-slate-800">
        {[
          { label: 'Overview', path: '/appliance-doctor', active: subPage === 'landing' },
          { label: 'Air Conditioners (AC)', path: '/appliance-doctor/ac', active: subPage === 'ac' },
          { label: 'Refrigerators', path: '/appliance-doctor/refrigerator', active: subPage === 'refrigerator' },
          { label: 'Washing Machines', path: '/appliance-doctor/washing-machine', active: subPage === 'washing-machine' },
          { label: 'RO Water Purifiers', path: '/appliance-doctor/ro', active: subPage === 'ro' },
          { label: 'Geysers / Heaters', path: '/appliance-doctor/geyser', active: subPage === 'geyser' },
          { label: 'Microwaves', path: '/appliance-doctor/microwave', active: subPage === 'microwave' },
          { label: 'Kitchen Chimneys', path: '/appliance-doctor/chimney', active: subPage === 'chimney' }
        ].map((tab) => (
          <button
            key={tab.path}
            onClick={() => onNavigate(tab.path)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
              tab.active
                ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Hero Section */}
      <section className="text-center space-y-4 max-w-3xl mx-auto px-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-wider font-mono">
          <Wrench className="w-4 h-4" />
          <span>{current.badge}</span>
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
          {current.title}
        </h1>

        <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
          {current.subtitle}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <button
            onClick={() => onNavigate('/download')}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download Asset Doctor</span>
          </button>
          <button
            onClick={() => onNavigate(current.relatedToolPath)}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>{current.relatedToolLabel}</span>
            <ChevronRight className="w-4 h-4 text-emerald-400" />
          </button>
        </div>
      </section>

      {/* Verified Appliance Capabilities Grid */}
      <section className="space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-black text-white">Manage Everything for Your Home Appliances</h2>
          <p className="text-xs sm:text-sm text-slate-400">
            A single digital memory for invoices, warranties, service cycles, and repair economics.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileText className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-white text-sm">Invoice & Bill OCR</h3>
            <p className="text-slate-400 leading-relaxed">
              Snap a picture of your paper or online bill. We automatically extract the purchase date, brand, model, and warranty terms.
            </p>
          </div>

          <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="w-9 h-9 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-white text-sm">Warranty & AMC Alerts</h3>
            <p className="text-slate-400 leading-relaxed">
              Separate comprehensive coverage from 10-year compressor or motor guarantees with proactive countdown alerts.
            </p>
          </div>

          <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Zap className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-white text-sm">Energy Cost Intelligence</h3>
            <p className="text-slate-400 leading-relaxed">
              Understand power consumption based on star ratings and ambient usage to keep your electricity bills in check.
            </p>
          </div>

          <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="w-9 h-9 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Clock className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-white text-sm">Maintenance Reminders</h3>
            <p className="text-slate-400 leading-relaxed">
              Auto-scheduled calendar reminders for AC filter rinsing, washing machine tub cleaning, and RO cartridge changes.
            </p>
          </div>
        </div>
      </section>

      {/* Category Specific Technical Checkpoints */}
      <section className="p-8 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-6">
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider font-mono">
            Maintenance Engineering
          </span>
          <h2 className="text-2xl font-black text-white">
            Recommended Care Schedule & Checkpoints
          </h2>
          <p className="text-xs text-slate-400">
            Recommended schedule: <strong className="text-white">{current.maintenanceSchedule}</strong>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Critical Maintenance Tasks</h4>
            <ul className="space-y-2 text-xs text-slate-300">
              {current.keyCheckpoints.map((pt, idx) => (
                <li key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{pt}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <span className="font-bold text-white text-sm flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Warranty Rules in India</span>
              </span>
              <p className="text-slate-400 leading-relaxed">{current.warrantyHighlights}</p>
              <div className="pt-2">
                <button
                  onClick={() => onNavigate('/tools/warranty-calculator')}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1"
                >
                  <span>Check your warranty expiry date online</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-xs space-y-2">
              <span className="font-bold text-emerald-400 text-sm flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                <span>Featured Guide</span>
              </span>
              <h5 className="text-white font-bold text-sm">{current.articleTitle}</h5>
              <button
                onClick={() => onNavigate(`/blog/${current.articleSlug}`)}
                className="inline-flex items-center gap-1.5 text-xs text-emerald-300 font-bold hover:underline cursor-pointer pt-1"
              >
                <span>Read practical step-by-step article</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Free Interactive Tools CTA Banner */}
      <section className="p-8 rounded-3xl bg-gradient-to-r from-teal-950/60 via-slate-900 to-emerald-950/60 border border-teal-500/30 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-left">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-400 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Browser Calculators</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white">
            Calculate Power Bills or Repair Economics
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 max-w-lg">
            Use our free browser tools without logging in to calculate AC electricity consumption or compare repair quotes against asset value.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <button
            onClick={() => onNavigate('/tools/ac-electricity-calculator')}
            className="px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition cursor-pointer text-center"
          >
            AC Electricity Calculator
          </button>
          <button
            onClick={() => onNavigate('/tools/repair-vs-replace')}
            className="px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-bold text-xs transition cursor-pointer text-center"
          >
            Repair vs Replace Tool
          </button>
        </div>
      </section>
    </div>
  );
};
