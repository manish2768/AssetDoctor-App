import React, { useState, useEffect } from 'react';
import { AssetDoctorLogo } from './AssetDoctorLogo';
import { Shield, Sparkles, CheckCircle2, Lock, ArrowRight, Activity, Wrench, FileText } from 'lucide-react';

interface SplashScreenProps {
  onFinish: () => void;
  autoCloseTimeoutMs?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onFinish,
  autoCloseTimeoutMs = 3200,
}) => {
  const [progress, setProgress] = useState(12);
  const [currentStatus, setCurrentStatus] = useState('Initializing AssetDoctor Vault Engine...');
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    const steps = [
      { pct: 30, text: 'Verifying Security Certificates & Warranty Logs...' },
      { pct: 60, text: 'Calculating Asset Depreciation & Service Health...' },
      { pct: 88, text: 'Encrypting Storage Keys & Database Sync...' },
      { pct: 100, text: 'AssetDoctor Ready! Opening Vault...' },
    ];

    let stepIdx = 0;
    const interval = setInterval(() => {
      if (stepIdx < steps.length) {
        setProgress(steps[stepIdx].pct);
        setCurrentStatus(steps[stepIdx].text);
        if (steps[stepIdx].pct === 100) {
          setIsCompleted(true);
        }
        stepIdx++;
      } else {
        clearInterval(interval);
      }
    }, autoCloseTimeoutMs / 4);

    return () => clearInterval(interval);
  }, [autoCloseTimeoutMs]);

  useEffect(() => {
    if (isCompleted) {
      const timer = setTimeout(() => {
        onFinish();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isCompleted, onFinish]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between p-6 sm:p-12 bg-gradient-to-b from-[#030a16] via-[#071426] to-[#020813] text-white animate-fade-in overflow-hidden">
      {/* Background Subtle Tech Grid & Radial Emerald Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.12)_0%,transparent_70%)] pointer-events-none" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-900/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Badge */}
      <div className="relative z-10 flex items-center justify-between w-full max-w-2xl pt-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
          <Lock className="w-3.5 h-3.5" />
          <span>AES-256 Encrypted Warranty Vault</span>
        </div>

        <button
          onClick={onFinish}
          className="px-3.5 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
        >
          <span>Skip Intro</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Center Splash Content */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-lg my-auto space-y-8">
        
        {/* Prominent AssetDoctor Logo (Shield with Green Care/Tech Plus Icon) */}
        <div className="relative transform hover:scale-105 transition-transform duration-500">
          <AssetDoctorLogo size="xl" />
        </div>

        {/* Brand Title & Tagline */}
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            Asset<span className="text-emerald-400">Doctor</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-300 font-medium max-w-sm mx-auto leading-relaxed">
            Smart Asset Protection, Servicing History & Warranty Health
          </p>
        </div>

        {/* Feature Pills */}
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <span className="px-3 py-1 rounded-xl bg-[#091b33] border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            Warranty Shield
          </span>
          <span className="px-3 py-1 rounded-xl bg-[#091b33] border border-emerald-500/30 text-teal-300 text-xs font-semibold flex items-center gap-1.5">
            <Wrench className="w-3.5 h-3.5 text-teal-400" />
            Service History
          </span>
          <span className="px-3 py-1 rounded-xl bg-[#091b33] border border-emerald-500/30 text-cyan-300 text-xs font-semibold flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            Resale Valuation
          </span>
        </div>

        {/* Progress Bar & Status Text */}
        <div className="w-full max-w-xs space-y-3 pt-4">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-slate-400 truncate max-w-[200px] text-left">{currentStatus}</span>
            <span className="text-emerald-400 font-black">{progress}%</span>
          </div>

          <div className="w-full h-2.5 rounded-full bg-[#081528] border border-slate-800 p-0.5 overflow-hidden">
            <div
              style={{ width: `${progress}%` }}
              className="h-full bg-gradient-to-r from-teal-500 via-emerald-400 to-cyan-400 rounded-full transition-all duration-300 ease-out shadow-lg shadow-emerald-500/50"
            />
          </div>
        </div>

        {/* Complete Action Button */}
        {isCompleted && (
          <button
            onClick={onFinish}
            className="mt-4 px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/30 hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-2 animate-bounce"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>Enter AssetDoctor Vault</span>
          </button>
        )}
      </div>

      {/* Footer Branding */}
      <div className="relative z-10 text-center pb-2">
        <p className="text-[11px] text-slate-500 font-mono flex items-center justify-center gap-2">
          <span>Dark Navy Blue & Emerald Green Care Theme</span>
          <span>•</span>
          <span className="text-emerald-400/80">ServiVault Verified v2.4</span>
        </p>
      </div>
    </div>
  );
};
