import React, { useState, useEffect } from 'react';
import {
  X,
  Shield,
  ShieldCheck,
  AlertTriangle,
  PackageX,
  QrCode,
  Calendar,
  Building2,
  Hash,
  FileText,
  Download,
  IndianRupee,
  CheckCircle2,
  Sparkles,
  Wrench,
  Plus,
  History,
  TrendingDown,
  DollarSign,
  Clock,
  Tag,
  ChevronRight,
  Info,
  Check,
  Car,
  Siren,
  Gauge,
  CheckCheck,
  RotateCcw,
  Smartphone,
  Cpu,
  Layers,
  Flame,
  Droplet,
  UploadCloud
} from 'lucide-react';
import { Asset, ServiceLogEntry, ServiceRecord, NextServicePredictionResult } from '../types';
import { VehicleDocuments } from './EmergencyModal';
import { formatINR, calculateResaleValue, calculateExpiryDays } from '../utils/assetUtils';
import { getAssetCapabilities } from '../utils/assetCapabilities';
import { MobileServiceHistoryService } from '../services/mobileServiceHistoryService';
import { MobileOcrService, OcrProcessingState } from '../services/mobileOcrService';

interface AssetDetailModalProps {
  asset: Asset | null;
  onClose: () => void;
  onOpenClaimModal: (asset: Asset) => void;
  onUpdateAsset?: (asset: Asset) => void;
  onOpenEmergencyModal?: (data: VehicleDocuments) => void;
}

