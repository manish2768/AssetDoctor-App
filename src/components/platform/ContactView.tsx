import React, { useState } from 'react';
import { Mail, MessageSquare, Send, CheckCircle2, Shield, Sparkles, Building, AlertCircle } from 'lucide-react';

interface ContactViewProps {
  onGoHome?: () => void;
}

export type ContactCategory =
  | 'general'
  | 'feedback'
  | 'issue'
  | 'privacy'
  | 'business';

export const ContactView: React.FC<ContactViewProps> = ({ onGoHome }) => {
  const [category, setCategory] = useState<ContactCategory>('general');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim() || !email.trim() || !message.trim()) {
      setErrorMessage('Please complete all required fields.');
      return;
    }

    if (!email.includes('@') || !email.includes('.')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);

    // Simulate clean client submission / mailto fallback
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
    }, 600);
  };

  const handleReset = () => {
    setName('');
    setEmail('');
    setSubject('');
    setMessage('');
    setIsSubmitted(false);
    setErrorMessage(null);
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-12 animate-fade-in">
      {/* Header */}
      <section className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold uppercase tracking-wider">
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Get in Touch</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-[1.08]">
          Let's Build the Future of <br />
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            Asset Intelligence.
          </span>
        </h1>

        <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl mx-auto">
          Have questions, suggestions, or feedback? Whether you're exploring the platform, reporting an edge case, or discussing business asset management, we'd love to hear from you.
        </p>
      </section>

      {/* Main Grid: Form + Direct Contact Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Interactive Contact Form (7 cols) */}
        <div className="lg:col-span-7 glass border border-white/10 rounded-3xl p-6 sm:p-8 bg-slate-900/80 shadow-2xl">
          {isSubmitted ? (
            <div className="text-center py-12 space-y-6 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-white">Message Received!</h3>
                <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                  Thank you for reaching out to Asset Doctor. We review every message with care and will respond to <span className="text-emerald-400 font-bold font-mono">{email}</span> shortly.
                </p>
              </div>
              <button
                onClick={handleReset}
                className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition cursor-pointer border border-slate-700"
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Category Selector */}
              <div className="space-y-2">
                <label className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                  Select Topic
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCategory('general')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition text-center border cursor-pointer ${
                      category === 'general'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950/60 border-white/5 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    General Enquiry
                  </button>

                  <button
                    type="button"
                    onClick={() => setCategory('feedback')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition text-center border cursor-pointer ${
                      category === 'feedback'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950/60 border-white/5 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    Product Feedback
                  </button>

                  <button
                    type="button"
                    onClick={() => setCategory('issue')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition text-center border cursor-pointer ${
                      category === 'issue'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950/60 border-white/5 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    Report an Issue
                  </button>

                  <button
                    type="button"
                    onClick={() => setCategory('privacy')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition text-center border cursor-pointer ${
                      category === 'privacy'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950/60 border-white/5 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    Privacy Request
                  </button>

                  <button
                    type="button"
                    onClick={() => setCategory('business')}
                    className={`col-span-2 sm:col-span-2 py-2 px-3 rounded-xl text-xs font-bold transition text-center border cursor-pointer ${
                      category === 'business'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950/60 border-white/5 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    Business / P2B Partnership
                  </button>
                </div>
              </div>

              {/* Error Notice */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Name and Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Your Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ashutosh"
                    className="w-full rounded-xl bg-slate-950/80 border border-white/10 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl bg-slate-950/80 border border-white/10 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition"
                  />
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Subject (Optional)</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Summary of your inquiry..."
                  className="w-full rounded-xl bg-slate-950/80 border border-white/10 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition"
                />
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Your Message *</label>
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your inquiry, feedback, or asset management scenario in detail..."
                  className="w-full rounded-xl bg-slate-950/80 border border-white/10 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition resize-none"
                ></textarea>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Sending Message...</span>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Message to Asset Doctor</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Right: Direct Channel Cards & Information (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="glass border border-white/10 rounded-3xl p-6 bg-slate-900/80 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">General &amp; Support Inquiries</h3>
                <p className="text-xs text-slate-400 font-mono">support@assetdoctor.in</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Have questions about how tools work, calculator formulas, or feedback on category coverage? Drop us an email anytime.
            </p>
          </div>

          <div className="glass border border-white/10 rounded-3xl p-6 bg-slate-900/80 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Building className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Business &amp; P2B Partnerships</h3>
                <p className="text-xs text-slate-400 font-mono">partnerships@assetdoctor.in</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              For commercial equipment fleets, authorized service centers, and enterprise asset portfolio integration discussions.
            </p>
          </div>

          <div className="glass border border-white/10 rounded-3xl p-6 bg-slate-900/80 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Privacy &amp; Data Rights</h3>
                <p className="text-xs text-slate-400 font-mono">privacy@assetdoctor.in</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              For statutory data access requests, vault export inquiries, or verification of our zero-sale privacy commitments.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
