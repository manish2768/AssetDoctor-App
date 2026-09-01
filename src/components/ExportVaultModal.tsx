import React from 'react';
import { Download, FileSpreadsheet, FileText, FileCode, X, Shield, Sparkles, CheckCircle2 } from 'lucide-react';
import { Asset } from '../types';
import { formatINR } from '../utils/assetUtils';
import { ExportPdfButton } from './ExportPdfButton';

interface ExportVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: Asset[];
  totalValuation: number;
}

export const ExportVaultModal: React.FC<ExportVaultModalProps> = ({
  isOpen,
  onClose,
  assets,
  totalValuation,
}) => {
  if (!isOpen) return null;

  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Download CSV
  const handleExportCSV = () => {
    const headers = [
      'ID',
      'Asset Name',
      'Brand',
      'Category',
      'Price (INR)',
      'Purchase Date',
      'Warranty Expiry Date',
      'Days Remaining',
      'Warranty Status',
      'Vendor / Store',
      'Serial Number',
      'Notes',
    ];

    const rows = assets.map((a) => [
      a.id,
      `"${(a.name || '').replace(/"/g, '""')}"`,
      `"${(a.brand || '').replace(/"/g, '""')}"`,
      `"${(a.category || '').replace(/"/g, '""')}"`,
      a.price || 0,
      a.purchaseDate || '',
      a.expiryDate || '',
      a.daysRemaining ?? 0,
      a.status || 'active',
      `"${(a.vendor || '').replace(/"/g, '""')}"`,
      `"${(a.serialNumber || '').replace(/"/g, '""')}"`,
      `"${(a.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `AssetDoctor_Vault_Summary_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onClose();
  };

  // 2. Download Printable HTML Summary Report (PDF printable)
  const handleExportPrintableReport = () => {
    const reportHTML = `<!DOCTYPE html>
<html>
<head>
  <title>AssetDoctor - Vault Summary & Warranty Certificate Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0f172a; color: #e2e8f0; padding: 40px; margin: 0; }
    .container { max-width: 900px; margin: 0 auto; background: #1e293b; padding: 40px; border-radius: 20px; border: 1px solid #334155; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #334155; padding-bottom: 20px; margin-bottom: 30px; }
    .logo { font-size: 24px; font-weight: 900; color: #2dd4bf; text-transform: uppercase; letter-spacing: 1px; }
    .subtitle { font-size: 12px; color: #94a3b8; margin-top: 4px; }
    .badge { background: #0f766e; color: #ccfbf1; padding: 6px 14px; border-radius: 12px; font-size: 12px; font-weight: 700; }
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 30px; }
    .stat-card { background: #0f172a; padding: 16px; border-radius: 12px; border: 1px solid #334155; }
    .stat-label { font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 700; }
    .stat-val { font-size: 22px; font-weight: 900; color: #f8fafc; margin-top: 4px; font-family: monospace; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background: #0f172a; color: #94a3b8; text-align: left; padding: 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #334155; }
    td { padding: 12px; font-size: 12px; border-bottom: 1px solid #334155; color: #cbd5e1; }
    .status-active { color: #34d399; font-weight: 700; }
    .status-expiring { color: #fbbf24; font-weight: 700; }
    .status-expired { color: #f87171; font-weight: 700; }
    .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #334155; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <div class="logo">ASSET DOCTOR</div>
        <div class="subtitle">Official Vault Summary & Warranty Certificate Backup • Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
      </div>
      <div class="badge">ServiVault Verified</div>
    </div>

    <div class="summary-grid">
      <div class="stat-card">
        <div class="stat-label">Total Assets Managed</div>
        <div class="stat-val">${assets.length} Items</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Vault Valuation</div>
        <div class="stat-val" style="color: #34d399">${formatINR(totalValuation)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Expiring Soon (&le; 30d)</div>
        <div class="stat-val" style="color: #fbbf24">${assets.filter(a => a.status === 'expiring_soon').length} Items</div>
      </div>
    </div>

    <h3 style="font-size: 16px; margin-bottom: 10px; color: #f8fafc">Itemized Asset & Warranty Inventory</h3>
    <table>
      <thead>
        <tr>
          <th>Asset / Item</th>
          <th>Brand & Category</th>
          <th>Purchase Date</th>
          <th>Valuation</th>
          <th>Warranty Expiry</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${assets
          .map(
            (a) => `
          <tr>
            <td><strong>${a.name}</strong><br/><span style="font-size:10px; color:#64748b">SN: ${a.serialNumber || 'N/A'}</span></td>
            <td>${a.brand} • ${a.category}</td>
            <td>${a.purchaseDate}</td>
            <td style="font-family: monospace; font-weight:700">${formatINR(a.price)}</td>
            <td>${a.expiryDate}</td>
            <td class="${a.status === 'active' ? 'status-active' : a.status === 'expiring_soon' ? 'status-expiring' : 'status-expired'}">
              ${a.status === 'active' ? 'Protected' : a.status === 'expiring_soon' ? `Expiring (${a.daysRemaining}d)` : 'Expired'}
            </td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>

    <div class="footer">
      Generated automatically by AssetDoctor ServiVault Engine. Emergency Mechanic Hotline & Instant AI OCR Reader.
    </div>
  </div>
  <script>
    window.onload = function() { window.print(); }
  </script>
</body>
</html>`;

    const blob = new Blob([reportHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (!w) {
      // Fallback download if popup blocked
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `AssetDoctor_Vault_Report_${todayStr}.html`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    URL.revokeObjectURL(url);
    onClose();
  };

  // 3. Download JSON Backup
  const handleExportJSON = () => {
    const jsonStr = JSON.stringify(assets, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AssetDoctor_ServiVault_Backup_${todayStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400">
              <Download className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Export Vault Summary Report
              </h2>
              <p className="text-xs text-slate-400">
                Download verified inventory logs, warranty certificates, or backup files
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

        {/* Export Options */}
        <div className="py-6 space-y-3">
          
          {/* Option 1: CSV Spreadsheet */}
          <button
            onClick={handleExportCSV}
            className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 hover:bg-emerald-950/10 text-left transition-all group flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-110 transition-transform">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                  CSV Spreadsheet (.csv)
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Structured table format for Excel, Google Sheets, or tax filing
                </div>
              </div>
            </div>
            <Sparkles className="w-4 h-4 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>

          {/* Option 2: Printable PDF / HTML Summary Certificate */}
          <button
            onClick={handleExportPrintableReport}
            className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-cyan-500/50 hover:bg-cyan-950/10 text-left transition-all group flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 group-hover:scale-110 transition-transform">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                  Printable Summary Certificate (PDF)
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Formatted visual certificate report with total valuation & active status
                </div>
              </div>
            </div>
            <Sparkles className="w-4 h-4 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>

          {/* Option 3: Full JSON Backup */}
          <button
            onClick={handleExportJSON}
            className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-teal-500/50 hover:bg-teal-950/10 text-left transition-all group flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 group-hover:scale-110 transition-transform">
                <FileCode className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-white group-hover:text-teal-300 transition-colors">
                  Full State Backup (.json)
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Complete raw data dump for migration or full vault restoring
                </div>
              </div>
            </div>
            <CheckCircle2 className="w-4 h-4 text-teal-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>

        </div>

        {/* Modal Footer */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>Total Vault Value: <strong className="text-emerald-400 font-mono">{formatINR(totalValuation)}</strong></span>
          <div className="flex items-center gap-2">
            <ExportPdfButton assets={assets} />
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
