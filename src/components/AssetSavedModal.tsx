import React from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert, 
  ExternalLink, 
  PhoneCall, 
  X, 
  Sparkles,
  Calendar
} from 'lucide-react';

export interface SavedAssetDetails {
  id?: string;
  name: string;
  category: string;
  brand?: string;
  purchaseDate?: string;
  expiryDate?: string;
  insuranceExpiry?: string;
  pucExpiry?: string;
  supportNumber?: string;
  brandSupportNumber?: string;
  imageUrl?: string;
}

export type SavedAssetData = SavedAssetDetails;

interface AssetSavedModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: SavedAssetDetails | null;
  onRenewClick?: (asset: SavedAssetDetails, type: 'insurance' | 'puc' | 'warranty') => void;
}

export const AssetSavedModal: React.FC<AssetSavedModalProps> = ({
  isOpen,
  onClose,
  asset,
  onRenewClick
}) => {
  if (!isOpen || !asset) return null;

  // 1. डेट से दिन गिनने का लॉजिक (Expiry Helper)
  const getDaysRemaining = (targetDateStr?: string) => {
    if (!targetDateStr) return null;
    const targetDate = new Date(targetDateStr);
    const today = new Date();
    const diffTime = targetDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // 2. सब प्रकार की एक्सपायरी चेक करना
  const warrantyDays = getDaysRemaining(asset.expiryDate);
  const insuranceDays = getDaysRemaining(asset.insuranceExpiry);
  const pucDays = getDaysRemaining(asset.pucExpiry);

  // 3. सबसे अर्जेंट अलर्ट खोजना
  const getAlertBadge = () => {
    if (insuranceDays !== null && insuranceDays <= 30) {
      const isUrgent = insuranceDays <= 7;
      return {
        type: 'insurance' as const,
        title: isUrgent ? '🚨 इंश्योरेंस जल्द समाप्त हो रहा है!' : '⚠️ इंश्योरेंस रिन्यूअल निकट है',
        days: insuranceDays,
        bgColor: isUrgent ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400',
        badgeColor: isUrgent ? 'bg-red-600 text-white' : 'bg-amber-500 text-white',
        btnText: 'Insurance Renew करें'
      };
    }

    if (pucDays !== null && pucDays <= 15) {
      return {
        type: 'puc' as const,
        title: '🛑 PUC सर्टिफिकेट एक्सपायर होने वाला है',
        days: pucDays,
        bgColor: 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400',
        badgeColor: 'bg-red-600 text-white',
        btnText: 'PUC अपडेट / रिन्यू करें'
      };
    }

    if (warrantyDays !== null && warrantyDays <= 30) {
      return {
        type: 'warranty' as const,
        title: '⚡ वारंटी 30 दिन में समाप्त होगी',
        days: warrantyDays,
        bgColor: 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400',
        badgeColor: 'bg-amber-500 text-white',
        btnText: 'Extended Warranty लें'
      };
    }

    return null;
  };

  const alert = getAlertBadge();
  const phone = asset.brandSupportNumber || asset.supportNumber;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-800 relative">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-9 h-9 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full flex items-center justify-center transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Top Celebration Header */}
        <div className="bg-gradient-to-br from-emerald-500 via-teal-600 to-blue-600 p-6 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 opacity-10 translate-x-4 -translate-y-4">
            <Sparkles className="w-32 h-32" />
          </div>
          
          <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
            <CheckCircle2 className="w-10 h-10 text-white" />
          </div>
          
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-xs font-semibold tracking-wide uppercase mb-2">
            <Sparkles className="w-3.5 h-3.5" /> Asset Protected
          </span>
          <h2 className="text-2xl font-black">🎉 सुरक्षित हो गया!</h2>
          <p className="text-xs text-white/80 mt-1">
            आपका एसेट और बिल सफलतापूर्वक सेव कर लिया गया है।
          </p>
        </div>

        {/* Asset Details Card Content */}
        <div className="p-6 space-y-4">
          
          {/* Asset Info Summary */}
          <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-800">
            {asset.imageUrl ? (
              <img 
                src={asset.imageUrl} 
                alt={asset.name} 
                className="w-16 h-16 object-cover rounded-xl border border-gray-200 dark:border-gray-700" 
              />
            ) : (
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-bold text-xl rounded-xl flex items-center justify-center shrink-0">
                {asset.name.charAt(0).toUpperCase()}
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md">
                {asset.category}
              </span>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate mt-0.5">
                {asset.name}
              </h3>
              {asset.purchaseDate && (
                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                  <Calendar className="w-3.5 h-3.5" /> खरीदा: {asset.purchaseDate}
                </p>
              )}
            </div>
          </div>

          {/* NEAR-EXPIRY ALERT BADGE (अगर एक्सपायारी नियर है) */}
          {alert ? (
            <div className={`p-4 rounded-2xl border ${alert.bgColor} space-y-3`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 animate-bounce" />
                  <span className="font-bold text-sm">{alert.title}</span>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${alert.badgeColor}`}>
                  {alert.days < 0 ? 'Expired' : `${alert.days} दिन बाकी`}
                </span>
              </div>

              <p className="text-xs opacity-90">
                चालान या अतिरिक्त पेनल्टी से बचने के लिए समय रहते रिन्यूअल पूरा कर लें।
              </p>

              {/* Action Button for Renewal */}
              <button
                onClick={() => onRenewClick && onRenewClick(asset, alert.type)}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-md text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <span>{alert.btnText}</span>
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* ALL GOOD GREEN BADGE (जब सब सेफ है) */
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center gap-3 text-emerald-700 dark:text-emerald-400">
              <ShieldAlert className="w-5 h-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div className="text-xs">
                <p className="font-bold">सब कुछ सुरक्षित है! ✅</p>
                <p className="opacity-80">कोई भी निकटतम एक्सपायरी नहीं पाई गई।</p>
              </div>
            </div>
          )}

          {/* Helper Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            {phone && (
              <a
                href={`tel:${phone}`}
                className="flex items-center justify-center gap-2 py-2.5 px-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-semibold text-xs transition"
              >
                <PhoneCall className="w-4 h-4 text-emerald-500" />
                <span>कस्टमर केयर</span>
              </a>
            )}

            <button
              onClick={onClose}
              className={`py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition shadow-md cursor-pointer ${!phone ? 'col-span-2' : ''}`}
            >
              ठीक है (Dashboard)
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
