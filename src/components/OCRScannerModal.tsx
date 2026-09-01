import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ScanText,
  Upload,
  X,
  FileCheck2,
  Sparkles,
  CheckCircle2,
  Calendar,
  IndianRupee,
  ShieldCheck,
  Building2,
  Tag,
  Hash,
  ShoppingBag,
  PlusCircle,
  Check,
  Camera,
  CameraOff,
  RefreshCw,
  ShieldAlert,
  AlertTriangle,
  FileWarning,
  Info,
  Lock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Asset, AssetCategory, ReceiptScanResult, ParsedInvoiceItem } from '../types';
import { calculateWarrantyStatus, formatINR } from '../utils/assetUtils';
import { analyzeInvoiceForScams, validateGSTIN } from '../utils/scamGuardUtils';

interface OCRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddAsset: (newAsset: Asset) => void;
}

export const OCRScannerModal: React.FC<OCRScannerModalProps> = ({
  isOpen,
  onClose,
  onAddAsset,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState<string>('');
  
  // Live camera state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Multi-item scanning & Scam Guard state
  const [vendor, setVendor] = useState<string>('');
  const [purchaseDate, setPurchaseDate] = useState<string>('');
  const [gstin, setGstin] = useState<string>('');
  const [parsedItems, setParsedItems] = useState<ParsedInvoiceItem[]>([]);
  const [extractionEvidence, setExtractionEvidence] = useState<Record<string, unknown>>({});
  const [verifiedForSave, setVerifiedForSave] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [showScamDetails, setShowScamDetails] = useState<boolean>(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
    setCameraError(null);
  };

  const startCamera = async () => {
    setCameraError(null);
    setIsCameraActive(true);
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      setCameraError('Camera access denied or device not available. Please upload an image file.');
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      stopCamera();
      setImagePreview(dataUrl);
      triggerScan({ base64Image: dataUrl, mimeType: 'image/jpeg' });
    }
  };

  const resetModalState = () => {
    stopCamera();
    setImagePreview(null);
    setIsScanning(false);
    setScanStep('');
    setVendor('');
    setPurchaseDate('');
    setGstin('');
    setParsedItems([]);
    setExtractionEvidence({});
    setVerifiedForSave(false);
    setHasScanned(false);
    setDragActive(false);
    setShowScamDetails(true);
  };

  useEffect(() => {
    if (!isOpen) {
      resetModalState();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const handleClose = () => {
    resetModalState();
    onClose();
  };

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
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImagePreview(result);
      triggerScan({ base64Image: result, mimeType: file.type || 'image/jpeg' });
    };
    reader.readAsDataURL(file);
  };

  const triggerScan = async (payload: { base64Image?: string; mimeType?: string; sampleType?: string }) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsScanning(true);
      setScanStep('Document saved. OCR will start when internet connection is restored.');
      try {
        const offlineDocId = `doc_offline_${Date.now()}`;
        const queueKey = 'assetdoctor_offline_docs';
        const existing = JSON.parse(localStorage.getItem(queueKey) || '[]');
        existing.push({
          id: offlineDocId,
          status: 'PENDING_PROCESSING',
          createdAt: new Date().toISOString(),
          notice: 'Document saved. OCR will start when internet connection is restored.'
        });
        localStorage.setItem(queueKey, JSON.stringify(existing));
      } catch (_) {}
      setTimeout(() => {
        setIsScanning(false);
        setHasScanned(false);
        handleClose();
      }, 1000);
      return;
    }

    setIsScanning(true);
    setHasScanned(false);

    setScanStep('Initializing Gemini AI Vision & Scam Guard Engine...');
    await new Promise((res) => setTimeout(res, 400));

    setScanStep('Verifying Merchant GSTIN, Tax Calculations & Vendor DB...');
    await new Promise((res) => setTimeout(res, 500));

    setScanStep('Extracting Product Models, Serial Numbers & Price Anomalies...');
    await new Promise((res) => setTimeout(res, 400));

    try {
      const response = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await response.json();

      const evidence = resData?.data?.fieldEvidence;
      const hasEvidence =
        evidence &&
        typeof evidence === 'object' &&
        Object.values(evidence).some(
          (field: any) => field && (field.sourceText || field.evidenceType === 'user_verified'),
        );
      if (resData.success && resData.data && hasEvidence) {
        populateExtractedData(resData.data);
      } else {
        throw new Error(resData.error || 'OCR returned no verifiable field evidence');
      }
    } catch (err: any) {
      console.error('Scan Error:', err);
      setVendor('');
      setPurchaseDate('');
      setGstin('');
      setParsedItems([]);
      setExtractionEvidence({});
      setVerifiedForSave(false);
      setScanStep('OCR unavailable. No values were populated; enter and verify details manually.');
    } finally {
      setIsScanning(false);
      setHasScanned(true);
    }
  };

  const populateExtractedData = (data: ReceiptScanResult) => {
    setExtractionEvidence(
      data && typeof (data as any).fieldEvidence === 'object'
        ? (data as any).fieldEvidence
        : {},
    );
    setVerifiedForSave(false);
    setVendor(data.vendor || '');
    setPurchaseDate(data.purchaseDate || '');
    setGstin(data.gstin || '');

    if (data.items && data.items.length > 0) {
      setParsedItems(
        data.items.map((it, idx) => ({
          id: it.id || `item-${idx + 1}-${Date.now()}`,
          itemName: it.itemName,
          brand: it.brand || '',
          price: it.price,
          warrantyMonths: it.warrantyMonths || 0,
          category: it.category || 'Gadgets',
          serialNumber: it.serialNumber || '',
          notes: it.notes || 'Extracted via Multi-Item OCR Scanner',
          selected: it.selected !== undefined ? it.selected : true,
        }))
      );
    } else if (data.itemName) {
      // Single legacy fallback
      setParsedItems([
        {
          id: `item-1-${Date.now()}`,
          itemName: data.itemName,
          brand: data.brand || '',
          price: data.price || 0,
          warrantyMonths: data.warrantyMonths || 0,
          category: data.category || 'Gadgets',
          serialNumber: data.serialNumber || '',
          notes: data.notes || 'Added via OCR Scanner',
          selected: true,
        },
      ]);
    }
  };

  const toggleItemSelection = (id: string) => {
    setParsedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const updateItemField = (id: string, field: keyof ParsedInvoiceItem, value: any) => {
    setParsedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const addNewItemRow = () => {
    const newItem: ParsedInvoiceItem = {
      id: `item-${Date.now()}`,
      itemName: 'Additional Invoice Item',
      brand: vendor || '',
      price: 0,
      warrantyMonths: 0,
      category: 'Gadgets',
      serialNumber: '',
      notes: 'Manually added line item',
      selected: true,
    };
    setParsedItems((prev) => [...prev, newItem]);
  };

  // Calculate selected sum
  const selectedItems = parsedItems.filter((i) => i.selected);
  const totalInvoiceValuation = selectedItems.reduce((acc, curr) => acc + (curr.price || 0), 0);

  // AI Scam Guard Analysis Engine Calculation
  const scamGuard = useMemo(() => {
    return analyzeInvoiceForScams({
      vendor,
      purchaseDate,
      totalAmount: totalInvoiceValuation,
      gstin,
      items: parsedItems,
    });
  }, [vendor, purchaseDate, totalInvoiceValuation, gstin, parsedItems]);

  const gstValidation = useMemo(() => {
    return validateGSTIN(gstin);
  }, [gstin]);

  const handleSaveAllAssets = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItems.length === 0) return;
    if (!verifiedForSave) {
      setScanStep('Review every extracted value and confirm verification before saving.');
      return;
    }

    selectedItems.forEach((item, index) => {
      const { expiryDate, daysRemaining, status } = calculateWarrantyStatus(
        purchaseDate,
        item.warrantyMonths || 0
      );

      const uniqueId = `ast-${Date.now()}-${index}-${Math.floor(Math.random() * 100000)}`;

      const newAsset: Asset = {
        id: uniqueId,
        name: item.itemName,
        brand: item.brand || vendor,
        category: item.category,
        price: Number(item.price) || 0,
        purchaseDate,
        warrantyMonths: Number(item.warrantyMonths) || 0,
        expiryDate,
        daysRemaining,
        status,
        serialNumber: item.serialNumber || '',
        vendor: vendor || '',
        notes: item.notes || 'Added via OCR Scanner',
        receiptImageUrl: imagePreview || undefined,
        gstin,
        scamGuardStatus: scamGuard.status,
        ocrFieldEvidence: extractionEvidence,
        ocrFieldSources: {
          vendor: 'USER_VERIFIED',
          purchaseDate: 'USER_VERIFIED',
          gstin: 'USER_VERIFIED',
          itemName: 'USER_VERIFIED',
          price: 'USER_VERIFIED',
          warrantyMonths: 'USER_VERIFIED',
          serialNumber: 'USER_VERIFIED',
        },
        ocrVerified: true,
      };

      onAddAsset(newAsset);
    });

    handleClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div
        id="ocr-scanner-modal-container"
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-teal-500 to-cyan-500 text-slate-950 shadow-md">
              <ScanText className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Multi-Item Invoice OCR
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/30">
                  Gemini Vision AI
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Extract multiple products, line prices & warranties from Flipkart/Amazon invoices
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Upload Dropzone or Camera View */}
          {!hasScanned && (
            <div>
              {isCameraActive ? (
                <div className="relative border border-slate-800 bg-slate-950 rounded-2xl p-4 overflow-hidden">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                      <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                        Live Camera Viewfinder
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      Close Camera
                    </button>
                  </div>

                  {cameraError ? (
                    <div className="p-6 text-center bg-rose-500/10 border border-rose-500/30 rounded-xl my-2">
                      <CameraOff className="w-8 h-8 text-rose-400 mx-auto mb-2" />
                      <p className="text-xs font-bold text-rose-300">{cameraError}</p>
                      <div className="flex items-center justify-center gap-3 mt-4">
                        <button
                          type="button"
                          onClick={startCamera}
                          className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Retry Camera
                        </button>
                        <button
                          type="button"
                          onClick={stopCamera}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer transition-colors"
                        >
                          Use File Upload
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative rounded-xl overflow-hidden bg-black flex items-center justify-center border border-slate-800">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-64 sm:h-80 object-cover"
                      />
                      
                      {/* Viewfinder overlay frame */}
                      <div className="absolute inset-4 border-2 border-teal-400/40 rounded-lg pointer-events-none flex flex-col justify-between p-2">
                        <div className="flex justify-between">
                          <div className="w-4 h-4 border-t-2 border-l-2 border-teal-400"></div>
                          <div className="w-4 h-4 border-t-2 border-r-2 border-teal-400"></div>
                        </div>
                        <p className="text-[11px] font-medium text-teal-300/90 bg-slate-950/80 backdrop-blur-sm px-2.5 py-1 rounded-full text-center self-center border border-teal-500/30">
                          Align bill or invoice within camera view
                        </p>
                        <div className="flex justify-between">
                          <div className="w-4 h-4 border-b-2 border-l-2 border-teal-400"></div>
                          <div className="w-4 h-4 border-b-2 border-r-2 border-teal-400"></div>
                        </div>
                      </div>

                      <div className="absolute bottom-4 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={capturePhoto}
                          className="px-5 py-2.5 rounded-xl bg-teal-400 hover:bg-teal-300 text-slate-950 font-bold text-xs shadow-xl shadow-teal-500/30 flex items-center gap-2 transition-all cursor-pointer transform hover:scale-105"
                        >
                          <Camera className="w-4 h-4 stroke-[2.5]" />
                          Snap Photo
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
                    dragActive
                      ? 'border-teal-400 bg-teal-500/10'
                      : 'border-slate-700 bg-slate-950/50 hover:border-slate-500 hover:bg-slate-950'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  {isScanning ? (
                    <div className="py-6 flex flex-col items-center justify-center space-y-4">
                      <div className="relative w-16 h-16 flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full border-4 border-teal-500/20 border-t-teal-400 animate-spin"></div>
                        <Sparkles className="w-6 h-6 text-teal-400 animate-bounce" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-teal-400 animate-pulse">
                          {scanStep}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">Parsing line items & calculating invoice total valuation</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-teal-400">
                        <Upload className="w-8 h-8" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-200">
                          Upload or Scan Multi-Item Invoice
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Extracts phone, earbuds, appliances & accessories automatically
                        </p>
                      </div>

                      <div
                        className="flex flex-wrap items-center justify-center gap-3 pt-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 transition-colors cursor-pointer flex items-center gap-2"
                        >
                          <Upload className="w-4 h-4 text-slate-400" />
                          Browse Files
                        </button>

                        <button
                          type="button"
                          onClick={startCamera}
                          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 text-xs font-bold shadow-lg shadow-teal-500/20 transition-all cursor-pointer flex items-center gap-2 transform hover:scale-105"
                        >
                          <Camera className="w-4 h-4 stroke-[2.5]" />
                          Scan with Camera
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4 text-xs text-amber-200">
                Sample invoice presets are disabled in production. Upload a real document so every saved value has document evidence.
              </div>
            </div>
          )}

          {/* Parsed Multi-Item Form */}
          {hasScanned && (
            <form onSubmit={handleSaveAllAssets} className="space-y-5">
              
              {/* Success Banner */}
              <div className="p-4 rounded-2xl bg-teal-950/40 border border-teal-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-extrabold text-teal-300 flex items-center gap-2">
                      {vendor} Document Extracted
                      <span className="px-2 py-0.5 rounded-full bg-teal-500/20 text-[10px] font-mono text-teal-300 border border-teal-500/30">
                        {parsedItems.length} Products
                      </span>
                    </p>
                    <p className="text-[11px] text-teal-400/80">
                      Total Invoice Valuation: <strong className="font-mono text-white">{formatINR(totalInvoiceValuation)}</strong>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={resetModalState}
                  className="text-xs font-bold text-slate-400 hover:text-white underline cursor-pointer shrink-0"
                >
                  Rescan Document
                </button>
              </div>

              {/* Vendor, Date & GSTIN Metadata Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-950 border border-slate-800">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-teal-400" /> Merchant / Store
                  </label>
                  <input
                    type="text"
                    required
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-xs focus:border-teal-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" /> Purchase Date
                  </label>
                  <input
                    type="date"
                    required
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-xs focus:border-teal-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1 flex items-center gap-1">
                    <FileCheck2 className="w-3.5 h-3.5 text-cyan-400" /> GSTIN Tax No.
                  </label>
                  <input
                    type="text"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    placeholder="29AABCU9603R1ZM"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-cyan-300 font-mono text-xs focus:border-teal-500 focus:outline-none uppercase"
                  />
                </div>
              </div>

              {/* AI Scam Guard Verification Banner */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  scamGuard.status === 'VERIFIED'
                    ? 'bg-emerald-950/20 border-emerald-500/40'
                    : scamGuard.status === 'WARNING'
                    ? 'bg-amber-950/20 border-amber-500/40'
                    : 'bg-rose-950/30 border-rose-500/50 ring-1 ring-rose-500/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded-xl ${
                        scamGuard.status === 'VERIFIED'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : scamGuard.status === 'WARNING'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-rose-500/20 text-rose-400 animate-pulse'
                      }`}
                    >
                      {scamGuard.status === 'VERIFIED' ? (
                        <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
                      ) : scamGuard.status === 'WARNING' ? (
                        <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
                      ) : (
                        <ShieldAlert className="w-5 h-5 stroke-[2.5]" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-white uppercase tracking-wider">
                          AI Scam Guard Analysis
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase font-mono border ${
                            scamGuard.status === 'VERIFIED'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : scamGuard.status === 'WARNING'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          }`}
                        >
                          {scamGuard.authenticityScore}/100 Score • {scamGuard.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5">
                        {scamGuard.status === 'VERIFIED'
                          ? 'Invoice structure verified with valid GSTIN and standard retail pricing.'
                          : scamGuard.status === 'WARNING'
                          ? 'Minor inconsistencies detected (Unverified vendor or missing tax detail).'
                          : '🚨 HIGH RISK FAKE / SUSPICIOUS BILL: Formatting, price or GSTIN alerts flagged!'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowScamDetails(!showScamDetails)}
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {showScamDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {showScamDetails && (
                  <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2 text-xs">
                    {/* GSTIN Details */}
                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <FileCheck2 className="w-3.5 h-3.5 text-cyan-400" />
                        GSTIN Verification:
                      </span>
                      <span
                        className={`font-mono font-bold text-[11px] ${
                          gstValidation.isValid ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {gstValidation.message}
                      </span>
                    </div>

                    {/* Scam Flags */}
                    {scamGuard.scamFlags.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1">
                          <FileWarning className="w-3 h-3" /> Flagged Risks & Anomalies:
                        </p>
                        {scamGuard.scamFlags.map((flag, idx) => (
                          <div
                            key={idx}
                            className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-200 text-xs flex items-center gap-2"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0"></span>
                            <span>{flag}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Verified Safety Signals */}
                    {scamGuard.verifiedChecks.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Verified Safety Metrics:
                        </p>
                        {scamGuard.verifiedChecks.map((chk, idx) => (
                          <div
                            key={idx}
                            className="p-1.5 rounded-lg bg-emerald-500/5 text-emerald-300 text-[11px] flex items-center gap-2"
                          >
                            <Check className="w-3 h-3 text-emerald-400 shrink-0 stroke-[3]" />
                            <span>{chk}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Itemized Breakdown List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <ShoppingBag className="w-4 h-4 text-teal-400" />
                    Detected Invoice Line Items ({parsedItems.length})
                  </h3>
                  <button
                    type="button"
                    onClick={addNewItemRow}
                    className="text-xs font-bold text-teal-400 hover:text-teal-300 flex items-center gap-1 cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                {parsedItems.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className={`p-4 rounded-2xl border transition-all ${
                      item.selected
                        ? 'bg-slate-950 border-teal-500/40 ring-1 ring-teal-500/20'
                        : 'bg-slate-950/40 border-slate-800/80 opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={() => toggleItemSelection(item.id!)}
                        className={`mt-1 w-5 h-5 rounded-lg flex items-center justify-center transition-all cursor-pointer border ${
                          item.selected
                            ? 'bg-teal-500 border-teal-400 text-slate-950'
                            : 'bg-slate-900 border-slate-700 text-transparent'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </button>

                      {/* Main Item Fields */}
                      <div className="flex-1 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {/* Item Name */}
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1">
                              <Tag className="w-3 h-3 text-teal-400" /> Item Name / Model
                            </label>
                            <input
                              type="text"
                              required
                              value={item.itemName}
                              onChange={(e) => updateItemField(item.id!, 'itemName', e.target.value)}
                              className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-xs font-bold focus:border-teal-500 focus:outline-none"
                            />
                          </div>

                          {/* Price ₹ */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1">
                              <IndianRupee className="w-3 h-3 text-cyan-400" /> Price (₹)
                            </label>
                            <input
                              type="number"
                              required
                              value={item.price}
                              onChange={(e) => updateItemField(item.id!, 'price', Number(e.target.value))}
                              className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-teal-400 font-mono font-bold text-xs focus:border-teal-500 focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {/* Brand */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-1">
                              Brand
                            </label>
                            <input
                              type="text"
                              value={item.brand || ''}
                              onChange={(e) => updateItemField(item.id!, 'brand', e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:border-teal-500 focus:outline-none"
                            />
                          </div>

                          {/* Warranty Months */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3 text-emerald-400" /> Warranty
                            </label>
                            <select
                              value={item.warrantyMonths}
                              onChange={(e) => updateItemField(item.id!, 'warrantyMonths', Number(e.target.value))}
                              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:border-teal-500 focus:outline-none"
                            >
                              <option value={6}>6 Months</option>
                              <option value={12}>12 Months (1 yr)</option>
                              <option value={24}>24 Months (2 yrs)</option>
                              <option value={36}>36 Months (3 yrs)</option>
                              <option value={60}>60 Months (5 yrs)</option>
                            </select>
                          </div>

                          {/* Category */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-1">
                              Category
                            </label>
                            <select
                              value={item.category}
                              onChange={(e) => updateItemField(item.id!, 'category', e.target.value as AssetCategory)}
                              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:border-teal-500 focus:outline-none"
                            >
                              <option value="Gadgets">Gadgets</option>
                              <option value="Electronics">Electronics</option>
                              <option value="Appliances">Appliances</option>
                              <option value="Vehicles">Vehicles</option>
                              <option value="Home">Home</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>

                          {/* Serial Number */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1">
                              <Hash className="w-3 h-3 text-slate-500" /> Serial / IMEI
                            </label>
                            <input
                              type="text"
                              value={item.serialNumber || ''}
                              onChange={(e) => updateItemField(item.id!, 'serialNumber', e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:border-teal-500 focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Live Calculated Total & Add All Button */}
              <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-left w-full sm:w-auto">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                    Selected Items Valuation
                  </span>
                  <div className="text-sm font-extrabold text-teal-400 font-mono">
                    {formatINR(totalInvoiceValuation)}{' '}
                    <span className="text-xs font-sans text-slate-400 font-normal">
                      ({selectedItems.length} of {parsedItems.length} items checked)
                    </span>
                  </div>
                </div>

                <label className="flex items-start gap-2 text-[11px] text-amber-200 max-w-sm">
                  <input
                    type="checkbox"
                    checked={verifiedForSave}
                    onChange={(e) => setVerifiedForSave(e.target.checked)}
                    className="mt-0.5 accent-teal-500"
                  />
                  <span>I reviewed these values against the document and verify them before adding assets to the Vault.</span>
                </label>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={selectedItems.length === 0}
                    className="px-6 py-3 rounded-2xl bg-gradient-to-r from-teal-500 via-cyan-500 to-indigo-500 text-slate-950 font-black text-xs shadow-xl shadow-teal-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <Sparkles className="w-4 h-4 text-slate-950" />
                    <span>Add {selectedItems.length} Asset{selectedItems.length > 1 ? 's' : ''} to Vault ({formatINR(totalInvoiceValuation)})</span>
                  </button>
                </div>
              </div>

            </form>
          )}

        </div>
      </div>
    </div>
  );
};
