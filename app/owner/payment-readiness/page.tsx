'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import {
  ArrowLeft, ArrowUpRight, BadgeCheck, CheckCircle2, CircleAlert,
  Clock3, CreditCard, RefreshCw, ShieldCheck, Smartphone, Store, Wallet,
} from 'lucide-react';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const authClient = url && anon ? createClient(url, anon) : null;
const panel = 'rounded-[22px] border border-[#78603f]/35 bg-gradient-to-br from-[#1b1a19] to-[#101113]';
const formatDate = (text: string) => new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short',
}).format(new Date(text)) + ' ET';

type Report = {
  build: string;
  generatedAt: string;
  readOnly: boolean;
  safeForReadOnly: boolean;
  flags: {
    localSupabaseConfigured: boolean;
    stripeTestKeyFormat: boolean;
    webhookSigningSecretPresent: boolean;
    publicCheckoutOff: boolean;
    ownerTestCheckoutOff: boolean;
    notificationDeliveryOff: boolean;
    squarePaymentWritesOff: boolean;
    squareOnlineCheckoutOff: boolean;
    squareSandboxCredentialsPresent: boolean;
  };
  localRecords: {
    unresolvedReconciliationCount: number;
    recordedStripeWebhookEventCount: number;
    locallyConfirmedTestAppointments: number;
  };
  evidence: Record<string, string>;
  caveats: string[];
};

const prerequisites = [
  { key: 'publicCheckoutOff', label: 'Public online checkout locked', description: 'No customer deposits can be initiated.' },
  { key: 'ownerTestCheckoutOff', label: 'Owner test checkout locked', description: 'Only enable for a planned sandbox transaction.' },
  { key: 'notificationDeliveryOff', label: 'Outbound customer notifications locked', description: 'No live emails or SMS during testing.' },
  { key: 'stripeTestKeyFormat', label: 'Stripe test key format', description: 'Checks sk_test_ only; does not test the account or its permissions.' },
  { key: 'webhookSigningSecretPresent', label: 'Webhook secret configured', description: 'Presence is not proof of a matching Stripe CLI listener.' },
  { key: 'squarePaymentWritesOff', label: 'Square payment writes locked', description: 'This build cannot charge or refund a Square payment.' },
  { key: 'squareOnlineCheckoutOff', label: 'Square online deposits locked', description: 'Alternative online checkout is a future phase.' },
] as const;

