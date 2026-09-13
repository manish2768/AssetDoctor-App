import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Plus,
  Sparkles,
  Tag,
  IndianRupee,
  Calendar,
  ShieldCheck,
  Building2,
  Hash,
  FileText,
  Car,
  ShieldAlert,
  Upload,
  File as FileIcon,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Trash2,
  Eye,
  Loader2,
  Check,
} from 'lucide-react';
import { Asset, AssetCategory } from '../types';
import { calculateWarrantyStatus, formatINR } from '../utils/assetUtils';
import { isVehicleAsset } from '../domain/asset/assetGuards';
import { MobileAssetService } from '../services/mobileAssetService';

interface AddAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddAsset: (newAsset: Asset) => void;
  existingAssets?: Asset[];
  onViewExistingAsset?: (asset: Asset) => void;
}

interface ExtractedFieldConfidence {
  name?: 'high' | 'medium' | 'low';
  brand?: 'high' | 'medium' | 'low';
  price?: 'high' | 'medium' | 'low';
  purchaseDate?: 'high' | 'medium' | 'low';
  warrantyMonths?: 'high' | 'medium' | 'low';
  serialNumber?: 'high' | 'medium' | 'low';
  vendor?: 'high' | 'medium' | 'low';
}

export const AddAssetModal: React.FC<AddAssetModalProps> = ({
  isOpen,
  onClose,
  onAddAsset,
  existingAssets,
  onViewExistingAsset,
}) => {
  // Form fields
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState<AssetCategory>('ELECTRONICS');
  const [price, setPrice] = useState<number | ''>('');
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [warrantyMonths, setWarrantyMonths] = useState<number>(12);
  const [insuranceExpiryDate, setInsuranceExpiryDate] = useState('');
  const [pucExpiryDate, setPucExpiryDate] = useState('');
  const [maintenanceType, setMaintenanceType] = useState('');
  const [maintenanceDueDate, setMaintenanceDueDate] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [vendor, setVendor] = useState('');
  const [notes, setNotes] = useState('');

  // Upload & AI Scanning State
  const [dragActive, setDragActive] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStepIndex, setScanStepIndex] = useState(0);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isExtracted, setIsExtracted] = useState(false);
  const [detectedDocType, setDetectedDocType] = useState<string | null>(null);
  const [docTypeConfidence, setDocTypeConfidence] = useState<'high' | 'medium' | 'low'>('high');
  const [confidences, setConfidences] = useState<ExtractedFieldConfidence>({});

  // Document preview state
  const [fileObject, setFileObject] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [pdfPageCount, setPdfPageCount] = useState<number>(1);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  // Duplicate warning state
  const [duplicateAsset, setDuplicateAsset] = useState<Asset | null>(null);
  const [dismissDuplicate, setDismissDuplicate] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const SCAN_STEPS = [
    'Reading document...',
    'Document uploaded',
    'Extracting information',
    'Identifying asset',
    'Validating details',
    'Filling asset form',
  ];

  // Reset all states
  const resetForm = () => {
    setName('');
    setBrand('');
    setCategory('ELECTRONICS');
    setPrice('');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setWarrantyMonths(12);
    setInsuranceExpiryDate('');
    setPucExpiryDate('');
    setMaintenanceType('');
    setMaintenanceDueDate('');
    setSerialNumber('');
    setVendor('');
    setNotes('');

    setFileObject(null);
    setFilePreviewUrl(null);
    setIsPdf(false);
    setPdfPageCount(1);
    setIsScanning(false);
    setScanStepIndex(0);
    setScanError(null);
    setIsExtracted(false);
    setDetectedDocType(null);
    setConfidences({});
    setDuplicateAsset(null);
    setDismissDuplicate(false);
    setPreviewModalOpen(false);
  };

  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

  // Check for duplicate asset whenever serialNumber or (name + brand) change
  useEffect(() => {
    if (dismissDuplicate) return;

    const vaultAssets = existingAssets || MobileAssetService.getCachedAssets() || [];
    if (!vaultAssets.length) {
      setDuplicateAsset(null);
      return;
    }

    const cleanSerial = serialNumber.trim().toLowerCase();
    const cleanName = name.trim().toLowerCase();
    const cleanBrand = brand.trim().toLowerCase();

    // 1. Check exact serial match
    if (cleanSerial.length >= 4) {
      const matchBySerial = vaultAssets.find(
        (a) => a.serialNumber && a.serialNumber.trim().toLowerCase() === cleanSerial
      );
      if (matchBySerial) {
        setDuplicateAsset(matchBySerial);
        return;
      }
    }

    // 2. Check name + brand match
    if (cleanName.length >= 3 && cleanBrand.length >= 2) {
      const matchByName = vaultAssets.find(
        (a) =>
          a.name.trim().toLowerCase() === cleanName &&
          a.brand.trim().toLowerCase() === cleanBrand
      );
      if (matchByName) {
        setDuplicateAsset(matchByName);
        return;
      }
    }

    setDuplicateAsset(null);
  }, [serialNumber, name, brand, dismissDuplicate, existingAssets]);

  if (!isOpen) return null;

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Approximate PDF page count from binary
  const estimatePdfPages = async (file: File): Promise<number> => {
    try {
      const buffer = await file.slice(0, 100000).arrayBuffer();
      const text = new TextDecoder('latin1').decode(buffer);
      const matches = text.match(/\/Type\s*\/Pages[^>]*\/Count\s+(\d+)/);
      if (matches && matches[1]) {
        return Math.max(1, parseInt(matches[1], 10));
      }
    } catch {
      // Fallback
    }
    return 1;
  };

  // Handle Drag & Drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  // Validate and trigger scan
  const handleFileSelected = async (file: File) => {
    setScanError(null);

    // 1. Validate file format
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const ext = file.name.split('.').pop()?.toLowerCase();
    const isAllowedExt = ['pdf', 'jpg', 'jpeg', 'png', 'webp'].includes(ext || '');

    if (!allowedTypes.includes(file.type) && !isAllowedExt) {
      setScanError('Unsupported file type. Please upload a PDF, JPG, PNG, or WEBP document.');
      return;
    }

    // 2. Validate file size (max 15MB)
    const MAX_SIZE = 15 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setScanError(`File size exceeds 15 MB (${formatFileSize(file.size)}). Please upload a smaller file.`);
      return;
    }

    setFileObject(file);
    const pdf = file.type === 'application/pdf' || ext === 'pdf';
    setIsPdf(pdf);

    if (pdf) {
      const pages = await estimatePdfPages(file);
      setPdfPageCount(pages);
      setFilePreviewUrl(null);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        setFilePreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }

    // Trigger AI Scan
    await executeDocumentScan(file, pdf);
  };

  const executeDocumentScan = async (file: File, isPdfFile: boolean) => {
    setIsScanning(true);
    setScanStepIndex(0);
    setScanError(null);

    // Convert file to base64
    const base64Data: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    // Step 0: Reading document
    setScanStepIndex(0);
    await new Promise((r) => setTimeout(r, 350));

    // Step 1: Document uploaded
    setScanStepIndex(1);
    await new Promise((r) => setTimeout(r, 400));

    // Step 2: Extracting information
    setScanStepIndex(2);

    try {
      const response = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64Image: base64Data,
          mimeType: isPdfFile ? 'application/pdf' : file.type || 'image/jpeg',
        }),
      });

      // Step 3: Identifying asset
      setScanStepIndex(3);
      await new Promise((r) => setTimeout(r, 350));

      const resData = await response.json();

      if (response.ok && resData.success && resData.data) {
        // Step 4: Validating details
        setScanStepIndex(4);
        await new Promise((r) => setTimeout(r, 300));

        // Step 5: Filling asset form
        setScanStepIndex(5);
        await new Promise((r) => setTimeout(r, 250));

        populateExtractedDetails(resData.data);
      } else {
        throw new Error(resData.error || "Couldn't read this document. Please try another image or PDF.");
      }
    } catch (err: any) {
      console.warn('[AddAssetModal OCR Warning]', err);
      // Offline fallback: try to parse any recognizable text or give clear options
      setScanError(err.message || "Couldn't read this document. You can re-scan or enter details manually.");
    } finally {
      setIsScanning(false);
    }
  };

  const populateExtractedDetails = (data: any) => {
    const item = (data.items && data.items[0]) || {};

    // 1. Document Type
    if (data.documentType) {
      setDetectedDocType(data.documentType);
      setDocTypeConfidence(data.documentTypeConfidence || 'high');
    } else {
      setDetectedDocType('Purchase Invoice');
      setDocTypeConfidence('medium');
    }

    // 2. Asset Name & Brand
    if (item.itemName) {
      setName(String(item.itemName).trim());
    }
    if (item.brand) {
      setBrand(String(item.brand).trim());
    }

    // 3. Category
    if (item.category) {
      const validCats: AssetCategory[] = ['Electronics', 'Vehicles', 'Appliances', 'Gadgets', 'Home', 'Other'];
      const matched = validCats.find((c) => c.toLowerCase() === String(item.category).toLowerCase());
      if (matched) {
        setCategory(matched);
      }
    }

    // 4. Price
    if (typeof item.price === 'number' && item.price > 0) {
      setPrice(item.price);
    } else if (typeof data.totalAmount === 'number' && data.totalAmount > 0) {
      setPrice(data.totalAmount);
    }

    // 5. Purchase Date
    if (data.purchaseDate && /^\d{4}-\d{2}-\d{2}$/.test(data.purchaseDate)) {
      setPurchaseDate(data.purchaseDate);
    }

    // 6. Warranty
    if (typeof item.warrantyMonths === 'number' && item.warrantyMonths > 0) {
      setWarrantyMonths(item.warrantyMonths);
    }

    // 7. Merchant / Store
    if (data.vendor) {
      setVendor(String(data.vendor).trim());
    }

    // 8. Serial Number (Guarded against tax numbers)
    if (item.serialNumber) {
      const s = String(item.serialNumber).trim();
      const isTax = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i.test(s) ||
                    /^(GST|HSN|SAC|CGST|SGST|TAX)/i.test(s);
      if (!isTax) {
        setSerialNumber(s);
      }
    }

    // 9. Notes
    if (item.notes) {
      setNotes(String(item.notes).trim());
    } else if (data.vendor) {
      setNotes(`Purchased from ${data.vendor}`);
    }

    // 10. Confidence metadata
    setConfidences({
      name: item.confidence?.itemName || (item.itemName ? 'high' : 'low'),
      brand: item.confidence?.brand || (item.brand ? 'high' : 'low'),
      price: item.confidence?.price || (item.price ? 'high' : 'medium'),
      purchaseDate: item.confidence?.purchaseDate || (data.purchaseDate ? 'high' : 'medium'),
      warrantyMonths: item.warrantyMonths ? 'high' : 'medium',
      serialNumber: item.serialNumber ? 'high' : 'low',
      vendor: data.vendor ? 'high' : 'medium',
    });

    setIsExtracted(true);
  };

  const handleClear = () => {
    setName('');
    setBrand('');
    setCategory('ELECTRONICS');
    setPrice('');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setWarrantyMonths(12);
    setInsuranceExpiryDate('');
    setPucExpiryDate('');
    setMaintenanceType('');
    setMaintenanceDueDate('');
    setSerialNumber('');
    setVendor('');
    setNotes('');

    setFileObject(null);
    setFilePreviewUrl(null);
    setIsPdf(false);
    setIsExtracted(false);
    setDetectedDocType(null);
    setConfidences({});
    setDuplicateAsset(null);
    setDismissDuplicate(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price || !purchaseDate) return;

    const numericPrice = Number(price);
    const { expiryDate, daysRemaining, status } = calculateWarrantyStatus(
      purchaseDate,
      warrantyMonths
    );

    const isVehicle = isVehicleAsset({ category });

    const newAsset: Asset = {
      id: `ast-${Date.now()}`,
      name,
      brand: brand || 'Generic Brand',
      category,
      price: numericPrice,
      purchaseDate,
      warrantyMonths: Number(warrantyMonths),
      expiryDate,
      daysRemaining,
      status,
      insuranceExpiryDate: isVehicle && insuranceExpiryDate ? insuranceExpiryDate : undefined,
      pucExpiryDate: isVehicle && pucExpiryDate ? pucExpiryDate : undefined,
      maintenanceType: maintenanceType || (isVehicle ? 'Vehicle Annual Service' : 'Routine Maintenance Check'),
      maintenanceDueDate: maintenanceDueDate || expiryDate,
      serialNumber: serialNumber || '',
      vendor: vendor || 'Direct Purchase',
      notes: notes || 'Registered in AssetDoctor Vault',
    };

    onAddAsset(newAsset);
    onClose();
    resetForm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div
        id="add-asset-modal-container"
        className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>Add Asset to Vault</span>
                {isExtracted && (
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    AI Filled
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Upload a document for instant AI extraction or enter details manually
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-6 space-y-4">

          {/* ========================================================= */}
          {/* SECTION 1: SMART DOCUMENT UPLOAD & AI SCAN AREA           */}
          {/* ========================================================= */}
          {!isExtracted && !isScanning && (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-2xl p-5 text-center transition-all ${
                dragActive
                  ? 'border-emerald-400 bg-emerald-500/10 scale-[1.01]'
                  : 'border-slate-800 bg-gradient-to-b from-slate-950/80 to-slate-900/60 hover:border-emerald-500/40'
              }`}
            >
              {/* Hidden file inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={onFileInputChange}
              />
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={onFileInputChange}
              />

              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-glow">
                  <Sparkles className="w-5 h-5" />
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white flex items-center justify-center gap-1.5">
                    <span>Add Asset Automatically with AI</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Drag &amp; drop your document here, or choose an option:
                  </p>
                </div>

                {/* Upload action buttons */}
                <div className="flex flex-wrap items-center justify-center gap-2.5 mt-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm hover:border-slate-600"
                  >
                    <FileIcon className="w-4 h-4 text-rose-400" />
                    <span>Upload PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm hover:border-slate-600"
                  >
                    <ImageIcon className="w-4 h-4 text-cyan-400" />
                    <span>Upload Image</span>
                  </button>
                </div>

                <div className="text-[11px] text-slate-500 font-medium mt-1">
                  Invoice • Warranty Card • RC • Insurance • Bill • AMC (Max 15 MB)
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SECTION 2: AI SCANNING / PROGRESS STATE                   */}
          {/* ========================================================= */}
          {isScanning && (
            <div className="p-5 rounded-2xl bg-slate-950/90 border border-emerald-500/30 text-center space-y-4 animate-fade-in shadow-glow">
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
                <span className="text-sm font-bold text-white">Analyzing document with AI...</span>
              </div>

              <div className="max-w-xs mx-auto space-y-2 text-left text-xs">
                {SCAN_STEPS.map((step, idx) => {
                  const isDone = idx < scanStepIndex;
                  const isCurrent = idx === scanStepIndex;
                  return (
                    <div
                      key={step}
                      className={`flex items-center gap-2 transition-all ${
                        isDone
                          ? 'text-emerald-400 font-semibold'
                          : isCurrent
                          ? 'text-white font-bold'
                          : 'text-slate-600'
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : isCurrent ? (
                        <span className="w-4 h-4 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin shrink-0" />
                      ) : (
                        <span className="w-4 h-4 rounded-full border border-slate-700 shrink-0" />
                      )}
                      <span>{step}</span>
                    </div>
                  );
                })}
              </div>

              <p className="text-[11px] text-slate-400">
                Extracting model, serial numbers, price, warranty &amp; verifying tax guards...
              </p>
            </div>
          )}

          {/* ========================================================= */}
          {/* ERROR NOTIFICATION                                        */}
          {/* ========================================================= */}
          {scanError && (
            <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/30 text-xs space-y-2 animate-fade-in">
              <div className="flex items-center justify-between text-rose-300 font-bold">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>Couldn't read this document</span>
                </span>
                <button
                  type="button"
                  onClick={() => setScanError(null)}
                  className="text-slate-400 hover:text-white"
                >
                  &times;
                </button>
              </div>
              <p className="text-slate-300 text-[11px]">{scanError}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-bold transition"
                >
                  Upload Another Document
                </button>
                <button
                  type="button"
                  onClick={() => setScanError(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
                >
                  Enter Details Manually
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SECTION 3: EXTRACTED DOCUMENT PREVIEW & REVIEW BAR        */}
          {/* ========================================================= */}
          {isExtracted && (
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-emerald-500/30 space-y-3 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Review AI extracted details</h4>
                    <p className="text-[11px] text-slate-400">
                      Verify auto-filled details below before saving to your vault
                    </p>
                  </div>
                </div>

                {detectedDocType && (
                  <span className="self-start sm:self-auto text-[11px] font-semibold px-2.5 py-1 rounded-full bg-cyan-950/50 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                    <Check className="w-3 h-3 text-cyan-400" />
                    <span>Doc: {detectedDocType}</span>
                  </span>
                )}
              </div>

              {/* Document preview chip */}
              {fileObject && (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    {isPdf ? (
                      <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                        <FileIcon className="w-4 h-4" />
                      </div>
                    ) : filePreviewUrl ? (
                      <img
                        src={filePreviewUrl}
                        alt="Doc Thumbnail"
                        className="w-8 h-8 rounded-lg object-cover border border-slate-700 shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                    )}

                    <div className="overflow-hidden">
                      <div className="font-bold text-slate-200 truncate max-w-[200px] sm:max-w-xs">
                        {fileObject.name}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {isPdf ? `${pdfPageCount} page${pdfPageCount > 1 ? 's' : ''} • ` : ''}
                        {formatFileSize(fileObject.size)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {filePreviewUrl && (
                      <button
                        type="button"
                        onClick={() => setPreviewModalOpen(true)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                        title="Preview Document"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleClear}
                      className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition"
                      title="Remove Document & Clear"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Action controls */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-bold text-teal-400 hover:text-teal-300 flex items-center gap-1 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Re-scan Document</span>
                </button>

                <button
                  type="button"
                  onClick={handleClear}
                  className="text-xs font-bold text-slate-400 hover:text-slate-200 transition"
                >
                  Clear AI Data
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SECTION 4: DUPLICATE ASSET WARNING BANNER                 */}
          {/* ========================================================= */}
          {duplicateAsset && (
            <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-xs space-y-2 animate-fade-in">
              <div className="flex items-center gap-2 text-amber-300 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Possible duplicate asset found</span>
              </div>
              <p className="text-slate-300 text-[11px]">
                An asset with matching identifier or brand/model already exists in your vault:{' '}
                <strong className="text-white font-semibold">"{duplicateAsset.name}"</strong> (
                {duplicateAsset.brand})
                {duplicateAsset.serialNumber ? ` • Serial: ${duplicateAsset.serialNumber}` : ''}.
              </p>
              <div className="flex items-center gap-2 pt-1">
                {onViewExistingAsset && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onViewExistingAsset(duplicateAsset);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-bold text-xs transition"
                  >
                    View Existing Asset
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDismissDuplicate(true)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
                >
                  Continue Anyway
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SECTION 5: ASSET FORM (Manual + AI editable)              */}
          {/* ========================================================= */}
          <form id="addAssetForm" onSubmit={handleSubmit} className="space-y-4">
            
            {/* Asset Name & Brand */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-emerald-400" /> Asset / Item Name *
                  </label>
                  {isExtracted && name && (
                    <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono">
                      ✓ AI extracted
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. LG 1.5 Ton 5 Star Split AC, Daikin AC, TVS Ronin"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:border-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-teal-400" /> Brand / Manufacturer
                  </label>
                  {isExtracted && brand && (
                    <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono">
                      ✓ AI extracted
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="e.g. LG, Daikin, Apple, Samsung, TVS, Honda"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:border-teal-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Category */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-300">
                    Category *
                  </label>
                  {isExtracted && (
                    <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono">
                      ✓ AI extracted
                    </span>
                  )}
                </div>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as AssetCategory)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:border-emerald-500 focus:outline-none cursor-pointer"
                >
                  <option value="Electronics">Electronics</option>
                  <option value="Vehicles">Vehicles (Car / Bike / Scooter)</option>
                  <option value="Appliances">Appliances</option>
                  <option value="Gadgets">Gadgets</option>
                  <option value="Home">Home</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Price in INR */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                    <IndianRupee className="w-3.5 h-3.5 text-cyan-400" /> Price (₹ INR) *
                  </label>
                  {isExtracted && price && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono border ${
                        confidences.price === 'high'
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      {confidences.price === 'high' ? '✓ AI extracted' : '⚠ Please verify'}
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="e.g. 85000"
                  value={price}
                  onChange={(e) => setPrice(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Purchase Date */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" /> Purchase Date *
                  </label>
                  {isExtracted && purchaseDate && (
                    <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono">
                      ✓ AI extracted
                    </span>
                  )}
                </div>
                <input
                  type="date"
                  required
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Warranty Months */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Warranty (Months) *
                  </label>
                  {isExtracted && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono border ${
                        confidences.warrantyMonths === 'high'
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      {confidences.warrantyMonths === 'high' ? '✓ AI extracted' : '⚠ Please verify'}
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  required
                  min="1"
                  max="120"
                  value={warrantyMonths}
                  onChange={(e) => setWarrantyMonths(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Vendor / Retailer */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" /> Merchant / Store
                  </label>
                  {isExtracted && vendor && (
                    <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono">
                      ✓ AI extracted
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="e.g. Croma, Apple Store, TVS Motors, Flipkart"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Serial / VIN Number */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5 text-slate-400" /> Serial / VIN Number
                  </label>
                  {isExtracted && serialNumber && (
                    <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono">
                      ✓ AI extracted
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="e.g. SN-991203, IMEI, Chassis ID"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:border-emerald-500 focus:outline-none font-mono"
                />
              </div>

            </div>

            {/* Dynamic Vehicle Compliance Fields */}
            {isVehicleAsset({ category }) && (
              <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 space-y-3 animate-fade-in">
                <div className="flex items-center justify-between text-cyan-400 font-bold text-xs">
                  <div className="flex items-center gap-2">
                    <Car className="w-4 h-4 text-cyan-400" />
                    <span>Vehicle Compliance &amp; Document Expiry Tracking</span>
                  </div>
                  <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded font-mono">
                    Auto-Alert Active
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" /> Insurance Expiry Date
                    </label>
                    <input
                      type="date"
                      value={insuranceExpiryDate}
                      onChange={(e) => setInsuranceExpiryDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:border-cyan-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-teal-400" /> PUC Expiry Date
                    </label>
                    <input
                      type="date"
                      value={pucExpiryDate}
                      onChange={(e) => setPucExpiryDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Maintenance / Service Reminders */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/80">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-cyan-400" /> Maintenance / Service Type
                </label>
                <input
                  type="text"
                  placeholder="e.g. RO Filter Change, Bike Service, Insurance Renewal"
                  value={maintenanceType}
                  onChange={(e) => setMaintenanceType(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-cyan-400" /> Next Maintenance Due Date
                </label>
                <input
                  type="date"
                  value={maintenanceDueDate}
                  onChange={(e) => setMaintenanceDueDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-slate-400" /> Notes / Extended AMC
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Includes extended panel protection plan, AMC coverage..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:border-emerald-500 focus:outline-none"
              />
            </div>

          </form>
        </div>

        {/* Modal Bottom Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/95 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {isExtracted && (
              <button
                type="button"
                onClick={handleClear}
                className="px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold transition"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              form="addAssetForm"
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 hover:scale-[1.02] transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4" />
              <span>Save Asset to Vault</span>
            </button>
          </div>
        </div>

        {/* Full Image Preview Modal */}
        {previewModalOpen && filePreviewUrl && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <div className="relative max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                <span className="text-xs font-bold text-white truncate max-w-md">
                  {fileObject?.name}
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="max-h-[70vh] overflow-auto flex items-center justify-center">
                <img
                  src={filePreviewUrl}
                  alt="Full Document Preview"
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
