import React from 'react';
import { ShieldAlert, ArrowRight, Plus, X, FolderOpen } from 'lucide-react';
import type { Asset } from '../../types';

interface DuplicateAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingAsset: Asset;
  onOpenExisting: (asset: Asset) => void;
  onCreateAnother: () => void;
  reason?: string;
}

export const DuplicateAssetModal: React.FC<DuplicateAssetModalProps> = ({
  isOpen,
  onClose,
  existingAsset,
  onOpenExisting,
  onCreateAnother,
  reason
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="relative bg-[#070D18] border border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-6 text-slate-100 animate-scale-up">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Warning Icon */}
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 shadow-lg shadow-amber-500/10">
          <ShieldAlert className="w-6 h-6" />
        </div>

        <div className="text-center space-y-2">
          <h3 className="text-xl font-black text-white">
            Looks like you already have this asset
          </h3>
          <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
            {reason || `"${existingAsset.name}" is already registered in your Asset Doctor Vault.`}
          </p>
        </div>

        {/* Existing Asset Card Preview */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white text-sm">{existingAsset.name}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 font-mono">
              {existingAsset.category}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
            <span>Brand: {existingAsset.brand || 'N/A'}</span>
            <span>Price: ₹{(existingAsset.price || 0).toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-2">
          <button
            onClick={() => onOpenExisting(existingAsset)}
            className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
          >
            <FolderOpen className="w-4 h-4" />
            <span>Open Existing Asset</span>
          </button>

          <button
            onClick={onCreateAnother}
            className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white font-bold text-xs sm:text-sm border border-slate-800 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create Another (New Copy)</span>
          </button>

          <button
            onClick={onClose}
            className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-400 transition cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
