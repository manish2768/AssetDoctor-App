import React from 'react';
import { Sparkles, CheckCircle2, ArrowRight, X, Clock, Calculator } from 'lucide-react';
import type { GuestCalculation } from '../../services/guestSessionService';

interface GuestMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingCalculations: GuestCalculation[];
  onMigrateAll: () => void;
}

export const GuestMigrationModal: React.FC<GuestMigrationModalProps> = ({
  isOpen,
  onClose,
  pendingCalculations,
  onMigrateAll
}) => {
  if (!isOpen || pendingCalculations.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="relative bg-[#070D18] border border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-6 text-slate-100 animate-scale-up">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 shadow-lg shadow-emerald-500/10">
          <Sparkles className="w-6 h-6" />
        </div>

        <div className="text-center space-y-2">
          <h3 className="text-xl font-black text-white">
            Save your recent results?
          </h3>
          <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
            You calculated {pendingCalculations.length} item{pendingCalculations.length > 1 ? 's' : ''} as a guest. Would you like to sync them into your permanent Asset Vault?
          </p>
        </div>

        {/* Calculations List */}
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
          {pendingCalculations.map((calc) => (
            <div
              key={calc.id}
              className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2.5">
                <Calculator className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <span className="font-bold text-white block">{calc.assetName}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {calc.toolType.replace(/_/g, ' ')} • {calc.primaryMetricLabel}: {calc.primaryMetricValue}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-2">
          <button
            onClick={onMigrateAll}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Save All to My Vault</span>
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
          >
            Not Now
          </button>
        </div>
      </div>
    </div>
  );
};
