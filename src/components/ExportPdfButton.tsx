import React, { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';

export interface ExportAssetItem {
  name: string;
  category: string;
  purchaseDate?: string;
  expiryDate?: string;
  price?: number;
  [key: string]: any;
}

interface ExportPdfButtonProps {
  assets: ExportAssetItem[];
  userName?: string;
}

export const ExportPdfButton: React.FC<ExportPdfButtonProps> = ({ assets, userName = "Valued User" }) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPDF = () => {
    setIsExporting(true);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      console.warn("Pop-up blocked by browser settings");
      setIsExporting(false);
      return;
    }

    // 📊 Cumulative Valuation (CumStore) की कैलकुलेशन
    const totalCumStoreValuation = assets.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
    const avgAssetValuation = assets.length > 0 ? Math.round(totalCumStoreValuation / assets.length) : 0;

    const currentDate = new Date().toLocaleDateString('hi-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>AssetDoctor - CumStore Vault Summary Report</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; color: #1e293b; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0284c7; padding-bottom: 15px; margin-bottom: 25px; }
            .logo { font-size: 24px; font-weight: bold; color: #0284c7; }
            
            /* Summary Grid */
            .summary-box { display: flex; gap: 15px; background: #f8fafc; padding: 15px; border-radius: 12px; margin-bottom: 25px; border: 1px solid #e2e8f0; }
            .stat-card { flex: 1; background: #ffffff; padding: 12px 15px; border-radius: 8px; border: 1px solid #cbd5e1; }
            .stat-title { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold; }
            .stat-value { font-size: 18px; font-weight: bold; color: #0f172a; margin-top: 4px; }
            .highlight-val { color: #0284c7; }

            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background: #0f172a; color: white; text-align: left; padding: 10px; font-size: 12px; }
            td { padding: 12px 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
            tr:nth-child(even) { background: #f8fafc; }
            .badge { padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: bold; display: inline-block; }
            .badge-active { background: #dcfce7; color: #166534; }
            .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="logo">ASSET DOCTOR</div>
              <p style="font-size: 12px; color: #64748b; margin: 4px 0 0 0;">Smart Care & Warranty Vault Report</p>
            </div>
            <div style="text-align: right;">
              <p style="font-size: 12px; font-weight: bold; margin: 0;">यूज़र: ${userName}</p>
              <p style="font-size: 11px; color: #64748b; margin: 2px 0 0 0;">तारीख: ${currentDate}</p>
            </div>
          </div>

          <!-- 📊 CumStore Summary Blocks -->
          <div class="summary-box">
            <div class="stat-card">
              <div class="stat-title">कुल एसेट्स (Total Assets)</div>
              <div class="stat-value">${assets.length} Items</div>
            </div>
            <div class="stat-card">
              <div class="stat-title">CumStore वॉल्ट वैल्यू (Cum Valuation)</div>
              <div class="stat-value highlight-val">₹${totalCumStoreValuation.toLocaleString('en-IN')}</div>
            </div>
            <div class="stat-card">
              <div class="stat-title">औसत एसेट वैल्यू (Avg Asset Value)</div>
              <div class="stat-value">₹${avgAssetValuation.toLocaleString('en-IN')}</div>
            </div>
          </div>

          <h3>आपके पंजीकृत एसेट्स की सूची</h3>
          <table>
            <thead>
              <tr>
                <th>एसेट का नाम</th>
                <th>कैटेगरी</th>
                <th>खरीद तिथि</th>
                <th>वारंटी/इन्श्योरेंस समाप्ति</th>
                <th>मूल्य (Price)</th>
              </tr>
            </thead>
            <tbody>
              ${assets.map(item => `
                <tr>
                  <td><strong>${item.name}</strong></td>
                  <td>${item.category}</td>
                  <td>${item.purchaseDate || 'N/A'}</td>
                  <td><span class="badge badge-active">${item.expiryDate || 'N/A'}</span></td>
                  <td>₹${(Number(item.price) || 0).toLocaleString('en-IN')}</td>
                </tr>
              `).join('')}
            </tbody>
            <!-- Table Footer containing CumStore total -->
            <tfoot>
              <tr style="background: #f1f5f9; font-weight: bold;">
                <td colspan="4" style="text-align: right; font-size: 13px;">कुल संचयी मूल्य (CumStore Total):</td>
                <td style="color: #0284c7; font-size: 14px;">₹${totalCumStoreValuation.toLocaleString('en-IN')}</td>
              </tr>
            </tfoot>
          </table>

          <div class="footer">
            Generated via AssetDoctor App • Your Personal Asset & Warranty Assistant
          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setIsExporting(false);
  };

  return (
    <button
      onClick={handleExportPDF}
      disabled={isExporting || assets.length === 0}
      className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition shadow-md disabled:opacity-50 cursor-pointer"
    >
      {isExporting ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <FileText className="w-4 h-4" />
      )}
      <span>PDF रिपोर्ट डाउनलोड करें</span>
    </button>
  );
};
