'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { Activity, ArrowLeft, CheckCircle2, CircleAlert, Clock3, CreditCard, RefreshCw, ShieldCheck, ExternalLink } from 'lucide-react';

const api = '/api/owner/payment-activity';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const authClient = supabaseUrl && anonKey ? createClient(supabaseUrl, anonKey) : null;
const panel = 'rounded-[22px] border border-[#78603f]/35 bg-gradient-to-br from-[#1a1918] to-[#101113]';
const currency = (value: number) => `$${(value / 100).toFixed(2)}`;
const fmtDate = (value: string | null) => value
  ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) + ' ET'
  : 'Timestamp not stored';
const shortId = (value: string) => value.length > 27 ? `${value.slice(0, 17)}…${value.slice(-8)}` : value;

type Milestone = { id: string; label: string; occurredAt: string | null; detail: string; kind: 'neutral' | 'review' | 'complete' };
type ActivityItem = {
  id: string; customerName: string; appointmentAt: string; checkoutSessionId: string;
  depositCents: number; storedStatus: string; holdExpired: boolean; holdExpiresAt: string | null;
  paymentReferenceMatches: boolean; unresolvedReviews: number; displayStatus: string; milestones: Milestone[];
};
type Report = {
  items: ActivityItem[]; asOf: string; limits: string; caveat: string;
  checks: { localSupabase: boolean; publicCheckoutDisabled: boolean; notificationDeliveryDisabled: boolean; ownerTestCheckoutEnabled: boolean };
};
type StripeSnapshot = {
  id: string; status: string; paymentStatus: string; amountCents: number | null;
  currency: string | null; testMode: boolean;
  matches: { linkedSession: boolean; appointmentMetadata: boolean; depositAmount: boolean; usdCurrency: boolean };
  checkedAt: string; note: string;
};

