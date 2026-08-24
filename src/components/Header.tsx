import React from 'react';
import { Shield, Plus, ScanText, Sparkles, Download, Bell, PhoneCall, User, CheckCircle2, Smartphone, Mail, KeyRound, Settings, MapPin } from 'lucide-react';
import { AssetDoctorLogo } from './AssetDoctorLogo';
import { formatINR } from '../utils/assetUtils';

interface HeaderProps {
  totalValuation: number;
  totalAssetsCount: number;
  expiringSoonCount: number;
  userPhone?: string;
  userEmail?: string;
  userLocation?: string;
  onOpenOCR: () => void;
  onOpenAddModal: () => void;
  onOpenEmergencyModal: () => void;
  onOpenUpdatePhoneModal?: () => void;
  onOpenUpdateEmailModal?: () => void;
  onOpenLoginModal?: () => void;
  onOpenAccountSettingsModal?: () => void;
  onOpenWarrantyAlertsModal?: () => void;
  onOpenSplashScreen?: () => void;
  onExportVault: () => void;
  onScrollToAlerts: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  totalValuation,
  totalAssetsCount,
  expiringSoonCount,
  userPhone = '+91 98765 43210',
  userEmail = 'manish2768@gmail.com',
  userLocation = 'Mumbai, Maharashtra',
  onOpenOCR,
  onOpenAddModal,
  onOpenEmergencyModal,
  onOpenUpdatePhoneModal,
  onOpenUpdateEmailModal,
  onOpenLoginModal,
  onOpenAccountSettingsModal,
  onOpenWarrantyAlertsModal,
  onOpenSplashScreen,
  onExportVault,
  onScrollToAlerts,
}) => {
  const currentDateFormatted = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#030a16]/95 border-b border-emerald-500/20 px-4 lg:px-8 py-3.5 transition-all shadow-xl shadow-slate-950/50">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3.5">
        
        {/* Brand & User Welcome Profile Header */}
        <div className="flex items-center justify-between md:justify-start gap-4">
          
          {/* Logo & Brand Name */}
          <div className="flex items-center gap-3">
            <AssetDoctorLogo
              size="md"
              onClick={onOpenSplashScreen}
            />

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white font-sans flex items-center gap-1.5">
                  Asset<span className="text-emerald-400">Doctor</span>
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  ServiVault V2.4
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium flex items-center gap-1.5 mt-0.5">
                <span>Smart Care & Warranty Vault</span>
                <span className="hidden sm:inline text-slate-600">•</span>
                <span className="hidden sm:inline text-emerald-400 font-mono font-bold">
                  Valuation: {formatINR(totalValuation)}
                </span>
              </p>
            </div>
          </div>

          {/* User Welcome Profile Widget & Sync Pill */}
          <div className="flex items-center gap-3">
            <div
              onClick={onOpenAccountSettingsModal}
              className="hidden lg:flex items-center gap-2.5 pl-4 border-l border-emerald-900/40 cursor-pointer hover:opacity-90 transition-all group"
              title="Open Account Settings & Change Password"
            >
              <div className="relative">
                <div className="w-9 h-9 rounded-xl bg-[#081426] border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:border-emerald-400 transition-all shadow-md">
                  <User className="w-5 h-5" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-[#030a16] rounded-full"></span>
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1 group-hover:text-emerald-300 transition-colors">
                  <span>Welcome, User</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 flex-wrap">
                  <span>{userPhone}</span>
                  <span>•</span>
                  <span className="flex items-center gap-0.5 text-emerald-400 font-semibold">
                    <MapPin className="w-2.5 h-2.5" />
                    <span className="truncate max-w-[110px]">{userLocation}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Offline / Online Sync Indicator */}
            <div
              onClick={onOpenAccountSettingsModal}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-[10px] font-mono cursor-pointer hover:border-emerald-500/40"
              title="Click to view offline storage & sync queue"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-slate-300 font-bold">Cloud Synced</span>
            </div>
          </div>

          {/* Mobile Valuation Badge */}
          <div className="sm:hidden text-right">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Value</span>
            <span className="text-xs font-bold font-mono text-emerald-400">{formatINR(totalValuation)}</span>
          </div>

        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-2">
          
          {/* Sign In / Forgot Password Button */}
          {onOpenLoginModal && (
            <button
              onClick={onOpenLoginModal}
              id="header-login-forgot-pwd-btn"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all cursor-pointer"
              title="Sign In or Forgot Password Recovery"
            >
              <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
              <span>Forgot Password / Sign In</span>
            </button>
          )}

          {/* Account Settings Button */}
          {onOpenAccountSettingsModal && (
            <button
              onClick={onOpenAccountSettingsModal}
              id="header-account-settings-btn"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all cursor-pointer"
              title="Account Settings & Change Password"
            >
              <Settings className="w-3.5 h-3.5 text-emerald-400" />
              <span>Account Settings</span>
            </button>
          )}
          
          {/* Update Phone Action Button */}
          {onOpenUpdatePhoneModal && (
            <button
              onClick={onOpenUpdatePhoneModal}
              id="header-update-phone-btn"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-bold transition-all cursor-pointer"
              title="Update Registered Mobile Phone via OTP"
            >
              <Smartphone className="w-3.5 h-3.5 text-teal-400" />
              <span>Update Phone</span>
            </button>
          )}

          {/* Update Email Action Button */}
          {onOpenUpdateEmailModal && (
            <button
              onClick={onOpenUpdateEmailModal}
              id="header-update-email-btn"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition-all cursor-pointer"
              title="Update Auth Email via Verification Link"
            >
              <Mail className="w-3.5 h-3.5 text-cyan-400" />
              <span>Update Email</span>
            </button>
          )}

          {/* Emergency Mechanic Help Quick Action */}
          <button
            onClick={onOpenEmergencyModal}
            id="header-emergency-help-btn"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all cursor-pointer shadow-md shadow-rose-500/10 active:scale-95"
            title="Emergency Service & Mechanic Contact Hotline"
          >
            <PhoneCall className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
            <span>Emergency Help</span>
          </button>

          {/* Notification Bell Icon & Warranty Expiry Alert Counter */}
          <button
            onClick={onOpenWarrantyAlertsModal || onScrollToAlerts}
            id="header-notification-bell-btn"
            className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all cursor-pointer font-bold text-xs ${
              expiringSoonCount > 0
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 hover:bg-amber-500/25 shadow-md shadow-amber-500/10'
                : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
            }`}
            title="Open 7-Day Warranty Alerts & Notifications"
          >
            <div className="relative">
              <Bell className={`w-4 h-4 ${expiringSoonCount > 0 ? 'text-amber-400 animate-bounce' : 'text-slate-400'}`} />
              {expiringSoonCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
              )}
            </div>
            <span>{expiringSoonCount > 0 ? `${expiringSoonCount} Alerts` : 'Alerts'}</span>
            {expiringSoonCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 text-[10px] rounded-full bg-amber-500 text-slate-950 font-black">
                {expiringSoonCount}
              </span>
            )}
          </button>

          <button
            onClick={onOpenOCR}
            id="header-ocr-scan-btn"
            className="group relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-indigo-500 text-slate-950 font-bold text-xs shadow-lg shadow-teal-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer overflow-hidden"
          >
            <ScanText className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden xs:inline">Scan Document / Invoice</span>
            <span className="xs:hidden">Scan Invoice</span>
            <Sparkles className="w-3 h-3 text-slate-950" />
          </button>

          <button
            onClick={onOpenAddModal}
            id="header-add-asset-btn"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition-all cursor-pointer hover:border-slate-600"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Add Asset</span>
          </button>

          <button
            onClick={onExportVault}
            id="header-export-vault-btn"
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-xs transition-all cursor-pointer"
            title="Export Vault Backup JSON"
          >
            <Download className="w-4 h-4" />
          </button>

        </div>

      </div>
    </header>
  );
};

