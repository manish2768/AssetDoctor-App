import React from 'react';
import { Download, Smartphone, ShieldCheck, Sparkles, Bell, Camera, QrCode, Lock, CheckCircle2, ChevronRight } from 'lucide-react';
import { GooglePlayDownloadButton } from '../GooglePlayDownloadButton';

interface DownloadAppPageProps {
  onNavigate: (path: string) => void;
  onOpenVaultApp?: () => void;
}

export const DownloadAppPage: React.FC<DownloadAppPageProps> = ({
  onNavigate,
  onOpenVaultApp
}) => {
  return (
    <div className="w-full max-w-5xl mx-auto space-y-12">
      {/* Hero Section */}
      <section className="text-center space-y-4 max-w-3xl mx-auto px-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-wider font-mono">
          <Smartphone className="w-4 h-4" />
          <span>Official Mobile Experience</span>
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
          Download Asset Doctor
        </h1>

        <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
          Your Home & Vehicle Doctor in your pocket. Snap invoices, get automated WhatsApp service alerts, and access encrypted documents offline.
        </p>

        {/* Download Badges */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <GooglePlayDownloadButton
            variant="hero"
            placement="download_page"
            label="Get it on Google Play"
            sublabel="Direct Official Store"
            showChevron
          />

          {onOpenVaultApp && (
            <button
              onClick={onOpenVaultApp}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Use Web Vault (No Install)</span>
              <ChevronRight className="w-4 h-4 text-emerald-400" />
            </button>
          )}
        </div>
      </section>

      {/* Mobile Features Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Camera className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">Camera Bill Scanner</h3>
          <p className="text-slate-400 leading-relaxed">
            Take a photo of any thermal bill, warranty card, or insurance sheet. Our on-device OCR extracts dates and serials in seconds.
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center">
            <Bell className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">WhatsApp & Push Alerts</h3>
          <p className="text-slate-400 leading-relaxed">
            Never miss a PUC expiry, insurance renewal, AC filter clean, or vehicle service due date with automated reminder messages.
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">Offline-First Vault</h3>
          <p className="text-slate-400 leading-relaxed">
            Show police your vehicle RC or service centers your warranty even without mobile network reception in basements.
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
            <QrCode className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">Smart QR Parking</h3>
          <p className="text-slate-400 leading-relaxed">
            Manage your windshield QR code right from the app to receive masked calls when your vehicle needs to be moved.
          </p>
        </div>
      </section>

      {/* Security & Privacy Commitment */}
      <section className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800 text-center space-y-4 max-w-2xl mx-auto">
        <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto" />
        <h3 className="text-xl font-bold text-white">Privacy & Security Guaranteed</h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          Asset Doctor enforces strict client-side encryption. We never sell your personal contact numbers, purchase receipts, or car details to marketing companies.
        </p>
      </section>
    </div>
  );
};
