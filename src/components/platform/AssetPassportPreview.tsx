import React, { useState } from 'react';
import {
  ShieldCheck,
  QrCode,
  CheckCircle2,
  Lock,
  Share2,
  Calendar,
  Sparkles,
  Car,
  Smartphone,
  Wrench,
  ChevronRight,
  Plus,
  ArrowRight
} from 'lucide-react';

interface AssetPassportPreviewProps {
  onOpenVault?: () => void;
}

export const AssetPassportPreview: React.FC<AssetPassportPreviewProps> = ({ onOpenVault }) => {
  const [copied, setCopied] = useState(false);

  const timelineStages = [
    { stage: '1. Purchase', desc: 'Authorized Tax Invoice & Ownership Established', date: 'Jun 2025', status: 'COMPLETED' },
    { stage: '2. Warranty', desc: '3-Year Manufacturer Warranty Active', date: 'Valid to 2028', status: 'ACTIVE' },
    { stage: '3. Service', desc: '1,000 KM & 6,000 KM Services Completed On-Time', date: 'Feb 2026', status: 'COMPLETED' },
    { stage: '4. Repairs', desc: 'Zero Major Structural or Engine Repairs', date: 'Clean Record', status: 'COMPLETED' },
    { stage: '5. Documents', desc: 'RC Smart Card, Insurance & PUC Vaulted', date: '3 Documents', status: 'COMPLETED' },
    { stage: '6. Maintenance', desc: 'Chain Lubrication & Fluid Levels Optimal', date: 'Current', status: 'ACTIVE' },
    { stage: '7. Health', desc: 'Health Score 95/100 · Optimal Condition', date: 'Audited', status: 'ACTIVE' },
    { stage: '8. Lifecycle', desc: 'Estimated Useful Lifespan: ~10 Years Remaining', date: 'Projected 2036', status: 'PROJECTED' }
  ];

  const handleShare = () => {
    navigator.clipboard?.writeText('https://assetdoctor.in/passport/sample-passport');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="w-full max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-black uppercase tracking-wider font-mono">
          <QrCode className="w-3.5 h-3.5" />
          <span>Universal Cryptographic Identity</span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
          Universal Asset Passport
        </h2>
        <p className="text-xs sm:text-sm text-slate-400">
          A tamper-proof digital record of ownership, verified service milestones, active warranty coverage, and fair market resale value.
        </p>
      </div>

      {/* Main Container */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 sm:p-8 space-y-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 font-mono">
              Live Interactive Preview
            </span>
            <h3 className="text-lg font-black text-white mt-0.5">
              Verified Asset Lifecycle Passport
            </h3>
          </div>
          <button
            onClick={handleShare}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{copied ? 'Copied Link!' : 'Share Public Passport'}</span>
          </button>
        </div>

        {/* 8-Stage Timeline Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {timelineStages.map((item, idx) => (
            <div
              key={idx}
              className="p-4 rounded-2xl bg-slate-950 border border-slate-800/90 space-y-2 hover:border-indigo-500/40 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-xs">{item.stage}</span>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded font-mono ${
                  item.status === 'COMPLETED'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : item.status === 'ACTIVE'
                    ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {item.status}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">{item.desc}</p>
              <span className="text-[10px] font-mono text-slate-500 block pt-1 border-t border-slate-900">
                {item.date}
              </span>
            </div>
          ))}
        </div>

        {/* CTA Banner */}
        <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-black text-white">Create a Verified Digital Passport for Any Asset</h4>
            <p className="text-xs text-slate-400">Maximize resale valuation and share authenticated service records instantly.</p>
          </div>
          <button
            onClick={onOpenVault}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-teal-500 hover:from-indigo-400 hover:to-teal-400 text-slate-950 font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Create My Asset Passport</span>
          </button>
        </div>
      </div>
    </section>
  );
};
