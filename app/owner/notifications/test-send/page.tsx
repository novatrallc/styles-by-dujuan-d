'use client';
import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { ArrowLeft, MailCheck, ShieldCheck, Send } from 'lucide-react';

type Kind = 'booking_confirmed' | 'booking_cancelled' | 'booking_rescheduled' | 'payment_review';
const choices: { value: Kind; label: string }[] = [
  { value: 'booking_confirmed', label: 'Customer confirmation' },
  { value: 'booking_cancelled', label: 'Customer cancellation' },
  { value: 'booking_rescheduled', label: 'Customer rescheduling (template only)' },
  { value: 'payment_review', label: 'Owner payment alert' },
];
export default function NotificationTestSendPage() {
  const [kind, setKind] = useState<Kind>('booking_confirmed');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  async function send() {
    setBusy(true); setResult(''); setError('');
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key) throw new Error('Supabase browser configuration missing.');
      const client = createClient(url, key);
      const { data, error: authError } = await client.auth.getSession();
      if (authError || !data.session?.access_token) throw new Error('Sign into the owner dashboard first.');
      const response = await fetch('/api/owner/notifications/test-send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind }), cache: 'no-store',
      });
      const body: { error?: string; accepted?: boolean; recipient?: string; providerMessageId?: string } = await response.json();
      if (!response.ok || !body.accepted) throw new Error(body.error || 'Test email was not accepted.');
      setResult(`Test accepted for ${body.recipient}. Provider ID: ${body.providerMessageId}. Check inbox and spam; acceptance is not proof of delivery.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Test send failed.'); }
    finally { setBusy(false); }
  }
  return <main className="section-wrap section-space min-h-[75vh] text-white">
    <Link href="/owner/notifications" className="inline-flex items-center gap-2 text-sm text-[#d9b77d] hover:underline"><ArrowLeft size={16} /> Back to notification center</Link>
    <div className="mt-8"><p className="text-xs uppercase tracking-[.25em] text-[#d9b77d]">Private owner console</p><h1 className="display mt-3 text-3xl md:text-5xl">Signature test delivery</h1><p className="mt-3 max-w-2xl text-sm text-white/60">Send a fictional sample email to your verified owner address only. No customer information, bookings, or notification queue records are changed.</p></div>
    <div className="luxe-card mt-8 max-w-2xl p-6 md:p-9">
      <div className="flex items-center gap-3 text-[#e8cf9b]"><ShieldCheck size={20} /><strong>Owner-only, test-only</strong></div>
      <p className="mt-3 text-sm leading-6 text-white/60">Test sending requires ENABLE_NOTIFICATION_TEST_SEND=true, a Resend API key, a verified sender, and NOTIFICATION_TEST_EMAIL matching your signed-in owner email. Live customer delivery remains separately disabled.</p>
      <label className="mt-6 block text-sm text-white/80">Choose a sample template<select value={kind} onChange={e => setKind(e.target.value as Kind)} className="mt-2 block w-full rounded-xl border border-white/20 bg-[#171717] px-4 py-3 text-white outline-none focus:border-[#d9b77d]">{choices.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
      <button type="button" disabled={busy} onClick={() => void send()} className="button-gold mt-6 inline-flex items-center gap-2 disabled:opacity-50"><Send size={16} /> {busy ? 'Submitting test…' : 'Send sample to owner email'}</button>
      {error && <p role="alert" className="mt-5 text-sm text-[#e8cf9b]">{error}</p>}
      {result && <p role="status" className="mt-5 flex items-start gap-2 text-sm text-[#e8cf9b]"><MailCheck size={18} className="shrink-0" /> {result}</p>}
      <p className="mt-5 text-xs text-white/45">This sends a real email only when explicitly enabled. Test templates are labeled; no customer emails are accepted as recipients.</p>
    </div>
  </main>;
}
