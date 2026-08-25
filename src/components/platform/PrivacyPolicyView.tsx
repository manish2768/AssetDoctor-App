import React from 'react';
import { Shield, Lock, FileText, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';

interface PrivacyPolicyViewProps {
  onGoBack?: () => void;
}

export const PrivacyPolicyView: React.FC<PrivacyPolicyViewProps> = ({ onGoBack }) => {
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

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold uppercase tracking-wider">
          <Shield className="w-3.5 h-3.5" />
          <span>Legal &amp; Privacy Architecture</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
          Privacy Policy
        </h1>

        <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400">
          <span>Effective Date: August 25, 2026</span>
          <span>•</span>
          <span>Last Updated: August 2026</span>
          <span>•</span>
          <span className="text-emerald-400">Version 2.0</span>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed max-w-2xl">
          At Asset Doctor, we believe that understanding and managing physical assets requires uncompromising respect for user privacy. This Privacy Policy details how we collect, process, vault, and protect your data across our public tools and authenticated asset vault.
        </p>
      </div>

      {/* 20 Core Sections */}
      <div className="space-y-10 text-sm leading-relaxed">
        {/* Section 1 */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="font-mono text-emerald-400 text-sm">01.</span> Information We Collect
          </h2>
          <p>
            Asset Doctor operates under a <strong>Guest-First, Minimum-Required Data</strong> principle. We collect information only when necessary to perform calculations, vault records, or maintain your account. We distinguish strictly between anonymous guest calculations, authenticated vault data, and privacy-scrubbed system telemetry.
          </p>
        </section>

        {/* Section 2 */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="font-mono text-emerald-400 text-sm">02.</span> Information Users Voluntarily Provide
          </h2>
          <p>
            When utilizing interactive tools (e.g. Repair vs. Replace, Warranty Checker, Depreciation Calculator), you voluntarily provide asset parameters such as purchase price, purchase date, asset category, brand, and repair quotes. In guest mode, these inputs remain in your browser session unless you explicitly choose to create an account or persist them.
          </p>
        </section>

        {/* Section 3 */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="font-mono text-emerald-400 text-sm">03.</span> Asset Information
          </h2>
          <p>
            When registering assets within My Asset Vault, you may store metadata such as model names, serial numbers, VINs, registration numbers, odometer readings, and custom warranty milestones. This information is associated solely with your authenticated tenant identifier and is never exposed publicly.
          </p>
        </section>

        {/* Section 4 */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="font-mono text-emerald-400 text-sm">04.</span> Documents &amp; Uploaded Files
          </h2>
          <p>
            When utilizing the Smart Document Analyzer or vaulting invoices, policies, PUCs, or warranty cards, files are stored in tenant-isolated cloud storage. Optical Character Recognition (OCR) extracts structured metadata (e.g. invoice dates, odometer readings) to populate your records. Raw document files remain accessible only to the authenticated owner.
          </p>
        </section>

        {/* Section 5 */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="font-mono text-emerald-400 text-sm">05.</span> Account Information
          </h2>
          <p>
            When creating an optional account to persist calculations or synchronize assets across devices, we collect your verified email address and authentication credentials. We do not require mandatory phone numbers or physical home addresses for standard vault usage.
          </p>
        </section>

        {/* Section 6 */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="font-mono text-emerald-400 text-sm">06.</span> How Information Is Used
          </h2>
          <ul className="list-disc pl-5 space-y-1 text-slate-300">
            <li>To compute accurate depreciation curves, maintenance schedules, and economic recommendations.</li>
            <li>To alert you to upcoming warranty expiration dates and statutory compliance deadlines.</li>
            <li>To maintain your private asset vault inventory and sync records across your sessions.</li>
            <li>To diagnose software defects, harden platform reliability, and improve algorithmic accuracy.</li>
          </ul>
        </section>

        {/* Section 7 */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="font-mono text-emerald-400 text-sm">07.</span> Authentication &amp; Session Security
          </h2>
          <p>
            Authentication is managed via secure token exchanges. We utilize industry-standard cryptographic sessions (JSON Web Tokens) with automated expiration to protect against unauthorized account hijacking. Super Admin privileges are restricted via verified server-side custom claims.
          </p>
        </section>

        {/* Section 8 */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="font-mono text-emerald-400 text-sm">08.</span> Cloud Storage &amp; Data Isolation
          </h2>
          <p>
            Vault data is stored in enterprise cloud infrastructure with strict tenant-level isolation rules. Database security rules enforce that only the authenticated user owning a record may read, edit, or delete their assets and attached documents.
          </p>
        </section>

        {/* Section 9 */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="font-mono text-emerald-400 text-sm">09.</span> Analytics &amp; Telemetry
          </h2>
          <p>
            We use Google Analytics 4 and in-memory aggregated counters to understand general website traffic and tool completion rates. Telemetry streams are subject to <strong>Automated Client-Side PII Scrubbing</strong>: emails, phone numbers, addresses, Firebase UIDs, and raw OCR invoice text are permanently stripped before any event is logged.
          </p>
        </section>

        {/* Section 10 */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="font-mono text-emerald-400 text-sm">10.</span> Cookies &amp; Local Storage
          </h2>
          <p>
            We utilize browser LocalStorage and essential session cookies solely to preserve your active theme preference, guest calculation history, and authenticated session tokens. We do not use cross-site third-party tracking cookies or advertising tracking beacons.
          </p>
        </section>

        {/* Section 11 */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="font-mono text-emerald-400 text-sm">11.</span> Data Sharing &amp; Third Parties
          </h2>
          <p>
            Asset Doctor does not sell, rent, lease, or trade personal customer data to any third party. We share data only with infrastructure sub-processors (e.g. Google Cloud / Firebase hosting and authentication) strictly necessary to deliver the service.
          </p>
        </section>

        {/* Section 12 */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="font-mono text-emerald-400 text-sm">12.</span> Zero Data Monetization Commitment
          </h2>
          <p>
            Our business model is founded on providing software utility and asset intelligence — never on behavioral advertising or selling private consumer purchase histories to insurance brokers, data brokers, or advertisers.
          </p>
        </section>

        {/* Section 13 */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="font-mono text-emerald-400 text-sm">13.</span> Data Retention Policy
          </h2>
          <p>
            Guest calculations in temporary sessions expire automatically when you clear your browser storage. Authenticated vault data is retained as long as your account remains active. If you delete an asset or document, it is immediately removed from live database collections.
          </p>
        </section>

        {/* Section 14 */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="font-mono text-emerald-400 text-sm">14.</span> Account Deletion &amp; Data Export
          </h2>
          <p>
            You have full sovereignty over your information. At any time within Account Settings, you may trigger a complete JSON/CSV export of your asset portfolio or execute an immediate, irreversible account deletion that purges your database records and vaulted documents.
          </p>
        </section>

        {/* Section 15 */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="font-mono text-emerald-400 text-sm">15.</span> Security Safeguards
          </h2>
          <p>
            We implement HTTPS TLS 1.3 transport encryption, least-privilege administrative access controls, automated dependency vulnerability surveillance, and tenant authorization checks. However, no internet transmission is 100% infallible; we encourage users to employ strong, unique passwords.
          </p>
        </section>

        {/* Section 16 */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="font-mono text-emerald-400 text-sm">16.</span> User Rights &amp; Data Control
          </h2>
          <p>
            Under applicable digital personal data protection laws, you possess the right to access, rectify, port, restrict processing of, and erase your personal data. These actions can be executed directly within the platform UI or by submitting a privacy inquiry.
          </p>
        </section>

        {/* Section 17 */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="font-mono text-emerald-400 text-sm">17.</span> Children's Privacy
          </h2>
          <p>
            Asset Doctor is designed for general audiences and personal asset management. We do not knowingly collect personal data from individuals under 13 years of age without parental consent. If we discover inadvertent collection from a minor, we promptly purge such records.
          </p>
        </section>

        {/* Section 18 */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="font-mono text-emerald-400 text-sm">18.</span> Third-Party Services &amp; Links
          </h2>
          <p>
            Our website may contain links to external OEM technical manuals, warranty claim directories, or regulatory portals. We are not responsible for the privacy practices or content of third-party websites and recommend reviewing their independent policies.
          </p>
        </section>

        {/* Section 19 */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="font-mono text-emerald-400 text-sm">19.</span> Changes to This Privacy Policy
          </h2>
          <p>
            We may update this Privacy Policy periodically to reflect evolving platform capabilities or regulatory requirements. Any modifications will be posted on this page with an updated "Last Updated" timestamp. Continued use of the platform constitutes acceptance of revised terms.
          </p>
        </section>

        {/* Section 20 */}
        <section className="space-y-3 p-5 rounded-2xl bg-slate-900/60 border border-white/10">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="font-mono text-emerald-400 text-sm">20.</span> Contact Information &amp; Privacy Requests
          </h2>
          <p className="text-xs text-slate-300">
            For questions regarding this policy, data export assistance, or to exercise your statutory privacy rights, please reach out through our official <a href="/contact" className="text-emerald-400 underline font-bold hover:text-emerald-300">Contact Portal</a> or contact the project administration at:
          </p>
          <div className="pt-2 text-xs font-mono text-slate-400 space-y-1">
            <p className="text-white font-bold">Asset Doctor Privacy &amp; Data Governance</p>
            <p>Email: <a href="mailto:support@assetdoctor.in" className="text-emerald-400 font-bold hover:underline">support@assetdoctor.in</a></p>
            <p>Location: India (Universal Platform)</p>
          </div>
        </section>
      </div>
    </div>
  );
};
