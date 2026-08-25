import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Lock,
  Mail,
  Phone,
  Send,
  ShieldCheck,
  CheckCircle2,
  KeyRound,
  ArrowRight,
  ExternalLink,
  Sparkles,
  Eye,
  EyeOff,
  AlertCircle,
  Database,
  Smartphone,
  Check,
  RefreshCw,
} from 'lucide-react';
import { AssetDoctorLogo } from './AssetDoctorLogo';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  userPhone: string;
  onLoginSuccess?: (email: string) => void;
  onOpenAuthModal?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  userEmail,
  userPhone,
  onLoginSuccess,
  onOpenAuthModal,
}) => {
  // Views: 'LOGIN' | 'FORGOT_PASSWORD' | 'NEW_PASSWORD' | 'SUCCESS'
  const [view, setView] = useState<'LOGIN' | 'FORGOT_PASSWORD' | 'NEW_PASSWORD' | 'SUCCESS'>('LOGIN');

  // Login Form state
  const [emailOrPhone, setEmailOrPhone] = useState(userEmail || 'manish2768@gmail.com');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Forgot Password state
  const [resetMethod, setResetMethod] = useState<'OTP' | 'EMAIL'>('OTP');
  const [resetTarget, setResetTarget] = useState(userPhone || '+91 98765 43210');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [emailLinkSent, setEmailLinkSent] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // New Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Error & Status
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setView('LOGIN');
      setEmailOrPhone(userEmail || 'manish2768@gmail.com');
      setLoginPassword('');
      setErrorMsg('');
      setSuccessMsg('');
      setOtpSent(false);
      setEmailLinkSent(false);
      setOtpDigits(['', '', '', '', '', '']);
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [isOpen, userEmail, userPhone]);

  if (!isOpen) return null;

  // Password validation checks
  const hasMinLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isNewPasswordValid = hasMinLength && hasUpper && hasLower && hasNumber && hasSpecial && passwordsMatch;

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginPassword) {
      setErrorMsg('Please enter your account password.');
      return;
    }

    setErrorMsg('');
    setIsLoggingIn(true);

    setTimeout(() => {
      setIsLoggingIn(false);
      if (onLoginSuccess) {
        onLoginSuccess(emailOrPhone);
      }
      onClose();
    }, 1000);
  };

  // Dispatch OTP
  const handleSendResetOtp = () => {
    if (!resetTarget) {
      setErrorMsg('Please enter a valid mobile phone number or email.');
      return;
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    setOtpSent(true);
    setErrorMsg('');
    setOtpDigits(['', '', '', '', '', '']);

    setTimeout(() => {
      otpInputRefs.current[0]?.focus();
    }, 150);
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      const pastedDigits = value.slice(0, 6).split('');
      const newDigits = [...otpDigits];
      pastedDigits.forEach((d, i) => {
        if (i < 6) newDigits[i] = d;
      });
      setOtpDigits(newDigits);
      const nextIdx = Math.min(pastedDigits.length, 5);
      otpInputRefs.current[nextIdx]?.focus();
      return;
    }

    const newDigits = [...otpDigits];
    newDigits[index] = value;
    setOtpDigits(newDigits);

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

  const handleVerifyOtpAndProceed = (e: React.FormEvent) => {
    e.preventDefault();
    const entered = otpDigits.join('');
    if (entered.length !== 6) {
      setErrorMsg('Please enter all 6 digits of the OTP.');
      return;
    }
    if (entered !== generatedOtp) {
      setErrorMsg('Invalid OTP code. Please check and try again.');
      return;
    }

    setErrorMsg('');
    setView('NEW_PASSWORD');
  };

  // Dispatch Reset Email Link
  const handleSendResetEmail = () => {
    if (!resetTarget || !resetTarget.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    const token = `rst-link-${Math.random().toString(36).substring(2, 10)}`;
    setResetToken(token);
    setEmailLinkSent(true);
    setErrorMsg('');
  };

  const handleSimulateClickEmailLink = () => {
    setErrorMsg('');
    setView('NEW_PASSWORD');
  };

  // Handle Save New Password
  const handleSaveNewPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isNewPasswordValid) {
      setErrorMsg('Password must satisfy all security requirements and confirmation must match.');
      return;
    }

    setErrorMsg('');
    setView('SUCCESS');

    setTimeout(() => {
      setSuccessMsg('Your password has been successfully reset!');
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div
        id="login-modal-container"
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <AssetDoctorLogo size="sm" />
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-1.5">
                {view === 'LOGIN' && 'Sign In to AssetDoctor'}
                {view === 'FORGOT_PASSWORD' && 'Password Recovery'}
                {view === 'NEW_PASSWORD' && 'Set New Password'}
                {view === 'SUCCESS' && 'Password Reset Complete'}
              </h2>
              <p className="text-xs text-slate-400">
                {view === 'LOGIN' && 'Access your warranty vault & service records'}
                {view === 'FORGOT_PASSWORD' && 'Reset using OTP or verification email'}
                {view === 'NEW_PASSWORD' && 'Create a strong, compliant password'}
                {view === 'SUCCESS' && 'Your credentials have been updated'}
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

          {/* Error Message Banner */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* VIEW 1: LOGIN FORM */}
          {view === 'LOGIN' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Email Address or Mobile Number:
                </label>
                <input
                  type="text"
                  required
                  value={emailOrPhone}
                  onChange={(e) => setEmailOrPhone(e.target.value)}
                  placeholder="name@example.com or +91 9876543210"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-white text-xs font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-300">
                    Account Password:
                  </label>
                  {/* PROMINENT FORGOT PASSWORD LINK */}
                  <button
                    type="button"
                    onClick={() => {
                      setView('FORGOT_PASSWORD');
                      setErrorMsg('');
                    }}
                    id="forgot-password-link"
                    className="text-xs font-bold text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <KeyRound className="w-3 h-3" />
                    <span>Forgot Password?</span>
                  </button>
                </div>

                <div className="relative flex items-center">
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-4 pr-10 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-white text-xs font-mono focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 text-slate-500 hover:text-slate-300"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {isLoggingIn ? (
                    <>
                      <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                      <span>Signing In...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Sign In to Vault</span>
                    </>
                  )}
                </button>
              </div>

              {onOpenAuthModal && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={onOpenAuthModal}
                    className="w-full py-2.5 px-4 rounded-2xl bg-slate-950 border border-blue-500/30 text-blue-400 font-bold text-xs hover:bg-blue-950/40 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Smartphone className="w-4 h-4 text-blue-400" />
                    <span>Login with Google / Mobile OTP (Firebase) &rarr;</span>
                  </button>
                </div>
              )}

              {/* Alternative Quick Forgot Password Trigger Box */}
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-1">
                <p className="text-[11px] text-slate-400">
                  Can't access your account password?
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setView('FORGOT_PASSWORD');
                    setErrorMsg('');
                  }}
                  className="text-xs font-bold text-teal-400 hover:underline cursor-pointer"
                >
                  Reset password via Mobile OTP or Verification Link &rarr;
                </button>
              </div>
            </form>
          )}

          {/* VIEW 2: FORGOT PASSWORD (OTP / EMAIL RESET CHOICE) */}
          {view === 'FORGOT_PASSWORD' && (
            <div className="space-y-4">
              {/* Method Selector Tabs */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-2xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setResetMethod('OTP');
                    setResetTarget(userPhone || '+91 98765 43210');
                    setErrorMsg('');
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    resetMethod === 'OTP'
                      ? 'bg-slate-800 text-teal-400 border border-teal-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>6-Digit OTP</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setResetMethod('EMAIL');
                    setResetTarget(userEmail || 'manish2768@gmail.com');
                    setErrorMsg('');
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    resetMethod === 'EMAIL'
                      ? 'bg-slate-800 text-cyan-400 border border-cyan-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email Reset Link</span>
                </button>
              </div>

              {/* METHOD 1: OTP RECOVERY */}
              {resetMethod === 'OTP' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Registered Mobile Phone Number:
                    </label>
                    <input
                      type="text"
                      value={resetTarget}
                      onChange={(e) => setResetTarget(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full px-4 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:border-teal-500 focus:outline-none"
                    />
                  </div>

                  {!otpSent ? (
                    <button
                      type="button"
                      onClick={handleSendResetOtp}
                      className="w-full py-2.5 px-4 rounded-2xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-teal-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Password Reset OTP</span>
                    </button>
                  ) : (
                    <form onSubmit={handleVerifyOtpAndProceed} className="space-y-3">
                      {/* Demo OTP Banner */}
                      <div className="p-3 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider block">
                            SMS OTP Generated
                          </span>
                          <span className="text-xs font-mono font-bold text-white tracking-widest">
                            {generatedOtp}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleQuickFillOtp}
                          className="px-2.5 py-1 rounded-lg bg-teal-500/20 text-teal-300 text-[10px] font-bold hover:bg-teal-500/30 border border-teal-500/30 transition-all cursor-pointer flex items-center gap-1"
                        >
                          <Sparkles className="w-3 h-3" />
                          Auto-Fill
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-300 text-center">
                          Enter 6-Digit Verification OTP Code:
                        </label>
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
                              className="w-10 h-11 text-center text-lg font-black font-mono rounded-xl bg-slate-950 border border-slate-800 text-teal-400 focus:border-teal-500 focus:outline-none"
                            />
                          ))}
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 px-4 rounded-2xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-teal-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Verify OTP & Set New Password</span>
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* METHOD 2: EMAIL RESET LINK */}
              {resetMethod === 'EMAIL' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Registered Account Email:
                    </label>
                    <input
                      type="email"
                      value={resetTarget}
                      onChange={(e) => setResetTarget(e.target.value)}
                      placeholder="user@example.com"
                      className="w-full px-4 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:border-cyan-500 focus:outline-none"
                    />
                  </div>

                  {!emailLinkSent ? (
                    <button
                      type="button"
                      onClick={handleSendResetEmail}
                      className="w-full py-2.5 px-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Email Verification Link</span>
                    </button>
                  ) : (
                    <div className="p-4 rounded-2xl bg-slate-950 border border-cyan-500/30 space-y-3">
                      <p className="text-xs text-slate-300">
                        Verification link dispatched to <strong className="text-white font-mono">{resetTarget}</strong>.
                      </p>

                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-2">
                        <span className="text-[10px] uppercase tracking-wider font-extrabold text-cyan-400 block">
                          Simulated Inbox Dispatch
                        </span>
                        <button
                          type="button"
                          onClick={handleSimulateClickEmailLink}
                          className="w-full py-2 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Click Reset Link ({resetToken.slice(0, 10)}...)</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => {
                    setView('LOGIN');
                    setErrorMsg('');
                  }}
                  className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
                >
                  &larr; Back to Login
                </button>
              </div>
            </div>
          )}

          {/* VIEW 3: SET NEW PASSWORD WITH VALIDATION */}
          {view === 'NEW_PASSWORD' && (
            <form onSubmit={handleSaveNewPassword} className="space-y-4">
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Verification confirmed. Create your new vault password below:</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  New Password:
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new strong password"
                    className="w-full pl-4 pr-10 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 text-slate-500 hover:text-slate-300"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Confirm New Password:
                </label>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Live Password Requirements Checklist */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1.5 text-[11px]">
                <span className="font-bold text-slate-400 block uppercase tracking-wider text-[10px]">
                  Password Security Requirements:
                </span>

                <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                  <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
                    <Check className="w-3 h-3" />
                    <span>8+ characters</span>
                  </div>

                  <div className={`flex items-center gap-1.5 ${hasUpper ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
                    <Check className="w-3 h-3" />
                    <span>Uppercase (A-Z)</span>
                  </div>

                  <div className={`flex items-center gap-1.5 ${hasLower ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
                    <Check className="w-3 h-3" />
                    <span>Lowercase (a-z)</span>
                  </div>

                  <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
                    <Check className="w-3 h-3" />
                    <span>Number (0-9)</span>
                  </div>

                  <div className={`flex items-center gap-1.5 ${hasSpecial ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
                    <Check className="w-3 h-3" />
                    <span>Special character (!@#)</span>
                  </div>

                  <div className={`flex items-center gap-1.5 ${passwordsMatch ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
                    <Check className="w-3 h-3" />
                    <span>Passwords match</span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={!isNewPasswordValid}
                className={`w-full py-3 px-4 rounded-2xl font-black text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  isNewPasswordValid
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-emerald-500/20 hover:scale-[1.01]'
                    : 'bg-slate-800 text-slate-500 opacity-60 cursor-not-allowed'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Save New Password</span>
              </button>
            </form>
          )}

          {/* VIEW 4: SUCCESS */}
          {view === 'SUCCESS' && (
            <div className="py-6 text-center space-y-4 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20">
                <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
              </div>

              <div>
                <h3 className="text-lg font-black text-white">
                  Password Reset Successful!
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Your new vault credentials are now active and synced across all sessions.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (onLoginSuccess) onLoginSuccess(userEmail);
                  onClose();
                }}
                className="w-full py-3 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
              >
                Done & Continue to Vault
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
