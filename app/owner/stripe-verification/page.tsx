'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { Activity, ArrowLeft, CheckCircle2, CircleAlert, CreditCard, RefreshCw, ShieldCheck } from 'lucide-react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const client = supabaseUrl && supabaseAnon ? createClient(supabaseUrl, supabaseAnon) : null;

type Checks = {
  localSupabase: boolean;
  stripeTestKey: boolean;
  webhookSecretPresent: boolean;
  localhostOrigin: boolean;
  publicCheckoutDisabled: boolean;
  notificationDeliveryDisabled: boolean;
  ownerSandboxCheckoutEnabled: boolean;
  publicCatalogEnabled: boolean;
  publicPricingEnabled: boolean;
};
type Appointment = {
  id: string;
  starts_at: string;
  status: string;
  deposit_cents: number | null;
  stripe_checkout_session_id: string | null;
  payment_reference: string | null;
  hold_expires_at: string | null;
};
type Reconciliation = {
  id: string;
  stripe_event_id: string;
  stripe_checkout_session_id: string;
  reason: string;
  status: string;
  amount_cents: number;
};
type WebhookEvent = { stripe_event_id: string; event_type: string };
type ResponseData = {
  checks: Checks;
  appointments: Appointment[];
  reconciliation: Reconciliation[];
  webhookEventSample: WebhookEvent[];
  notes: { appointments: string; webhookEvents: string; reconciliation: string };
  checkedAt: string;
};

const card = 'rounded-2xl border border-[#56442e]/75 bg-[#161618] p-5 sm:p-7';
const eyebrow = 'text-[11px] font-semibold uppercase tracking-[.22em] text-[#d9b77d]';
const checkLabels: { field: keyof Checks; label: string; expected: boolean; note: string }[] = [
  { field: 'localSupabase', label: 'Local Supabase (port 54421)', expected: true, note: 'No hosted database reads' },
  { field: 'stripeTestKey', label: 'Stripe test secret configured', expected: true, note: 'Checks test-key prefix only' },
  { field: 'webhookSecretPresent', label: 'Webhook secret configured', expected: true, note: 'Does not verify CLI secret matches' },
  { field: 'localhostOrigin', label: 'Localhost checkout redirect', expected: true, note: 'No live-site redirect' },
  { field: 'publicCheckoutDisabled', label: 'Public checkout locked', expected: true, note: 'Customer payments remain off' },
  { field: 'notificationDeliveryDisabled', label: 'Outbound notifications locked', expected: true, note: 'No customer email delivery' },
];

function prettyDate(value: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Not available';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  }).format(new Date(value));
}
function dollar(cents: number | null): string {
  return typeof cents === 'number' ? `$${(cents / 100).toFixed(2)}` : 'Unknown';
}
function shortId(value: string | null): string {
  return !value ? '—' : value.length > 25 ? `${value.slice(0, 17)}…${value.slice(-6)}` : value;
}

