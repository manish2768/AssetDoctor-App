import React from 'react';
import {
  ShieldCheck,
  QrCode,
  Calendar,
  Wrench,
  CheckCircle2,
  Lock,
  ArrowRight,
  Sparkles,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';
import { AssetPassportService, PublicAssetPassport } from '../../../platform/passport/assetPassportService';
import { AssetDoctorProtectedBadge } from '../trust/AssetDoctorProtectedBadge';

interface PublicAssetPassportViewProps {
  passport?: PublicAssetPassport;
  isPrivate?: boolean;
  onOpenVaultApp?: () => void;
}

export const PublicAssetPassportView: React.FC<PublicAssetPassportViewProps> = ({
  passport = {
    publicId: 'pass_sample_8829',
    isPublic: true,
    name: 'TVS Ronin 225 Dual Channel ABS',
    brand: 'TVS',
    category: 'Vehicles',
    modelYear: 2023,
    healthScore: 94,
    maintenanceStatus: 'OPTIMAL',
    verificationStatus: 'VERIFIED_OWNERSHIP',
    lifecycleStage: 'Protected Under OEM Warranty',
    serviceCount: 3,
    publicTimelineHighlights: [
      { date: '2023-01-15', event: 'Initial Registration & Invoice Verification', status: 'VERIFIED' },
      { date: '2023-07-20', event: 'First Free Periodic Service (1,000 KM)', status: 'RECORDED' },
      { date: '2024-01-18', event: 'Second Scheduled Periodic Service (6,000 KM)', status: 'RECORDED' }
    ],
    shareableUrl: 'https://assetdoctor.in/passport/pass_sample_8829',
    generatedAt: new Date().toISOString()
  },
  isPrivate = false,
  onOpenVaultApp
}) => {
  if (isPrivate || !passport.isPublic) {
    return (
      <div className="w-full max-w-xl mx-auto py-16 px-4 text-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
          <Lock className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-white">This Asset Passport is Private</h2>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            The owner of this asset has kept its digital verification passport private or the link has expired.
          </p>
        </div>
        <button
          onClick={onOpenVaultApp}
          className="px-5 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition cursor-pointer"
        >
          Go to Asset Doctor Home
        </button>
      </div>
    );
  }

  const qrUrl = AssetPassportService.getQrVerificationUrl(passport.publicId);

  return (
    <div className="w-full max-w-3xl mx-auto py-8 px-4 space-y-8 animate-fade-in">
      {/* 1. Header Provenance Seal */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-[#070D18] to-slate-900 border border-emerald-500/30 shadow-2xl relative overflow-hidden space-y-6">
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10 shrink-0">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 font-mono">
                  Asset Passport
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 text-slate-400 border border-slate-800">
                  ID: {passport.publicId}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
                {passport.name}
              </h1>
              <div className="mt-2">
                <AssetDoctorProtectedBadge state={{ id: 'PROTECTED', label: 'Asset Doctor Protected' }} compact />
              </div>
              <p className="text-xs text-slate-400 font-mono">
                {passport.brand} • {passport.category} • Year {passport.modelYear || 'N/A'}
              </p>
            </div>
          </div>

          <div className="text-right sm:border-l sm:border-slate-800 sm:pl-6">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Asset Health</span>
            <span className="text-3xl font-black text-emerald-400 font-mono">
              {passport.healthScore}<span className="text-sm text-slate-500">/100</span>
            </span>
          </div>
        </div>

        {/* Status Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-800/80 text-xs">
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] uppercase text-slate-500 block">Maintenance Status</span>
            <span className="font-bold text-emerald-400 font-mono">{passport.maintenanceStatus}</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] uppercase text-slate-500 block">Record status</span>
            <span className="font-bold text-white font-mono">On file</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 col-span-2 sm:col-span-1">
            <span className="text-[10px] uppercase text-slate-500 block">Service Records</span>
            <span className="font-bold text-cyan-400 font-mono">{passport.serviceCount} service records</span>
          </div>
        </div>
      </div>

      {/* 2. Public Provenance Timeline Highlights */}
      <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
        <h3 className="text-base font-bold text-white">Public Provenance Ledger</h3>

        <div className="space-y-3">
          {passport.publicTimelineHighlights.map((hl, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <span className="font-bold text-white block">{hl.event}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{hl.date}</span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-mono">
                {hl.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Conversion CTA for Visitors */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-teal-950/60 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-1">
          <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider font-mono">
            Powered by Asset Doctor Universal Intelligence
          </span>
          <h4 className="text-lg font-black text-white">Create a Digital Passport for Everything You Own</h4>
          <p className="text-xs text-slate-300">
            Encrypted offline-first storage, automated warranty alerts, and fraud-proof digital proof of ownership.
          </p>
        </div>

        <button
          onClick={onOpenVaultApp}
          className="px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition cursor-pointer flex items-center justify-center gap-2 shrink-0 shadow-lg shadow-emerald-500/20"
        >
          <span>Start Managing Free</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
