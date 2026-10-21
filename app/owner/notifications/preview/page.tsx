'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { ArrowLeft, Eye, Mail, ShieldCheck, RefreshCw } from 'lucide-react';

type Kind = 'booking_confirmed' | 'booking_cancelled' | 'booking_rescheduled' | 'payment_review';
type Preview = { subject: string; html: string; text: string; sample: true; audience: string };
const choices: { value: Kind; label: string }[] = [
  { value: 'booking_confirmed', label: 'Booking confirmation' },
  { value: 'booking_cancelled', label: 'Cancellation' },
  { value: 'booking_rescheduled', label: 'Rescheduling (template only)' },
  { value: 'payment_review', label: 'Owner payment alert' },
];
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = url && key ? createClient(url, key) : null;
export default function NotificationPreviewPage() {
  const [kind, setKind] = useState<Kind>('booking_confirmed');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [plain, setPlain] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError(''); setPreview(null);
    try {
      if (!supabase) throw new Error('Supabase browser configuration is missing.');
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session?.access_token) throw new Error('Sign in to the owner dashboard first.');
      const response = await fetch(`/api/owner/notifications/preview?kind=${encodeURIComponent(kind)}`, {
        headers: { Authorization: `Bearer ${data.session.access_token}` }, cache: 'no-store',
      });
      if (response.status === 401) throw new Error('Owner access denied.');
      if (!response.ok) throw new Error('Unable to load email preview.');
      const result: Preview = await response.json();
      setPreview(result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load preview.'); }
    finally { setLoading(false); }
  }, [kind]);
  useEffect(() => { void load(); }, [load]);
  return <main className="section-wrap section-space min-h-[75vh] text-white">
    <Link href="/owner/notifications" className="inline-flex items-center gap-2 text-sm text-[#d9b77d] hover:underline"><ArrowLeft size={16} /> Back to notification center</Link>
    <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
      <div><p className="text-xs uppercase tracking-[.25em] text-[#d9b77d]">Private owner console</p><h1 className="display mt-3 text-3xl md:text-5xl">Signature email previews</h1><p className="mt-3 text-sm text-white/60">See exactly how your transactional email templates look. Sample data only. No emails are sent.</p></div>
      <span className="inline-flex items-center gap-2 rounded-full border border-[#d9b77d]/40 px-4 py-2 text-xs text-[#e8cf9b]"><ShieldCheck size={15} /> Preview only</span>
    </div>
    <div className="luxe-card mt-8 p-5 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <label className="block min-w-[240px] text-sm text-white/70">Email type
          <select className="mt-2 block w-full rounded-xl border border-white/20 bg-[#171717] px-4 py-3 text-white focus:border-[#d9b77d] focus:outline-none" value={kind} onChange={e => setKind(e.target.value as Kind)}>{choices.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select>
        </label>
        <div className="flex gap-2"><button type="button" onClick={() => setPlain(value => !value)} className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-sm text-white hover:border-[#d9b77d]"><Eye size={16} /> {plain ? 'HTML view' : 'Plain text'}</button><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-[#d9b77d]/50 px-4 py-3 text-sm text-[#e8cf9b] disabled:opacity-50"><RefreshCw size={16} /> Refresh</button></div>
      </div>
      {loading && <p role="status" className="mt-6 text-white/60">Loading secure preview…</p>}
      {error && <p role="alert" className="mt-6 text-[#e8cf9b]">{error}</p>}
      {preview && <div className="mt-6"><p className="mb-2 flex items-center gap-2 text-sm text-white/70"><Mail size={16} className="text-[#d9b77d]" /> Subject: <span className="text-white">{preview.subject}</span></p><p className="mb-4 text-xs text-white/45">Recipient type: {preview.audience}. All names, services, and dates are fictional examples.</p>{plain ? <pre className="overflow-auto whitespace-pre-wrap rounded-xl border border-white/15 bg-black/50 p-5 text-sm leading-7 text-white/80">{preview.text}</pre> : <iframe title="Sample email preview" sandbox="" srcDoc={preview.html} className="h-[690px] w-full rounded-xl border border-[#d9b77d]/30 bg-[#08090a]" />}</div>}
    </div>
  </main>;
}
