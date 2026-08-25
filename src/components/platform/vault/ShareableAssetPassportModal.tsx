import React, { useState } from 'react';
import {
  ShieldCheck,
  QrCode,
  Share2,
  Copy,
  Check,
  X,
  ExternalLink,
  Lock,
  Globe
} from 'lucide-react';
import type { Asset } from '../../../types';
import { AssetPassportService, PublicAssetPassport } from '../../../platform/passport/assetPassportService';

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
  const [copied, setCopied] = useState(false);
  const [isPublic, setIsPublic] = useState(true);

  if (!isOpen) return null;

  const passport = AssetPassportService.createPublicPassport(asset, isPublic);
  const qrUrl = AssetPassportService.getQrVerificationUrl(passport.publicId);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(passport.shareableUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="relative bg-[#070D18] border border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 text-slate-100 animate-scale-up">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black text-white">Shareable Digital Passport</h3>
            <p className="text-xs text-slate-400">Public-safe provenance ledger for buyers, workshops, or insurance.</p>
          </div>
        </div>

        {/* QR & Passport Card */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center gap-5">
          <div className="w-36 h-36 rounded-xl bg-slate-950 p-2 border border-slate-800 shrink-0 flex items-center justify-center">
            <img
              src={qrUrl}
              alt="Verification QR Code"
              className="w-full h-full object-contain rounded-lg"
            />
          </div>

          <div className="space-y-2 text-xs w-full">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-sm">{passport.name}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                Score: {passport.healthScore}/100
              </span>
            </div>

            <p className="text-slate-400 text-[11px] font-mono">
              Brand: {passport.brand} • Year: {passport.modelYear || 'N/A'}
            </p>

            <div className="pt-2 border-t border-slate-800 space-y-1 text-[11px] text-slate-400">
              <div className="flex items-center justify-between">
                <span>Verification:</span>
                <span className="text-emerald-400 font-bold">{passport.verificationStatus}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Recorded Services:</span>
                <span className="text-white font-mono">{passport.serviceCount} on file</span>
              </div>
            </div>
          </div>
        </div>

        {/* Privacy Gating Notice */}
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-start gap-2.5 text-[11px] text-slate-400">
          <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>
            <strong className="text-white">Strict Privacy Whitelist:</strong> Personal contact info, private invoices, purchase prices, and customer IDs are permanently excluded from this public passport.
          </span>
        </div>

        {/* Share Link & Copy Action */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={passport.shareableUrl}
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 focus:outline-none"
            />
            <button
              onClick={handleCopyLink}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Link'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
