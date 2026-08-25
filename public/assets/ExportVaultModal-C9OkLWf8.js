import{$ as e,D as t,G as n,S as r,Y as i,_ as a,b as o,dt as s,lt as c,ut as l}from"./index-BDjBRVH3.js";var u=c(`file-code`,[[`path`,{d:`M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z`,key:`1oefj6`}],[`path`,{d:`M14 2v5a1 1 0 0 0 1 1h5`,key:`wfsgrz`}],[`path`,{d:`M10 12.5 8 15l2 2.5`,key:`1tg20x`}],[`path`,{d:`m14 12.5 2 2.5-2 2.5`,key:`yinavb`}]]),d=c(`file-spreadsheet`,[[`path`,{d:`M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z`,key:`1oefj6`}],[`path`,{d:`M14 2v5a1 1 0 0 0 1 1h5`,key:`wfsgrz`}],[`path`,{d:`M8 13h2`,key:`yr2amv`}],[`path`,{d:`M14 13h2`,key:`un5t4a`}],[`path`,{d:`M8 17h2`,key:`2yhykz`}],[`path`,{d:`M14 17h2`,key:`10kma7`}]]),f=c(`loader-circle`,[[`path`,{d:`M21 12a9 9 0 1 1-6.219-8.56`,key:`13zald`}]]),p=s(l()),m=o(),h=({assets:e,userName:t=`Valued User`})=>{let[r,i]=(0,p.useState)(!1);return(0,m.jsxs)(`button`,{onClick:()=>{i(!0);let n=window.open(``,`_blank`);if(!n){console.warn(`Pop-up blocked by browser settings`),i(!1);return}let r=e.reduce((e,t)=>e+(Number(t.price)||0),0),a=e.length>0?Math.round(r/e.length):0,o=`
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
              <div class="logo">🛡️ AssetDoctor</div>
              <p style="font-size: 12px; color: #64748b; margin: 4px 0 0 0;">Smart Care & Warranty Vault Report</p>
            </div>
            <div style="text-align: right;">
              <p style="font-size: 12px; font-weight: bold; margin: 0;">यूज़र: ${t}</p>
              <p style="font-size: 11px; color: #64748b; margin: 2px 0 0 0;">तारीख: ${new Date().toLocaleDateString(`hi-IN`,{day:`numeric`,month:`long`,year:`numeric`})}</p>
            </div>
          </div>

          <!-- 📊 CumStore Summary Blocks -->
          <div class="summary-box">
            <div class="stat-card">
              <div class="stat-title">कुल एसेट्स (Total Assets)</div>
              <div class="stat-value">${e.length} Items</div>
            </div>
            <div class="stat-card">
              <div class="stat-title">CumStore वॉल्ट वैल्यू (Cum Valuation)</div>
              <div class="stat-value highlight-val">₹${r.toLocaleString(`en-IN`)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-title">औसत एसेट वैल्यू (Avg Asset Value)</div>
              <div class="stat-value">₹${a.toLocaleString(`en-IN`)}</div>
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
              ${e.map(e=>`
                <tr>
                  <td><strong>${e.name}</strong></td>
                  <td>${e.category}</td>
                  <td>${e.purchaseDate||`N/A`}</td>
                  <td><span class="badge badge-active">${e.expiryDate||`N/A`}</span></td>
                  <td>₹${(Number(e.price)||0).toLocaleString(`en-IN`)}</td>
                </tr>
              `).join(``)}
            </tbody>
            <!-- Table Footer containing CumStore total -->
            <tfoot>
              <tr style="background: #f1f5f9; font-weight: bold;">
                <td colspan="4" style="text-align: right; font-size: 13px;">कुल संचयी मूल्य (CumStore Total):</td>
                <td style="color: #0284c7; font-size: 14px;">₹${r.toLocaleString(`en-IN`)}</td>
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
          <\/script>
        </body>
      </html>
    `;n.document.write(o),n.document.close(),i(!1)},disabled:r||e.length===0,className:`flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition shadow-md disabled:opacity-50 cursor-pointer`,children:[r?(0,m.jsx)(f,{className:`w-4 h-4 animate-spin`}):(0,m.jsx)(n,{className:`w-4 h-4`}),(0,m.jsx)(`span`,{children:`PDF रिपोर्ट डाउनलोड करें`})]})},g=({isOpen:o,onClose:s,assets:c,totalValuation:l})=>{if(!o)return null;let f=new Date().toISOString().split(`T`)[0];return(0,m.jsx)(`div`,{className:`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in`,children:(0,m.jsxs)(`div`,{className:`relative w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 overflow-hidden`,children:[(0,m.jsxs)(`div`,{className:`flex items-center justify-between pb-4 border-b border-slate-800`,children:[(0,m.jsxs)(`div`,{className:`flex items-center gap-3`,children:[(0,m.jsx)(`div`,{className:`p-3 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400`,children:(0,m.jsx)(i,{className:`w-5 h-5 animate-bounce`})}),(0,m.jsxs)(`div`,{children:[(0,m.jsx)(`h2`,{className:`text-lg font-bold text-white tracking-tight`,children:`Export Vault Summary Report`}),(0,m.jsx)(`p`,{className:`text-xs text-slate-400`,children:`Download verified inventory logs, warranty certificates, or backup files`})]})]}),(0,m.jsx)(`button`,{onClick:s,className:`p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer`,children:(0,m.jsx)(r,{className:`w-5 h-5`})})]}),(0,m.jsxs)(`div`,{className:`py-6 space-y-3`,children:[(0,m.jsxs)(`button`,{onClick:()=>{let e=[`ID`,`Asset Name`,`Brand`,`Category`,`Price (INR)`,`Purchase Date`,`Warranty Expiry Date`,`Days Remaining`,`Warranty Status`,`Vendor / Store`,`Serial Number`,`Notes`],t=c.map(e=>[e.id,`"${(e.name||``).replace(/"/g,`""`)}"`,`"${(e.brand||``).replace(/"/g,`""`)}"`,`"${(e.category||``).replace(/"/g,`""`)}"`,e.price||0,e.purchaseDate||``,e.expiryDate||``,e.daysRemaining??0,e.status||`active`,`"${(e.vendor||``).replace(/"/g,`""`)}"`,`"${(e.serialNumber||``).replace(/"/g,`""`)}"`,`"${(e.notes||``).replace(/"/g,`""`)}"`]),n=[e.join(`,`),...t.map(e=>e.join(`,`))].join(`
`),r=new Blob([n],{type:`text/csv;charset=utf-8;`}),i=URL.createObjectURL(r),a=document.createElement(`a`);a.href=i,a.setAttribute(`download`,`AssetDoctor_Vault_Summary_${f}.csv`),document.body.appendChild(a),a.click(),document.body.removeChild(a),URL.revokeObjectURL(i),s()},className:`w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 hover:bg-emerald-950/10 text-left transition-all group flex items-center justify-between cursor-pointer`,children:[(0,m.jsxs)(`div`,{className:`flex items-center gap-3.5`,children:[(0,m.jsx)(`div`,{className:`p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-110 transition-transform`,children:(0,m.jsx)(d,{className:`w-5 h-5`})}),(0,m.jsxs)(`div`,{children:[(0,m.jsx)(`div`,{className:`text-sm font-bold text-white group-hover:text-emerald-300 transition-colors`,children:`CSV Spreadsheet (.csv)`}),(0,m.jsx)(`div`,{className:`text-xs text-slate-400 mt-0.5`,children:`Structured table format for Excel, Google Sheets, or tax filing`})]})]}),(0,m.jsx)(t,{className:`w-4 h-4 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity`})]}),(0,m.jsxs)(`button`,{onClick:()=>{let e=`<!DOCTYPE html>
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
        <div class="logo">🛡️ AssetDoctor</div>
        <div class="subtitle">Official Vault Summary & Warranty Certificate Backup • Generated ${new Date().toLocaleDateString(`en-US`,{month:`long`,day:`numeric`,year:`numeric`})}</div>
      </div>
      <div class="badge">ServiVault Verified</div>
    </div>

    <div class="summary-grid">
      <div class="stat-card">
        <div class="stat-label">Total Assets Managed</div>
        <div class="stat-val">${c.length} Items</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Vault Valuation</div>
        <div class="stat-val" style="color: #34d399">${a(l)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Expiring Soon (&le; 30d)</div>
        <div class="stat-val" style="color: #fbbf24">${c.filter(e=>e.status===`expiring_soon`).length} Items</div>
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
        ${c.map(e=>`
          <tr>
            <td><strong>${e.name}</strong><br/><span style="font-size:10px; color:#64748b">SN: ${e.serialNumber||`N/A`}</span></td>
            <td>${e.brand} • ${e.category}</td>
            <td>${e.purchaseDate}</td>
            <td style="font-family: monospace; font-weight:700">${a(e.price)}</td>
            <td>${e.expiryDate}</td>
            <td class="${e.status===`active`?`status-active`:e.status===`expiring_soon`?`status-expiring`:`status-expired`}">
              ${e.status===`active`?`Protected`:e.status===`expiring_soon`?`Expiring (${e.daysRemaining}d)`:`Expired`}
            </td>
          </tr>
        `).join(``)}
      </tbody>
    </table>

    <div class="footer">
      Generated automatically by AssetDoctor ServiVault Engine. Emergency Mechanic Hotline & Instant AI OCR Reader.
    </div>
  </div>
  <script>
    window.onload = function() { window.print(); }
  <\/script>
</body>
</html>`,t=new Blob([e],{type:`text/html`}),n=URL.createObjectURL(t);if(!window.open(n,`_blank`)){let e=document.createElement(`a`);e.href=n,e.setAttribute(`download`,`AssetDoctor_Vault_Report_${f}.html`),document.body.appendChild(e),e.click(),document.body.removeChild(e)}URL.revokeObjectURL(n),s()},className:`w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-cyan-500/50 hover:bg-cyan-950/10 text-left transition-all group flex items-center justify-between cursor-pointer`,children:[(0,m.jsxs)(`div`,{className:`flex items-center gap-3.5`,children:[(0,m.jsx)(`div`,{className:`p-3 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 group-hover:scale-110 transition-transform`,children:(0,m.jsx)(n,{className:`w-5 h-5`})}),(0,m.jsxs)(`div`,{children:[(0,m.jsx)(`div`,{className:`text-sm font-bold text-white group-hover:text-cyan-300 transition-colors`,children:`Printable Summary Certificate (PDF)`}),(0,m.jsx)(`div`,{className:`text-xs text-slate-400 mt-0.5`,children:`Formatted visual certificate report with total valuation & active status`})]})]}),(0,m.jsx)(t,{className:`w-4 h-4 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity`})]}),(0,m.jsxs)(`button`,{onClick:()=>{let e=JSON.stringify(c,null,2),t=new Blob([e],{type:`application/json`}),n=URL.createObjectURL(t),r=document.createElement(`a`);r.href=n,r.download=`AssetDoctor_ServiVault_Backup_${f}.json`,r.click(),URL.revokeObjectURL(n),s()},className:`w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-teal-500/50 hover:bg-teal-950/10 text-left transition-all group flex items-center justify-between cursor-pointer`,children:[(0,m.jsxs)(`div`,{className:`flex items-center gap-3.5`,children:[(0,m.jsx)(`div`,{className:`p-3 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 group-hover:scale-110 transition-transform`,children:(0,m.jsx)(u,{className:`w-5 h-5`})}),(0,m.jsxs)(`div`,{children:[(0,m.jsx)(`div`,{className:`text-sm font-bold text-white group-hover:text-teal-300 transition-colors`,children:`Full State Backup (.json)`}),(0,m.jsx)(`div`,{className:`text-xs text-slate-400 mt-0.5`,children:`Complete raw data dump for migration or full vault restoring`})]})]}),(0,m.jsx)(e,{className:`w-4 h-4 text-teal-400 opacity-0 group-hover:opacity-100 transition-opacity`})]})]}),(0,m.jsxs)(`div`,{className:`pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500`,children:[(0,m.jsxs)(`span`,{children:[`Total Vault Value: `,(0,m.jsx)(`strong`,{className:`text-emerald-400 font-mono`,children:a(l)})]}),(0,m.jsxs)(`div`,{className:`flex items-center gap-2`,children:[(0,m.jsx)(h,{assets:c}),(0,m.jsx)(`button`,{onClick:s,className:`px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors cursor-pointer`,children:`Close`})]})]})]})})};export{g as ExportVaultModal};