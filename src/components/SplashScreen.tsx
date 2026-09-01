import React, { useEffect, useRef } from 'react';
import { AssetDoctorLogo } from './AssetDoctorLogo';
import { BRAND_WORDMARK } from '../theme/brandAssets';

interface SplashScreenProps {
  onFinish?: () => void;
  onComplete?: () => void;
  autoCloseTimeoutMs?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onFinish,
  onComplete,
  autoCloseTimeoutMs = 1400,
}) => {
  const finished = useRef(false);

  const handleFinish = () => {
    if (finished.current) return;
    finished.current = true;
    onFinish?.();
    onComplete?.();
  };

  useEffect(() => {
    const hold = Math.min(Math.max(Number(autoCloseTimeoutMs) || 1400, 600), 2200);
    const timer = setTimeout(handleFinish, hold);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCloseTimeoutMs]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#050A0F] text-white overflow-hidden">
      <div
        className="absolute w-56 h-56 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(20,184,166,0.18) 0%, transparent 68%)' }}
      />
      <div className="relative z-10 flex flex-col items-center animate-fade-in">
        <AssetDoctorLogo size="xl" />
        <p className="mt-5 text-[13px] font-extrabold tracking-[0.28em] uppercase">
          <span className="text-slate-50">{BRAND_WORDMARK.primary}</span>
          {' '}
          <span className="text-teal-400">{BRAND_WORDMARK.accent}</span>
        </p>
      </div>
    </div>
  );
};
