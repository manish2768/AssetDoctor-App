import React, { useState } from 'react';
import { Wrench, Calendar, Clock, AlertTriangle, CheckCircle2, ArrowRight, Shield, Car, Droplets } from 'lucide-react';

interface ServiceDueCalculatorToolProps {
  onSaveToVault?: () => void;
  onDownloadApp?: () => void;
}

export const ServiceDueCalculatorTool: React.FC<ServiceDueCalculatorToolProps> = ({
  onSaveToVault,
  onDownloadApp
}) => {
  const [assetType, setAssetType] = useState<'vehicle' | 'appliance'>('vehicle');
  const [lastServiceDate, setLastServiceDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 4);
    return d.toISOString().split('T')[0];
  });
  const [intervalMonths, setIntervalMonths] = useState<number>(6);
  const [currentOdometer, setCurrentOdometer] = useState<number>(24500);
  const [serviceIntervalKm, setServiceIntervalKm] = useState<number>(10000);
  const [dailyKmUsage, setDailyKmUsage] = useState<number>(25);

  // Compute Service Due
  const computeServiceDue = () => {
    if (!lastServiceDate) return null;
    const lastDate = new Date(lastServiceDate);
    if (isNaN(lastDate.getTime())) return null;

    // Calendar Due Date
    const calendarDueDate = new Date(lastDate);
    calendarDueDate.setMonth(calendarDueDate.getMonth() + Number(intervalMonths));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffDaysCalendar = Math.ceil((calendarDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    let finalDueDate = calendarDueDate;
    let daysRemaining = diffDaysCalendar;
    let limitingFactor: 'calendar' | 'mileage' = 'calendar';
    let kmRemaining = 0;

    if (assetType === 'vehicle' && serviceIntervalKm > 0 && dailyKmUsage > 0) {
      // Mileage Due calculation
      const lastServiceKm = Math.max(0, currentOdometer - (dailyKmUsage * Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))));
      const nextDueKm = lastServiceKm + serviceIntervalKm;
      kmRemaining = Math.max(0, nextDueKm - currentOdometer);
      const daysUntilKmDue = Math.ceil(kmRemaining / dailyKmUsage);

      // Whichever comes first principle
      if (daysUntilKmDue < diffDaysCalendar) {
        daysRemaining = daysUntilKmDue;
        limitingFactor = 'mileage';
        finalDueDate = new Date(today.getTime() + daysUntilKmDue * 24 * 60 * 60 * 1000);
      }
    }

    let status: 'normal' | 'due_soon' | 'overdue' = 'normal';
    if (daysRemaining < 0) {
      status = 'overdue';
    } else if (daysRemaining <= 15) {
      status = 'due_soon';
    }

    return {
      finalDueDateFormatted: finalDueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      daysRemaining,
      status,
      limitingFactor,
      kmRemaining
    };
  };

  const results = computeServiceDue();

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-400 text-xs font-black uppercase tracking-wider font-mono">
          <Wrench className="w-4 h-4" />
          <span>Predictive Upkeep Calculator</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Service Due Calculator
        </h1>
        <p className="text-slate-300 text-sm sm:text-base max-w-2xl mx-auto">
          Calculate the exact date and remaining days/KM for your car, bike, RO water purifier, or AC periodic service using the standard whichever-comes-first engineering rule.
        </p>
      </div>

      {/* Main Interactive Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm">
        {/* Left Inputs Column */}
        <div className="lg:col-span-6 space-y-5">
          <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Calendar className="w-4 h-4 text-teal-400" />
            <span>Service History & Usage</span>
          </h2>

          {/* Asset Type Selector */}
          <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => setAssetType('vehicle')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer ${
                assetType === 'vehicle' ? 'bg-teal-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Car className="w-4 h-4" />
              <span>Vehicle (Car / Bike)</span>
            </button>
            <button
              type="button"
              onClick={() => setAssetType('appliance')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer ${
                assetType === 'appliance' ? 'bg-teal-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Droplets className="w-4 h-4" />
              <span>Appliance (AC / RO / Filter)</span>
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Last Service Date</label>
            <input
              type="date"
              value={lastServiceDate}
              onChange={(e) => setLastServiceDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-teal-500 transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Recommended Calendar Interval</label>
            <div className="grid grid-cols-4 gap-2">
              {[3, 6, 12, 24].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setIntervalMonths(m)}
                  className={`py-2 rounded-xl text-xs font-bold transition border ${
                    intervalMonths === m
                      ? 'bg-teal-500 text-slate-950 border-teal-400 font-black'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {m} Months
                </button>
              ))}
            </div>
          </div>

          {assetType === 'vehicle' && (
            <div className="space-y-4 pt-2 border-t border-slate-800/80">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Current Odometer (KM)</label>
                  <input
                    type="number"
                    value={currentOdometer}
                    onChange={(e) => setCurrentOdometer(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-teal-500 transition"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Service Interval (KM)</label>
                  <select
                    value={serviceIntervalKm}
                    onChange={(e) => setServiceIntervalKm(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-teal-500 transition cursor-pointer"
                  >
                    <option value={3000}>3,000 KM (Scooters)</option>
                    <option value={6000}>6,000 KM (Bikes/Enfield)</option>
                    <option value={10000}>10,000 KM (Standard Cars)</option>
                    <option value={15000}>15,000 KM (Diesel/Euro)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-bold text-slate-300">Daily Average Running: <span className="text-teal-400">{dailyKmUsage} KM/day</span></label>
                </div>
                <input
                  type="range"
                  min="5"
                  max="120"
                  step="5"
                  value={dailyKmUsage}
                  onChange={(e) => setDailyKmUsage(Number(e.target.value))}
                  className="w-full accent-teal-500 cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Outputs Column */}
        <div className="lg:col-span-6 flex flex-col justify-between space-y-6 bg-slate-950/80 border border-slate-800/80 rounded-2xl p-6">
          {results ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Service Urgency Status</span>
                {results.status === 'normal' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Up to Date</span>
                  </span>
                )}
                {results.status === 'due_soon' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold animate-pulse">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Service Due Soon</span>
                  </span>
                )}
                {results.status === 'overdue' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Maintenance Overdue</span>
                  </span>
                )}
              </div>

              {/* Big Days Remaining Display */}
              <div className="text-center py-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                <span className="text-xs text-slate-400 font-medium">
                  {results.status === 'overdue' ? 'Days Overdue' : 'Days Until Next Service'}
                </span>
                <div className={`text-4xl sm:text-5xl font-black font-mono tracking-tight ${
                  results.status === 'overdue' ? 'text-rose-400' : results.status === 'due_soon' ? 'text-amber-400' : 'text-teal-400'
                }`}>
                  {results.status === 'overdue' ? Math.abs(results.daysRemaining) : results.daysRemaining}
                </div>
                <span className="text-xs text-slate-400">
                  Estimated Due Date: <strong className="text-white font-bold">{results.finalDueDateFormatted}</strong>
                </span>
              </div>

              {/* Details Breakdown */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-slate-400 font-medium block">Governing Factor</span>
                  <span className="text-white font-bold text-sm block">
                    {results.limitingFactor === 'mileage' ? 'Odometer KM Limit' : 'Elapsed Calendar Days'}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-slate-400 font-medium block">Remaining Distance</span>
                  <span className="text-white font-bold text-sm block font-mono">
                    {assetType === 'vehicle' ? `~${results.kmRemaining.toLocaleString('en-IN')} KM` : 'N/A (Time Based)'}
                  </span>
                </div>
              </div>

              {/* Checklist Recommendation */}
              <div className="p-3.5 rounded-xl bg-teal-500/5 border border-teal-500/20 text-xs text-slate-300 space-y-1">
                <div className="font-bold text-teal-400 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Key Maintenance Checkpoints:</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  {assetType === 'vehicle'
                    ? 'Drain & replace engine oil + oil filter. Inspect brake pads, tyre air pressure, coolant levels, and chain/belt tension.'
                    : 'Clean primary dust filters, check drainage pipes for blockages, and test electrical grounding to prevent power surge damage.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500">
              Please provide service history details to calculate.
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row gap-3">
            {onSaveToVault && (
              <button
                onClick={onSaveToVault}
                className="flex-1 px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <span>Save to Asset Vault</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            {onDownloadApp && (
              <button
                onClick={onDownloadApp}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-semibold text-xs transition cursor-pointer"
              >
                Get Mobile App
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