export default function StripeVerificationPage() {
  const [token, setToken] = useState<string | null>(null);
  const [report, setReport] = useState<ResponseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!client) return;
    let mounted = true;
    void client.auth.getSession().then(({ data }) => {
      if (mounted) setToken(data.session?.access_token ?? null);
    });
    const { data: auth } = client.auth.onAuthStateChange((_event, session) => {
      setToken(session?.access_token ?? null);
    });
    return () => { mounted = false; auth.subscription.unsubscribe(); };
  }, []);

  const refresh = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await client.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error('Sign in to the Owner Dashboard first.');
      const response = await fetch('/api/owner/stripe-verification', {
        headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store',
      });
      const result = await response.json() as ResponseData & { error?: string };
      if (!response.ok) throw new Error(result.error ?? `Verification request failed (${response.status}).`);
      setReport(result);
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : 'Could not load verification results.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) { setReport(null); return; }
    void refresh();
  }, [token, refresh]);

  const safe = report ? checkLabels.every(item => report.checks[item.field] === item.expected) : false;
  const pending = report?.appointments.filter(a => a.status === 'pending_payment').length ?? 0;
  const confirmed = report?.appointments.filter(a => a.status === 'confirmed').length ?? 0;
  const mismatched = report?.appointments.filter(a =>
    a.status === 'confirmed' && (!a.payment_reference || a.payment_reference !== a.stripe_checkout_session_id),
  ).length ?? 0;

  return <main className="section-wrap section-space min-h-[75vh]">
    <Link href="/owner" className="inline-flex items-center gap-2 text-sm text-[#d9b77d] hover:underline"><ArrowLeft size={16} /> Back to Owner Dashboard</Link>
    <div className="mt-9 flex flex-wrap items-start justify-between gap-5">
      <div>
        <p className={eyebrow}>Owner Development Workspace · B4.2.3</p>
        <h1 className="display mt-3 text-3xl sm:text-5xl">Stripe Test Verification</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-white/60">Review local Stripe test appointments, webhook records, payment exceptions, and safety switches—all without creating a charge or changing a booking.</p>
      </div>
      <button type="button" disabled={!token || loading} onClick={() => void refresh()} className="inline-flex items-center gap-2 rounded-full border border-[#806743] px-5 py-3 text-sm text-[#edd4a1] transition hover:bg-[#d9b77d]/10 disabled:opacity-50"><RefreshCw size={16} />{loading ? 'Checking…' : 'Refresh report'}</button>
    </div>

    <div className="mt-7 rounded-xl border border-[#d9b77d]/35 bg-[#d9b77d]/10 px-5 py-4 text-sm leading-6 text-[#eed29b]">
      <ShieldCheck size={18} className="mr-2 inline-block" /> LOCAL TEST DATA ONLY · This screen never turns on public checkout, sends email, or calls Stripe to create a payment.
    </div>
    {!client && <p role="alert" className="mt-6 text-red-300">Supabase browser configuration is missing.</p>}
    {client && !token && <p className="mt-6 text-white/70">Please <Link className="text-[#e6c486] underline" href="/owner">sign in as owner</Link> to view verification results.</p>}
    {error && <p role="alert" className="mt-6 rounded-xl border border-red-500/40 bg-red-950/20 p-4 text-red-200">{error}</p>}
    {token && !report && !error && <p role="status" className="mt-6 text-white/60">Loading protected local payment records…</p>}

    {report && <div className="mt-9 grid gap-7">
      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-4"><div><p className={eyebrow}>Sandbox safety</p><h2 className="display mt-2 text-2xl sm:text-3xl">Launch guardrails</h2></div><span className={`rounded-full border px-4 py-2 text-sm ${safe ? 'border-emerald-500/40 text-emerald-200' : 'border-amber-500/40 text-amber-200'}`}>{safe ? 'Local configuration checks passed' : 'Review safeguards before testing'}</span></div>
        <p className="mt-3 text-sm leading-6 text-white/55">These checks inspect configuration only. They do not prove Stripe CLI delivery, project-key pairing, or an actual payment outcome.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {checkLabels.map(item => {
            const pass = report.checks[item.field] === item.expected;
            return <div key={item.field} className="flex gap-3 rounded-xl border border-white/10 bg-[#0d0d10] p-4">
              {pass ? <CheckCircle2 size={20} className="shrink-0 text-emerald-300" /> : <CircleAlert size={20} className="shrink-0 text-amber-300" />}
              <div><p className="font-medium">{item.label}</p><p className="mt-1 text-xs text-white/50">{item.note}</p></div>
            </div>;
          })}
        </div>
        <div className="mt-5 flex flex-wrap gap-x-7 gap-y-2 text-xs text-white/60">
          <span>Owner-only checkout: <strong className="text-[#e9ca95]">{report.checks.ownerSandboxCheckoutEnabled ? 'Temporarily ON — turn off after testing' : 'OFF'}</strong></span>
          <span>Public service catalog: {report.checks.publicCatalogEnabled ? 'ON' : 'OFF'}</span>
          <span>Public pricing: {report.checks.publicPricingEnabled ? 'ON' : 'OFF'}</span>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Local checkout summary">
        <div className={card}><p className={eyebrow}>Sampled confirmations</p><p className="display mt-3 text-4xl text-[#e9c789]">{confirmed}</p><p className="mt-2 text-xs text-white/50">Confirmed test appointments in the displayed sample</p></div>
        <div className={card}><p className={eyebrow}>Pending test holds</p><p className="display mt-3 text-4xl text-[#e9c789]">{pending}</p><p className="mt-2 text-xs text-white/50">Check hold expiry before starting a new test</p></div>
        <div className={card}><p className={eyebrow}>Needs review</p><p className="display mt-3 text-4xl text-[#e9c789]">{report.reconciliation.length + mismatched}</p><p className="mt-2 text-xs text-white/50">Exception rows plus mismatched confirmed-session references; may overlap</p></div>
      </section>

      <section className={card}>
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className={eyebrow}>Local Supabase</p><h2 className="display mt-2 text-2xl sm:text-3xl">Stripe test appointments</h2></div><span className="text-xs text-white/50">{report.appointments.length} records displayed</span></div>
        <p className="mt-3 text-xs leading-5 text-white/50">{report.notes.appointments}</p>
        {report.appointments.length === 0 ? <p className="mt-6 rounded-xl border border-white/10 bg-[#0b0b0d] p-5 text-sm text-white/60">No test checkout appointments were found in the sample yet. Creating a Stripe session is a separate, owner-initiated step.</p> :
        <div className="mt-6 overflow-x-auto"><table className="min-w-[740px] w-full text-left text-sm"><thead className="border-b border-white/15 text-[#d9b77d]"><tr><th className="pb-3 pr-4">Appointment</th><th className="pb-3 pr-4">Booking time (ET)</th><th className="pb-3 pr-4">Status</th><th className="pb-3 pr-4">Deposit</th><th className="pb-3 pr-4">Session linkage</th><th className="pb-3">Hold expiry (ET)</th></tr></thead><tbody>{report.appointments.map(a => {
          const linked = a.status === 'confirmed' && a.payment_reference === a.stripe_checkout_session_id;
          return <tr key={a.id} className="border-b border-white/10 text-white/75"><td className="py-4 pr-4 font-mono text-xs" title={a.id}>{shortId(a.id)}</td><td className="py-4 pr-4">{prettyDate(a.starts_at)}</td><td className="py-4 pr-4">{a.status.replaceAll('_', ' ')}</td><td className="py-4 pr-4">{dollar(a.deposit_cents)}</td><td className="py-4 pr-4 text-xs">{linked ? <span className="text-emerald-300">Confirmed / matched</span> : a.status === 'confirmed' ? <span className="text-red-300">Reference mismatch</span> : <span className="text-white/50" title={a.stripe_checkout_session_id ?? ''}>{shortId(a.stripe_checkout_session_id)}</span>}</td><td className="py-4">{prettyDate(a.hold_expires_at)}</td></tr>;
        })}</tbody></table></div>}
      </section>

      <section className={card}>
        <p className={eyebrow}>Payment exceptions</p><h2 className="display mt-2 text-2xl sm:text-3xl">Reconciliation queue</h2>
        <p className="mt-3 text-xs leading-5 text-white/50">{report.notes.reconciliation}</p>
        {report.reconciliation.length ? <div className="mt-5 grid gap-3">{report.reconciliation.map(r => <div key={r.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-amber-700/30 bg-[#0b0b0d] p-4"><div><p className="font-semibold text-[#e5c48b]">{r.reason.replaceAll('_',' ')}</p><p className="mt-1 font-mono text-xs text-white/50">Event {shortId(r.stripe_event_id)} · {shortId(r.stripe_checkout_session_id)}</p></div><span className="text-sm">{r.status} · {dollar(r.amount_cents)}</span></div>)}</div> : <p className="mt-5 text-sm text-white/60">No test-session reconciliation records in this sample.</p>}
        <Link href="/owner/reconciliation" className="mt-5 inline-flex text-sm text-[#e3be7b] underline">Open owner reconciliation</Link>
      </section>

      <section className={card}>
        <div className="flex items-center gap-2"><Activity className="text-[#d9b77d]" size={22}/><h2 className="display text-2xl">Recorded webhook event sample</h2></div>
        <p className="mt-3 text-xs leading-5 text-white/50">{report.notes.webhookEvents}</p>
        {report.webhookEventSample.length ? <div className="mt-5 grid gap-2 sm:grid-cols-2">{report.webhookEventSample.map(event => <div key={event.stripe_event_id} className="rounded-xl border border-white/10 bg-[#0b0b0d] p-3"><p className="font-mono text-xs text-[#e9ca95]">{shortId(event.stripe_event_id)}</p><p className="mt-1 text-xs text-white/60">{event.event_type}</p></div>)}</div> : <p className="mt-5 text-sm text-white/60">No recorded webhook events in this sample.</p>}
      </section>

      <section className={card}>
        <div className="flex items-center gap-2"><CreditCard className="text-[#d9b77d]" size={22}/><h2 className="display text-2xl">Controlled test runbook</h2></div>
        <ol className="mt-5 list-decimal space-y-3 pl-5 text-sm leading-7 text-white/70">
          <li>Verify all six safeguards above, then confirm the Stripe CLI listener says <strong>Ready</strong> and forwards to <code>/api/stripe/webhook</code>.</li>
          <li>Confirm its current <code>whsec_</code> matches <code>STRIPE_WEBHOOK_SECRET</code> in local <code>.env.local</code>; never paste secrets into chat.</li>
          <li>Temporarily enable only <code>ENABLE_OWNER_STRIPE_TEST_CHECKOUT=true</code> and restart Next.js. Keep public checkout and outbound delivery off.</li>
          <li>From <Link href="/owner/stripe-sandbox" className="text-[#e5c48b] underline">Stripe Sandbox Lab</Link>, use a fictional customer and a valid future slot. Pay exactly $10 using a Stripe test card.</li>
          <li>Verify Stripe CLI reports webhook HTTP 200, refresh this report, and check that the matching test appointment is confirmed with a matching payment reference.</li>
          <li>Inspect any reconciliation exceptions; do not immediately retry an uncertain payment or double-reserve the same time.</li>
          <li>Turn the owner-only feature flag back OFF and restart Next.js. Do not turn on public checkout as part of this test.</li>
        </ol>
        <p className="mt-5 text-xs text-white/45">This page cannot verify actual Stripe transfers, CLI status, test-key account pairing, or refund handling. Those checks require separate testing before public launch.</p>
      </section>
      <p className="text-right text-xs text-white/40">Last checked {prettyDate(report.checkedAt)}</p>
    </div>}
  </main>;
}
