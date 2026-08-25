import React, { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Plus,
  ArrowRight,
  Sparkles,
  Info,
  HelpCircle
} from 'lucide-react';
import { NumericInput } from '../../common/NumericInput';

interface AssetHealthScoreToolProps {
  onSaveToVault?: () => void;
}

export const AssetHealthScoreTool: React.FC<AssetHealthScoreToolProps> = ({ onSaveToVault }) => {
  const [category, setCategory] = useState<'VEHICLE' | 'ELECTRONICS' | 'APPLIANCE' | 'HOUSEHOLD'>('VEHICLE');
  const [ageYears, setAgeYears] = useState<number | null>(2.5);
  const [maintenanceHistory, setMaintenanceHistory] = useState<'ON_TIME' | 'DELAYED' | 'MISSED'>('ON_TIME');
  const [warrantyStatus, setWarrantyStatus] = useState<'ACTIVE' | 'EXPIRED' | 'EXTENDED'>('ACTIVE');
  const [condition, setCondition] = useState<'FLAWLESS' | 'MINOR_WEAR' | 'MODERATE_ISSUES' | 'CRITICAL_FAILURE'>('FLAWLESS');
  const [repairCount, setRepairCount] = useState<number | null>(0);
  const [docsAvailable, setDocsAvailable] = useState<'FULL_DOCS' | 'BILL_ONLY' | 'NO_RECORDS'>('FULL_DOCS');

  // Transparent Point Weights: Total 100 Points
  // 1. Age Factor: Max 20 pts
  const safeAge = ageYears ?? 0;
  const maxCategoryLife = category === 'ELECTRONICS' ? 5 : category === 'APPLIANCE' ? 9 : 12;
  const lifeUsedRatio = Math.min(1, safeAge / maxCategoryLife);
  const agePoints = Math.round(20 * (1 - lifeUsedRatio * 0.7)); // 6 to 20 pts

  // 2. Maintenance Compliance: Max 25 pts
  const maintPoints = maintenanceHistory === 'ON_TIME' ? 25 : maintenanceHistory === 'DELAYED' ? 14 : 5;

  // 3. Warranty Status: Max 20 pts
  const warrantyPoints = warrantyStatus === 'ACTIVE' || warrantyStatus === 'EXTENDED' ? 20 : 8;

  // 4. Operational Condition: Max 15 pts
  const conditionPoints = condition === 'FLAWLESS' ? 15 : condition === 'MINOR_WEAR' ? 10 : condition === 'MODERATE_ISSUES' ? 5 : 0;

  // 5. Repair History: Max 10 pts
  const safeRepairs = repairCount ?? 0;
  const repairPoints = safeRepairs === 0 ? 10 : safeRepairs <= 2 ? 6 : 2;

  // 6. Documentation: Max 10 pts
  const docPoints = docsAvailable === 'FULL_DOCS' ? 10 : docsAvailable === 'BILL_ONLY' ? 6 : 2;

  const totalScore = Math.max(10, Math.min(100, agePoints + maintPoints + warrantyPoints + conditionPoints + repairPoints + docPoints));

  let status = 'OPTIMAL';
  let statusColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
  if (totalScore < 50) {
    status = 'CRITICAL ATTENTION';
    statusColor = 'text-rose-400 bg-rose-500/10 border-rose-500/30';
  } else if (totalScore < 75) {
    status = 'ATTENTION REQUIRED';
    statusColor = 'text-amber-400 bg-amber-500/10 border-amber-500/30';
  } else if (totalScore < 90) {
    status = 'GOOD HEALTH';
    statusColor = 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
  }

  // Generate Top 3 Actions
  const topActions: string[] = [];
  if (docsAvailable !== 'FULL_DOCS') {
    topActions.push('Vault purchase bill, warranty card, and recent service invoices to establish provenance.');
  }
  if (maintenanceHistory !== 'ON_TIME') {
    topActions.push('Schedule overdue periodic preventive service and fluid/filter inspection.');
  }
  if (warrantyStatus === 'EXPIRED') {
    topActions.push('Review extended warranty or AMC plans to cap unpredictable out-of-pocket repair costs.');
  }
  if (condition !== 'FLAWLESS') {
    topActions.push('Get an authorized diagnostic evaluation on lingering operational faults.');
  }
  if (topActions.length < 3) {
    topActions.push('Log ongoing service milestones to maintain 100% health score and resale value.');
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-400 text-xs font-black uppercase tracking-wider font-mono">
          <Activity className="w-3.5 h-3.5" />
          <span>Transparent 100-Point Audit</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          See How Healthy Your Asset Is
        </h2>
        <p className="text-xs sm:text-sm text-slate-400">
          Transparent multi-dimensional scoring factoring age, service compliance, warranty coverage, and document readiness.
        </p>
      </div>

      {/* Main Grid */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 sm:p-8 space-y-6 shadow-2xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Inputs Form */}
          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4 text-xs">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">Health Input Factors</span>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Asset Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 font-bold text-white focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="VEHICLE">Automotive (Car, Bike, Scooter)</option>
                  <option value="ELECTRONICS">Smartphones & Computers</option>
                  <option value="APPLIANCE">Home Appliances (AC, Washing Machine)</option>
                  <option value="HOUSEHOLD">Household & Living (Solar, Furniture)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Asset Age (Years)</label>
                  <NumericInput
                    value={ageYears}
                    onChange={setAgeYears}
                    placeholder="e.g. 2.5"
                    min={0}
                    max={50}
                    allowDecimal={true}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 font-mono font-bold text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Prior Repairs</label>
                  <NumericInput
                    value={repairCount}
                    onChange={setRepairCount}
                    placeholder="0"
                    min={0}
                    allowDecimal={false}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 font-mono font-bold text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Maintenance History</label>
                <select
                  value={maintenanceHistory}
                  onChange={(e) => setMaintenanceHistory(e.target.value as any)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 font-bold text-white focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="ON_TIME">Always On-Time (100% Scheduled Upkeep)</option>
                  <option value="DELAYED">Delayed Service (1-3 Months Late)</option>
                  <option value="MISSED">Irregular / Missed Services</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Warranty Status</label>
                  <select
                    value={warrantyStatus}
                    onChange={(e) => setWarrantyStatus(e.target.value as any)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 font-bold text-white focus:outline-none focus:border-teal-500 cursor-pointer"
                  >
                    <option value="ACTIVE">Active Standard Warranty</option>
                    <option value="EXTENDED">Extended AMC Plan</option>
                    <option value="EXPIRED">Expired Warranty</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Current Condition</label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value as any)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 font-bold text-white focus:outline-none focus:border-teal-500 cursor-pointer"
                  >
                    <option value="FLAWLESS">Flawless Operation</option>
                    <option value="MINOR_WEAR">Minor Wear & Tear</option>
                    <option value="MODERATE_ISSUES">Intermittent Glitches</option>
                    <option value="CRITICAL_FAILURE">Severe Fault Detected</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Document Readiness</label>
                <select
                  value={docsAvailable}
                  onChange={(e) => setDocsAvailable(e.target.value as any)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 font-bold text-white focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="FULL_DOCS">Full Digital Vault (Bill + Warranty + Service Invoices)</option>
                  <option value="BILL_ONLY">Purchase Invoice Only</option>
                  <option value="NO_RECORDS">No Physical / Digital Records</option>
                </select>
              </div>
            </div>
          </div>

          {/* Results Score & Action Plan */}
          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Health Status</span>
              <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border font-mono ${statusColor}`}>
                {status}
              </span>
            </div>

            {/* Big Score Display */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Overall Asset Health Score</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-4xl font-black text-white font-mono">{totalScore}</span>
                  <span className="text-lg text-slate-500 font-bold font-mono">/ 100</span>
                </div>
              </div>
              <div className="text-right text-[11px] font-mono text-slate-400 space-y-0.5">
                <div>Age: {agePoints}/20 pts</div>
                <div>Maintenance: {maintPoints}/25 pts</div>
                <div>Warranty: {warrantyPoints}/20 pts</div>
                <div>Condition: {conditionPoints}/15 pts</div>
              </div>
            </div>

            {/* Top 3 Actions */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold text-teal-400 tracking-wider block">
                Your Top 3 Recommended Actions
              </span>
              <div className="space-y-1.5 text-xs text-slate-300">
                {topActions.slice(0, 3).map((action, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-teal-500/20 text-teal-300 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="leading-relaxed">{action}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[10px] text-slate-500 italic pt-2 border-t border-slate-800">
              * Score is computed deterministically using standard reliability engineering models and does not represent an on-site physical appraisal.
            </p>
          </div>
        </div>

        {/* App Conversion CTA */}
        <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-black text-white">Save This Score & Receive Health Alerts</h4>
            <p className="text-xs text-slate-400">Asset Doctor tracks health degradation in real time as your asset ages.</p>
          </div>
          <button
            onClick={onSaveToVault}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Save to Asset Doctor Vault</span>
          </button>
        </div>
      </div>
    </div>
  );
};
