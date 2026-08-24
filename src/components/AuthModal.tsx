import React, { useState } from 'react';
import { signInWithPopup, signInWithPhoneNumber, type ConfirmationResult } from 'firebase/auth';
import { auth, googleProvider, setupRecaptcha } from '../firebase';
import { ShieldCheck, Phone, Mail, ArrowRight, CheckCircle2, X } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: any) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [authMode, setAuthMode] = useState<'selection' | 'phone'>('selection');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  // 1. Google Sign-In
  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError('');
      const result = await signInWithPopup(auth, googleProvider);
      onSuccess(result.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'गूगल लॉगिन में समस्या आई');
    } finally {
      setLoading(false);
    }
  };

  // 2. Send Mobile OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber || phoneNumber.length < 10) {
      setError('कृपया सही 10 अंकों का मोबाइल नंबर दर्ज करें');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const formattedPhone = phoneNumber.startsWith('+91') ? phoneNumber : `+91${phoneNumber}`;
      const recaptchaVerifier = setupRecaptcha('recaptcha-container');
      
      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, recaptchaVerifier);
      setConfirmationResult(confirmation);
    } catch (err: any) {
      setError(err.message || 'OTP भेजने में विफलता हुई');
    } finally {
      setLoading(false);
    }
  };

  // 3. Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || !confirmationResult) return;

    try {
      setLoading(true);
      setError('');
      const result = await confirmationResult.confirm(otp);
      onSuccess(result.user);
      onClose();
    } catch (err: any) {
      setError('गलत OTP! कृपया पुनः प्रयास करें।');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div id="recaptcha-container"></div>
      
      <div className="relative bg-white dark:bg-gray-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-800 animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/40 rounded-2xl flex items-center justify-center mx-auto mb-3 text-blue-600 dark:text-blue-400">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">AssetDoctor में लॉगिन करें</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            अपने एसेट्स और बिल्स को क्लाउड में 100% सेफ रखें
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-xl text-xs text-center font-medium">
            {error}
          </div>
        )}

        {/* Selection View */}
        {authMode === 'selection' && (
          <div className="space-y-3">
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 font-semibold py-3.5 px-4 rounded-2xl transition duration-200 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Mail className="w-5 h-5 text-red-500" />
              <span>Google के साथ आगे बढ़ें</span>
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200 dark:border-gray-800"></div></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-white dark:bg-gray-900 px-3 text-gray-400">या फिर</span></div>
            </div>

            <button
              onClick={() => setAuthMode('phone')}
              className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 px-4 rounded-2xl transition duration-200 shadow-lg shadow-blue-500/25 cursor-pointer"
            >
              <Phone className="w-5 h-5" />
              <span>मोबाइल नंबर (OTP) से लॉगिन करें</span>
            </button>
          </div>
        )}

        {/* Phone / OTP View */}
        {authMode === 'phone' && (
          <div>
            {!confirmationResult ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                    मोबाइल नंबर (10 अङ्क)
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium px-3 py-3 rounded-xl text-sm border border-gray-200 dark:border-gray-700">+91</span>
                    <input
                      type="tel"
                      placeholder="9876543210"
                      maxLength={10}
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'OTP भेजा जा रहा है...' : 'OTP प्राप्त करें'} <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                    6 अंकों का OTP दर्ज करें
                  </label>
                  <input
                    type="text"
                    placeholder="123456"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-full text-center tracking-widest text-xl font-bold bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl transition duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'सत्यापित हो रहा है...' : 'लॉगिन पूर्ण करें'} <CheckCircle2 className="w-5 h-5" />
                </button>
              </form>
            )}

            <button
              onClick={() => { setAuthMode('selection'); setConfirmationResult(null); }}
              className="mt-4 w-full text-center text-xs text-gray-500 hover:underline cursor-pointer"
            >
              ← वापस लॉगिन विकल्प पर जाएँ
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
