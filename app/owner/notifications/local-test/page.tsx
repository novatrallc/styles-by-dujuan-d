'use client';
import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { ArrowLeft, MailOpen, Send, ShieldCheck, ExternalLink } from 'lucide-react';

type Kind = 'booking_confirmed' | 'booking_cancelled' | 'booking_rescheduled' | 'payment_review';
const options: { kind: Kind; label: string }[] = [
  { kind: 'booking_confirmed', label: 'Customer booking confirmation' },
  { kind: 'booking_cancelled', label: 'Customer cancellation' },
  { kind: 'booking_rescheduled', label: 'Customer rescheduling' },
  { kind: 'payment_review', label: 'Owner payment review alert' },
];
export default function LocalEmailTestPage() {
  const [kind, setKind] = useState<Kind>('booking_confirmed');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  async function send() {
    setBusy(true); setError(''); setResult('');
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key) throw new Error('Supabase browser configuration missing.');
      const supabase = createClient(url, key);
      const { data, error: authError } = await supabase.auth.getSession();
      if (authError || !data.session?.access_token) throw new Error('Sign into the owner dashboard first.');
      const response = await fetch('/api/owner/notifications/local-test', {
        method: 'POST', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({ kind }),
      });
      const payload: { error?: string; accepted?: boolean; recipient?: string } = await response.json();
      if (!response.ok || !payload.accepted) throw new Error(payload.error || 'Local test failed.');
      setResult(`Captured sample for ${payload.recipient}. Open Mailpit to inspect it.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to send local sample.'); }
    finally { setBusy(false); }
  }
  return <main className="section-wrap section-space min-h-[75vh] text-white">
    <Link href="/owner/notifications" className="inline-flex items-center gap-2 text-sm text-[#d9b77d] hover:underline"><ArrowLeft size={16} /> Back to notification center</Link>
    <div className="mt-8"><p className="text-xs uppercase tracking-[.25em] text-[#d9b77d]">Private owner console · Development only</p>
      <h1 className="display mt-3 text-3xl md:text-5xl">Local email atelier</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">Experience every signature email in a private local inbox. All details are fictional. No customer messages leave your computer.</p></div>
    <div className="luxe-card mt-8 max-w-2xl p-6 md:p-9">
      <div className="flex items-center gap-3 text-[#e8cf9b]"><ShieldCheck size={20} /><strong>Protected local simulation</strong></div>
      <label className="mt-6 block text-sm text-white/80">Sample notification
        <select value={kind} onChange={e => setKind(e.target.value as Kind)} className="mt-2 block w-full rounded-xl border border-white/20 bg-[#171717] px-4 py-3 text-white outline-none focus:border-[#d9b77d]">
          {options.map(option => <option key={option.kind} value={option.kind}>{option.label}</option>)}
        </select>
      </label>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" disabled={busy} onClick={() => void send()} className="button-gold inline-flex items-center gap-2 disabled:opacity-50"><Send size={16} /> {busy ? 'Capturing…' : 'Send to local inbox'}</button>
        <a href="http://localhost:8025" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-[#d9b77d]/50 px-4 py-3 text-sm text-[#e8cf9b] hover:bg-[#d9b77d]/10"><MailOpen size={17} /> Open Mailpit <ExternalLink size={14} /></a>
      </div>
      {error && <p role="alert" className="mt-5 text-sm text-[#e8cf9b]">{error}</p>}
      {result && <p role="status" className="mt-5 text-sm text-[#e8cf9b]">{result}</p>}
      <p className="mt-6 text-xs leading-6 text-white/45">Requires Docker Mailpit and ENABLE_LOCAL_MAIL_TEST=true. This does not touch Stripe, real appointments, notification history, or production email delivery.</p>
    </div>
  </main>;
}
