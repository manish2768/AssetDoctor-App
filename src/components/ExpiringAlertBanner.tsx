import React, { useState, useMemo } from 'react';
import { AlertOctagon, ShieldAlert, X, ChevronRight, FileText, Phone, RefreshCw, Car, ShieldCheck } from 'lucide-react';
import { Asset } from '../types';
import { formatINR, getBrandServiceHotline, calculateExpiryDays } from '../utils/assetUtils';

interface ExpiringAlertBannerProps {
  expiringAssets: Asset[];
  allAssets?: Asset[];
  onSelectAsset: (asset: Asset) => void;
  onOpenClaimModal: (asset: Asset) => void;
  onRenewWarrantyToast?: (msg: string) => void;
}

export interface BannerAlertItem {
  id: string;
  asset: Asset;
  alertType: 'Warranty' | 'Vehicle Insurance' | 'Vehicle PUC';
  expiryDate: string;
  daysRemaining: number;
}

export const ExpiringAlertBanner: React.FC<ExpiringAlertBannerProps> = ({
  expiringAssets,
  allAssets,
  onSelectAsset,
  onOpenClaimModal,
  onRenewWarrantyToast,
}) => {
  const [dismissed, setDismissed] = useState(false);

  const assetList = allAssets || expiringAssets;

  // Gather combined Warranty, Insurance, and PUC expirations in <= 7 days
  const alertItems = useMemo(() => {
    const items: BannerAlertItem[] = [];

    assetList.forEach((asset) => {
      // 1. Warranty Alert
      if (asset.daysRemaining > 0 && asset.daysRemaining <= 7) {
        items.push({
          id: `banner-warr-${asset.id}`,
          asset,
          alertType: 'Warranty',
          expiryDate: asset.expiryDate,
          daysRemaining: asset.daysRemaining,
        });
      }

      // 2. Vehicle Insurance Alert
      if (asset.insuranceExpiryDate) {
        const { daysRemaining } = calculateExpiryDays(asset.insuranceExpiryDate);
        if (daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 7) {
          items.push({
            id: `banner-ins-${asset.id}`,
            asset,
            alertType: 'Vehicle Insurance',
            expiryDate: asset.insuranceExpiryDate,
            daysRemaining,
          });
        }
      }

      // 3. Vehicle PUC Alert
      if (asset.pucExpiryDate) {
        const { daysRemaining } = calculateExpiryDays(asset.pucExpiryDate);
        if (daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 7) {
          items.push({
            id: `banner-puc-${asset.id}`,
            asset,
            alertType: 'Vehicle PUC',
            expiryDate: asset.pucExpiryDate,
            daysRemaining,
          });
        }
      }
    });

    return items;
  }, [assetList]);

  const count = alertItems.length;

  if (dismissed || count === 0) return null;

  return (
    <div
      id="top-notification-expiry-banner"
      className="relative mb-8 rounded-2xl bg-gradient-to-r from-amber-950/90 via-slate-900 to-slate-950 border-2 border-amber-500/50 p-5 shadow-2xl shadow-amber-500/10 overflow-hidden"
    >
      {/* Background Warning Mesh */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Banner Left Icon + Title */}
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 shrink-0">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold text-xs border border-amber-500/30">
                <AlertOctagon className="w-3.5 h-3.5 text-amber-400" />
                7-DAY DOCUMENT & WARRANTY EXPIRY ALERT
              </span>
            </div>

            <p className="text-sm font-black text-amber-300 mt-1">
              ⚠️ Warning: You have {count} {count === 1 ? 'document' : 'documents'} (Warranty / Vehicle Insurance / PUC) expiring in the next 7 days.
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Review policy coverage now or request renewal before expiration.
            </p>
          </div>
        </div>

        {/* Banner Actions */}
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors cursor-pointer"
          aria-label="Dismiss alert"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* List of Expiring Items */}
      <div className="mt-4 pt-4 border-t border-amber-500/20 grid grid-cols-1 md:grid-cols-2 gap-3">
        {alertItems.map((item) => {
          const { asset, alertType, expiryDate, daysRemaining } = item;
          const hotline = getBrandServiceHotline(asset.brand, asset.category, asset.name);

          return (
            <div
              key={item.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-900/90 border border-amber-500/30 hover:border-amber-400 transition-all group"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-slate-100 truncate group-hover:text-amber-300 transition-colors">
                    {asset.name}
                  </span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                    {alertType === 'Warranty' ? <ShieldCheck className="w-3 h-3 text-emerald-400" /> : <Car className="w-3 h-3 text-cyan-400" />}
                    {alertType}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-slate-400 mt-1 flex-wrap">
                  <span>Expiry Date: <strong className="text-slate-200">{expiryDate}</strong></span>
                  <span>•</span>
                  <span className="font-extrabold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30">
                    {daysRemaining === 0
                      ? 'Expires Today!'
                      : `Expires in ${daysRemaining} days`}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <button
                  onClick={() => {
                    if (onRenewWarrantyToast) {
                      onRenewWarrantyToast(`Renewal request sent for ${asset.name} (${alertType})`);
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                  title="Renew Coverage"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Renew</span>
                </button>

                <a
                  href={`tel:${hotline.phone}`}
                  className="p-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 transition-colors cursor-pointer"
                  title="Contact Support"
                >
                  <Phone className="w-3.5 h-3.5 text-cyan-400" />
                </a>

                <button
                  onClick={() => onOpenClaimModal(asset)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                  title="File Claim"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Claim</span>
                </button>

                <button
                  onClick={() => onSelectAsset(asset)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="View Asset Details"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};