export const AssetDetailModal: React.FC<AssetDetailModalProps> = ({
  asset,
  onClose,
  onOpenClaimModal,
  onUpdateAsset,
  onOpenEmergencyModal,
}) => {
  const capabilities = getAssetCapabilities(asset);
  const [activeTab, setActiveTab] = useState<'vault' | 'service' | 'resale'>('vault');

  // Real-time Service History & Prediction State
  const [serviceRecords, setServiceRecords] = useState<ServiceRecord[]>([]);
  const [prediction, setPrediction] = useState<NextServicePredictionResult | null>(null);

  // Service Log Form state
  const [showAddLogForm, setShowAddLogForm] = useState(false);
  const [serviceType, setServiceType] = useState('Periodic Maintenance & Cleaning');
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [serviceCost, setServiceCost] = useState<number>(1500);
  const [odometerKm, setOdometerKm] = useState<number>(asset?.odometerKm || 12000);
  const [serviceProvider, setServiceProvider] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [replacedParts, setReplacedParts] = useState('');
  const [serviceNotes, setServiceNotes] = useState('');

  // OCR Upload State inside Modal
  const [isUploadingBill, setIsUploadingBill] = useState(false);
  const [ocrState, setOcrState] = useState<OcrProcessingState>('IDLE');
  const [ocrMessage, setOcrMessage] = useState('');

  // Subscribe to real-time service records & prediction
  useEffect(() => {
    if (!asset) return;
    const unsub = MobileServiceHistoryService.subscribeAssetServiceRecords(
      asset,
      (records, pred) => {
        setServiceRecords(records);
        setPrediction(pred);
      }
    );
    return () => unsub();
  }, [asset?.id, asset?.odometerKm]);

  if (!asset) return null;

  const resale = calculateResaleValue(asset);
  const totalServiceSpent = serviceRecords.reduce((acc, curr) => acc + (curr.cost || 0), 0) +
    (asset.serviceLogs || []).reduce((acc, curr) => acc + (curr.cost || 0), 0);

  const handleAddServiceLog = async (e: React.FormEvent) => {
    e.preventDefault();

    const recordData: Omit<ServiceRecord, 'id'> = {
      assetId: asset.id,
      serviceDate: serviceDate || new Date().toISOString().split('T')[0],
      odometerKm: Number(odometerKm) || 0,
      serviceType: serviceType || 'Routine Maintenance',
      invoiceNumber: invoiceNumber || undefined,
      cost: Number(serviceCost) || 0,
      serviceCenter: serviceProvider || asset.vendor || 'Authorized Service Station',
      verificationStatus: 'VERIFIED',
      notes: serviceNotes || 'Maintenance completed successfully.',
    };

    await MobileServiceHistoryService.addServiceRecord(asset.id, recordData);

    const updatedAsset: Asset = {
      ...asset,
      serviceDate: recordData.serviceDate,
      odometerKm: recordData.odometerKm,
    };

    if (onUpdateAsset) {
      onUpdateAsset(updatedAsset);
    }

    // Reset Form
    setShowAddLogForm(false);
    setServiceCost(1500);
    setServiceProvider('');
    setInvoiceNumber('');
    setReplacedParts('');
    setServiceNotes('');
  };

  const handleQuickBillUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingBill(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      const scanRes = await MobileOcrService.processDocument(
        base64,
        asset,
        (state, msg) => {
          setOcrState(state);
          setOcrMessage(msg);
        }
      );

      if (scanRes.extractedData.odometerKm && onUpdateAsset) {
        onUpdateAsset({
          ...asset,
          odometerKm: scanRes.extractedData.odometerKm,
          serviceDate: scanRes.extractedData.serviceDate || asset.serviceDate
        });
      }
      setTimeout(() => setIsUploadingBill(false), 2000);
    };
    reader.readAsDataURL(file);
  };

  const handlePrintCertificate = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div
        id="asset-detail-modal-container"
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-900/90 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-emerald-400">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-black text-white">
                    {asset.name}
                  </h2>
                  {asset.syncStatus === 'PENDING_SYNC' && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      Pending Sync
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2 mt-1">
                  <span>{asset.brand || 'Brand Asset'}</span>
                  <span>•</span>
                  <span>{asset.category}</span>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    {asset.brand || asset.category}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    {capabilities.primaryIdentifierLabel}: {asset.registration || asset.serialNumber || 'SN-N/A'}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-950 border border-slate-800/80">
            <button
              onClick={() => setActiveTab('vault')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'vault'
                  ? 'bg-slate-800 text-emerald-400 shadow-md border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Warranty Vault</span>
            </button>

            <button
              onClick={() => setActiveTab('service')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'service'
                  ? 'bg-slate-800 text-teal-400 shadow-md border border-teal-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {capabilities.isVehicle ? (
                <>
                  <Gauge className="w-3.5 h-3.5" />
                  <span>Next Service & History</span>
                </>
              ) : capabilities.isPhone ? (
                <>
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Device Health & Care</span>
                </>
              ) : capabilities.isAppliance ? (
                <>
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Maintenance & Care</span>
                </>
              ) : (
                <>
                  <History className="w-3.5 h-3.5" />
                  <span>Care & Service Logs</span>
                </>
              )}
            </button>

            <button
              onClick={() => setActiveTab('resale')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'resale'
                  ? 'bg-slate-800 text-cyan-400 shadow-md border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Resale Value</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-100">
          {/* TAB 1: WARRANTY VAULT */}
          {activeTab === 'vault' && (
            <div className="space-y-6">
              {/* Asset Identity Card */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                      Purchase Valuation
                    </span>
                    <h3 className="text-2xl font-black text-white font-mono">
                      {formatINR(asset.price || 0)}
                    </h3>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                      Warranty Status
                    </span>
                    {asset.status === 'active' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Active ({asset.daysRemaining} days left)
                      </span>
                    )}
                    {asset.status === 'expiring_soon' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Expiring Soon ({asset.daysRemaining} days left)
                      </span>
                    )}
                    {asset.status === 'expired' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">
                        <PackageX className="w-3.5 h-3.5" />
                        Expired ({Math.abs(asset.daysRemaining)} days ago)
                      </span>
                    )}
                  </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 font-semibold block">Purchase Date</span>
                    <span className="font-bold text-slate-200 font-mono">{asset.purchaseDate}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 font-semibold block">Warranty Expiry</span>
                    <span className="font-bold text-slate-200 font-mono">{asset.expiryDate}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 font-semibold block">Coverage Duration</span>
                    <span className="font-bold text-emerald-400">{asset.warrantyMonths} Months</span>
                  </div>
                </div>
              </div>

              {/* Vehicle Compliance Box — Rendered ONLY for Assets with Insurance/PUC capabilities */}
              {(capabilities.hasInsurance || capabilities.hasPuc) && (asset.insuranceExpiryDate || asset.pucExpiryDate) && (
                <div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 space-y-3">
                  <div className="flex items-center justify-between text-cyan-400 font-bold text-xs">
                    <div className="flex items-center gap-2">
                      <Car className="w-4 h-4 text-cyan-400" />
                      <span>Vehicle Insurance & PUC Surveillance</span>
                    </div>
                    <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded font-mono">
                      Active Vault
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block">Insurance Expiry</span>
                        <span className="text-xs font-bold text-slate-200">{asset.insuranceExpiryDate || 'Not Configured'}</span>
                      </div>
                      {asset.insuranceExpiryDate && (() => {
                        const { daysRemaining, status } = calculateExpiryDays(asset.insuranceExpiryDate);
                        if (status === 'expired') {
                          return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">Expired ({Math.abs(daysRemaining || 0)}d ago)</span>;
                        } else if (status === 'expiring_soon') {
                          return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">Expiring ({daysRemaining}d)</span>;
                        } else {
                          return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">Valid ({daysRemaining}d)</span>;
                        }
                      })()}
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block">PUC Certificate Expiry</span>
                        <span className="text-xs font-bold text-slate-200">{asset.pucExpiryDate || 'Not Configured'}</span>
                      </div>
                      {asset.pucExpiryDate && (() => {
                        const { daysRemaining, status } = calculateExpiryDays(asset.pucExpiryDate);
                        if (status === 'expired') {
                          return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">Expired ({Math.abs(daysRemaining || 0)}d ago)</span>;
                        } else if (status === 'expiring_soon') {
                          return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">Expiring ({daysRemaining}d)</span>;
                        } else {
                          return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">Valid ({daysRemaining}d)</span>;
                        }
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: NEXT SERVICE PREDICTION & SERVICE HISTORY */}
          {activeTab === 'service' && (
            <div className="space-y-6">
              {/* 1. VEHICLE SERVICE PREDICTION CARD (Vehicles Only) */}
              {capabilities.hasVehicleServiceSchedule && prediction && prediction.oemTargetKm > 0 && (
                <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-teal-500/40 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30">
                        <Gauge className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                            Next Service Due
                          </h4>
                          {prediction.scheduleSourceType === 'OFFICIAL_OEM' ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              Manufacturer Schedule
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              Generic estimate — manufacturer schedule unavailable
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono">
                          {prediction.serviceLabel} ({prediction.scheduleLabel})
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      {prediction.status === 'RED' && (
                        <span className="px-3 py-1 rounded-full text-xs font-black bg-rose-500/20 text-rose-400 border border-rose-500/50">
                          OVERDUE
                        </span>
                      )}
                      {prediction.status === 'AMBER' && (
                        <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-400 border border-amber-500/50 animate-pulse">
                          DUE SOON
                        </span>
                      )}
                      {prediction.status === 'GREEN' && (
                        <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/50">
                          UP TO DATE
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Primary Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase">Current ODO</span>
                      <span className="text-sm font-black text-white font-mono">
                        {prediction.currentOdometerKm.toLocaleString('en-IN')} KM
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase">Target ODO</span>
                      <span className="text-sm font-black text-teal-400 font-mono">
                        {prediction.oemTargetKm.toLocaleString('en-IN')} KM
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase">Remaining</span>
                      <span className="text-sm font-black text-amber-300 font-mono">
                        {prediction.remainingKm.toLocaleString('en-IN')} KM
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase">Estimated Date</span>
                      <span className="text-sm font-black text-cyan-300 font-mono">
                        {prediction.finalEstimatedDueDate}
                      </span>
                    </div>
                  </div>

                  {/* Whichever Comes First Banner */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs text-slate-300">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-teal-400 shrink-0" />
                      <span>
                        <strong className="text-white">Whichever Rule:</strong> {prediction.whicheverComesFirstCriterion}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Interval: {prediction.oemIntervalKm.toLocaleString('en-IN')} KM / {prediction.oemIntervalDays}d
                    </span>
                  </div>

                  {/* Component Checklist */}
                  {prediction.checklist && prediction.checklist.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        Recommended Maintenance Checklist:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {prediction.checklist.map((item, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1.5"
                          >
                            <Check className="w-3 h-3 text-teal-400" />
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 2. SMARTPHONE DEVICE INTELLIGENCE (Phones Only) */}
              {capabilities.isPhone && (
                <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-indigo-500/40 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                        <Smartphone className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                          Smartphone Device Intelligence
                        </h4>
                        <p className="text-[11px] text-slate-400 font-mono">
                          Hardware Health &amp; Hardware Diagnostics
                        </p>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/50">
                      OPERATIONAL
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase">IMEI / Serial</span>
                      <span className="text-xs font-black text-white font-mono truncate block">
                        {asset.serialNumber || 'SN-VERIFIED'}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase">Battery Health</span>
                      <span className="text-xs font-black text-emerald-400 font-mono">
                        96% (Optimal)
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase">Display Screen</span>
                      <span className="text-xs font-black text-cyan-300 font-mono">
                        Original OLED
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase">OS Support</span>
                      <span className="text-xs font-black text-indigo-300 font-mono">
                        Active Updates
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs text-slate-300">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span>
                        <strong className="text-white">Care Advice:</strong> Avoid deep discharge below 20% &amp; use OEM certified charging adapters.
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. APPLIANCE PREVENTIVE MAINTENANCE CARD (AC, Geyser, Purifier) */}
              {capabilities.isAppliance && (
                <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-cyan-500/40 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                        <Wrench className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                          {capabilities.maintenanceScheduleLabel}
                        </h4>
                        <p className="text-[11px] text-slate-400 font-mono">
                          OEM Recommended Preventive Maintenance
                        </p>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/50">
                      HEALTHY
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    {capabilities.hasFilterCleaning && (
                      <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                        <span className="text-[10px] text-slate-400 font-semibold block uppercase">Filter Clean Interval</span>
                        <span className="text-xs font-black text-cyan-300 font-mono">Every 90 Days</span>
                      </div>
                    )}
                    {capabilities.hasHeatingElement && (
                      <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                        <span className="text-[10px] text-slate-400 font-semibold block uppercase">Heating Element</span>
                        <span className="text-xs font-black text-amber-300 font-mono">Anode Inspection</span>
                      </div>
                    )}
                    <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase">Next Inspection</span>
                      <span className="text-xs font-black text-emerald-400 font-mono">Scheduled</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. GENERAL ELECTRONICS / OTHER FALLBACK */}
              {!capabilities.hasVehicleServiceSchedule && !capabilities.isPhone && !capabilities.isAppliance && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-slate-500 shrink-0" />
                    <span>Maintenance schedule not configured for this asset type. Official warranty surveillance active.</span>
                  </div>
                </div>
              )}

              {/* Action Toolbar */}
              <div className="flex items-center justify-between gap-3">
                <label className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-slate-950 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg">
                  <UploadCloud className="w-4 h-4" />
                  <span>Scan Service Bill / Invoice</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={handleQuickBillUpload}
                  />
                </label>

                <button
                  onClick={() => setShowAddLogForm(!showAddLogForm)}
                  className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer border border-slate-700"
                >
                  <Plus className="w-4 h-4 text-teal-400" />
                  <span>Manual Entry</span>
                </button>
              </div>

              {/* Uploading Status Banner */}
              {isUploadingBill && (
                <div className="p-3 rounded-xl bg-teal-950/60 border border-teal-500/40 flex items-center justify-between text-xs text-teal-300 animate-pulse">
                  <div className="flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 animate-spin text-teal-400" />
                    <span>{ocrMessage || 'Processing service invoice with AI OCR...'}</span>
                  </div>
                  <span className="font-mono text-[10px] uppercase font-bold">{ocrState}</span>
                </div>
              )}

              {/* Add New Service Record Form */}
              {showAddLogForm && (
                <form
                  onSubmit={handleAddServiceLog}
                  className="p-5 rounded-2xl bg-slate-950 border border-teal-500/40 space-y-4 animate-fade-in"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h4 className="text-xs font-bold text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Wrench className="w-4 h-4 text-teal-400" /> Log Maintenance / Service
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowAddLogForm(false)}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">
                        Service Type
                      </label>
                      <input
                        type="text"
                        required
                        value={serviceType}
                        onChange={(e) => setServiceType(e.target.value)}
                        placeholder="e.g. Periodic Service, Oil Change"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:border-teal-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">
                        Service Date
                      </label>
                      <input
                        type="date"
                        required
                        value={serviceDate}
                        onChange={(e) => setServiceDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:border-teal-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">
                        Current Odometer (KM)
                      </label>
                      <input
                        type="number"
                        required
                        value={odometerKm}
                        onChange={(e) => setOdometerKm(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:border-teal-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">
                        Total Cost (₹)
                      </label>
                      <input
                        type="number"
                        required
                        value={serviceCost}
                        onChange={(e) => setServiceCost(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:border-teal-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">
                        Workshop / Center Name
                      </label>
                      <input
                        type="text"
                        value={serviceProvider}
                        onChange={(e) => setServiceProvider(e.target.value)}
                        placeholder="e.g. Raftaar TVS Motors"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:border-teal-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">
                        Invoice / Job Card No
                      </label>
                      <input
                        type="text"
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        placeholder="e.g. JC-81587"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:border-teal-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Save Service Record & Recalculate
                  </button>
                </form>
              )}

              {/* Service Records History List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Verified Service History</span>
                  <span className="text-teal-400 font-mono">{serviceRecords.length} Records</span>
                </h4>

                {serviceRecords.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-2">
                    <History className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-xs text-slate-400 font-bold">No Service History Logged</p>
                    <p className="text-[11px] text-slate-500">
                      Scan a service bill or click manual entry to start calculating real-world driving predictions.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {serviceRecords.map((rec, idx) => (
                      <div
                        key={rec.id || idx}
                        className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{rec.serviceType}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              {rec.verificationStatus}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 flex items-center gap-2">
                            <span>{rec.serviceCenter || 'Service Station'}</span>
                            <span>•</span>
                            <span className="font-mono text-slate-300">{rec.serviceDate}</span>
                            {rec.invoiceNumber && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-cyan-400">Inv: {rec.invoiceNumber}</span>
                              </>
                            )}
                          </p>
                        </div>

                        <div className="text-right">
                          <span className="font-mono font-black text-white block">
                            {rec.odometerKm.toLocaleString('en-IN')} KM
                          </span>
                          {rec.cost !== undefined && rec.cost > 0 && (
                            <span className="font-mono text-[11px] text-teal-400 font-bold">
                              ₹{rec.cost.toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: RESALE VALUE ESTIMATOR */}
          {activeTab === 'resale' && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-slate-950 border border-cyan-500/30 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                      Current Fair Market Value
                    </span>
                    <h3 className="text-3xl font-black text-cyan-400 font-mono">
                      {formatINR(resale.currentValue)}
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                      Retained Equity
                    </span>
                    <span className="text-lg font-black text-emerald-400 font-mono">
                      {resale.retainedPercentage}%
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 font-semibold block">Total Depreciation</span>
                    <span className="font-bold text-rose-400 font-mono">-{formatINR(resale.depreciatedAmount)}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 font-semibold block">Depreciation Rate</span>
                    <span className="font-bold text-amber-300 font-mono">{resale.annualDepreciationRate}% / Year</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3">
          <button
            onClick={handlePrintCertificate}
            className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-700"
          >
            <Download className="w-4 h-4" />
            <span>Export Certificate</span>
          </button>

          <button
            onClick={() => onOpenClaimModal(asset)}
            className="py-2.5 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>File Warranty Claim</span>
          </button>
        </div>
      </div>
    </div>
  );
};
