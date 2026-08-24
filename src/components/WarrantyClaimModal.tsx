import React, { useState } from 'react';
import {
  X,
  FileText,
  Copy,
  Check,
  Mail,
  Send,
  AlertTriangle,
  Building2,
  CheckSquare,
  PhoneCall,
  ExternalLink,
  MapPin,
  ShieldCheck,
  LifeBuoy,
  Phone,
  MessageSquare,
} from 'lucide-react';
import { Asset } from '../types';
import { formatINR, getBrandServiceHotline } from '../utils/assetUtils';

interface WarrantyClaimModalProps {
  asset: Asset | null;
  onClose: () => void;
}

export const WarrantyClaimModal: React.FC<WarrantyClaimModalProps> = ({
  asset,
  onClose,
}) => {
  const [issueDescription, setIssueDescription] = useState('Hardware malfunction / defect observed during normal operation.');
  const [copied, setCopied] = useState(false);

  if (!asset) return null;

  const brandInfo = getBrandServiceHotline(asset.brand || asset.name);

  // Map of known official brand support links & service locators
  const getBrandLinks = (brandName: string) => {
    const cleanBrand = brandName.toLowerCase();
    if (cleanBrand.includes('apple')) {
      return {
        supportUrl: 'https://support.apple.com/in-in',
        locatorUrl: 'https://locate.apple.com/in/en/',
        hotline: '1800-108-4746',
      };
    } else if (cleanBrand.includes('samsung')) {
      return {
        supportUrl: 'https://www.samsung.com/in/support/',
        locatorUrl: 'https://www.samsung.com/in/support/service-center/',
        hotline: '1800-5-7267864',
      };
    } else if (cleanBrand.includes('lg')) {
      return {
        supportUrl: 'https://www.lg.com/in/support',
        locatorUrl: 'https://www.lg.com/in/support/find-service-center',
        hotline: '1800-315-9999',
      };
    } else if (cleanBrand.includes('sony')) {
      return {
        supportUrl: 'https://www.sony.co.in/electronics/support',
        locatorUrl: 'https://www.sony.co.in/electronics/support/service-centres',
        hotline: '1800-103-7799',
      };
    } else if (cleanBrand.includes('nothing')) {
      return {
        supportUrl: 'https://in.nothing.tech/pages/contact-support',
        locatorUrl: 'https://in.nothing.tech/pages/service-centre',
        hotline: '1800-202-1234',
      };
    } else if (cleanBrand.includes('dell')) {
      return {
        supportUrl: 'https://www.dell.com/support/home/en-in',
        locatorUrl: 'https://www.dell.com/support/home/en-in/servicecenter',
        hotline: '1800-425-4026',
      };
    } else if (cleanBrand.includes('hp')) {
      return {
        supportUrl: 'https://support.hp.com/in-en',
        locatorUrl: 'https://support.hp.com/in-en/service-center',
        hotline: '1800-258-7170',
      };
    } else if (cleanBrand.includes('croma')) {
      return {
        supportUrl: 'https://www.croma.com/helpAndSupport',
        locatorUrl: 'https://www.croma.com/store-finder',
        hotline: '1800-572-7662',
      };
    }

    // Default Fallbacks
    return {
      supportUrl: `https://www.google.com/search?q=${encodeURIComponent(brandName + ' official warranty support claim India')}`,
      locatorUrl: `https://www.google.com/maps/search/${encodeURIComponent('Authorized ' + brandName + ' Service Center near me')}`,
      hotline: brandInfo.phone,
    };
  };

  const brandLinks = getBrandLinks(asset.brand || asset.name);

  const claimSubject = `Warranty Service Claim Request - ${asset.name} (SN: ${asset.serialNumber || 'N/A'})`;

  const claimBody = `Dear ${asset.vendor || asset.brand || 'Customer Service Team'},

I am writing to formally request a warranty service / claim for my asset registered under ServiVault AssetDoctor:

ASSET DETAILS:
- Product Name: ${asset.name}
- Brand / Merchant: ${asset.brand || asset.vendor || 'N/A'}
- Category: ${asset.category}
- Purchase Date: ${asset.purchaseDate}
- Warranty Period: ${asset.warrantyMonths} Months
- Expiry Date: ${asset.expiryDate}
- Serial / IMEI Number: ${asset.serialNumber || 'N/A'}
- Tax GSTIN: ${asset.gstin || 'N/A'}
- Estimated Asset Valuation: ${formatINR(asset.price)}

ISSUE DESCRIPTION:
${issueDescription}

Attached with this email are copies of the original tax invoice and warranty certificate verification.
Please advise on the nearest authorized service center or dispatch an engineer for on-site inspection.

Sincerely,
Asset Owner
Via AssetDoctor ServiVault`;

  const handleCopy = () => {
    navigator.clipboard.writeText(`Subject: ${claimSubject}\n\n${claimBody}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendEmail = () => {
    const mailtoUrl = `mailto:support@${(asset.brand || 'brand').toLowerCase().replace(/\s+/g, '')}.com?subject=${encodeURIComponent(
      claimSubject
    )}&body=${encodeURIComponent(claimBody)}`;
    window.open(mailtoUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div
        id="warranty-claim-modal-container"
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Smart Support & Warranty Claim Hub
              </h2>
              <p className="text-xs text-slate-400">
                Direct hotline, claim portals, nearby service centers & automated email claim for {asset.name}
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

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">

          {/* Quick Emergency Assistance Action Buttons */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <PhoneCall className="w-3.5 h-3.5 text-teal-400" />
              Direct Brand Emergency Contact & Claim Portals:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Toll-Free Hotline Call Button */}
              <a
                href={`tel:${brandLinks.hotline.replace(/[^0-9+]/g, '')}`}
                className="p-3.5 rounded-2xl bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-300 transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-400">
                    Toll-Free Hotline
                  </span>
                  <Phone className="w-4 h-4 text-teal-400 group-hover:scale-110 transition-transform" />
                </div>
                <div className="mt-2">
                  <p className="text-sm font-black font-mono text-white truncate">
                    {brandLinks.hotline}
                  </p>
                  <p className="text-[11px] text-teal-300/80 mt-0.5">
                    Click to Call {asset.brand || 'Support'}
                  </p>
                </div>
              </a>

              {/* Official Support Link */}
              <a
                href={brandLinks.supportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3.5 rounded-2xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-400">
                    Official Claim Portal
                  </span>
                  <ExternalLink className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                </div>
                <div className="mt-2">
                  <p className="text-xs font-bold text-white truncate">
                    {asset.brand || 'Brand'} Web Portal
                  </p>
                  <p className="text-[11px] text-cyan-300/80 mt-0.5">
                    File Request Online
                  </p>
                </div>
              </a>

              {/* Nearby Service Center Locator */}
              <a
                href={brandLinks.locatorUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400">
                    Service Center Map
                  </span>
                  <MapPin className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                </div>
                <div className="mt-2">
                  <p className="text-xs font-bold text-white truncate">
                    Find Authorized Centers
                  </p>
                  <p className="text-[11px] text-amber-300/80 mt-0.5">
                    Google Maps Locator
                  </p>
                </div>
              </a>
            </div>
          </div>

          {/* Defect Description Field */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Describe the Malfunction / Defect Observed:
            </label>
            <textarea
              rows={2}
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-amber-500 focus:outline-none"
              placeholder="e.g. Display screen flickering, battery drain, engine noise..."
            />
          </div>

          {/* Generated Email Draft Box */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                Pre-Filled Warranty Claim Letter Draft:
              </span>
              <button
                onClick={handleCopy}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied Draft!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Letter</span>
                  </>
                )}
              </button>
            </div>

            <pre className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed max-h-52 overflow-y-auto">
              {claimBody}
            </pre>
          </div>

          {/* Service Claim Checklist */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
            <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <CheckSquare className="w-4 h-4 text-emerald-400" />
              Warranty Claim Readiness Checklist:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400 pt-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Original Purchase Invoice (GSTIN Verified)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Product Serial / IMEI Tag Photo</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Short Video/Photo of Fault</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>ServiVault Digital Warranty Certificate</span>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer Controls */}
        <div className="p-5 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
          >
            Close
          </button>

          <button
            onClick={handleSendEmail}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            <span>Open Email Support Client</span>
          </button>
        </div>

      </div>
    </div>
  );
};
