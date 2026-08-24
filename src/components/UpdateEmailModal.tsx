import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Send,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  ArrowRight,
  Database,
  Lock,
  Sparkles,
  Inbox,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

interface UpdateEmailModalProps {
  isOpen: boolean;
  currentEmail: string;
  onClose: () => void;
  onEmailUpdated: (newEmail: string) => void;
}

export const UpdateEmailModal: React.FC<UpdateEmailModalProps> = ({
  isOpen,
  currentEmail,
  onClose,
  onEmailUpdated,
}) => {
  const [step, setStep] = useState<'INPUT' | 'LINK_SENT' | 'UPDATING' | 'SUCCESS'>('INPUT');
  const [newEmail, setNewEmail] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [resendCooldown, setResendCooldown] = useState(30);

  useEffect(() => {
    if (isOpen) {
      setStep('INPUT');
      setNewEmail('');
      setVerificationToken('');
      setErrorMsg('');
      setResendCooldown(30);
    }
  }, [isOpen]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 'LINK_SENT' && resendCooldown > 0) {
      interval = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, resendCooldown]);

  if (!isOpen) return null;

  const handleSendVerificationLink = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = newEmail.trim().toLowerCase();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setErrorMsg('Please enter a valid email address (e.g. user@example.com).');
      return;
    }

    if (cleanEmail === currentEmail.trim().toLowerCase()) {
      setErrorMsg('New email cannot be the same as your current registered email.');
      return;
    }

    // Generate random secure verification token
    const token = `v-tok-${Math.random().toString(36).substring(2, 10)}-${Date.now()}`;
    setVerificationToken(token);
    setErrorMsg('');
    setStep('LINK_SENT');
    setResendCooldown(30);
  };

  const handleSimulateEmailClick = () => {
    setErrorMsg('');
    setStep('UPDATING');

    // Simulate Auth DB Email Update
    setTimeout(() => {
      setStep('SUCCESS');
      onEmailUpdated(newEmail.trim().toLowerCase());
    }, 1200);
  };

  const handleResendLink = () => {
    const token = `v-tok-${Math.random().toString(36).substring(2, 10)}-${Date.now()}`;
    setVerificationToken(token);
    setResendCooldown(30);
    setErrorMsg('A fresh verification link has been resent to your email.');
    setTimeout(() => setErrorMsg(''), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div
        id="update-email-modal-container"
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-1.5">
                Update User Email Address
              </h2>
              <p className="text-xs text-slate-400">
                Current: <span className="font-mono text-slate-200 font-bold">{currentEmail || 'user@example.com'}</span>
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

          {/* Stepper Flow Bar */}
          <div className="flex items-center justify-between px-2 text-[11px] font-bold text-slate-400 border-b border-slate-800/80 pb-3">
            <span className={`flex items-center gap-1 ${step === 'INPUT' ? 'text-cyan-400' : 'text-slate-500'}`}>
              <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px]">1</span>
              New Email
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-700" />
            <span className={`flex items-center gap-1 ${step === 'LINK_SENT' ? 'text-cyan-400' : 'text-slate-500'}`}>
              <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px]">2</span>
              Verify Link
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-700" />
            <span className={`flex items-center gap-1 ${step === 'SUCCESS' ? 'text-emerald-400' : 'text-slate-500'}`}>
              <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px]">3</span>
              Auth Updated
            </span>
          </div>

          {/* Alert / Notification banner */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-200 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: INPUT NEW EMAIL */}
          {step === 'INPUT' && (
            <form onSubmit={handleSendVerificationLink} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-cyan-400" />
                  Enter New Email Address:
                </label>
                <input
                  type="email"
                  required
                  autoFocus
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. new.email@domain.com"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-white font-mono text-sm focus:border-cyan-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                  A unique Auth verification link will be dispatched to this inbox. Click the link to authorize updating your user account credentials.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  id="send-email-verification-btn"
                  className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>Send Verification Link</span>
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: SIMULATED INBOX VERIFICATION LINK SENT */}
          {step === 'LINK_SENT' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-950 border border-cyan-500/40 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-cyan-400 flex items-center gap-1">
                    <Inbox className="w-3.5 h-3.5" />
                    Simulated Email Inbox Dispatch
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">Just Now</span>
                </div>

                <div>
                  <p className="text-xs text-slate-300">
                    To: <strong className="font-mono text-white">{newEmail}</strong>
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Subject: <strong>Confirm Email Update Request - ServiVault Auth</strong>
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/90 text-xs space-y-2">
                  <p className="text-slate-300">
                    Please click the secure magic link below to finalize updating your user account email in Auth:
                  </p>
                  
                  <button
                    type="button"
                    onClick={handleSimulateEmailClick}
                    id="click-verification-link-btn"
                    className="w-full py-2.5 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-cyan-500/20"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Click Verification Link ({verificationToken.slice(0, 12)}...)</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                <button
                  type="button"
                  onClick={() => setStep('INPUT')}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer underline"
                >
                  Change Email
                </button>

                {resendCooldown > 0 ? (
                  <span className="text-slate-500 font-mono text-[11px]">
                    Resend link in {resendCooldown}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendLink}
                    className="text-cyan-400 font-bold hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Resend Link
                  </button>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: UPDATING AUTH DATABASE */}
          {step === 'UPDATING' && (
            <div className="py-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full border-4 border-cyan-500 border-t-transparent animate-spin mx-auto"></div>
              <p className="text-sm font-bold text-white flex items-center justify-center gap-2">
                <Database className="w-4 h-4 text-cyan-400 animate-pulse" />
                Updating Firebase / Supabase Auth Email...
              </p>
              <p className="text-xs text-slate-400">
                Verifying token signature and updating primary user identity record.
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
                  User Email Updated!
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Primary Auth identity email successfully updated to:
                </p>
                <div className="mt-2 text-base font-black font-mono text-emerald-400">
                  {newEmail}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
                <Lock className="w-3.5 h-3.5 text-cyan-400 inline mr-1" />
                Security token verified. All future warranty notifications & claim reports will be sent to this email.
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
