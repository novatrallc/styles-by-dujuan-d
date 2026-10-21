'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { Activity, ArrowLeft, AlertTriangle, CheckCircle2, Clock3, RefreshCw, Send, ShieldCheck, ClipboardList, RotateCcw } from 'lucide-react';

type Health = {
  counts: { pending: number; sending: number; sent: number; failed: number };
  oldestPendingAt: string | null;
  deliveryEnabled: boolean;
  checkedAt: string;
  scope: string;
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = url && key ? createClient(url, key) : null;
const fmt = (value: string) => new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short',
}).format(new Date(value));

export default function NotificationHealthPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (!supabase) throw new Error('Supabase browser configuration is missing.');
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw new Error('Unable to read your session.');
      const token = data.session?.access_token;
      if (!token) throw new Error('Please sign in to the owner dashboard first.');
      const response = await fetch('/api/owner/notifications/health', {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
      });
      if (response.status === 401) throw new Error('Owner authorization failed. Check OWNER_EMAILS.');
      if (!response.ok) throw new Error('Unable to load delivery health. Verify the Build 3.9 database migration.');
      setHealth(await response.json() as Health);
    } catch (cause) {
      setHealth(null);
      setError(cause instanceof Error ? cause.message : 'Unable to load health status.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const pendingAgeHours = health?.oldestPendingAt
    ? Math.max(0, (new Date(health.checkedAt).getTime() - new Date(health.oldestPendingAt).getTime()) / 3_600_000)
    : null;
  const attention = Boolean(health && (health.counts.failed > 0 || (health.deliveryEnabled && pendingAgeHours !== null && pendingAgeHours > 1)));
  const stats = health ? [
    { label: 'Pending', count: health.counts.pending, Icon: Clock3 },
    { label: 'In progress', count: health.counts.sending, Icon: Activity },
    { label: 'Sent', count: health.counts.sent, Icon: CheckCircle2 },
    { label: 'Failed', count: health.counts.failed, Icon: AlertTriangle },
  ] : [];

  return <main className="section-wrap section-space min-h-[70vh] text-white">
    <Link href="/owner" className="inline-flex items-center gap-2 text-sm text-[#d9b77d] hover:underline"><ArrowLeft size={16}/> Back to owner dashboard</Link>
    <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs uppercase tracking-[.25em] text-[#d9b77d]">PRIVATE OWNER CONSOLE</p>
        <h1 className="display mt-3 text-3xl md:text-5xl">Delivery health</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">A clear view of notification queue health and delivery readiness. No customer information is displayed.</p></div>
      <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-[#d9b77d]/50 px-4 py-3 text-sm text-[#e8cf9b] hover:bg-[#d9b77d]/10 disabled:opacity-50"><RefreshCw size={17}/> {loading ? 'Refreshing…' : 'Refresh status'}</button>
    </div>
    {error && <div role="alert" className="luxe-card mt-8 flex items-start gap-3 p-5 text-[#e8cf9b]"><AlertTriangle size={20}/>{error}</div>}
    {loading && <p role="status" className="mt-8 text-white/65">Checking notification health…</p>}
    {health && !loading && <>
      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">{stats.map(({label,count,Icon}) => <div key={label} className="luxe-card p-5"><Icon size={21} className="text-[#d9b77d]" aria-hidden="true"/><p className="mt-4 text-3xl font-semibold tabular-nums">{count}</p><p className="mt-1 text-sm text-white/60">{label}</p></div>)}</div>
      <section className="luxe-card mt-6 p-6 md:p-8" aria-label="Delivery readiness">
        <div className="flex items-start gap-3">{attention ? <AlertTriangle className="shrink-0 text-[#e8cf9b]"/> : <ShieldCheck className="shrink-0 text-[#d9b77d]"/>}
          <div><h2 className="display text-2xl">{attention ? 'Review recommended' : 'Operations overview'}</h2>
            <p className="mt-2 text-sm leading-6 text-white/65">{health.deliveryEnabled ? 'Production delivery is enabled by server configuration.' : 'Production email delivery is disabled. Pending notifications will remain queued until a dispatcher is configured and enabled.'}</p>
            {health.counts.failed > 0 && <p className="mt-3 text-sm text-[#e8cf9b]">{health.counts.failed} failed notification(s) require manual investigation. This page never retries or sends emails.</p>}
            {health.counts.sending > 0 && <p className="mt-3 text-sm text-white/65">In-progress messages may include interrupted dispatch attempts; investigate any that remain in this state.</p>}
            {health.oldestPendingAt && <p className="mt-3 text-sm text-white/65">Oldest pending event: {fmt(health.oldestPendingAt)} ET ({pendingAgeHours?.toFixed(1)} hours old).</p>}
            <p className="mt-4 text-xs text-white/40">Last checked: {fmt(health.checkedAt)} ET · Counts cover the full notification outbox.</p>
          </div></div>
      </section>
      <div className="mt-6 flex flex-wrap gap-3"><Link href="/owner/notifications" className="inline-flex items-center gap-2 rounded-xl border border-[#d9b77d]/50 px-4 py-3 text-sm text-[#e8cf9b]"><Send size={16}/> Open notification history</Link><Link href="/owner/notifications/recovery" className="inline-flex items-center gap-2 rounded-xl border border-[#d9b77d]/50 px-4 py-3 text-sm text-[#e8cf9b]"><RotateCcw size={16} aria-hidden="true"/> Recovery console</Link><Link href="/owner/notifications/investigations" className="inline-flex items-center gap-2 rounded-xl border border-[#d9b77d]/50 px-4 py-3 text-sm text-[#e8cf9b]"><ClipboardList size={16}/> Investigate failures</Link><Link href="/owner/notifications/local-test" className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-sm text-white/75">Local Email Lab</Link></div>
    </>}
  </main>;
}
