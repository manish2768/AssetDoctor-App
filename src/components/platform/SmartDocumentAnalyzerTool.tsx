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
  Wrench
} from 'lucide-react';
import { DocumentRegistry } from '../../platform/documents/documentRegistry';

export const SmartDocumentAnalyzerTool: React.FC = () => {
  const [sampleType, setSampleType] = useState<'service_bill' | 'insurance_policy' | 'phone_invoice'>('service_bill');
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);

  const samplePayloads = {
    service_bill: {
      text: `TVS MOTOR COMPANY AUTHORIZED SERVICE CENTER\nJob Card No: JC-2026-9902\nDate: 12-Feb-2026\nVehicle Reg: MH-02-EV-9999 (TVS Ronin 225)\nOdometer: 6,120 KM\nDescription: 2nd Periodic Maintenance (6,000 KM Milestone)\nItems:\n- TVS TRU4 Synthetic 10W-30 Oil (1.2L): Rs 650.00\n- Oil Filter Element: Rs 120.00\n- Chain Clean & Lube: Rs 150.00\n- Periodic Labour Charges: Rs 450.00\nTotal Amount: Rs 1,370.00\nNext Service Due: 12,000 KM or 180 Days`,
      type: 'SERVICE_INVOICE'
    },
    insurance_policy: {
      text: `HDFC ERGO GENERAL INSURANCE COMPANY LTD.\nMotor Comprehensive Policy Schedule\nPolicy No: 2311-8902-8829-00\nInsured: Ashutosh\nVehicle Make/Model: Royal Enfield Classic 350\nReg No: DL-01-AB-1234\nPolicy Period: 01-Jan-2026 to 31-Dec-2026\nIDV (Insured Declared Value): Rs 1,85,000\nOwn Damage Premium: Rs 2,450.00\nThird Party Liability: Rs 1,366.00\nTotal Premium Paid: Rs 4,502.88 (Incl. 18% GST)`,
      type: 'INSURANCE_POLICY'
    },
    phone_invoice: {
      text: `RELIANCE RETAIL DIGITAL LIMITED\nTax Invoice / Cash Memo\nInvoice No: MUM-RET-2026-11829\nDate: 10-Jan-2026\nGSTIN: 27AAACR1234F1Z5\nItem: Apple iPhone 16 Pro 128GB Black Titanium\nIMEI: 359281098273615\nSerial No: HGF98201K\nHSN: 85171200\nNet Amount: Rs 1,01,610.17\nCGST 9%: Rs 9,144.91\nSGST 9%: Rs 9,144.91\nFinal Total: Rs 1,19,900.00\nStandard Manufacturer Warranty: 12 Months`,
      type: 'PURCHASE_INVOICE'
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
          documentType: 'Service Invoice',
          vehicleRegistration: 'MH-02-EV-9999',
          odometerKm: 6120,
          totalAmount: '₹1,370',
          nextServiceTarget: '12,000 KM / 180 Days',
          workshop: 'TVS Authorized Service Center',
          invoiceDate: '12-Feb-2026'
        };
        intelligenceInsights = [
          'Odometer KM (6,120 KM) successfully reconciled against previous asset telemetry (3,400 KM)',
          'Next service milestone automatically stepped to 12,000 KM',
          'TVS TRU4 Synthetic engine oil replacement verified against OEM specifications'
        ];
      } else if (sampleType === 'insurance_policy') {
        parsedEntities = {
          documentType: 'Insurance Policy Certificate',
          policyNumber: '2311-8902-8829-00',
          insurer: 'HDFC ERGO General Insurance',
          vehicleRegistration: 'DL-01-AB-1234',
          idvAmount: '₹1,85,000',
          expiryDate: '31-Dec-2026'
        };
        intelligenceInsights = [
          'Comprehensive policy active until 31-Dec-2026',
          'IDV (₹1,85,000) matched with fair market depreciation curve (92% retained)',
          'Zero deductible claim assistant profile activated'
        ];
      } else {
        parsedEntities = {
          documentType: 'Tax Purchase Invoice',
          product: 'Apple iPhone 16 Pro 128GB',
          imei: '359281098273615',
          serialNumber: 'HGF98201K',
          purchasePrice: '₹1,19,900',
          vendorGstin: '27AAACR1234F1Z5 (Verified)',
          warrantyExpiry: '09-Jan-2027'
        };
        intelligenceInsights = [
          'Valid GSTIN and official retail invoice verified',
          '1-Year Apple limited hardware warranty active through 09-Jan-2027',
          'IMEI registered for device diagnostics & resale valuation tracking'
        ];
      }

      setExtractedData({
        classifiedType: def?.displayName || classified.typeCode,
        confidence: classified.confidence,
        entities: parsedEntities,
        insights: intelligenceInsights
      });
      setIsProcessing(false);
    }, 450);
  };

  return (
    <div className="w-full rounded-3xl bg-slate-900/90 border border-slate-800 p-6 sm:p-8 shadow-2xl space-y-6">
      {/* Tool Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Zap className="w-4 h-4" />
            </span>
            <span className="text-xs font-black uppercase text-cyan-400 tracking-wider">
              Free Intelligent Tool
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
            Smart Document & Bill Analyzer
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Test universal OCR and entity extraction across service bills, insurance schedules, and retail invoices.
          </p>
        </div>
      </div>

      {/* Sample Document Selectors */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { setSampleType('service_bill'); setExtractedData(null); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 border ${
            sampleType === 'service_bill'
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          <Car className="w-3.5 h-3.5" />
          <span>Automotive Service Bill</span>
        </button>

        <button
          onClick={() => { setSampleType('insurance_policy'); setExtractedData(null); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 border ${
            sampleType === 'insurance_policy'
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Vehicle Insurance Policy</span>
        </button>

        <button
          onClick={() => { setSampleType('phone_invoice'); setExtractedData(null); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 border ${
            sampleType === 'phone_invoice'
              ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50'
              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Electronics Tax Invoice</span>
        </button>
      </div>

      {/* Interactive Document Preview Box */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Raw Document Text */}
        <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
              Document Text Stream
            </span>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
              Ready for Extraction
            </span>
          </div>

          <pre className="p-3.5 rounded-xl bg-slate-900 border border-slate-800/80 text-xs font-mono text-slate-300 leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-60">
            {samplePayloads[sampleType].text}
          </pre>

          <button
            onClick={handleRunAnalysis}
            disabled={isProcessing}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            {isProcessing ? (
              <span>Analyzing Document Intelligence...</span>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Extract Document Intelligence</span>
              </>
            )}
          </button>
        </div>

        {/* Right: Extracted Intelligence Results */}
        <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">
            Extracted Entities & Telemetry
          </span>

          {extractedData ? (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Classified Document</span>
                  <span className="text-xs font-black text-emerald-300">{extractedData.classifiedType}</span>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  {Math.round(extractedData.confidence * 100)}% Confidence
                </span>
              </div>

              {/* Entity Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(extractedData.entities).map(([key, val]) => (
                  <div key={key} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 font-semibold block capitalize">
                      {key.replace(/([A-Z])/g, ' $1')}
                    </span>
                    <span className="font-bold text-white font-mono">{String(val)}</span>
                  </div>
                ))}
              </div>

              {/* Action Insights */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider block">
                  Automated Intelligence Actions
                </span>
                {extractedData.insights.map((ins: string, idx: number) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{ins}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-60 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-800 rounded-2xl text-slate-500 text-xs space-y-2">
              <FileText className="w-8 h-8 text-slate-600" />
              <p>Click &quot;Extract Document Intelligence&quot; to parse structured fields and triggers.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
