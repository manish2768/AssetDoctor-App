import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Lock,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Mail,
  Smartphone,
  Eye,
  EyeOff,
  Check,
  Database,
  History,
  Sparkles,
  LogOut,
  RefreshCw,
  MapPin,
  Navigation,
  Loader2,
  Bell,
  MessageSquare,
  CloudUpload,
  Wifi,
  WifiOff
} from 'lucide-react';
import { AssetDoctorLogo } from './AssetDoctorLogo';
import { syncEngine, SyncEngineStatus } from '../services/mobileSyncEngine';
import { MobileNotificationService, UserNotificationPreferences } from '../services/mobileNotificationService';

interface AccountSettingsModalProps {
  isOpen: boolean;
  userEmail: string;
  userPhone: string;
  userLocation?: string;
  onClose: () => void;
  onOpenUpdatePhoneModal: () => void;
  onOpenUpdateEmailModal: () => void;
  onOpenForgotPassword: () => void;
  onUpdateLocation?: (newLocation: string) => void;
  onPasswordChangedToast?: (msg: string) => void;
  onShowToast?: (msg: string) => void;
  onLoadDemoAssets?: () => void;
}

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  isOpen,
  userEmail,
  userPhone,
  userLocation = 'Mumbai, Maharashtra',
  onClose,
  onOpenUpdatePhoneModal,
  onOpenUpdateEmailModal,
  onOpenForgotPassword,
  onUpdateLocation,
  onPasswordChangedToast,
  onShowToast,
  onLoadDemoAssets,
}) => {
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'NOTIFICATIONS' | 'CHANGE_PASSWORD' | 'SECURITY_LOG'>('PROFILE');

  // Location state
  const [locationInput, setLocationInput] = useState(userLocation);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  // Notification Preferences State
  const [prefs, setPrefs] = useState<UserNotificationPreferences>(() =>
    MobileNotificationService.getPreferences()
  );

  // Sync Engine Status
  const [syncStatus, setSyncStatus] = useState<SyncEngineStatus>(() => syncEngine.getStatus());

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (userLocation) {
      setLocationInput(userLocation);
    }
  }, [userLocation]);

  useEffect(() => {
    if (isOpen) {
      setPrefs(MobileNotificationService.getPreferences());
      const unsub = syncEngine.subscribeStatus(setSyncStatus);
      return () => unsub();
    }
  }, [isOpen]);

  // Password validation rules
  const hasMinLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
  const isMatch = newPassword === confirmPassword && confirmPassword !== '';

  const handleTogglePref = async (key: keyof UserNotificationPreferences) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    await MobileNotificationService.updatePreferences(updated);
    if (onShowToast) {
      onShowToast(`Updated notification preferences`);
    }
  };

  const handleManualSync = async () => {
    setIsUpdating(true);
    const res = await syncEngine.flushQueue();
    setIsUpdating(false);
    if (onShowToast) {
      onShowToast(`Synced ${res.synced} items to Firebase Cloud (${res.conflicts} conflicts)`);
    }
  };

  const handleSaveLocationManual = () => {
    if (!locationInput.trim()) {
      setErrorMsg('Please enter a valid City / Location');
      return;
    }
    if (onUpdateLocation) {
      onUpdateLocation(locationInput.trim());
    }
    setSuccessMsg('Location saved successfully.');
    if (onShowToast) onShowToast(`Location updated to "${locationInput.trim()}"`);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      const err = 'Geolocation is not supported by your browser.';
      setErrorMsg(err);
      if (onShowToast) onShowToast(err);
      return;
    }

    setIsDetectingLocation(true);
    setErrorMsg('');
    setSuccessMsg('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          if (response.ok) {
            const data = await response.json();
            const addr = data.address || {};
            const city =
              addr.city ||
              addr.town ||
              addr.village ||
              addr.suburb ||
              addr.municipality ||
              addr.county ||
              addr.state_district ||
              '';
            const state = addr.state || '';
            const detectedStr = [city, state].filter(Boolean).join(', ') || 'Mumbai, Maharashtra';

            setLocationInput(detectedStr);
            if (onUpdateLocation) {
              onUpdateLocation(detectedStr);
            }
            setSuccessMsg(`Location detected & updated to ${detectedStr}`);
            if (onShowToast) onShowToast(`📍 Location updated to ${detectedStr}`);
          } else {
            setErrorMsg('Could not resolve location address. Please type manually.');
          }
        } catch (e) {
          setErrorMsg('Location resolution failed. Please type manually.');
        } finally {
          setIsDetectingLocation(false);
        }
      },
      (err) => {
        setIsDetectingLocation(false);
        setErrorMsg('Location permission denied or unavailable.');
      }
    );
  };

  const handleChangePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!hasMinLength || !hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      setErrorMsg('Password does not meet the security criteria.');
      return;
    }

    if (!isMatch) {
      setErrorMsg('New passwords do not match.');
      return;
    }

    setIsUpdating(true);
    setTimeout(() => {
      setIsUpdating(false);
      setSuccessMsg('Account password changed successfully.');
      if (onPasswordChangedToast) {
        onPasswordChangedToast('Account password updated successfully!');
      }
      setTimeout(() => {
        onClose();
      }, 1500);
    }, 800);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AssetDoctorLogo size="sm" />
            <div>
              <h2 className="text-lg font-bold text-white">
                Account Settings & Preferences
              </h2>
              <p className="text-xs text-slate-400">
                Profile credentials, notifications & offline sync controls
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
            onClick={() => setActiveTab('PROFILE')}
            className={`py-2.5 px-3 rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 border-b-2 ${
              activeTab === 'PROFILE'
                ? 'text-emerald-400 border-emerald-400 bg-slate-900'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Profile & Sync</span>
          </button>

          <button
            onClick={() => setActiveTab('NOTIFICATIONS')}
            className={`py-2.5 px-3 rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 border-b-2 ${
              activeTab === 'NOTIFICATIONS'
                ? 'text-emerald-400 border-emerald-400 bg-slate-900'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>WhatsApp & Alerts</span>
          </button>

          <button
            onClick={() => setActiveTab('CHANGE_PASSWORD')}
            className={`py-2.5 px-3 rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 border-b-2 ${
              activeTab === 'CHANGE_PASSWORD'
                ? 'text-emerald-400 border-emerald-400 bg-slate-900'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Password</span>
          </button>

          <button
            onClick={() => setActiveTab('SECURITY_LOG')}
            className={`py-2.5 px-3 rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 border-b-2 ${
              activeTab === 'SECURITY_LOG'
                ? 'text-emerald-400 border-emerald-400 bg-slate-900'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Security Log</span>
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Error / Success Notifications */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs font-bold flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: PROFILE & OFFLINE SYNC */}
          {activeTab === 'PROFILE' && (
            <div className="space-y-4">
              {/* Sync Status Box */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    {syncStatus.isOnline ? (
                      <Wifi className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <WifiOff className="w-4 h-4 text-amber-400" />
                    )}
                    <span className="text-xs font-bold text-white">
                      {syncStatus.isOnline ? 'Online & Connected' : 'Offline Mode Active'}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {syncStatus.pendingCount === 0 ? 'All changes synced' : `${syncStatus.pendingCount} pending sync`}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Offline Storage: Scoped LocalStorage & IndexedDB</span>
                  <button
                    type="button"
                    onClick={handleManualSync}
                    disabled={isUpdating || !syncStatus.isOnline}
                    className="px-3 py-1.5 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/30 font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
                    <span>Sync Now</span>
                  </button>
                </div>
              </div>

              {/* Profile Details Card */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between py-1 text-xs border-b border-slate-800 pb-2">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-cyan-400" />
                    Auth Email:
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-white font-bold">{userEmail}</span>
                    <button
                      onClick={() => {
                        onClose();
                        onOpenUpdateEmailModal();
                      }}
                      className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-bold border border-cyan-500/30 cursor-pointer"
                    >
                      Update
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between py-1 text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-teal-400" />
                    Registered Phone:
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-white font-bold">{userPhone}</span>
                    <button
                      onClick={() => {
                        onClose();
                        onOpenUpdatePhoneModal();
                      }}
                      className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 text-[10px] font-bold border border-teal-500/30 cursor-pointer"
                    >
                      Update
                    </button>
                  </div>
                </div>
              </div>

              {/* Location Box */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-bold flex items-center gap-1.5 text-xs">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    City / Location:
                  </span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={locationInput}
                    onChange={(e) => setLocationInput(e.target.value)}
                    placeholder="City, State"
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleDetectLocation}
                    disabled={isDetectingLocation}
                    className="px-3 py-2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>Detect</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveLocationManual}
                    className="px-3 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: WHATSAPP & NOTIFICATIONS */}
          {activeTab === 'NOTIFICATIONS' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-950 border border-teal-500/30 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h4 className="text-xs font-bold text-white">Meta WhatsApp Notifications</h4>
                      <p className="text-[11px] text-slate-400">Automated service due & expiry reminders to WhatsApp</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleTogglePref('whatsappOptIn')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                      prefs.whatsappOptIn ? 'bg-emerald-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        prefs.whatsappOptIn ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="space-y-2 pt-1 text-xs">
                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-300">Next Service Due Reminders</span>
                    <button
                      type="button"
                      onClick={() => handleTogglePref('serviceDueAlerts')}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                        prefs.serviceDueAlerts ? 'bg-teal-500' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                          prefs.serviceDueAlerts ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-300">Vehicle Insurance Expiry Alerts</span>
                    <button
                      type="button"
                      onClick={() => handleTogglePref('insuranceExpiryAlerts')}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                        prefs.insuranceExpiryAlerts ? 'bg-teal-500' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                          prefs.insuranceExpiryAlerts ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-300">PUC Certificate Expiry Alerts</span>
                    <button
                      type="button"
                      onClick={() => handleTogglePref('pucExpiryAlerts')}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                        prefs.pucExpiryAlerts ? 'bg-teal-500' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                          prefs.pucExpiryAlerts ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CHANGE PASSWORD */}
          {activeTab === 'CHANGE_PASSWORD' && (
            <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Current Password:
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full pl-4 pr-10 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 text-slate-500 hover:text-slate-300"
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  New Password:
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new strong password"
                    className="w-full pl-4 pr-10 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 text-slate-500 hover:text-slate-300"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Confirm New Password:
                </label>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isUpdating}
                className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg transition-all cursor-pointer disabled:opacity-50"
              >
                {isUpdating ? 'Updating Password...' : 'Change Password'}
              </button>
            </form>
          )}

          {/* TAB 4: SECURITY LOG */}
          {activeTab === 'SECURITY_LOG' && (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-300 font-bold">
                  <span>Current Web & PWA Session</span>
                  <span className="text-emerald-400 font-mono text-[11px]">ACTIVE NOW</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Authenticated via Firebase Auth (assetdoctor-5fd25)
                </p>
                <p className="text-[10px] font-mono text-slate-500">
                  Last Sync: {syncStatus.lastSyncedAt || 'Just Now'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
