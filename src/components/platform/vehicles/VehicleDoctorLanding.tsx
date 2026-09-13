import React from 'react';
import {
  Car,
  Shield,
  FileText,
  Clock,
  QrCode,
  Wrench,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Bot,
  PhoneCall,
  Download
} from 'lucide-react';
import { GooglePlayDownloadButton } from '../GooglePlayDownloadButton';

export type VehicleDoctorSubPage = 'landing' | 'cars' | 'bikes' | 'warranty' | 'service' | 'documents';

interface VehicleDoctorLandingProps {
  subPage?: VehicleDoctorSubPage;
  onNavigate: (path: string) => void;
  onOpenVaultApp?: () => void;
}

export const VehicleDoctorLanding: React.FC<VehicleDoctorLandingProps> = ({
  subPage = 'landing',
  onNavigate,
  onOpenVaultApp
}) => {
  const SUB_PAGE_HEADERS: Record<VehicleDoctorSubPage, { title: string; subtitle: string; badge: string }> = {
    landing: {
      badge: 'Vehicle Doctor Ecosystem',
      title: 'Vehicle Doctor — Total Digital Care for Your Cars & Bikes',
      subtitle: 'Manage vehicle registration, insurance renewals, PUC deadlines, manufacturer warranties, service logs, and privacy-protected Smart QR parking.'
    },
    cars: {
      badge: 'Car Asset Management',
      title: 'Car Asset Management & Ownership Intelligence',
      subtitle: 'Track periodic service milestones, maintain high resale valuation, vault RC & insurance policies, and receive timely engine maintenance alerts.'
    },
    bikes: {
      badge: 'Two-Wheeler Management',
      title: 'Bike & Scooter Maintenance & Document Hub',
      subtitle: 'Keep motorcycles and scooters road-ready with chain lube alerts, engine oil tracking, statutory PUC checks, and instant breakdown support.'
    },
    warranty: {
      badge: 'Warranty & AMC Vault',
      title: 'Vehicle Warranty & Extended Coverage Tracking',
      subtitle: 'Never forfeit free OEM warranty repairs. Track manufacturer warranties, dealer extended contracts, and authorized battery warranties.'
    },
    service: {
      badge: 'Maintenance & Service',
      title: 'Periodic Vehicle Service & Upkeep Engine',
      subtitle: 'Whichever-comes-first odometer and calendar maintenance prediction for cars and bikes across major Indian automotive manufacturers.'
    },
    documents: {
      badge: 'Statutory Digital Vault',
      title: 'Vehicle Document Management — RC, Insurance & PUC',
      subtitle: 'Zero-clutter encrypted digital records for your Registration Certificate, motor insurance policy, and Pollution Under Control certificate.'
    }
  };

  const currentHeader = SUB_PAGE_HEADERS[subPage] || SUB_PAGE_HEADERS.landing;

  // Verified capabilities
  const capabilities = [
    {
      icon: FileText,
      title: 'Vehicle Documents & RC Vault',
      desc: 'Store digital copies of your Registration Certificate (RC) with smart field extraction for chassis, engine, and registration numbers.'
    },
    {
      icon: Shield,
      title: 'Insurance Expiry Alerts',
      desc: 'Proactive countdown alerts before comprehensive and third-party motor insurance policies lapse, avoiding hefty traffic fines.'
    },
    {
      icon: CheckCircle2,
      title: 'PUC Renewal Tracking',
      desc: 'Statutory Pollution Under Control (PUC) validity tracker with 6-month and 12-month reminder alerts.'
    },
    {
      icon: Clock,
      title: 'Manufacturer & Extended Warranty',
      desc: 'Track standard factory warranties and extended coverage packages so you never pay out-of-pocket for covered defects.'
    },
    {
      icon: Wrench,
      title: 'Periodic Service History',
      desc: 'Log service invoices, odometer readings, engine oil changes, and parts replacement to build a verified vehicle service record.'
    },
    {
      icon: QrCode,
      title: 'Smart QR Parking Assistant',
      desc: 'Place a privacy-protecting QR sticker on your windshield. If your vehicle blocks someone, they scan the QR to notify you without seeing your phone number.'
    },
    {
      icon: Bot,
      title: 'Vehicle AI Assistant',
      desc: 'Instant answers to service intervals, warning light diagnostics, and maintenance queries based on verified vehicle specifications.'
    }
  ];

  return (
    <div className="w-full max-w-6xl mx-auto space-y-12">
      {/* Subpage Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin border-b border-slate-800">
        {[
          { label: 'Overview', path: '/vehicle-doctor', active: subPage === 'landing' },
          { label: 'Cars', path: '/vehicle-doctor/cars', active: subPage === 'cars' },
          { label: 'Bikes & Scooters', path: '/vehicle-doctor/bikes', active: subPage === 'bikes' },
          { label: 'Warranty', path: '/vehicle-doctor/warranty', active: subPage === 'warranty' },
          { label: 'Service & Maintenance', path: '/vehicle-doctor/service', active: subPage === 'service' },
          { label: 'Documents (RC/PUC)', path: '/vehicle-doctor/documents', active: subPage === 'documents' }
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
          <Car className="w-4 h-4" />
          <span>{currentHeader.badge}</span>
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
          {currentHeader.title}
        </h1>

        <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
          {currentHeader.subtitle}
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
            onClick={() => onNavigate('/tools/service-due-calculator')}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Service Due Calculator</span>
            <ChevronRight className="w-4 h-4 text-emerald-400" />
          </button>
        </div>
      </section>

      {/* Core Capabilities Grid */}
      <section className="space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-black text-white">Verified Vehicle Doctor Capabilities</h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Real features designed to eliminate roadside hassles and statutory compliance penalties.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {capabilities.map((c, i) => {
            const Icon = c.icon;
            return (
              <div
                key={i}
                className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition space-y-3"
              >
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">{c.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{c.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Specific Subpage Highlight Content */}
      {subPage === 'cars' && (
        <section className="p-8 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
          <h3 className="text-xl font-bold text-white">Car Ownership Protection in India</h3>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Maintaining a car involves regular oil filter changes every 10,000 KM, wheel alignment every 5,000 KM, and annual insurance renewals. Asset Doctor gives you a single place to track odometer history, service invoices, battery warranty, and PUC certificates.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1">
              <span className="font-bold text-emerald-400">Whichever-Comes-First Rule</span>
              <p className="text-slate-400">Even if you drive low KM, engine oil degrades after 12 months due to oxidation. We track both distance and calendar limits.</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1">
              <span className="font-bold text-emerald-400">Resale Value Retention</span>
              <p className="text-slate-400">A documented service history and digitized bills increase car resale value by up to 15% during dealer valuation.</p>
            </div>
          </div>
        </section>
      )}

      {subPage === 'bikes' && (
        <section className="p-8 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
          <h3 className="text-xl font-bold text-white">Two-Wheeler & Scooter Health Tracking</h3>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Two-wheelers undergo severe stop-and-go thermal cycles in Indian traffic. Drive chains require cleaning every 500-1,000 KM, and spark plugs require replacement every 12,000 KM. Vehicle Doctor reminds you before chain slack or dirty oil damages the engine.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            {['Royal Enfield', 'TVS', 'Hero MotoCorp', 'Bajaj', 'Honda', 'Yamaha', 'Ather EV', 'Ola Electric'].map((b) => (
              <span key={b} className="px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-300">
                {b} Support
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Free Interactive Tools CTA Banner */}
      <section className="p-8 rounded-3xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-teal-950/60 border border-emerald-500/30 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-left">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Interactive Tools</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white">
            Calculate Your Next Service Date Online
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 max-w-lg">
            Try our free Service Due Calculator or check your vehicle’s warranty status right now in your browser.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <button
            onClick={() => onNavigate('/tools/service-due-calculator')}
            className="px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition cursor-pointer text-center"
          >
            Service Due Calculator
          </button>
          <button
            onClick={() => onNavigate('/tools/warranty-calculator')}
            className="px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-bold text-xs transition cursor-pointer text-center"
          >
            Warranty Calculator
          </button>
        </div>
      </section>

      {/* Internal Linking to Blog Articles */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Popular Vehicle Guides</h3>
          <button
            onClick={() => onNavigate('/blog/category/vehicles')}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1"
          >
            <span>View all vehicle articles</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div
            onClick={() => onNavigate('/blog/car-service-kitne-km-par-karni-chahiye')}
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 transition cursor-pointer space-y-2"
          >
            <span className="text-emerald-400 font-bold">Car Care</span>
            <h4 className="font-bold text-white text-sm">Car Service कितने KM पर करनी चाहिए?</h4>
            <p className="text-slate-400">Complete guide on standard 10,000 KM vs 1-year service intervals in Indian driving conditions.</p>
          </div>

          <div
            onClick={() => onNavigate('/blog/puc-kaise-check-kare')}
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 transition cursor-pointer space-y-2"
          >
            <span className="text-teal-400 font-bold">Statutory Compliance</span>
            <h4 className="font-bold text-white text-sm">PUC कैसे Check करें & Expiry Rules</h4>
            <p className="text-slate-400">How to check Parivahan online PUC status and avoid Rs 10,000 traffic fines.</p>
          </div>

          <div
            onClick={() => onNavigate('/blog/vehicle-documents-kaun-kaun-se-rakhne-chahiye')}
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 transition cursor-pointer space-y-2"
          >
            <span className="text-cyan-400 font-bold">Document Vault</span>
            <h4 className="font-bold text-white text-sm">Vehicle Documents कौन-कौन से रखने चाहिए?</h4>
            <p className="text-slate-400">Mandatory checklist: RC, valid Insurance, PUC, and Digilocker validity norms.</p>
          </div>
        </div>
      </section>
    </div>
  );
};
