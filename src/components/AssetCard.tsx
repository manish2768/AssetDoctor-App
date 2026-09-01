import React from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  PackageX,
  Tv,
  Laptop,
  Bike,
  WashingMachine,
  Sparkles,
  Calendar,
  Building2,
  Hash,
  ChevronRight,
  FileText,
  Trash2,
  MessageCircle,
  Wind,
  Droplets,
  Car,
  Wrench,
  Phone,
  TrendingDown,
} from 'lucide-react';
import { Asset, WarrantyStatus } from '../types';
import { formatINR, generateWhatsAppShareUrl, getBrandServiceHotline, calculateResaleValue, calculateExpiryDays } from '../utils/assetUtils';
import { getAssetCapabilities } from '../utils/assetCapabilities';

interface AssetCardProps {
  asset: Asset;
  onSelect: (asset: Asset) => void;
  onClaim: (asset: Asset) => void;
  onDelete: (id: string) => void;
}

export const AssetCard: React.FC<AssetCardProps> = ({
  asset,
  onSelect,
  onClaim,
  onDelete,
}) => {
  // Category Icon Resolver with Bike, AC, RO, Car support
  const renderCategoryIcon = () => {
    const lname = asset.name.toLowerCase();
    if (lname.includes('ac') || lname.includes('air conditioner')) {
      return <Wind className="w-5 h-5 text-cyan-400" />;
    }
    if (lname.includes('ro') || lname.includes('water') || lname.includes('purifier')) {
      return <Droplets className="w-5 h-5 text-blue-400" />;
    }
    if (lname.includes('car') || lname.includes('creta')) {
      return <Car className="w-5 h-5 text-emerald-400" />;
    }

    switch (asset.category) {
      case 'Electronics':
        return <Tv className="w-5 h-5 text-teal-400" />;
      case 'Gadgets':
        return <Laptop className="w-5 h-5 text-indigo-400" />;
      case 'Vehicles':
        return <Bike className="w-5 h-5 text-amber-400" />;
      case 'Appliances':
        return <WashingMachine className="w-5 h-5 text-cyan-400" />;
      default:
        return <Sparkles className="w-5 h-5 text-emerald-400" />;
    }
  };

  const renderStatusBadge = (status: WarrantyStatus, daysRemaining: number) => {
    if (daysRemaining <= 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
          <PackageX className="w-3 h-3 text-rose-400" />
          Expired
        </span>
      );
    } else if (status === 'expiring_soon' || daysRemaining <= 7) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm shadow-amber-500/20 animate-pulse">
          <AlertTriangle className="w-3 h-3 text-amber-400" />
          Expiring Soon ({daysRemaining === 0 ? 'Today' : `${daysRemaining}d`})
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          Active ({daysRemaining}d)
        </span>
      );
    }
  };

  const renderComplianceBadge = (type: 'Insurance' | 'PUC', dateStr?: string) => {
    if (!dateStr) return null;
    const { daysRemaining, status } = calculateExpiryDays(dateStr);
    if (daysRemaining === null || status === null) return null;

    let badgeStyle = '';
    let statusText = '';

    if (status === 'expired') {
      badgeStyle = 'bg-rose-500/15 text-rose-300 border-rose-500/40';
      statusText = `Expired (${daysRemaining <= 0 ? (daysRemaining === 0 ? 'Today' : `${Math.abs(daysRemaining)}d ago`) : ''})`;
    } else if (status === 'expiring_soon') {
      badgeStyle = 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse';
      statusText = `Expiring (${daysRemaining}d)`;
    } else {
      badgeStyle = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      statusText = `Valid (${daysRemaining}d)`;
    }

    return (
      <span
        key={`badge-${type}`}
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${badgeStyle}`}
        title={`${type} Expiry Date: ${dateStr}`}
      >
        <ShieldCheck className="w-3 h-3" />
        {type}: {statusText}
      </span>
    );
  };

  const whatsAppUrl = generateWhatsAppShareUrl(asset);
  const hotline = getBrandServiceHotline(asset.brand, asset.category, asset.name);
  const resale = calculateResaleValue(asset);
  const capabilities = getAssetCapabilities(asset);

  return (
    <div
      id={`asset-card-${asset.id}`}
      className={`group relative rounded-3xl bg-slate-900/80 backdrop-blur-md border ${
        asset.status === 'expiring_soon'
          ? 'border-amber-500/50 hover:border-amber-400 shadow-xl shadow-amber-500/5'
          : asset.status === 'expired'
          ? 'border-slate-800 hover:border-slate-700'
          : 'border-slate-800/90 hover:border-teal-500/50'
      } p-5 transition-all duration-300 hover:shadow-2xl hover:translate-y-[-2px] flex flex-col justify-between overflow-hidden`}
    >
      {/* Top Subtle Gradient Ambient Accent */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-28 h-28 bg-teal-500/5 rounded-full blur-2xl group-hover:bg-teal-500/15 transition-colors"></div>

      <div>
        {/* Top Meta Bar */}
        <div className="flex items-start justify-between gap-2.5 mb-3">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 group-hover:border-teal-500/40 transition-colors">
              {renderCategoryIcon()}
            </div>
            <div>
              {/* Brand Tag & Scam Guard Badge */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                  {asset.brand || asset.category}
                </span>

                {asset.scamGuardStatus && (
                  <span
                    className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                      asset.scamGuardStatus === 'VERIFIED'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : asset.scamGuardStatus === 'WARNING'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    }`}
                  >
                    <ShieldCheck className="w-2.5 h-2.5" />
                    {asset.scamGuardStatus === 'VERIFIED' ? 'GST Verified' : 'Scam Alert'}
                  </span>
                )}
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-100 group-hover:text-teal-300 transition-colors line-clamp-1 mt-1">
                {asset.name}
              </h3>
            </div>
          </div>

          <div className="shrink-0">
            {renderStatusBadge(asset.status, asset.daysRemaining)}
          </div>
        </div>

        {/* Vehicle Specific Compliance Badges (Insurance & PUC) — Rendered ONLY for Vehicles */}
        {(capabilities.hasInsurance || capabilities.hasPuc) && (asset.insuranceExpiryDate || asset.pucExpiryDate) && (
          <div className="mb-3 p-2.5 rounded-2xl bg-slate-950/90 border border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-slate-300 font-bold">
              <Car className="w-3.5 h-3.5 text-cyan-400" />
              <span>Vehicle Docs:</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {asset.insuranceExpiryDate ? (
                renderComplianceBadge('Insurance', asset.insuranceExpiryDate)
              ) : (
                <span className="text-[10px] font-semibold text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  Insurance: Not Set
                </span>
              )}

              {asset.pucExpiryDate ? (
                renderComplianceBadge('PUC', asset.pucExpiryDate)
              ) : (
                <span className="text-[10px] font-semibold text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  PUC: Not Set
                </span>
              )}
            </div>
          </div>
        )}

        {/* Valuation & Specs Box */}
        <div className="my-3.5 p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-400">Purchase Value:</span>
            <span className="text-sm font-black text-emerald-400 font-mono tracking-tight">
              {formatINR(asset.price)}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-800/60">
            <span className="font-semibold text-slate-400 flex items-center gap-1">
              <TrendingDown className="w-3 h-3 text-cyan-400" />
              Est. Resale Worth:
            </span>
            <span className="font-bold text-cyan-300 font-mono flex items-center gap-1.5">
              <span>{formatINR(resale.currentValue)}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                {resale.retainedPercentage}%
              </span>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 pt-2 border-t border-slate-800/60">
            <div className="flex items-center gap-1.5 truncate">
              <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="truncate">{asset.vendor || 'Authorized Store'}</span>
            </div>
            <div className="flex items-center gap-1.5 truncate justify-end">
              <Hash className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="font-mono truncate">{asset.serialNumber || '—'}</span>
            </div>
          </div>

          {/* Maintenance Due Date if present */}
          {asset.maintenanceDueDate && (
            <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-cyan-400">
              <span className="flex items-center gap-1 font-semibold">
                <Wrench className="w-3 h-3" /> {asset.maintenanceType || 'Service Due'}
              </span>
              <span className="font-mono font-bold text-cyan-300">{asset.maintenanceDueDate}</span>
            </div>
          )}
        </div>

        {/* Timeline Dates */}
        <div className="flex items-center justify-between text-xs text-slate-400 mb-3 px-1">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>Bought: {asset.purchaseDate}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
            <span>Expiry: <strong className="text-slate-200">{asset.expiryDate}</strong></span>
          </div>
        </div>
      </div>

      {/* Card Footer Actions */}
      <div className="pt-3 border-t border-slate-800/80 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {/* WhatsApp Share Button */}
          <a
            href={whatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="py-2 px-2.5 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            title="Share Asset & Warranty details on WhatsApp"
          >
            <MessageCircle className="w-3.5 h-3.5 text-teal-400" />
            <span>Share WhatsApp</span>
          </a>

          {/* Service Hotline Call Button */}
          <a
            href={`tel:${hotline.phone}`}
            className="py-2 px-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer truncate"
            title={`Call Brand Support Hotline (${hotline.label})`}
          >
            <Phone className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="truncate">Service Hotline</span>
          </a>
        </div>

        <div className="grid grid-cols-12 gap-2">
          {/* Claim Helper & Support Hub Button */}
          <button
            onClick={() => onClaim(asset)}
            className="col-span-8 py-2 px-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer truncate"
          >
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Support & Claim</span>
          </button>

          {/* Details View Button */}
          <button
            onClick={() => onSelect(asset)}
            className="col-span-2 p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center"
            title="View Certificate & History"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Delete Button */}
          <button
            onClick={() => onDelete(asset.id)}
            className="col-span-2 p-2 rounded-xl bg-slate-950 hover:bg-rose-950/60 text-slate-500 hover:text-rose-400 border border-slate-800 hover:border-rose-900 transition-all cursor-pointer flex items-center justify-center"
            title="Delete Asset"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

    </div>
  );
};
