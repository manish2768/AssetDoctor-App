import React from 'react';
import { ShieldCheck, Shield, AlertTriangle, Clock } from 'lucide-react';
import { BADGE_STATES } from '../../../trust/protectionStatus.js';

type BadgeState = { id?: string; label?: string } | null | undefined;

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  PROTECTED: ShieldCheck,
  ACTION_REQUIRED: AlertTriangle,
  EXPIRING: Clock,
  REVIEW_REQUIRED: AlertTriangle,
  INCOMPLETE: Shield,
};

const TONES: Record<string, string> = {
  PROTECTED: 'bg-[#07111F] text-emerald-400 border-emerald-500/40',
  ACTION_REQUIRED: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
  EXPIRING: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  REVIEW_REQUIRED: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  INCOMPLETE: 'bg-white/5 text-slate-400 border-white/10',
};

export function AssetDoctorProtectedBadge({
  state,
  compact = false,
  className = '',
}: {
  state?: BadgeState;
  compact?: boolean;
  className?: string;
}) {
  const id = state?.id && BADGE_STATES[state.id as keyof typeof BADGE_STATES] ? state.id : 'INCOMPLETE';
  const label =
    state?.label ||
    BADGE_STATES[id as keyof typeof BADGE_STATES]?.label ||
    BADGE_STATES.INCOMPLETE.label;
  const Icon = ICONS[id] || Shield;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-bold tracking-wide ${
        compact ? 'text-[10px]' : 'text-[11px]'
      } ${TONES[id] || TONES.INCOMPLETE} ${className}`}
    >
      <Icon className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      <span>{label}</span>
    </span>
  );
}

export default AssetDoctorProtectedBadge;
