import React, { useState, useMemo } from 'react';
import {
  X,
  Bell,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Phone,
  FileText,
  ExternalLink,
  ChevronRight,
  CheckCircle2,
  RefreshCw,
  Wrench,
  Sparkles,
  PackageX,
  Building2,
  Calendar,
  Car,
  ShieldCheck,
} from 'lucide-react';
import { Asset } from '../types';
import { formatINR, getBrandServiceHotline, calculateExpiryDays } from '../utils/assetUtils';

interface WarrantyAlertsModalProps {
  isOpen: boolean;
  assets: Asset[];
  onClose: () => void;
  onSelectAsset: (asset: Asset) => void;
  onClaimAsset: (asset: Asset) => void;
  onOpenEmergencyModal: () => void;
  onRenewWarrantyToast?: (assetName: string) => void;
}

export interface ModalAlertItem {
  id: string;
  asset: Asset;
  alertType: 'Warranty' | 'Vehicle Insurance' | 'Vehicle PUC';
  expiryDate: string;
  daysRemaining: number;
  isUrgent7Days: boolean;
  isExpired: boolean;
}

export const WarrantyAlertsModal: React.FC<WarrantyAlertsModalProps> = ({
  isOpen,
  assets,
  onClose,
  onSelectAsset,
  onClaimAsset,
  onOpenEmergencyModal,
  onRenewWarrantyToast,
}) => {
  const [activeTab, setActiveTab] = useState<'EXPIRING_7_DAYS' | 'EXPIRED' | 'ALL_ALERTS'>('EXPIRING_7_DAYS');

  // Unified calculation of Warranty, Insurance & PUC Alerts
  const { expiring7Days, expiredItems, allAlertItems } = useMemo(() => {
    const list7Days: ModalAlertItem[] = [];
    const listExpired: ModalAlertItem[] = [];
    const listAll: ModalAlertItem[] = [];

    assets.forEach((asset) => {
      // 1. Warranty Alert
      const wDays = asset.daysRemaining;
      const wUrgent = wDays > 0 && wDays <= 7;
      const wExpired = wDays <= 0;

      const warrItem: ModalAlertItem = {
        id: `mod-warr-${asset.id}`,
        asset,
        alertType: 'Warranty',
        expiryDate: asset.expiryDate,
        daysRemaining: wDays,
        isUrgent7Days: wUrgent,
        isExpired: wExpired,
      };

      if (wUrgent) list7Days.push(warrItem);
      if (wExpired) listExpired.push(warrItem);
      if (wDays <= 30 || wExpired) listAll.push(warrItem);

      // 2. Vehicle Insurance Alert
      if (asset.insuranceExpiryDate) {
        const { daysRemaining: insDays } = calculateExpiryDays(asset.insuranceExpiryDate);
        if (insDays !== null) {
          const insUrgent = insDays > 0 && insDays <= 7;
          const insExpired = insDays <= 0;

          const insItem: ModalAlertItem = {
            id: `mod-ins-${asset.id}`,
            asset,
            alertType: 'Vehicle Insurance',
            expiryDate: asset.insuranceExpiryDate,
            daysRemaining: insDays,
            isUrgent7Days: insUrgent,
            isExpired: insExpired,
          };

          if (insUrgent) list7Days.push(insItem);
          if (insExpired) listExpired.push(insItem);
          if (insDays <= 30 || insExpired) listAll.push(insItem);
        }
      }

      // 3. Vehicle PUC Alert
      if (asset.pucExpiryDate) {
        const { daysRemaining: pucDays } = calculateExpiryDays(asset.pucExpiryDate);
        if (pucDays !== null) {
          const pucUrgent = pucDays > 0 && pucDays <= 7;
          const pucExpired = pucDays <= 0;

          const pucItem: ModalAlertItem = {
            id: `mod-puc-${asset.id}`,
            asset,
            alertType: 'Vehicle PUC',
            expiryDate: asset.pucExpiryDate,
            daysRemaining: pucDays,
            isUrgent7Days: pucUrgent,
            isExpired: pucExpired,
          };

          if (pucUrgent) list7Days.push(pucItem);
          if (pucExpired) listExpired.push(pucItem);
          if (pucDays <= 30 || pucExpired) listAll.push(pucItem);
        }
      }
    });

    return {
      expiring7Days: list7Days,
      expiredItems: listExpired,
      allAlertItems: listAll,
    };
  }, [assets]);

  if (!isOpen) return null;

  const displayedAlertItems =
    activeTab === 'EXPIRING_7_DAYS'
      ? expiring7Days
      : activeTab === 'EXPIRED'
      ? expiredItems
      : allAlertItems;

  const handleRenewClick = (item: ModalAlertItem) => {
    if (onRenewWarrantyToast) {
      onRenewWarrantyToast(`Initiated renewal request for ${item.asset.name} (${item.alertType})`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div
        id="warranty-alerts-modal-container"
        className="relative w-full max-w-2xl bg-slate-900 border border-amber-500/40 rounded-3xl shadow-2xl shadow-amber-500/10 overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400">
              <Bell className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  Warranty & Document Expiry Alerts
                </h2>
                {expiring7Days.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold animate-pulse">
                    {expiring7Days.length} Action Needed
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Monitor warranties, vehicle insurance, and PUC certificates nearing expiration
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs Bar */}
        <div className="flex border-b border-slate-800 bg-slate-950 px-4 pt-2 gap-2 text-xs font-bold">
          <button
            onClick={() => setActiveTab('EXPIRING_7_DAYS')}
            id="tab-expiring-7-days"
            className={`py-2.5 px-3 rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 border-b-2 ${
              activeTab === 'EXPIRING_7_DAYS'
                ? 'text-amber-400 border-amber-400 bg-slate-900'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Expiring in 7 Days ({expiring7Days.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('EXPIRED')}
            id="tab-expired"
            className={`py-2.5 px-3 rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 border-b-2 ${
              activeTab === 'EXPIRED'
                ? 'text-rose-400 border-rose-400 bg-slate-900'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <PackageX className="w-3.5 h-3.5" />
            <span>Expired ({expiredItems.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('ALL_ALERTS')}
            id="tab-all-alerts"
            className={`py-2.5 px-3 rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 border-b-2 ${
              activeTab === 'ALL_ALERTS'
                ? 'text-teal-400 border-teal-400 bg-slate-900'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>All Alerts ({allAlertItems.length})</span>
          </button>
        </div>

        {/* List of Notification Items */}
        <div className="p-5 overflow-y-auto space-y-3.5 flex-1">
          {displayedAlertItems.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">No Pending Expiry Alerts</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {activeTab === 'EXPIRING_7_DAYS'
                  ? 'Great news! You have no warranties, vehicle insurance, or PUC certificates expiring within the next 7 days.'
                  : 'All document coverage in this category is fully up to date.'}
              </p>
            </div>
          ) : (
            displayedAlertItems.map((item) => {
              const { asset, alertType, expiryDate, daysRemaining, isUrgent7Days, isExpired } = item;
              const hotline = getBrandServiceHotline(asset.brand, asset.category, asset.name);

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl bg-slate-950 border ${
                    isUrgent7Days
                      ? 'border-amber-500/50 shadow-md shadow-amber-500/5'
                      : isExpired
                      ? 'border-rose-500/30'
                      : 'border-slate-800'
                  } transition-all space-y-3`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                          {asset.brand || asset.category}
                        </span>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                          {alertType === 'Warranty' ? <ShieldCheck className="w-3 h-3 text-emerald-400" /> : <Car className="w-3 h-3 text-cyan-400" />}
                          {alertType}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          Value: {formatINR(asset.price)}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                        {asset.name}
                      </h4>

                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          Expiry Date: <strong className="text-slate-200">{expiryDate}</strong>
                        </span>
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-500" />
                          {asset.vendor || 'Authorized Store'}
                        </span>
                      </div>
                    </div>

                    {/* Expiry Badge */}
                    <div className="shrink-0 text-right">
                      {isExpired ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                          <PackageX className="w-3.5 h-3.5" />
                          Expired ({Math.abs(daysRemaining)}d ago)
                        </span>
                      ) : isUrgent7Days ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {daysRemaining === 0
                            ? 'Expires Today!'
                            : `Expires in ${daysRemaining} days`}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-teal-500/10 text-teal-300 border border-teal-500/30">
                          <Clock className="w-3.5 h-3.5" />
                          In {daysRemaining} days
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="pt-2 border-t border-slate-900 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Renew Coverage Button */}
                      <button
                        onClick={() => handleRenewClick(item)}
                        className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-amber-500/20"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Renew {alertType}</span>
                      </button>

                      {/* Contact Support Hotline */}
                      <a
                        href={`tel:${hotline.phone}`}
                        className="px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Phone className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Contact Support</span>
                      </a>

                      {/* File Claim Button */}
                      <button
                        onClick={() => {
                          onClose();
                          onClaimAsset(asset);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-emerald-400" />
                        <span>File Claim</span>
                      </button>
                    </div>

                    {/* View Details */}
                    <button
                      onClick={() => {
                        onClose();
                        onSelectAsset(asset);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>Details</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer Banner */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>AssetDoctor Auto-Sync monitors warranty & vehicle compliance 24/7.</span>
          </div>

          <button
            onClick={() => {
              onClose();
              onOpenEmergencyModal();
            }}
            className="text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1 cursor-pointer"
          >
            <Wrench className="w-3.5 h-3.5" /> Emergency Support &rarr;
          </button>
        </div>
      </div>
    </div>
  );
};
