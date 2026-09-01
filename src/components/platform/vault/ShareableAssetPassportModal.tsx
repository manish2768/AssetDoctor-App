import React, { useMemo, useState } from 'react';
import { ShieldCheck, X, Lock } from 'lucide-react';
import type { Asset } from '../../../types';
import { AssetDoctorProtectedBadge } from '../trust/AssetDoctorProtectedBadge';
import {
  PASSPORT_SHARE_FIELDS,
  defaultShareSelection,
  buildPassportSharePreview,
} from '../../../trust/protectionStatus.js';

interface ShareableAssetPassportModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset;
}

export const ShareableAssetPassportModal: React.FC<ShareableAssetPassportModalProps> = ({
  isOpen,
  onClose,
  asset
}) => {
  const [selected, setSelected] = useState(defaultShareSelection);
  const preview = useMemo(
    () => buildPassportSharePreview(asset as unknown as Record<string, unknown>, selected),
    [asset, selected]
  );

  if (!isOpen) return null;

  const handleShare = async () => {
    const text = [
      'Asset Passport',
      ...preview.lines.map((l) => `${l.label}: ${l.value}`),
      '',
      'Shared from Asset Doctor. No public URL was created.',
    ].join('\n');
    if (navigator.share) {
      await navigator.share({ title: 'Asset Passport', text });
      return;
    }
    await navigator.clipboard.writeText(text);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
      <div className="relative bg-[#070D18] border border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-5 text-slate-100">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black text-white">Share Asset Passport</h3>
            <p className="text-xs text-slate-400">Private by default. Preview before sharing.</p>
          </div>
        </div>

        <AssetDoctorProtectedBadge state={{ id: 'PROTECTED', label: 'Asset Doctor Protected' }} compact />

        <div className="space-y-2">
          {PASSPORT_SHARE_FIELDS.map((field) => (
            <label key={field.id} className="flex items-center justify-between text-sm text-slate-200">
              <span>{field.label}</span>
              <input
                type="checkbox"
                checked={!!selected[field.id]}
                onChange={(e) => setSelected((prev) => ({ ...prev, [field.id]: e.target.checked }))}
              />
            </label>
          ))}
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-[11px] text-slate-400">
          <p className="text-white font-bold mb-1">Preview</p>
          {preview.lines.length ? (
            preview.lines.map((l) => (
              <p key={l.label}>{l.label}: {String(l.value)}</p>
            ))
          ) : (
            <p>Nothing selected yet.</p>
          )}
          {preview.warnings.map((w) => (
            <p key={w} className="text-amber-300 mt-1">{w}</p>
          ))}
          <p className="mt-2 flex items-start gap-2">
            <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <span>{preview.backendNote}</span>
          </p>
        </div>

        <button
          onClick={handleShare}
          className="w-full px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition cursor-pointer"
        >
          Share preview
        </button>
      </div>
    </div>
  );
};
