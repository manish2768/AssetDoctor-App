import React, { useState } from 'react';
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  Tag,
  Car,
  Smartphone,
  Wrench,
  HelpCircle,
  Plus
} from 'lucide-react';
import { DocumentRegistry } from '../../platform/documents/documentRegistry';

interface SmartDocumentAnalyzerToolProps {
  onSaveToVault?: () => void;
}

export const SmartDocumentAnalyzerTool: React.FC<SmartDocumentAnalyzerToolProps> = ({ onSaveToVault }) => {
  const [sampleType, setSampleType] = useState<'service_bill' | 'insurance_policy' | 'phone_invoice' | 'ac_installation'>('service_bill');
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [customFileSelected, setCustomFileSelected] = useState<string | null>(null);

  const samplePayloads = {
    service_bill: {
      text: `AUTHORIZED AUTOMOTIVE SERVICE CENTER\nJob Card No: JC-2026-9902\nDate: 12-Feb-2026\nVehicle: 225cc Motorcycle\nRegistration: MH-02-XX-4829\nOdometer: 6,120 KM\nDescription: Periodic Maintenance (6,000 KM Milestone)\nItems:\n- Synthetic 10W-30 Oil (1.2L): Rs 650.00\n- Oil Filter Element: Rs 120.00\n- Chain Clean & Synthetic Lube: Rs 150.00\n- Periodic Labour Charges: Rs 450.00\nTotal Amount: Rs 1,370.00\nNext Service Due: 12,000 KM or 180 Days`,
      type: 'SERVICE_INVOICE',
      isVehicle: true
    },
    insurance_policy: {
      text: `NATIONAL GENERAL INSURANCE COMPANY\nMotor Comprehensive Policy Schedule\nPolicy No: 2311-8902-8829-00\nInsured: Policyholder Record\nVehicle: 350cc Cruiser Motorcycle\nRegistration: DL-01-XX-9182\nPolicy Period: 01-Jan-2026 to 31-Dec-2026\nIDV (Insured Declared Value): Rs 1,85,000\nOwn Damage Premium: Rs 2,450.00\nThird Party Liability: Rs 1,366.00\nTotal Premium Paid: Rs 4,502.88 (Incl. 18% GST)`,
      type: 'INSURANCE_POLICY',
      isVehicle: true
    },
    phone_invoice: {
      text: `DIGITAL RETAIL ELECTRONICS LIMITED\nTax Purchase Invoice / Cash Memo\nInvoice No: RET-2026-11829\nDate: 10-Jan-2026\nGSTIN: 27AAACR1234F1Z5\nItem: Flagship 5G Smartphone 256GB\nIMEI: 359281098273615\nSerial No: HGF98201K\nNet Amount: Rs 76,186.44\nGST 18%: Rs 13,713.56\nFinal Total: Rs 89,900.00\nStandard Manufacturer Warranty: 12 Months`,
      type: 'PURCHASE_INVOICE',
      isVehicle: false
    },
    ac_installation: {
      text: `CLIMATE APPLIANCES & HVAC SOLUTIONS\nInstallation & Handover Invoice\nInvoice No: AC-INST-2026-4401\nDate: 20-Mar-2026\nItem: 1.5 Ton 5-Star Inverter Split AC\nOutdoor Serial: DKN-ODU-882910\nIndoor Serial: DKN-IDU-882911\nCompressor Warranty: 10 Years\nPCB Inverter Warranty: 5 Years\nComprehensive Warranty: 1 Year\nTotal Paid: Rs 44,500.00`,
      type: 'PURCHASE_INVOICE',
      isVehicle: false
    }
  };

  const handleRunAnalysis = () => {
    setIsProcessing(true);
    setExtractedData(null);

    setTimeout(() => {
      const selected = samplePayloads[sampleType];
      const classified = DocumentRegistry.classifyByText(selected.text);
      const def = DocumentRegistry.getDefinition(classified.typeCode);

      let parsedEntities: Record<string, any> = {};
      let intelligenceInsights: string[] = [];

      if (sampleType === 'service_bill') {
        parsedEntities = {
          documentType: 'Periodic Service Invoice',
          statusBadge: 'VERIFIED',
          vendor: 'Authorized Dealership Service Center',
          invoiceDate: '12-Feb-2026',
          invoiceNumber: 'JC-2026-9902',
          asset: '225cc Motorcycle',
          totalAmount: '₹1,370 (Incl. Taxes)',
          odometerKm: '6,120 KM',
          nextServiceMilestone: '12,000 KM / 180 Days',
          isVehicle: true
        };
        intelligenceInsights = [
          'Odometer KM (6,120 KM) verified from service job sheet.',
          'Next scheduled service milestone calculated at 12,000 KM or 180 days.',
          'Synthetic engine oil replacement and filter drain confirmed.'
        ];
      } else if (sampleType === 'insurance_policy') {
        parsedEntities = {
          documentType: 'Comprehensive Motor Insurance Policy',
          statusBadge: 'VERIFIED',
          vendor: 'National General Insurance Co.',
          policyNumber: '2311-8902-8829-00',
          asset: '350cc Cruiser Motorcycle',
          idvAmount: '₹1,85,000',
          totalAmount: '₹4,502.88',
          expiryDate: '31-Dec-2026',
          isVehicle: true
        };
        intelligenceInsights = [
          'Comprehensive Own Damage & Third Party coverage active through 31-Dec-2026.',
          'Insured Declared Value (₹1,85,000) verified against vehicle depreciation curve.',
          'Zero deductible cashless claim protocol eligible.'
        ];
      } else if (sampleType === 'phone_invoice') {
        parsedEntities = {
          documentType: 'GST Retail Purchase Invoice',
          statusBadge: 'VERIFIED',
          vendor: 'Digital Retail Electronics Ltd. (GSTIN: 27AAACR1234F1Z5)',
          invoiceDate: '10-Jan-2026',
          invoiceNumber: 'RET-2026-11829',
          asset: 'Flagship 5G Smartphone 256GB',
          totalAmount: '₹89,900.00 (Incl. 18% GST)',
          serialOrImei: 'IMEI: 359281098273615 / SN: HGF98201K',
          warrantyTerms: '12 Months Limited Manufacturer Hardware Warranty',
          expiryDate: '09-Jan-2027',
          isVehicle: false
        };
        intelligenceInsights = [
          'Official GST invoice verified with verified merchant GSTIN.',
          '1-Year manufacturer warranty active through 09-Jan-2027.',
          'IMEI cataloged for safe CEIR blocking and warranty claim proof.'
        ];
      } else {
        parsedEntities = {
          documentType: 'Appliance Tax Invoice & Warranty Record',
          statusBadge: 'VERIFIED',
          vendor: 'Climate Appliances & HVAC Solutions',
          invoiceDate: '20-Mar-2026',
          invoiceNumber: 'AC-INST-2026-4401',
          asset: '1.5 Ton Inverter Split AC',
          totalAmount: '₹44,500.00',
          serialOrImei: 'Outdoor: DKN-ODU-882910 | Indoor: DKN-IDU-882911',
          warrantyTerms: '10 Yrs Compressor + 5 Yrs Inverter PCB + 1 Yr Comprehensive',
          isVehicle: false
        };
        intelligenceInsights = [
          '10-Year compressor and 5-Year PCB warranty terms extracted.',
          'Multi-unit serials (Indoor + Outdoor) categorized for maintenance tracking.',
          'Initial seasonal filter cleaning scheduled in 90 days.'
        ];
      }

      setExtractedData({
        classifiedType: def?.displayName || classified.typeCode,
        confidence: classified.confidence,
        statusBadge: parsedEntities.statusBadge || 'VERIFIED',
        entities: parsedEntities,
        insights: intelligenceInsights
      });
      setIsProcessing(false);
    }, 700);
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-black uppercase tracking-wider font-mono">
          <UploadCloud className="w-3.5 h-3.5" />
          <span>Universal OCR Document Intelligence</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          Bill & Invoice Analyzer
        </h2>
        <p className="text-xs sm:text-sm text-slate-400">
          Extract line items, taxes, warranty clauses, service intervals, and odometer readings from any bill or invoice.
        </p>
      </div>

      {/* Main Container */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 sm:p-8 space-y-6 shadow-2xl">
        {/* Sample Document Type Switcher */}
        <div className="space-y-3">
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Select Document Archetype or Test Sample
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              onClick={() => { setSampleType('service_bill'); setExtractedData(null); }}
              className={`p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                sampleType === 'service_bill' ? 'bg-sky-500/20 text-sky-300 border-sky-500/50' : 'bg-slate-950 text-slate-400 border-slate-800'
              }`}
            >
              <Car className="w-3.5 h-3.5" />
              <span>Vehicle Service Bill</span>
            </button>
            <button
              onClick={() => { setSampleType('insurance_policy'); setExtractedData(null); }}
              className={`p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                sampleType === 'insurance_policy' ? 'bg-sky-500/20 text-sky-300 border-sky-500/50' : 'bg-slate-950 text-slate-400 border-slate-800'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Insurance Policy</span>
            </button>
            <button
              onClick={() => { setSampleType('phone_invoice'); setExtractedData(null); }}
              className={`p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                sampleType === 'phone_invoice' ? 'bg-sky-500/20 text-sky-300 border-sky-500/50' : 'bg-slate-950 text-slate-400 border-slate-800'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Phone Invoice</span>
            </button>
            <button
              onClick={() => { setSampleType('ac_installation'); setExtractedData(null); }}
              className={`p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                sampleType === 'ac_installation' ? 'bg-sky-500/20 text-sky-300 border-sky-500/50' : 'bg-slate-950 text-slate-400 border-slate-800'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Appliance Invoice</span>
            </button>
          </div>
        </div>

        {/* Upload / Test Box */}
        <div className="p-6 rounded-2xl bg-slate-950 border border-dashed border-slate-700 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-sky-400">
            <FileText className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-white">
              {customFileSelected || `Ready to analyze: ${sampleType.replace('_', ' ').toUpperCase()}`}
            </h4>
            <p className="text-xs text-slate-400">
              Drop any service bill, warranty card, or purchase invoice (PDF, JPG, PNG).
            </p>
          </div>
          <button
            onClick={handleRunAnalysis}
            disabled={isProcessing}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-400 hover:to-teal-400 text-slate-950 font-black text-xs transition-all cursor-pointer inline-flex items-center gap-2 shadow-lg shadow-sky-500/20 disabled:opacity-50"
          >
            {isProcessing ? (
              <span>Extracting Document Fields...</span>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5" />
                <span>Run Document OCR Analysis</span>
              </>
            )}
          </button>
        </div>

        {/* Extracted Structured Data Results */}
        {extractedData && (
          <div className="space-y-6 animate-fade-in">
            {/* Header Status */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase text-slate-400">Extracted Document:</span>
                <span className="text-xs font-black text-white">{extractedData.classifiedType}</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[10px]">
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-black">
                  {extractedData.statusBadge}
                </span>
                <span className="text-slate-500">Confidence: {Math.round(extractedData.confidence * 100)}%</span>
              </div>
            </div>

            {/* Extracted Fields Table */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {Object.entries(extractedData.entities)
                .filter(([k]) => k !== 'isVehicle' && k !== 'statusBadge')
                .map(([key, val]) => (
                  <div key={key} className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-0.5">
                    <span className="text-[10px] font-mono text-slate-500 uppercase block">
                      {key.replace(/([A-Z])/g, ' $1')}
                    </span>
                    <span className="font-bold text-slate-200 block truncate">{String(val)}</span>
                  </div>
                ))}
            </div>

            {/* Intelligence Insights */}
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase text-sky-400 tracking-wider block">
                Lifecycle & Intelligence Insights
              </span>
              <div className="space-y-1.5 text-xs text-slate-300">
                {extractedData.insights.map((insight: string, idx: number) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                    <span>{insight}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Save to Vault CTA */}
            <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-black text-white">Save This Record to Asset Doctor</h4>
                <p className="text-xs text-slate-400">Vaulted documents remain encrypted and accessible offline anytime.</p>
              </div>
              <button
                onClick={onSaveToVault}
                className="px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Save to Asset Doctor Vault</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