export default function PaymentActivityTimeline() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [snapshot, setSnapshot] = useState<StripeSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [stripeError, setStripeError] = useState('');

  const authToken = useCallback(async (): Promise<string> => {
    if (!authClient) throw new Error('Local owner authentication configuration missing.');
    const { data, error: sessionError } = await authClient.auth.getSession();
    if (sessionError || !data.session?.access_token) throw new Error('Sign in through the Owner Dashboard first.');
    return data.session.access_token;
  }, []);
  const refresh = useCallback(async () => {
    setLoading(true); setError(''); setSnapshot(null); setStripeError('');
    try {
      const token = await authToken();
      const response = await fetch(api, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const body = await response.json() as Report & { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Unable to load payment timeline.');
      setItems(body.items ?? []); setReport(body);
      setSelectedId(current => (body.items ?? []).some(item => item.id === current)
        ? current : body.items?.[0]?.id ?? null);
    } catch (cause) {
      setItems([]); setReport(null); setError(cause instanceof Error ? cause.message : 'Could not load payment activity.');
    } finally { setLoading(false); }
  }, [authToken]);
  useEffect(() => { void refresh(); }, [refresh]);
  const selected = items.find(item => item.id === selectedId) ?? null;
  async function checkStripe() {
    if (!selected || checking) return;
    setChecking(true); setStripeError(''); setSnapshot(null);
    try {
      const token = await authToken();
      const response = await fetch(`${api}/stripe?appointmentId=${encodeURIComponent(selected.id)}`,
        { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const body = await response.json() as StripeSnapshot & { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Stripe lookup was not successful.');
      setSnapshot(body);
    } catch (cause) {
      setStripeError(cause instanceof Error ? cause.message : 'Unable to retrieve Stripe session.');
    } finally { setChecking(false); }
  }
  const verified = snapshot && Object.values(snapshot.matches).every(Boolean);
  const attention = items.filter(i => i.unresolvedReviews > 0 || (i.holdExpired && i.storedStatus === 'pending_payment')).length;
  const confirmed = items.filter(i => i.storedStatus === 'confirmed' && i.paymentReferenceMatches).length;

  return <main className="section-wrap section-space min-h-[75vh] text-[#f7f0e5]">
    <Link href="/owner" className="inline-flex items-center gap-2 text-sm text-[#e4c18b] hover:underline"><ArrowLeft size={17}/> Back to owner dashboard</Link>
    <div className="mt-8 flex flex-wrap items-start justify-between gap-5">
      <div><p className="text-[11px] font-semibold uppercase tracking-[.26em] text-[#d9b77d]">Owner payment workspace · B4.2.6</p>
        <h1 className="display mt-3 text-4xl md:text-5xl">Payment activity timeline</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60">Explore test reservations, recorded milestones and on-demand Stripe status — without creating charges or changing appointments.</p>
      </div>
      <button type="button" onClick={() => void refresh()} disabled={loading || checking} className="inline-flex items-center gap-2 rounded-full border border-[#8f7048] px-5 py-3 text-sm text-[#eac98f] hover:bg-[#d9b77d]/10 disabled:opacity-40"><RefreshCw size={16}/> Refresh activity</button>
    </div>
    <div className={`${panel} mt-7 flex gap-3 p-5 text-sm text-[#ead2a6]`}><ShieldCheck size={20} className="shrink-0"/><div>
      <p className="font-semibold">Local-only · read-only · TEST sessions</p>
      <p className="mt-1 leading-6 text-white/55">This page cannot submit a payment, refund, webhook replay, booking change or customer notification. Stripe API status is checked only when you request it.</p>
    </div></div>
    {report && <div className="mt-6 grid gap-4 sm:grid-cols-3">
      <div className={`${panel} p-5`}><p className="text-xs uppercase tracking-widest text-[#d9b77d]">Test sessions shown</p><p className="display mt-2 text-3xl">{items.length}</p></div>
      <div className={`${panel} p-5`}><p className="text-xs uppercase tracking-widest text-[#d9b77d]">Needs investigation</p><p className="display mt-2 text-3xl">{attention}</p></div>
      <div className={`${panel} p-5`}><p className="text-xs uppercase tracking-widest text-[#d9b77d]">Confirmed locally</p><p className="display mt-2 text-3xl">{confirmed}</p></div>
    </div>}
    {report && (!report.checks.publicCheckoutDisabled || !report.checks.notificationDeliveryDisabled) &&
      <p role="alert" className="mt-5 rounded-xl border border-red-500/40 bg-red-950/25 p-4 text-sm text-red-200">A public checkout or notification safety switch appears enabled. Stop payment testing and inspect local configuration.</p>}
    {error && <p role="alert" className="mt-5 rounded-xl border border-red-500/35 bg-red-950/20 p-4 text-sm text-red-200">{error}</p>}
    <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(250px,.85fr)_minmax(0,1.45fr)]">
      <section aria-label="Test payment sessions" className={`${panel} p-5 sm:p-6`}>
        <h2 className="display text-2xl">Test payments</h2>
        <p className="mt-2 text-xs leading-6 text-white/50">Recent locally stored Stripe test sessions. Select one to inspect its timeline.</p>
        {loading ? <p className="mt-6 text-sm text-white/60">Loading test activity…</p>
        : items.length === 0 ? <p className="mt-6 text-sm text-white/60">No linked Stripe test sessions in the current sample.</p>
        : <div className="mt-5 grid gap-3">{items.map(item => <button type="button" key={item.id}
            onClick={() => { setSelectedId(item.id); setSnapshot(null); setStripeError(''); }}
            aria-pressed={selected?.id === item.id}
            className={`rounded-2xl border p-4 text-left transition ${selected?.id === item.id ? 'border-[#d9b77d] bg-[#d9b77d]/10' : 'border-white/10 bg-black/20 hover:border-[#96774b]'}`}>
              <div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold text-[#f0ce92]">{currency(item.depositCents)}</span>{item.unresolvedReviews > 0 ? <CircleAlert size={17} className="text-[#edc489]"/> : <Activity size={17} className="text-white/50"/>}</div>
              <p className="mt-2 text-sm text-white/85">{item.customerName || 'Test appointment'}</p>
              <p className="mt-2 text-xs leading-5 text-white/55">{item.displayStatus}</p>
              <p className="mt-2 font-mono text-[11px] text-white/40">{shortId(item.checkoutSessionId)}</p>
            </button>)}</div>}
      </section>
      <section aria-label="Selected payment activity" className={`${panel} min-w-0 p-5 sm:p-7`}>
        {!selected ? <div className="py-14 text-center"><Activity size={30} className="mx-auto text-[#d9b77d]"/><p className="mt-3 text-sm text-white/55">Select a test payment to inspect its recorded activity.</p></div> : <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="text-[11px] font-semibold uppercase tracking-[.23em] text-[#d9b77d]">Selected reservation</p>
              <h2 className="display mt-2 text-2xl sm:text-3xl">{selected.displayStatus}</h2></div>
            <button type="button" onClick={() => void checkStripe()} disabled={checking || loading}
              className="inline-flex items-center gap-2 rounded-full border border-[#c49d63] px-4 py-2.5 text-sm text-[#f1d39c] hover:bg-[#d9b77d]/10 disabled:opacity-40"><CreditCard size={16}/>{checking ? 'Checking…' : 'Check Stripe status'}</button>
          </div>
          <div className="mt-6 grid gap-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm sm:grid-cols-2">
            <div><p className="text-xs text-white/45">Scheduled appointment</p><p className="mt-1">{fmtDate(selected.appointmentAt)}</p></div>
            <div><p className="text-xs text-white/45">Stored DB status</p><p className="mt-1 capitalize">{selected.storedStatus.replaceAll('_',' ')}</p></div>
            <div><p className="text-xs text-white/45">Hold deadline</p><p className="mt-1">{fmtDate(selected.holdExpiresAt)}</p></div>
            <div><p className="text-xs text-white/45">Unresolved payment reviews</p><p className="mt-1">{selected.unresolvedReviews}</p></div>
          </div>
          <p className="mt-4 break-all font-mono text-xs text-white/45">Session: {selected.checkoutSessionId}</p>
          {stripeError && <p role="alert" className="mt-5 rounded-xl border border-red-500/40 bg-red-950/20 p-4 text-sm text-red-200">{stripeError}</p>}
          {snapshot && <div className={`mt-5 rounded-2xl border p-5 ${verified ? 'border-[#d9b77d]/40 bg-[#d9b77d]/10' : 'border-orange-400/40 bg-orange-950/20'}`}>
            <div className="flex items-start justify-between gap-2"><p className="font-semibold text-[#efd4a3]">Stripe API snapshot</p>{verified ? <CheckCircle2 size={20} className="text-[#efce91]"/> : <CircleAlert size={20} className="text-orange-300"/>}</div>
            <p className="mt-2 text-sm text-white/85">Checkout: <strong>{snapshot.status}</strong> · Payment: <strong>{snapshot.paymentStatus}</strong> · Amount: <strong>{snapshot.amountCents === null ? 'Unknown' : currency(snapshot.amountCents)}</strong></p>
            <p className="mt-2 text-xs leading-5 text-white/55">Account/session checks: {Object.values(snapshot.matches).filter(Boolean).length}/4 matched. Checked {fmtDate(snapshot.checkedAt)}. This is not webhook delivery proof.</p>
            {!verified && <p className="mt-2 text-sm text-orange-200">A Stripe-to-appointment mismatch needs investigation. Do not confirm this appointment.</p>}
          </div>}
          <div className="mt-7 border-t border-white/10 pt-6"><h3 className="display flex items-center gap-2 text-2xl"><Clock3 size={21} className="text-[#d9b77d]"/> Recorded milestones</h3>
            <p className="mt-2 text-xs leading-6 text-white/45">Milestones are evidence from local records. Missing timestamps are labeled rather than guessed.</p>
            <ol className="relative mt-6 ml-2 space-y-6 border-l border-[#7b633e]/50 pl-6">{selected.milestones.map(m => <li key={m.id} className="relative">
              <span className={`absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-[#1a1918] ${m.kind === 'review' ? 'bg-orange-300' : m.kind === 'complete' ? 'bg-[#d9b77d]' : 'bg-white/45'}`}/>
              <p className="text-sm font-semibold text-[#f2e7d7]">{m.label}</p>
              <p className="mt-1 text-xs text-[#d9b77d]">{fmtDate(m.occurredAt)}</p>
              <p className="mt-2 text-sm leading-6 text-white/55">{m.detail}</p>
            </li>)}</ol>
          </div>
        </>}
      </section>
    </div>
    <div className={`${panel} mt-7 p-5 sm:p-6`}><h2 className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck size={19} className="text-[#e2bf83]"/> Automatic forwarding evidence</h2>
      <p className="mt-3 text-sm leading-7 text-white/60">To pass this integration test, Stripe CLI must be running <strong>before</strong> a fresh sandbox checkout. Match the listener&apos;s <code>checkout.session.completed</code> event ID and HTTP 200 to the new local appointment and verify a matching payment reference. A historical signed replay or a Stripe API snapshot alone does not prove automatic forwarding.</p>
      <div className="mt-4 flex flex-wrap gap-5"><Link href="/owner/stripe-verification" className="inline-flex items-center gap-2 text-sm text-[#e8c689] hover:underline"><ExternalLink size={15}/> Stripe Verification Center</Link><Link href="/owner/reconciliation" className="inline-flex items-center gap-2 text-sm text-[#e8c689] hover:underline"><ExternalLink size={15}/> Payment Review Center</Link></div>
    </div>
    <p className="mt-5 text-xs leading-6 text-white/40">{report?.limits ?? 'Local sandbox diagnostic.'} {report?.caveat ?? ''}</p>
  </main>;
}
