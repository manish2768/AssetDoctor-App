import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Phone,
  Send,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Database,
  Lock,
  ArrowRight,
  Smartphone,
  Sparkles,
} from 'lucide-react';

interface UpdatePhoneModalProps {
  isOpen: boolean;
  currentPhone: string;
  onClose: () => void;
  onPhoneUpdated: (newPhone: string) => void;
}

export const UpdatePhoneModal: React.FC<UpdatePhoneModalProps> = ({
  isOpen,
  currentPhone,
  onClose,
  onPhoneUpdated,
}) => {
  const [step, setStep] = useState<'INPUT' | 'OTP' | 'SAVING' | 'SUCCESS'>('INPUT');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [resendTimer, setResendTimer] = useState(30);
  const [errorMsg, setErrorMsg] = useState('');
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isOpen) {
      setStep('INPUT');
      setPhoneNumber('');
      setOtpDigits(['', '', '', '', '', '']);
      setErrorMsg('');
      setResendTimer(30);
    }
  }, [isOpen]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 'OTP' && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, resendTimer]);

  if (!isOpen) return null;

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNumber = phoneNumber.replace(/\D/g, '');

    if (cleanNumber.length < 10) {
      setErrorMsg('Please enter a valid 10-digit mobile phone number.');
      return;
    }

    // Generate random 6-digit OTP
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(newOtp);
    setErrorMsg('');
    setStep('OTP');
    setResendTimer(30);
    setOtpDigits(['', '', '', '', '', '']);

    // Focus first OTP input
    setTimeout(() => {
      otpInputRefs.current[0]?.focus();
    }, 150);
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const pastedDigits = value.slice(0, 6).split('');
      const newDigits = [...otpDigits];
      pastedDigits.forEach((digit, i) => {
        if (i < 6) newDigits[i] = digit;
      });
      setOtpDigits(newDigits);
      const nextIndex = Math.min(pastedDigits.length, 5);
      otpInputRefs.current[nextIndex]?.focus();
      return;
    }

    const newDigits = [...otpDigits];
    newDigits[index] = value;
    setOtpDigits(newDigits);

    // Auto focus next field
    if (value !== '' && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleQuickFillOtp = () => {
    if (generatedOtp) {
      setOtpDigits(generatedOtp.split(''));
    }
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    const enteredOtp = otpDigits.join('');

    if (enteredOtp.length !== 6) {
      setErrorMsg('Please enter all 6 digits of the OTP code.');
      return;
    }

    if (enteredOtp !== generatedOtp) {
      setErrorMsg('Invalid OTP code. Please check and try again.');
      return;
    }

    setErrorMsg('');
    setStep('SAVING');

    // Simulate database update
    setTimeout(() => {
      setStep('SUCCESS');
      const formattedPhone = `+91 ${phoneNumber.replace(/\D/g, '').replace(/(\d{5})(\d{5})/, '$1 $2')}`;
      onPhoneUpdated(formattedPhone);
    }, 1200);
  };

  const handleResendOtp = () => {
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(newOtp);
    setResendTimer(30);
    setErrorMsg('A new OTP has been sent to your mobile phone.');
    setTimeout(() => setErrorMsg(''), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div
        id="update-phone-modal-container"
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-500/20 border border-teal-500/30 text-teal-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-1.5">
                Update Mobile Phone Number
              </h2>
              <p className="text-xs text-slate-400">
                Current: <span className="font-mono text-slate-200 font-bold">{currentPhone || '+91 98765 43210'}</span>
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
        <div className="p-6 space-y-5">

          {/* Progress Flow Stepper */}
          <div className="flex items-center justify-between px-2 text-[11px] font-bold text-slate-400 border-b border-slate-800/80 pb-3">
            <span className={`flex items-center gap-1 ${step === 'INPUT' ? 'text-teal-400' : 'text-slate-500'}`}>
              <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px]">1</span>
              New Phone
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-700" />
            <span className={`flex items-center gap-1 ${step === 'OTP' ? 'text-teal-400' : 'text-slate-500'}`}>
              <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px]">2</span>
              Enter OTP
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-700" />
            <span className={`flex items-center gap-1 ${step === 'SUCCESS' ? 'text-emerald-400' : 'text-slate-500'}`}>
              <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px]">3</span>
              Database Updated
            </span>
          </div>

          {/* Error / Alert Message Box */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center justify-between gap-2">
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: INPUT PHONE NUMBER */}
          {step === 'INPUT' && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-teal-400" />
                  Enter New Mobile Phone Number:
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-xs font-mono font-bold text-slate-400 border-r border-slate-800 pr-2">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    autoFocus
                    maxLength={10}
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="98765 43210"
                    className="w-full pl-14 pr-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-white font-mono text-sm tracking-wider focus:border-teal-500 focus:outline-none"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  We will send a 6-digit OTP code to verify ownership before updating your account database record.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  id="send-otp-btn"
                  className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 font-bold text-xs shadow-lg shadow-teal-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>Send OTP to New Number</span>
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: ENTER OTP */}
          {step === 'OTP' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              {/* Simulated OTP Display Banner for Easy Testing */}
              <div className="p-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-teal-400 block">
                    SMS Dispatched
                  </span>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Demo Security OTP: <strong className="font-mono text-white text-sm tracking-widest">{generatedOtp}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleQuickFillOtp}
                  className="px-2.5 py-1 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 text-[10px] font-bold border border-teal-500/40 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3 text-teal-300" />
                  Auto-Fill OTP
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2 text-center">
                  Enter 6-Digit OTP Code Sent to +91 {phoneNumber}:
                </label>

                {/* 6-Digit Input Boxes */}
                <div className="flex items-center justify-center gap-2">
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        otpInputRefs.current[idx] = el;
                      }}
                      type="text"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      className="w-11 h-12 text-center text-lg font-black font-mono rounded-xl bg-slate-950 border border-slate-800 text-teal-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                <button
                  type="button"
                  onClick={() => setStep('INPUT')}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer underline"
                >
                  Change Number
                </button>

                {resendTimer > 0 ? (
                  <span className="text-slate-500 font-mono text-[11px]">
                    Resend code in {resendTimer}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    className="text-teal-400 font-bold hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Resend OTP
                  </button>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  id="verify-otp-btn"
                  className="w-full py-3 px-4 rounded-2xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-teal-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verify OTP & Update Phone</span>
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: SAVING / UPDATING DATABASE */}
          {step === 'SAVING' && (
            <div className="py-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full border-4 border-teal-500 border-t-transparent animate-spin mx-auto"></div>
              <p className="text-sm font-bold text-white flex items-center justify-center gap-2">
                <Database className="w-4 h-4 text-teal-400 animate-pulse" />
                Updating 'user_phone' field in database...
              </p>
              <p className="text-xs text-slate-400">
                Encrypting mobile number credentials and syncing user record.
              </p>
            </div>
          )}

          {/* STEP 4: SUCCESS */}
          {step === 'SUCCESS' && (
            <div className="py-6 text-center space-y-4 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20">
                <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
              </div>

              <div>
                <h3 className="text-lg font-black text-white">
                  Database Record Updated!
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Field <code className="text-teal-300 font-mono bg-slate-950 px-1.5 py-0.5 rounded">user_phone</code> has been successfully updated to:
                </p>
                <div className="mt-2 text-base font-black font-mono text-emerald-400">
                  +91 {phoneNumber.replace(/(\d{5})(\d{5})/, '$1 $2')}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
                <Lock className="w-3.5 h-3.5 text-teal-400 inline mr-1" />
                All SMS alerts and warranty claim dispatches will now be routed to this verified mobile contact.
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
