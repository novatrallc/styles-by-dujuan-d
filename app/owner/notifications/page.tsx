'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { ArrowLeft, BellRing, CheckCheck, Clock3, AlertTriangle, RefreshCw, Search, ShieldCheck, Mail, CalendarDays, Eye, Send, FlaskConical, Activity, ClipboardList, RotateCcw } from 'lucide-react';

type Notification = {
  id: string;
  kind: string;
  audience: string;
  status: string;
  created_at: string;
  sent_at: string | null;
  attempts: number | null;
  customer_name: string | null;
  service_name: string | null;
  appointment_start: string | null;
};
type Filter = 'all' | 'pending' | 'sent' | 'attention';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const zone = 'America/New_York';
function when(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { timeZone: zone, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}
function title(kind: string) {
  return kind.replace(/[_-]/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}
function isAttention(status: string) { return ['failed', 'error', 'dead', 'needs_review'].includes(status.toLowerCase()); }
function isSent(status: string) { return ['sent', 'delivered'].includes(status.toLowerCase()); }
function isPending(status: string) { return !isAttention(status) && !isSent(status); }

export default function OwnerNotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authorized, setAuthorized] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (!supabase) throw new Error('Supabase browser configuration is missing.');
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw new Error('Unable to verify your session. Sign in again.');
      const token = data.session?.access_token;
      if (!token) throw new Error('Please sign in on the owner dashboard first.');
      const response = await fetch('/api/owner/notifications', {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
      });
      if (response.status === 401) throw new Error('Owner access denied. Confirm your email is listed in OWNER_EMAILS.');
      if (!response.ok) throw new Error('Unable to load notifications. Check the Build 3.9 migration and server logs.');
      const result: { items?: Notification[] } = await response.json();
      setItems(Array.isArray(result.items) ? result.items : []);
      setAuthorized(true);
    } catch (cause) {
      setItems([]);
      setAuthorized(false);
      setError(cause instanceof Error ? cause.message : 'Unable to load notifications.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const counts = useMemo(() => ({
    all: items.length,
    pending: items.filter(item => isPending(item.status)).length,
    sent: items.filter(item => isSent(item.status)).length,
    attention: items.filter(item => isAttention(item.status)).length,
  }), [items]);
  const visible = useMemo(() => items.filter(item => {
    if (filter === 'pending' && !isPending(item.status)) return false;
    if (filter === 'sent' && !isSent(item.status)) return false;
    if (filter === 'attention' && !isAttention(item.status)) return false;
    const text = [item.kind, item.audience, item.status, item.customer_name, item.service_name].join(' ').toLowerCase();
    return text.includes(query.trim().toLowerCase());
  }), [items, filter, query]);

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' }, { key: 'pending', label: 'Pending' },
    { key: 'sent', label: 'Sent' }, { key: 'attention', label: 'Needs attention' },
  ];

  return (
    <main className="section-wrap section-space min-h-[70vh] text-white">
      <Link href="/owner" className="inline-flex items-center gap-2 text-sm text-[#d9b77d] hover:underline">
        <ArrowLeft size={16} aria-hidden="true" /> Back to owner dashboard
      </Link>
      <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[.25em] text-[#d9b77d]">Private owner console</p>
          <h1 className="display mt-3 text-3xl md:text-5xl">Notification center</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">A refined view of customer messages and owner alerts, all in one place.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3"><Link href="/owner/notifications/health" className="inline-flex items-center gap-2 rounded-xl border border-[#d9b77d]/50 px-4 py-3 text-sm text-[#e8cf9b] transition hover:bg-[#d9b77d]/10"><Activity size={17} aria-hidden="true" /> Delivery health</Link><Link href="/owner/notifications/recovery" className="inline-flex items-center gap-2 rounded-xl border border-[#d9b77d]/50 px-4 py-3 text-sm text-[#e8cf9b] transition hover:bg-[#d9b77d]/10"><RotateCcw size={17} aria-hidden="true" /> Recovery console</Link><Link href="/owner/notifications/investigations" className="inline-flex items-center gap-2 rounded-xl border border-[#d9b77d]/50 px-4 py-3 text-sm text-[#e8cf9b] transition hover:bg-[#d9b77d]/10"><ClipboardList size={17} aria-hidden="true" /> Investigations</Link><Link href="/owner/notifications/local-test" className="inline-flex items-center gap-2 rounded-xl border border-[#d9b77d]/50 px-4 py-3 text-sm text-[#e8cf9b] transition hover:bg-[#d9b77d]/10"><FlaskConical size={17} aria-hidden="true" /> Local email lab</Link><Link href="/owner/notifications/test-send" className="inline-flex items-center gap-2 rounded-xl border border-[#d9b77d]/50 px-4 py-3 text-sm text-[#e8cf9b] transition hover:bg-[#d9b77d]/10"><Send size={17} aria-hidden="true" /> Test delivery</Link>
        <Link href="/owner/notifications/preview" className="inline-flex items-center gap-2 rounded-xl border border-[#d9b77d]/50 px-4 py-3 text-sm text-[#e8cf9b] transition hover:bg-[#d9b77d]/10"><Eye size={17} aria-hidden="true" /> Email previews</Link>
        <button type="button" onClick={() => void refresh()} disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-[#d9b77d]/50 px-4 py-3 text-sm text-[#e8cf9b] transition hover:bg-[#d9b77d]/10 disabled:opacity-50">
          <RefreshCw size={17} aria-hidden="true" /> {loading ? 'Refreshing…' : 'Refresh'}
        </button>
        </div>
      </div>

      {!error && authorized && <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {([
          { label: 'Total events', value: counts.all, icon: BellRing },
          { label: 'Pending', value: counts.pending, icon: Clock3 },
          { label: 'Sent', value: counts.sent, icon: CheckCheck },
          { label: 'Needs attention', value: counts.attention, icon: AlertTriangle },
        ] as const).map(stat => <div key={stat.label} className="luxe-card p-4 md:p-5">
          <stat.icon size={19} className="text-[#d9b77d]" aria-hidden="true" />
          <p className="mt-4 text-3xl font-semibold tabular-nums">{stat.value}</p>
          <p className="mt-1 text-xs text-white/55">{stat.label}</p>
        </div>)}
      </div>}

      <section className="luxe-card mt-7 p-5 md:p-7" aria-live="polite">
        {loading ? <p className="flex items-center gap-2 text-white/70"><RefreshCw size={18} className="animate-spin text-[#d9b77d]" aria-hidden="true" /> Loading notifications…</p>
        : error ? <div role="alert" className="flex items-start gap-3 text-[#e8cf9b]"><AlertTriangle size={20} className="mt-0.5 shrink-0" aria-hidden="true" /><p>{error} <Link href="/owner" className="underline">Owner dashboard</Link></p></div>
        : <>
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter notifications">
              {filters.map(option => <button key={option.key} type="button" aria-pressed={filter === option.key}
                onClick={() => setFilter(option.key)} className={`rounded-full border px-3 py-2 text-xs transition ${filter === option.key ? 'border-[#d9b77d] bg-[#d9b77d] text-black' : 'border-white/20 text-white/70 hover:border-[#d9b77d]/60'}`}>
                {option.label} <span className="ml-1 tabular-nums">{counts[option.key]}</span>
              </button>)}
            </div>
            <label className="relative block min-w-0 lg:w-64">
              <span className="sr-only">Search notifications</span>
              <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#d9b77d]" aria-hidden="true" />
              <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search notifications"
                className="w-full rounded-xl border border-white/20 bg-black/40 py-2.5 pl-10 pr-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#d9b77d]" />
            </label>
          </div>
          {visible.length === 0 ? <div className="py-14 text-center">
            <ShieldCheck size={30} className="mx-auto text-[#d9b77d]" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-semibold">{items.length === 0 ? 'No notifications yet' : 'No matching notifications'}</h2>
            <p className="mt-2 text-sm text-white/55">{items.length === 0 ? 'Customer updates and owner alerts will appear here as they are queued.' : 'Try a different filter or search.'}</p>
          </div> : <div className="mt-6 space-y-3">
            {visible.map(item => <article key={item.id} className="rounded-xl border border-white/10 bg-white/[.025] p-4 transition hover:border-[#d9b77d]/30 md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="rounded-lg border border-[#d9b77d]/20 bg-[#d9b77d]/10 p-2 text-[#d9b77d]">{item.audience === 'owner' ? <BellRing size={18} aria-hidden="true" /> : <Mail size={18} aria-hidden="true" />}</span>
                  <div className="min-w-0">
                    <h3 className="font-medium text-white">{title(item.kind)}</h3>
                    <p className="mt-1 text-sm text-white/60">{item.customer_name || (item.audience === 'owner' ? 'Owner alert' : 'Customer notification')}{item.service_name ? ` · ${item.service_name}` : ''}</p>
                    {item.appointment_start && <p className="mt-2 flex items-center gap-1.5 text-xs text-white/50"><CalendarDays size={13} aria-hidden="true" /> Appointment: {when(item.appointment_start)} ET</p>}
                  </div>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs ${isAttention(item.status) ? 'border-amber-400/40 text-amber-200' : isSent(item.status) ? 'border-emerald-400/30 text-emerald-200' : 'border-[#d9b77d]/35 text-[#e8cf9b]'}`}>{title(item.status)}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-white/10 pt-3 text-xs text-white/45">
                <span>Queued: {when(item.created_at)} ET</span>
                {item.sent_at && <span>Sent: {when(item.sent_at)} ET</span>}
                <span>Audience: {title(item.audience)}</span>
                <span>Attempts: {item.attempts ?? 0}</span>
              </div>
            </article>)}
          </div>}
          <p className="mt-6 text-xs text-white/40">Showing up to 100 most recent events. This is a read-only delivery log, not a customer inbox. No messages are sent from this page.</p>
        </>}
      </section>
    </main>
  );
}
