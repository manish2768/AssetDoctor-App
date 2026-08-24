import React, { useState } from 'react';
import { 
  Siren, 
  PhoneCall, 
  FileText, 
  ShieldCheck, 
  ExternalLink, 
  X, 
  AlertCircle, 
  Copy, 
  Check, 
  Wrench,
  Car
} from 'lucide-react';

export interface VehicleDocuments {
  assetName: string;
  registrationNumber?: string;
  rcUrl?: string;
  insuranceUrl?: string;
  insurancePolicyNo?: string;
  insuranceProvider?: string;
  insuranceExpiry?: string;
  pucUrl?: string;
  pucExpiry?: string;
  brandName?: string;
  roadsideAssistanceNumber?: string; // Emergency Towing / RSA Number
  customerCareNumber?: string;
}

interface EmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: VehicleDocuments | null;
}

export const EmergencyModal: React.FC<EmergencyModalProps> = ({
  isOpen,
  onClose,
  data
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!isOpen || !data) return null;

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border-2 border-red-500/30 relative">
        
        {/* Top Emergency Red Banner */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 p-5 text-white flex items-center justify-between relative overflow-hidden">
          <div className="flex items-center gap-3 z-10">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center animate-pulse">
              <Siren className="w-7 h-7 text-white" />
            </div>
            <div>
              <span className="bg-red-900/60 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider">
                Emergency Mode Active
              </span>
              <h2 className="text-xl font-black">{data.assetName}</h2>
              {data.registrationNumber && (
                <p className="text-xs font-mono bg-black/20 px-2 py-0.5 rounded text-red-100 inline-block mt-0.5">
                  {data.registrationNumber}
                </p>
              )}
            </div>
          </div>

          <button 
            onClick={onClose}
            className="z-10 w-9 h-9 bg-black/20 hover:bg-black/40 text-white rounded-full flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">

          {/* 1. QUICK HELP CALL BUTTONS (Roadside & Insurance) */}
          <div className="grid grid-cols-2 gap-3">
            {data.roadsideAssistanceNumber ? (
              <a
                href={`tel:${data.roadsideAssistanceNumber}`}
                className="flex flex-col items-center justify-center p-3.5 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold shadow-lg shadow-red-500/25 transition active:scale-95"
              >
                <div className="flex items-center gap-2">
                  <Wrench className="w-5 h-5" />
                  <span className="text-sm">RSA / Breakdown</span>
                </div>
                <span className="text-[10px] font-normal opacity-90 mt-0.5">{data.roadsideAssistanceNumber}</span>
              </a>
            ) : (
              <a
                href={`tel:${data.customerCareNumber || '1800123456'}`}
                className="flex flex-col items-center justify-center p-3.5 bg-red-600 text-white rounded-2xl font-bold shadow-md transition"
              >
                <div className="flex items-center gap-2">
                  <PhoneCall className="w-5 h-5" />
                  <span className="text-sm">Customer Support</span>
                </div>
              </a>
            )}

            {data.insuranceProvider && (
              <a
                href={`tel:${data.customerCareNumber || ''}`}
                className="flex flex-col items-center justify-center p-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/25 transition active:scale-95"
              >
                <div className="flex items-center gap-2">
                  <PhoneCall className="w-5 h-5" />
                  <span className="text-sm">Insurance Claim</span>
                </div>
                <span className="text-[10px] font-normal opacity-90 mt-0.5">{data.insuranceProvider}</span>
              </a>
            )}
          </div>

          {/* 2. 1-TAP DOCUMENT ACCESS (RC, Insurance, PUC) */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-blue-500" /> तुरंत देखने योग्य डाक्यूमेंट्स (Instant Docs)
            </h3>

            <div className="space-y-2.5">
              
              {/* Vehicle RC Document */}
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg">
                    <Car className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">RC (Registration Copy)</p>
                    <p className="text-xs text-gray-500">गाड़ी की आरसी कॉपी</p>
                  </div>
                </div>
                {data.rcUrl ? (
                  <a
                    href={data.rcUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow transition"
                  >
                    Open <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <span className="text-xs text-amber-500 font-semibold bg-amber-50 dark:bg-amber-950/40 px-2 py-1 rounded">Not Uploaded</span>
                )}
              </div>

              {/* Insurance Copy */}
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-lg">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">Insurance Policy</p>
                    <p className="text-xs text-gray-500">
                      {data.insurancePolicyNo ? `Policy No: ${data.insurancePolicyNo}` : 'बीमा पॉलिसी की कॉपी'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {data.insurancePolicyNo && (
                    <button
                      onClick={() => copyToClipboard(data.insurancePolicyNo!, 'policy')}
                      className="p-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg cursor-pointer"
                      title="Copy Policy No"
                    >
                      {copiedField === 'policy' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  )}
                  {data.insuranceUrl ? (
                    <a
                      href={data.insuranceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow transition"
                    >
                      Open <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <span className="text-xs text-amber-500 font-semibold bg-amber-50 dark:bg-amber-950/40 px-2 py-1 rounded">Not Uploaded</span>
                  )}
                </div>
              </div>

              {/* PUC Certificate */}
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 rounded-lg">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">PUC Certificate</p>
                    <p className="text-xs text-gray-500">
                      {data.pucExpiry ? `Valid Till: ${data.pucExpiry}` : 'प्रदूषण प्रमाण पत्र'}
                    </p>
                  </div>
                </div>
                {data.pucUrl ? (
                  <a
                    href={data.pucUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow transition"
                  >
                    Open <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <span className="text-xs text-amber-500 font-semibold bg-amber-50 dark:bg-amber-950/40 px-2 py-1 rounded">Not Uploaded</span>
                )}
              </div>

            </div>
          </div>

          {/* Quick Notice Banner */}
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600" />
            <span>
              पुलिस चेकिंग या टोल प्लाजा पर आप इन डाक्यूमेंट्स को सीधे दिखा सकते हैं।
            </span>
          </div>

        </div>

      </div>
    </div>
  );
};
