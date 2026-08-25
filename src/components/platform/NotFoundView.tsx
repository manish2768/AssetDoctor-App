import React from 'react';
import { Shield, Home, Wrench, Boxes, ArrowRight, Search } from 'lucide-react';

interface NotFoundViewProps {
  onGoHome: () => void;
  onExploreTools: () => void;
  onExploreAssets: () => void;
}

export const NotFoundView: React.FC<NotFoundViewProps> = ({
  onGoHome,
  onExploreTools,
  onExploreAssets
}) => {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6 bg-[#070D18] text-slate-100 animate-fade-in">
      <div className="max-w-lg w-full rounded-3xl bg-slate-900/90 border border-slate-800 p-8 text-center space-y-6 shadow-2xl">
        <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
          <Shield className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="text-[11px] font-mono text-emerald-400 uppercase font-black tracking-widest block">
            404 • Page Not Found
          </span>
          <h2 className="text-2xl font-black text-white">
            That asset intelligence page doesn't exist.
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
            The URL you requested may have been moved, renamed, or is temporarily unavailable. All your saved calculations and vaulted assets remain completely secure.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
          <button
            onClick={onGoHome}
            className="w-full py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </button>

          <button
            onClick={onExploreTools}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all cursor-pointer border border-slate-700 flex items-center justify-center gap-1.5"
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Explore Tools</span>
          </button>

          <button
            onClick={onExploreAssets}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all cursor-pointer border border-slate-700 flex items-center justify-center gap-1.5"
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>Explore Assets</span>
          </button>
        </div>
      </div>
    </div>
  );
};
