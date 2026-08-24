import React, { useState, useMemo } from 'react';
import { ShieldAlert, Clock, AlertTriangle, FileText, MessageCircle, Phone, ChevronRight, CheckCircle, Calendar, Sparkles } from 'lucide-react';
import { Asset } from '../types';
import { formatINR, generateWhatsAppShareUrl, getBrandServiceHotline } from '../utils/assetUtils';

interface WarrantyExpiryWidgetProps {
  assets: Asset[];
  onSelectAsset: (asset: Asset) => void;
  onOpenClaimModal: (asset: Asset) => void;
}

type ExpiryWindow = '30' | '60' | '90' | 'expired';

export const WarrantyExpiryWidget: React.FC<WarrantyExpiryWidgetProps> = ({
  assets,
  onSelectAsset,
  onOpenClaimModal,
}) => {
  const [selectedWindow, setSelectedWindow] = useState<ExpiryWindow>('30');

  // Categorize assets into time windows
  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      const days = asset.daysRemaining;
      const isExpired = asset.status === 'expired' || days === 0;

      if (selectedWindow === 'expired') {
        return isExpired;
      }
      if (isExpired) return false;

      if (selectedWindow === '30') {
        return days > 0 && days <= 30;
      }
      if (selectedWindow === '60') {
        return days > 30 && days <= 60;
      }
      if (selectedWindow === '90') {
        return days > 60 && days <= 90;
      }
      return false;
    });
  }, [assets, selectedWindow]);

  // Counts for tabs
  const counts = useMemo(() => {
    let count30 = 0;
    let count60 = 0;
    let count90 = 0;
    let countExpired = 0;

    assets.forEach((ast) => {
      const days = ast.daysRemaining;
      const isExpired = ast.status === 'expired' || days === 0;

      if (isExpired) {
        countExpired++;
      } else if (days > 0 && days <= 30) {
        count30++;
      } else if (days > 30 && days <= 60) {
        count60++;
      } else if (days > 60 && days <= 90) {
        count90++;
      }
    });

    return { count30, count60, count90, countExpired };
  }, [assets]);

  return (
    <div
      id="upcoming-warranty-expiries-widget"
      className="p-6 rounded-3xl bg-slate-900/90 backdrop-blur-xl border border-slate-800 shadow-2xl space-y-5"
    >
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Clock className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white tracking-tight">
                Upcoming Warranty Expiries
              </h2>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Timeline Tracker
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Monitor coverage deadlines for proactive claims and renewal extensions
            </p>
          </div>
        </div>

        {/* Time Window Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 self-start md:self-auto overflow-x-auto max-w-full">
          <button
            onClick={() => setSelectedWindow('30')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              selectedWindow === '30'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>&le; 30 Days</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/40 font-mono">
              {counts.count30}
            </span>
          </button>

          <button
            onClick={() => setSelectedWindow('60')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              selectedWindow === '60'
                ? 'bg-yellow-500 text-slate-950 shadow-lg shadow-yellow-500/20 font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>&le; 60 Days</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/40 font-mono">
              {counts.count60}
            </span>
          </button>

          <button
            onClick={() => setSelectedWindow('90')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              selectedWindow === '90'
                ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20 font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>&le; 90 Days</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/40 font-mono">
              {counts.count90}
            </span>
          </button>

          <button
            onClick={() => setSelectedWindow('expired')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              selectedWindow === 'expired'
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20 font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Expired</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/40 font-mono">
              {counts.countExpired}
            </span>
          </button>
        </div>
      </div>

      {/* Asset List Content */}
      {filteredAssets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredAssets.map((asset) => {
            const whatsAppUrl = generateWhatsAppShareUrl(asset);
            const hotline = getBrandServiceHotline(asset.brand, asset.category, asset.name);

            return (
              <div
                key={`exp-widget-${asset.id}`}
                className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between space-y-3 group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      {asset.brand} • {asset.category}
                    </span>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                        selectedWindow === 'expired'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          : selectedWindow === '30'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse'
                          : selectedWindow === '60'
                          ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                          : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                      }`}
                    >
                      {selectedWindow === 'expired'
                        ? 'Expired'
                        : `${asset.daysRemaining} days remaining`}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white mt-2 group-hover:text-teal-300 transition-colors line-clamp-1">
                    {asset.name}
                  </h3>

                  <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
                    <span>Valuation: <strong className="text-emerald-400 font-mono">{formatINR(asset.price)}</strong></span>
                    <span>Expires: <strong className="text-slate-300">{asset.expiryDate}</strong></span>
                  </div>
                </div>

                {/* Card Quick Actions */}
                <div className="pt-2 border-t border-slate-900 grid grid-cols-3 gap-1.5 text-[11px]">
                  <button
                    onClick={() => onOpenClaimModal(asset)}
                    className="py-1.5 px-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold flex items-center justify-center gap-1 cursor-pointer truncate"
                    title="Generate Warranty Claim Assistant Document"
                  >
                    <FileText className="w-3 h-3 text-amber-400 shrink-0" />
                    <span className="truncate">Claim</span>
                  </button>

                  <a
                    href={whatsAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-1.5 px-2 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 font-bold flex items-center justify-center gap-1 cursor-pointer truncate"
                    title="Share Asset Details on WhatsApp"
                  >
                    <MessageCircle className="w-3 h-3 text-teal-400 shrink-0" />
                    <span className="truncate">WhatsApp</span>
                  </a>

                  <a
                    href={`tel:${hotline.phone}`}
                    className="py-1.5 px-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold flex items-center justify-center gap-1 cursor-pointer truncate"
                    title={`Call Hotline (${hotline.label})`}
                  >
                    <Phone className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span className="truncate">Call Support</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-8 text-center rounded-2xl bg-slate-950/40 border border-slate-800/60">
          <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-300">
            No warranties expiring in this window ({selectedWindow === 'expired' ? 'Expired' : `${selectedWindow} Days`})
          </p>
          <p className="text-xs text-slate-500 mt-1">
            All registered items under this filter are active and protected.
          </p>
        </div>
      )}
    </div>
  );
};
