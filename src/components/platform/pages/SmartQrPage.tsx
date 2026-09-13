import React from 'react';
import { QrCode, Shield, PhoneOff, AlertCircle, CheckCircle2, ChevronRight, Download, Sparkles, Car } from 'lucide-react';

interface SmartQrPageProps {
  onNavigate: (path: string) => void;
  onOpenVaultApp?: () => void;
}

export const SmartQrPage: React.FC<SmartQrPageProps> = ({
  onNavigate,
  onOpenVaultApp
}) => {
  return (
    <div className="w-full max-w-5xl mx-auto space-y-12">
      {/* Hero */}
      <section className="text-center space-y-4 max-w-3xl mx-auto px-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-black uppercase tracking-wider font-mono">
          <QrCode className="w-4 h-4" />
          <span>Privacy-First Technology</span>
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
          Smart QR Parking & Asset Identity
        </h1>

        <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
          The smart sticker for your windshield and home assets. Enable emergency contact and parking alerts without exposing your personal mobile number to strangers.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <button
            onClick={() => onNavigate('/download')}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download Asset Doctor App</span>
          </button>
          <button
            onClick={() => onNavigate('/vehicle-doctor')}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Explore Vehicle Doctor</span>
            <ChevronRight className="w-4 h-4 text-emerald-400" />
          </button>
        </div>
      </section>

      {/* How Smart QR Works */}
      <section className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-black text-white">How Smart QR Parking Works</h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Say goodbye to leaving your phone number handwritten on paper slips.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-center sm:text-left">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm mx-auto sm:mx-0">
              1
            </div>
            <h3 className="text-base font-bold text-white">Stick QR on Windshield</h3>
            <p className="text-slate-400 leading-relaxed">
              Generate and link your unique Smart QR inside the Asset Doctor app. Print or adhere it securely to your vehicle windshield.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-center sm:text-left">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center font-bold text-sm mx-auto sm:mx-0">
              2
            </div>
            <h3 className="text-base font-bold text-white">Anyone Scans via Camera</h3>
            <p className="text-slate-400 leading-relaxed">
              If your vehicle is double-parked or blocking an entrance, anyone can scan the QR code using any smartphone camera without installing any app.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-center sm:text-left">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm mx-auto sm:mx-0">
              3
            </div>
            <h3 className="text-base font-bold text-white">Instant Masked Alert</h3>
            <p className="text-slate-400 leading-relaxed">
              You receive an immediate notification to move your vehicle. Your real personal phone number remains completely hidden and protected.
            </p>
          </div>
        </div>
      </section>

      {/* Privacy Benefits */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <PhoneOff className="w-4 h-4" />
          </div>
          <h4 className="font-bold text-white text-sm">Zero Number Leakage</h4>
          <p className="text-slate-400 leading-relaxed">
            Eliminate harassment, spam calls, and data scraping caused by displaying handwritten phone numbers on dashboards.
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Shield className="w-4 h-4" />
          </div>
          <h4 className="font-bold text-white text-sm">Emergency Assistance Ready</h4>
          <p className="text-slate-400 leading-relaxed">
            In case of roadside emergencies, authorized contacts can access emergency medical notes or towing assistance.
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <QrCode className="w-4 h-4" />
          </div>
          <h4 className="font-bold text-white text-sm">Appliance Quick Vault</h4>
          <p className="text-slate-400 leading-relaxed">
            Stick QR codes on appliances. When a technician visits, scan the QR to instantly pull up invoice, warranty, and past repair history.
          </p>
        </div>
      </section>
    </div>
  );
};
