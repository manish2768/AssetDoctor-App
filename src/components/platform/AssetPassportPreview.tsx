import React, { useState } from 'react';
import {
  ShieldCheck,
  QrCode,
  CheckCircle2,
  Lock,
  Share2,
  Download,
  Calendar,
  Sparkles,
  Car,
  Smartphone,
  Wrench
} from 'lucide-react';
import { createUniversalAsset } from '../../platform/core/universalAssetSchema';

export const AssetPassportPreview: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const samplePassportAsset = createUniversalAsset({
    assetId: 'passport-demo-01',
    publicAssetId: 'AST-8902-99FA',
    name: 'TVS Ronin 225 Dual Tone',
    category: 'VEHICLE',
    brand: 'TVS Motor Company',
    model: 'Ronin 225',
    purchasePrice: 168000,
    purchaseDate: '2025-06-10',
    primaryIdentifier: 'MH-02-EV-9999',
    warranty: {
      hasWarranty: true,
      warrantyStatus: 'ACTIVE',
      expiryDate: '2028-06-09'
    },
    valuation: {
      currentValue: 142000,
      depreciationRateAnnual: 15,
      totalDepreciation: 26000,
      estimatedResaleValue: 135000,
      repairVsReplaceScore: 92,
      valuationModelVersion: '1.0',
      lastValuationAt: '2026-08-25'
    }
  });

  const handleShare = () => {
    navigator.clipboard?.writeText(`https://assetdoctor.in/passport/${samplePassportAsset.publicAssetId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full rounded-3xl bg-slate-900/90 border border-slate-800 p-6 sm:p-8 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <QrCode className="w-4 h-4" />
            </span>
            <span className="text-xs font-black uppercase text-indigo-400 tracking-wider">
              Cryptographic Identity
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
            Universal Asset Passport & QR Verification
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Tamper-proof digital asset certificate showcasing verified ownership, service history, and warranty validity for transparent resale.
          </p>
        </div>

        <button
          onClick={handleShare}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>{copied ? 'Link Copied!' : 'Share Public Passport'}</span>
        </button>
      </div>

      {/* Passport Certificate Card */}
      <div className="max-w-xl mx-auto rounded-3xl bg-gradient-to-b from-[#081528] via-slate-950 to-slate-950 border border-indigo-500/40 p-6 sm:p-8 shadow-2xl relative overflow-hidden space-y-6">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Certificate Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/40">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-black text-indigo-400 tracking-widest block">
                Official Digital Passport
              </span>
              <h3 className="text-lg font-black text-white">{samplePassportAsset.name}</h3>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-500 font-mono block">Permanent ID</span>
            <span className="text-xs font-black text-emerald-400 font-mono">{samplePassportAsset.publicAssetId}</span>
          </div>
        </div>

        {/* Key Attributes Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] text-slate-400 font-semibold block">Primary Identifier</span>
            <span className="font-bold text-white font-mono">{samplePassportAsset.primaryIdentifier}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] text-slate-400 font-semibold block">Manufacturer Warranty</span>
            <span className="font-bold text-emerald-400">Active (June 2028)</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] text-slate-400 font-semibold block">Fair Market Value</span>
            <span className="font-bold text-cyan-400 font-mono">₹1,42,000</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] text-slate-400 font-semibold block">Service History</span>
            <span className="font-bold text-emerald-400">100% OEM Verified</span>
          </div>
        </div>

        {/* Verification Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 font-mono">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Vault Certified & Cryptographically Signed</span>
          </div>
          <span>v2.8</span>
        </div>
      </div>
    </div>
  );
};