export default function PaymentReadiness() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      if (!authClient) throw new Error('Local owner authentication is not configured.');
      const { data, error: sessionError } = await authClient.auth.getSession();
      if (sessionError || !data.session?.access_token) throw new Error('Sign in to the Owner Dashboard first.');
      const response = await fetch('/api/owner/payment-readiness', {
        headers: { Authorization: `Bearer ${data.session.access_token}` }, cache: 'no-store',
      });
      const body = await response.json() as Report & { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Could not load readiness data.');
      setReport(body);
    } catch (cause) {
      setReport(null);
      setError(cause instanceof Error ? cause.message : 'Unable to load readiness.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  return <main className="section-wrap section-space min-h-[75vh] text-[#f6eee3]">
    <Link href="/owner" className="inline-flex items-center gap-2 text-sm text-[#eac98f] hover:underline">
      <ArrowLeft size={16} aria-hidden="true"/> Back to owner dashboard
    </Link>
    <div className="mt-8 flex flex-wrap items-start justify-between gap-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[.26em] text-[#d9b77d]">Private owner workspace · B4.2.7</p>
        <h1 className="display mt-3 text-4xl md:text-5xl">Payment provider readiness</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-white/60">One premium experience: Stripe deposits, Apple Pay when eligible, and Square for the in-shop balance. Nothing on this page moves money.</p>
      </div>
      <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-full border border-[#8f7048] px-5 py-3 text-sm text-[#eac98f] hover:bg-[#d9b77d]/10 disabled:opacity-40">
        <RefreshCw size={16} aria-hidden="true"/> Refresh checks
      </button>
    </div>

    <div className={`${panel} mt-7 flex items-start gap-3 p-5`}>
      <ShieldCheck className="mt-0.5 shrink-0 text-[#e2bd7e]" size={21} aria-hidden="true"/>
      <div><p className="text-sm font-semibold text-[#efc98f]">LOCAL-ONLY · READ-ONLY · NO NEW PROCESSOR CONNECTION</p>
        <p className="mt-2 text-sm leading-6 text-white/60">Merchant identity and automatic Stripe forwarding remain unverified. The original $10 late-payment review is preserved. No Square payment lookup, checkout, refund, or database migration is performed here.</p></div>
    </div>
    {error && <div role="alert" className="mt-5 rounded-xl border border-red-500/40 bg-red-950/25 p-4 text-sm text-red-200">{error}</div>}
    {loading && <p role="status" className="mt-6 text-sm text-white/60">Loading private payment checks…</p>}
    {report && <>
      {!report.safeForReadOnly && <p role="alert" className="mt-5 rounded-xl border border-red-500/45 bg-red-950/30 p-4 text-sm text-red-200">One or more payment safety switches is enabled. Stop integration testing until checkout, Square writes, and outbound delivery are locked.</p>}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className={`${panel} p-5`}><p className="text-xs uppercase tracking-widest text-[#d9b77d]">Needs payment review</p><p className="display mt-2 text-3xl">{report.localRecords.unresolvedReconciliationCount}</p><p className="mt-2 text-xs text-white/50">Local owner reconciliation records</p></div>
        <div className={`${panel} p-5`}><p className="text-xs uppercase tracking-widest text-[#d9b77d]">Webhook rows stored</p><p className="display mt-2 text-3xl">{report.localRecords.recordedStripeWebhookEventCount}</p><p className="mt-2 text-xs text-white/50">Not proof of CLI forwarding</p></div>
        <div className={`${panel} p-5`}><p className="text-xs uppercase tracking-widest text-[#d9b77d]">Confirmed test reservations</p><p className="display mt-2 text-3xl">{report.localRecords.locallyConfirmedTestAppointments}</p><p className="mt-2 text-xs text-white/50">Database state, not payment audit</p></div>
      </div>
      <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,.85fr)]">
        <section className={`${panel} p-5 sm:p-7`} aria-labelledby="guardrails-title">
          <div className="flex items-center gap-3"><ShieldCheck size={21} className="text-[#e7c18a]"/><h2 id="guardrails-title" className="display text-2xl">Local launch guardrails</h2></div>
          <p className="mt-2 text-xs leading-6 text-white/50">These are configuration-format checks, not cryptographic account verification.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">{prerequisites.map(check => {
            const ok = report.flags[check.key];
            return <div key={check.key} className="rounded-xl border border-white/10 bg-black/25 p-4">
              <div className="flex items-start gap-2">{ok ? <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-400" size={18}/> : <CircleAlert className="mt-0.5 shrink-0 text-amber-400" size={18}/>}<p className="text-sm font-medium">{check.label}</p></div>
              <p className="mt-2 text-xs leading-5 text-white/50">{check.description}</p>
            </div>;
          })}</div>
        </section>
        <section className={`${panel} p-5 sm:p-7`} aria-labelledby="evidence-title">
          <div className="flex items-center gap-3"><Clock3 size={21} className="text-[#e7c18a]"/><h2 id="evidence-title" className="display text-2xl">Evidence still required</h2></div>
          <div className="mt-5 space-y-4 text-sm">
            <Evidence label="Stripe automatic signed forwarding" detail="CLI Ready before checkout, HTTP 200, matching event/session, timely DB confirmation"/>
            <Evidence label="Stripe merchant identity" detail="Dujuan must approve the actual merchant of record; previous sandbox showed HoneyBee Creation LLC"/>
            <Evidence label="Apple Pay through Stripe" detail="Eligible Apple device and wallet, approved merchant, and successful signed sandbox payment"/>
            <Evidence label="Square owner and location" detail="Seller authorization, POS location, payment lookup permission and explicit appointment linking"/>
          </div>
          <div className="mt-6 rounded-xl border border-[#d9b77d]/25 bg-[#d9b77d]/5 p-4 text-xs leading-6 text-[#e8d6bd]">
            <BadgeCheck size={17} className="mb-2 text-[#dfb774]"/>
            Stripe CLI authentication previously returned 403. This dashboard does not call Stripe or claim that automatic forwarding works.
          </div>
        </section>
      </div>
      <section className={`${panel} mt-8 p-5 sm:p-7`} aria-labelledby="journey-title">
        <h2 id="journey-title" className="display text-2xl">The phased payment experience</h2>
        <p className="mt-2 text-sm text-white/55">Building in stages means Dujuan gets a clean experience without an unsafe second deposit processor.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Phase number="01" Icon={CreditCard} title="Stripe deposit" label="Existing TEST foundation" description="A $10 online reservation deposit. Apple Pay may appear in Stripe-hosted Checkout on eligible devices."/>
          <Phase number="02" Icon={Smartphone} title="Apple Pay wallet" label="Next phase · gated" description="A Stripe payment method, not another processor. Wallet testing and signed webhook evidence required."/>
          <Phase number="03" Icon={Store} title="Square in-shop balance" label="Future phase · unconnected" description="Dujuan collects the remaining balance through Square POS. Website payment lookup only after seller approval."/>
        </div>
        <div className="mt-6 rounded-xl border border-[#d9b77d]/25 bg-[#d9b77d]/5 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#eed3a4]"><Wallet size={17}/> Example only · no live payment data</div>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3"><div><p className="text-white/50">Service total</p><p className="display mt-1 text-2xl">$40.00</p></div><div><p className="text-white/50">Verified Stripe deposit</p><p className="display mt-1 text-2xl">−$10.00</p></div><div><p className="text-white/50">Square balance due</p><p className="display mt-1 text-2xl text-[#edca8e]">$30.00</p></div></div>
          <p className="mt-3 text-xs leading-5 text-white/50">This is illustrative accounting math, not a statement that the previous late-paid reservation has been credited or confirmed. Actual allocations require independently verified provider records.</p>
        </div>
      </section>
      <div className="mt-7 flex flex-wrap items-center gap-3">
        <Link href="/owner/payment-activity" className="inline-flex items-center gap-2 rounded-full border border-[#8f7048] px-5 py-3 text-sm text-[#eac98f] hover:bg-[#d9b77d]/10"><Clock3 size={16}/> Payment activity <ArrowUpRight size={15}/></Link>
        <Link href="/owner/reconciliation" className="inline-flex items-center gap-2 rounded-full border border-[#8f7048] px-5 py-3 text-sm text-[#eac98f] hover:bg-[#d9b77d]/10"><CreditCard size={16}/> Payment review <ArrowUpRight size={15}/></Link>
      </div>
      <p className="mt-6 text-xs text-white/40">Last local check: {formatDate(report.generatedAt)} · No merchant payment provider API was called · No migrations were executed.</p>
    </>}
  </main>;
}

function Evidence({ label, detail }: { label: string; detail: string }) {
  return <div className="border-b border-white/10 pb-4 last:border-b-0 last:pb-0"><p className="flex items-center gap-2 font-medium"><CircleAlert size={16} className="shrink-0 text-[#d9b77d]"/> {label}</p><p className="mt-2 pl-6 text-xs leading-5 text-white/55">{detail}</p></div>;
}
function Phase({ number, Icon, title, label, description }: {
  number: string; Icon: typeof CreditCard; title: string; label: string; description: string;
}) {
  return <div className="rounded-2xl border border-[#78603f]/35 bg-black/25 p-5">
    <div className="flex items-center justify-between text-[#dec08b]"><Icon size={23} aria-hidden="true"/><span className="display text-2xl opacity-55">{number}</span></div>
    <h3 className="display mt-5 text-xl">{title}</h3><p className="mt-2 text-[11px] font-semibold uppercase tracking-widest text-[#d9b77d]">{label}</p>
    <p className="mt-3 text-sm leading-6 text-white/55">{description}</p>
  </div>;
}
