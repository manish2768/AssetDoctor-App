import React from 'react';
import { FileText, ShieldAlert, ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react';

interface TermsAndConditionsViewProps {
  onGoBack?: () => void;
}

export const TermsAndConditionsView: React.FC<TermsAndConditionsViewProps> = ({ onGoBack }) => {
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

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono font-bold uppercase tracking-wider">
          <FileText className="w-3.5 h-3.5" />
          <span>User Agreement &amp; Operating Terms</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
          Terms &amp; Conditions
        </h1>

        <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400">
          <span>Effective Date: August 25, 2026</span>
          <span>•</span>
          <span>Last Updated: August 2026</span>
          <span>•</span>
          <span className="text-cyan-400">Version 2.0</span>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed max-w-2xl">
          Welcome to Asset Doctor. By accessing our public tools, website, or authenticated vault features, you agree to comply with and be bound by these Terms and Conditions. Please review them thoroughly before using the platform.
        </p>
      </div>

      {/* 19 Core Sections */}
      <div className="space-y-10 text-sm leading-relaxed">
        {/* Section 1 */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="font-mono text-cyan-400 text-sm">01.</span> Acceptance of Terms
          </h2>
          <p>
            By visiting, browsing, executing calculations on, or registering an account with Asset Doctor ("the Platform"), you acknowledge that you have read, understood, and agreed to be legally bound by these Terms &amp; Conditions and our Privacy Policy. If you do not agree with any provision, you must discontinue using the platform.
          </p>
        </section>

        {/* Section 2 */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="font-mono text-cyan-400 text-sm">02.</span> Description of Asset Doctor
          </h2>
          <p>
            Asset Doctor is a universal asset intelligence and lifecycle management platform offering informational calculators, document intelligence tooling, depreciation modeling, maintenance scheduling, and personal vault storage for physical assets across automotive, electronics, appliance, solar, living, and business sectors.
          </p>
        </section>

        {/* Section 3 */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="font-mono text-cyan-400 text-sm">03.</span> Account Responsibilities &amp; Security
          </h2>
          <p>
            If you create an account, you are responsible for maintaining the confidentiality of your credentials and restricting unauthorized access to your devices. You agree to accept responsibility for all activities conducted under your authenticated account.
          </p>
        </section>

        {/* Section 4 */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="font-mono text-cyan-400 text-sm">04.</span> Guest Usage &amp; Temporary Sessions
          </h2>
          <p>
            Asset Doctor provides free guest tools without requiring user login. Data created during guest sessions is stored locally in your browser and may be purged upon browser cache clearance. We assume no liability for unmigrated guest calculations lost due to browser cache deletion.
          </p>
        </section>

        {/* Section 5 */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="font-mono text-cyan-400 text-sm">05.</span> Asset Information Responsibility
          </h2>
          <p>
            You represent that all asset information, purchase invoices, odometer readings, and serial numbers you enter or upload into Asset Doctor are accurate, authentic, and pertain to property you own or are legally authorized to manage.
          </p>
        </section>

        {/* Section 6 */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="font-mono text-cyan-400 text-sm">06.</span> Calculator &amp; Algorithmic Tool Limitations
          </h2>
          <p>
            Interactive decision tools (e.g. Repair vs. Replace, Depreciation Calculator, Total Cost of Ownership) utilize general mathematical models, standard category depreciation curves, and empirical economic heuristics (e.g. the 50% Rule). They are engineered as informational decision aids and should not be treated as definitive or binding appraisal guarantees.
          </p>
        </section>

        {/* Section 7 */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="font-mono text-cyan-400 text-sm">07.</span> Estimates &amp; Informational Content
          </h2>
          <p>
            Where official manufacturer data is unavailable, Asset Doctor displays clearly labeled <em>"Generic Estimates"</em>. These numbers reflect generalized category averages and should be verified against your specific product variant's official owner manual.
          </p>
        </section>

        {/* Section 8 */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="font-mono text-cyan-400 text-sm">08.</span> Maintenance Recommendations
          </h2>
          <p>
            Maintenance intervals and service due countdowns are generated based on published OEM schedules and statistical mileage velocities. Actual mechanical maintenance requirements may vary depending on driving conditions, environmental dust, operating temperature, and manufacturer revisions. Always consult certified technicians.
          </p>
        </section>

        {/* Section 9 */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="font-mono text-cyan-400 text-sm">09.</span> OCR &amp; Document Extraction Limitations
          </h2>
          <p>
            Optical Character Recognition algorithms parse text with high fidelity, but optical quality, document creases, poor lighting, or handwritten notes can impact extraction accuracy. Users are advised to review and confirm auto-extracted numbers before saving records.
          </p>
        </section>

        {/* Section 10 */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="font-mono text-cyan-400 text-sm">10.</span> Third-Party Information &amp; Brand Directories
          </h2>
          <p>
            Brand names, logos, vehicle models, and appliance trademarks referenced on the platform belong to their respective trademark holders. Reference to third-party brands does not imply endorsement, sponsorship, or formal partnership by those entities.
          </p>
        </section>

        {/* Section 11 */}
        <section className="space-y-3 p-5 rounded-2xl bg-amber-950/20 border border-amber-500/20">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <span className="font-mono text-amber-400 text-sm">11.</span> No Professional, Legal, or Financial Advice
          </h2>
          <p className="text-xs text-slate-300">
            The content, tools, calculations, and recommendations provided on Asset Doctor do not constitute formal legal, accounting, tax, insurance appraisal, or mechanical engineering advice. Always consult licensed professionals for high-value financial, insurance claims, or automotive safety decisions.
          </p>
        </section>

        {/* Section 12 */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="font-mono text-cyan-400 text-sm">12.</span> User-Generated Content &amp; Ownership
          </h2>
          <p>
            You retain 100% intellectual property ownership over all assets, custom notes, receipts, photos, and document files you upload to Asset Doctor. By uploading content, you grant Asset Doctor a limited technical license solely to host, parse, and display your data back to you.
          </p>
        </section>

        {/* Section 13 */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="font-mono text-cyan-400 text-sm">13.</span> Prohibited Use &amp; System Integrity
          </h2>
          <p>
            You agree not to engage in any activity that disrupts or interferes with platform operations, including automated scraping, denial of service attacks, reverse-engineering client code, uploading malware, or attempting unauthorized penetration of administrative consoles.
          </p>
        </section>

        {/* Section 14 */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="font-mono text-cyan-400 text-sm">14.</span> Intellectual Property Rights
          </h2>
          <p>
            All platform software, algorithms, UI components, branding, logos, visual designs, and documentation are the exclusive intellectual property of Asset Doctor and its founder, protected under applicable copyright, trademark, and trade secret laws.
          </p>
        </section>

        {/* Section 15 */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="font-mono text-cyan-400 text-sm">15.</span> Service Availability &amp; Modifications
          </h2>
          <p>
            We strive for maximum platform uptime and continuous service. However, we reserve the right to modify, suspend, or update features, calculators, or server environments for maintenance, security patches, or architectural upgrades without prior liability.
          </p>
        </section>

        {/* Section 16 */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="font-mono text-cyan-400 text-sm">16.</span> Account Suspension &amp; Termination
          </h2>
          <p>
            We reserve the right to suspend or terminate accounts that engage in fraudulent behavior, abuse system infrastructure, violate intellectual property, or breach these Terms &amp; Conditions. Users may close their accounts at any time via Account Settings.
          </p>
        </section>

        {/* Section 17 */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="font-mono text-cyan-400 text-sm">17.</span> Limitation of Liability
          </h2>
          <p>
            To the maximum extent permitted by applicable law, Asset Doctor, its creator, and contributors shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from the use of, or inability to use, the platform or reliance on its estimates.
          </p>
        </section>

        {/* Section 18 */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="font-mono text-cyan-400 text-sm">18.</span> Changes to Terms &amp; Conditions
          </h2>
          <p>
            We may update these terms periodically. When revisions occur, the updated document will be published with a revised "Last Updated" timestamp. Your continued use of the platform following the posting of modifications constitutes acceptance.
          </p>
        </section>

        {/* Section 19 */}
        <section className="space-y-3 p-5 rounded-2xl bg-slate-900/60 border border-white/10">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="font-mono text-cyan-400 text-sm">19.</span> Governing Law &amp; Legal Notices
          </h2>
          <p className="text-xs text-slate-300">
            These terms shall be governed by and construed in accordance with the laws of India. For legal inquiries or formal correspondence, please reach out through our official <a href="/contact" className="text-cyan-400 underline font-bold hover:text-cyan-300">Contact Portal</a> or contact:
          </p>
          <div className="pt-2 text-xs font-mono text-slate-400 space-y-1">
            <p className="text-white font-bold">Asset Doctor Legal &amp; Governance</p>
            <p>Email: <span className="text-cyan-400 font-bold">legal@assetdoctor.in</span></p>
            <p>Entity: [Asset Doctor Project • India]</p>
          </div>
        </section>
      </div>
    </div>
  );
};
