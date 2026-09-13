import React, { useState } from 'react';
import { Zap, IndianRupee, ArrowRight, Sparkles, AlertCircle, Info, Thermometer } from 'lucide-react';

interface AcElectricityCalculatorToolProps {
  onSaveToVault?: () => void;
  onDownloadApp?: () => void;
}

export const AcElectricityCalculatorTool: React.FC<AcElectricityCalculatorToolProps> = ({
  onSaveToVault,
  onDownloadApp
}) => {
  const [capacity, setCapacity] = useState<string>('1.5'); // Tons
  const [acType, setAcType] = useState<string>('5_star_inverter');
  const [hoursPerDay, setHoursPerDay] = useState<number>(8);
  const [daysPerMonth, setDaysPerMonth] = useState<number>(30);
  const [unitRate, setUnitRate] = useState<number>(8.5); // INR per kWh unit

  // Approximate power consumption in kW per capacity and star efficiency
  // Based on Indian BEE ISEER testing norms for inverter & non-inverter split ACs
  const calculatePower = () => {
    const capNum = parseFloat(capacity) || 1.5;

    // Baseline power draw in kW during continuous load
    let baseKw = capNum * 1.05; // ~1.5 kW for 1.5T non-inverter

    if (acType === '5_star_inverter') {
      baseKw = capNum * 0.58; // Inverter AC averages ~550W-900W once room cools
    } else if (acType === '4_star_inverter') {
      baseKw = capNum * 0.68;
    } else if (acType === '3_star_inverter') {
      baseKw = capNum * 0.76;
    } else if (acType === '3_star_fixed') {
      baseKw = capNum * 1.0;
    } else if (acType === 'non_inverter') {
      baseKw = capNum * 1.15;
    }

    const dailyUnits = Number((baseKw * hoursPerDay).toFixed(2));
    const monthlyUnits = Number((dailyUnits * daysPerMonth).toFixed(1));
    const yearlyUnits = Number((monthlyUnits * 8).toFixed(1)); // typical 8 cooling months in India

    const dailyCost = Math.round(dailyUnits * unitRate);
    const monthlyCost = Math.round(monthlyUnits * unitRate);
    const yearlyCost = Math.round(yearlyUnits * unitRate);

    // Potential savings if upgraded or operated at 24C with clean filters
    const potentialMonthlySavings = Math.round(monthlyCost * 0.24);

    return {
      dailyUnits,
      monthlyUnits,
      yearlyUnits,
      dailyCost,
      monthlyCost,
      yearlyCost,
      potentialMonthlySavings
    };
  };

  const results = calculatePower();

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-black uppercase tracking-wider font-mono">
          <Zap className="w-4 h-4" />
          <span>BEE Standards Based Free Calculator</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          AC Electricity Cost Calculator
        </h1>
        <p className="text-slate-300 text-sm sm:text-base max-w-2xl mx-auto">
          Estimate daily, monthly, and seasonal power consumption and electricity bills for your split or window AC. Discover how star rating and temperature settings affect your bill.
        </p>
      </div>

      {/* Main Interactive Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm">
        {/* Left Inputs Column */}
        <div className="lg:col-span-6 space-y-5">
          <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Thermometer className="w-4 h-4 text-amber-400" />
            <span>Select AC Specifications & Usage</span>
          </h2>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">AC Tonnage Capacity</label>
            <div className="grid grid-cols-4 gap-2">
              {['0.8', '1.0', '1.5', '2.0'].map((ton) => (
                <button
                  key={ton}
                  type="button"
                  onClick={() => setCapacity(ton)}
                  className={`py-2 rounded-xl text-xs font-bold transition border ${
                    capacity === ton
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {ton} Ton
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Star Rating & Technology</label>
            <select
              value={acType}
              onChange={(e) => setAcType(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-amber-500 transition cursor-pointer"
            >
              <option value="5_star_inverter">5 Star Inverter Split AC (Highest Efficiency)</option>
              <option value="4_star_inverter">4 Star Inverter Split AC</option>
              <option value="3_star_inverter">3 Star Inverter Split AC</option>
              <option value="3_star_fixed">3 Star Non-Inverter / Window AC</option>
              <option value="non_inverter">Old 1-2 Star / Non-Inverter AC</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <label className="font-bold text-slate-300">Daily Running Hours: <span className="text-amber-400">{hoursPerDay} hrs/day</span></label>
            </div>
            <input
              type="range"
              min="1"
              max="24"
              value={hoursPerDay}
              onChange={(e) => setHoursPerDay(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>1 hr (Night only)</span>
              <span>8 hrs (Sleep)</span>
              <span>16 hrs</span>
              <span>24 hrs</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Days Active per Month</label>
              <input
                type="number"
                min="1"
                max="31"
                value={daysPerMonth}
                onChange={(e) => setDaysPerMonth(Math.min(31, Math.max(1, Number(e.target.value))))}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-amber-500 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Electricity Rate (₹ / Unit)</label>
              <input
                type="number"
                step="0.5"
                min="3"
                max="20"
                value={unitRate}
                onChange={(e) => setUnitRate(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-amber-500 transition"
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] text-slate-400 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              Electricity rates in Indian cities generally vary between ₹6.50 to ₹9.50/unit (DISCOM slabs).
            </span>
          </div>
        </div>

        {/* Right Outputs Column */}
        <div className="lg:col-span-6 flex flex-col justify-between space-y-6 bg-slate-950/80 border border-slate-800/80 rounded-2xl p-6">
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estimated Power Consumption</span>
              <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold font-mono">
                {capacity} Ton • {hoursPerDay}h/day
              </span>
            </div>

            {/* Monthly Cost Hero Display */}
            <div className="text-center py-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-medium">Estimated Monthly AC Electricity Bill</span>
              <div className="text-4xl sm:text-5xl font-black text-amber-400 font-mono tracking-tight flex items-center justify-center gap-1">
                <span>₹</span>
                <span>{results.monthlyCost.toLocaleString('en-IN')}</span>
              </div>
              <span className="text-xs text-slate-400">
                (~{results.monthlyUnits} kWh Units per month)
              </span>
            </div>

            {/* Daily vs Yearly Breakdown */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-slate-400 font-medium block">Daily Cost (Est.)</span>
                <span className="text-white font-bold text-lg font-mono block">₹{results.dailyCost}</span>
                <span className="text-[11px] text-slate-500 block">{results.dailyUnits} Units/day</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-slate-400 font-medium block">Seasonal Cost (8 mos)</span>
                <span className="text-white font-bold text-lg font-mono block">₹{results.yearlyCost.toLocaleString('en-IN')}</span>
                <span className="text-[11px] text-slate-500 block">{results.yearlyUnits} Units/season</span>
              </div>
            </div>

            {/* Potential Savings Box */}
            <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs text-slate-300 space-y-1">
              <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Save Up To ₹{results.potentialMonthlySavings.toLocaleString('en-IN')}/Month:</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Setting AC to 24°C instead of 18°C saves ~6% electricity per degree, and cleaning mesh filters every 90 days restores up to 15% compressor efficiency.
              </p>
            </div>

            {/* Honest Disclaimer */}
            <div className="flex items-start gap-2 text-[10px] text-slate-500">
              <AlertCircle className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
              <span>
                Note: This calculation provides indicative estimates based on standard ambient test conditions. Actual electricity bills depend on room insulation, sun exposure, and state tariff slabs.
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row gap-3">
            {onSaveToVault && (
              <button
                onClick={onSaveToVault}
                className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
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
