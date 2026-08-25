import React, { useState } from 'react';
import {
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  Clock,
  ExternalLink,
  Info,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { NormalizedIntelligence, IntelligenceStatus } from '../../../services/liveData/assetIntelligenceService';

interface AssetIntelligenceCardProps {
  intelligence: NormalizedIntelligence;
  onExploreAction?: () => void;
}

export const AssetIntelligenceCard: React.FC<AssetIntelligenceCardProps> = ({
  intelligence,
  onExploreAction
}) => {
  const [showProvenanceModal, setShowProvenanceModal] = useState(false);

  const getStatusBadge = (status: IntelligenceStatus) => {
    switch (status) {
      case 'LIVE':
        return {
          label: 'LIVE FEED',
          classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          dot: 'bg-emerald-400 animate-pulse'
        };
      case 'VERIFIED':
        return {
          label: 'VERIFIED OEM',
          classes: 'bg-teal-500/10 text-teal-300 border-teal-500/30',
          dot: 'bg-teal-400'
        };
      case 'CACHED':
        return {
          label: 'CACHED RECORD',
          classes: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
          dot: 'bg-cyan-400'
        };
      case 'ESTIMATED':
        return {
          label: 'GENERIC ESTIMATE',
          classes: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
          dot: 'bg-amber-400'
        };
      case 'UNAVAILABLE':
      default:
        return {
          label: 'FEED UNAVAILABLE',
          classes: 'bg-slate-800 text-slate-400 border-slate-700',
          dot: 'bg-slate-500'
        };
    }
  };

  const badge = getStatusBadge(intelligence.status);
  const confidencePercent = Math.round(intelligence.confidence * 100);

  return (
    <div className="rounded-2xl bg-slate-950 border border-slate-800 p-5 space-y-4 shadow-lg hover:border-slate-700 transition-all text-xs">
      {/* 1. Header & Status */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-900 pb-3">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${badge.dot}`}></span>
          <span className="font-bold text-white uppercase text-[11px] font-mono">
            {intelligence.category}
          </span>
        </div>
        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider font-mono border ${badge.classes}`}>
          {badge.label}
        </span>
      </div>

      {/* 2. Main Content & Data Points */}
      <div className="space-y-2">
        <h4 className="font-bold text-white text-sm">
          {intelligence.entityId.replace(/-/g, ' ').toUpperCase()}
        </h4>
        <p className="text-slate-300 leading-relaxed text-xs">
          {intelligence.provenanceNotice}
        </p>

        {intelligence.status === 'UNAVAILABLE' && (
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 flex items-start gap-2">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <span>Live information currently unavailable from this provider. Standard safety and maintenance guidelines apply.</span>
          </div>
        )}
      </div>

      {/* 3. Metadata & Confidence Metric */}
      <div className="pt-2 border-t border-slate-900 grid grid-cols-2 gap-2 text-[11px] text-slate-400 font-mono">
        <div>
          <span className="text-slate-500 block text-[9px] uppercase">Confidence</span>
          <span className={`font-bold ${confidencePercent >= 90 ? 'text-emerald-400' : confidencePercent >= 60 ? 'text-amber-400' : 'text-slate-500'}`}>
            {confidencePercent}% Data Reliability
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[9px] uppercase">Last Verified</span>
          <span className="text-slate-300 font-bold">
            {new Date(intelligence.lastUpdated).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* 4. Provenance & "Why am I seeing this?" Trigger */}
      <div className="flex items-center justify-between pt-1 text-[11px]">
        <button
          onClick={() => setShowProvenanceModal(!showProvenanceModal)}
          className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 cursor-pointer"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Why am I seeing this?</span>
          {showProvenanceModal ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {intelligence.sourceUrl && (
          <a
            href={intelligence.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-white flex items-center gap-1"
          >
            <span>Source</span>
            <ExternalLink className="w-3 h-3 text-slate-500" />
          </a>
        )}
      </div>

      {/* 5. Expanded Provenance Drawer */}
      {showProvenanceModal && (
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-[11px] animate-fadeIn">
          <div className="flex items-start gap-2 text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white">Source Authority: {intelligence.source}</p>
              <p className="text-slate-400 mt-0.5 leading-relaxed">{intelligence.disclaimer}</p>
            </div>
          </div>
          <div className="pt-1.5 border-t border-slate-800 text-[10px] text-slate-500 font-mono flex items-center justify-between">
            <span>Provider ID: {intelligence.providerId}</span>
            <span>TTL: {intelligence.cacheDurationSeconds}s</span>
          </div>
        </div>
      )}
    </div>
  );
};
