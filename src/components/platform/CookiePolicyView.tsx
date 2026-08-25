import React from 'react';
import { Shield, Cookie, ArrowLeft } from 'lucide-react';

interface CookiePolicyViewProps {
  onGoBack?: () => void;
}

export const CookiePolicyView: React.FC<CookiePolicyViewProps> = ({ onGoBack }) => {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-12 animate-fade-in text-slate-300">
      {/* Header */}
      <div className="space-y-4 border-b border-white/10 pb-8">
        {onGoBack && (
          <button
            onClick={onGoBack}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-emerald-400 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
        )}

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-400 text-xs font-mono font-bold uppercase tracking-wider">
          <Cookie className="w-3.5 h-3.5" />
          <span>Storage &amp; Local Telemetry</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
          Cookie &amp; Local Storage Policy
        </h1>

        <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400">
          <span>Effective Date: August 25, 2026</span>
          <span>•</span>
          <span>Last Updated: August 2026</span>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed max-w-2xl">
          Asset Doctor uses minimal browser storage and essential cookies strictly to provide core features such as guest calculation persistence and secure account sessions.
        </p>
      </div>

      <div className="space-y-8 text-sm leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">1. What Are Cookies and Local Storage?</h2>
          <p>
            Cookies and browser LocalStorage are small text files or key-value entries stored on your device by your web browser. They allow websites to remember your actions and preferences over time so you don't have to re-enter calculations each time you navigate between pages.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">2. How We Use Browser Storage</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 space-y-1.5">
              <h3 className="font-bold text-white text-xs">Essential Authentication</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Secure JWT tokens to keep you logged in to your private asset vault across page reloads.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 space-y-1.5">
              <h3 className="font-bold text-white text-xs">Guest Calculation History</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Temporary local storage of your tool calculations so you can review or migrate them to an account later.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 space-y-1.5">
              <h3 className="font-bold text-white text-xs">UI Preferences</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Storing theme settings, collapsed sidebar states, and active calculation currency options.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 space-y-1.5">
              <h3 className="font-bold text-white text-xs">Anonymized Telemetry</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Google Analytics 4 cookies with automated client-side PII scrubbing to gauge general tool usage.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">3. Zero Third-Party Advertising Trackers</h2>
          <p>
            Asset Doctor does <strong>NOT</strong> embed third-party advertising tracking networks, behavioral retargeting scripts, or cross-app surveillance trackers.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">4. Controlling Browser Storage</h2>
          <p>
            You can clear your browser's local storage and cookies at any time through your browser settings. Please note that clearing local storage will purge unmigrated guest calculations and log you out of active vault sessions.
          </p>
        </section>

        <section className="space-y-3 p-5 rounded-2xl bg-slate-900/60 border border-white/10">
          <h2 className="text-lg font-bold text-white">5. Contact Information</h2>
          <p className="text-xs text-slate-300">
            For questions regarding our storage practices, contact <a href="mailto:support@assetdoctor.in" className="text-emerald-400 font-mono font-bold hover:underline">support@assetdoctor.in</a>.
          </p>
        </section>
      </div>
    </div>
  );
};
