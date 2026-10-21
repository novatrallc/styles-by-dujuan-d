'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { AlertTriangle, ArrowLeft, ClipboardList, Clock3, RefreshCw, ShieldCheck, Search } from 'lucide-react';

type Item = { id: string; kind: string; audience: string; status: 'pending' | 'sending' | 'failed'; attempts: number; last_error: string | null; created_at: string; sent_at: string | null; provider_message_id: string | null; event_key: string };
type Result = { items: Item[]; checkedAt: string; truncated: boolean; limit: number };
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = url && key ? createClient(url, key) : null;
const time = (date: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date));
const label = (s: string) => s.replaceAll('_', ' ');

export default function NotificationInvestigationsPage() {
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('attention');
  const [query, setQuery] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      if (!supabase) throw new Error('Supabase browser configuration is missing.');
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session?.access_token) throw new Error('Sign in to the owner dashboard first.');
      const response = await fetch('/api/owner/notifications/investigations', { headers: { Authorization: `Bearer ${data.session.access_token}` }, cache: 'no-store' });
      if (response.status === 401) throw new Error('Owner access denied. Check OWNER_EMAILS.');
      if (!response.ok) throw new Error('Unable to load investigations. Confirm Build 3.9 migration is installed.');
      setResult(await response.json() as Result);
    } catch (cause) { setResult(null); setError(cause instanceof Error ? cause.message : 'Investigation request failed.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const rows = useMemo(() => (result?.items ?? []).filter(item => {
    const ageMinutes = (new Date(result?.checkedAt ?? '').getTime() - new Date(item.created_at).getTime()) / 60000;
    const needsAttention = item.status === 'failed' || (item.status === 'sending' && ageMinutes > 15);
    if (filter === 'attention' && !needsAttention) return false;
    if (filter !== 'attention' && filter !== 'all' && item.status !== filter) return false;
    const needle = query.trim().toLowerCase();
    return !needle || [item.kind, item.status, item.event_key, item.id, item.last_error ?? ''].some(value => value.toLowerCase().includes(needle));
  }), [result, filter, query]);
  const failed = result?.items.filter(item => item.status === 'failed').length ?? 0;
  const stalled = result?.items.filter(item => item.status === 'sending' && (new Date(result.checkedAt).getTime() - new Date(item.created_at).getTime()) > 900000).length ?? 0;
  return <main className="section-wrap section-space min-h-[70vh] text-white">
    <Link href="/owner/notifications/health" className="inline-flex items-center gap-2 text-sm text-[#d9b77d] hover:underline"><ArrowLeft size={16}/> Back to delivery health</Link>
    <div className="mt-8 flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[.25em] text-[#d9b77d]">PRIVATE OWNER CONSOLE</p><h1 className="display mt-3 text-3xl md:text-5xl">Notification investigations</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">Review failed and delayed notification records. This workspace cannot send, retry, delete, or change messages.</p></div><button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-[#d9b77d]/50 px-4 py-3 text-sm text-[#e8cf9b] disabled:opacity-50"><RefreshCw size={17}/> {loading ? 'Refreshing…' : 'Refresh'}</button></div>
    {error && <p role="alert" className="luxe-card mt-8 p-5 text-[#e8cf9b]">{error}</p>}
    {loading && <p role="status" className="mt-8 text-white/65">Loading investigations…</p>}
    {result && !loading && <>
      <div className="mt-8 grid gap-3 sm:grid-cols-3"><div className="luxe-card p-5"><AlertTriangle className="text-[#d9b77d]"/><p className="mt-3 text-3xl font-semibold">{failed}</p><p className="text-sm text-white/60">Failed</p></div><div className="luxe-card p-5"><Clock3 className="text-[#d9b77d]"/><p className="mt-3 text-3xl font-semibold">{stalled}</p><p className="text-sm text-white/60">Potentially stalled*</p></div><div className="luxe-card p-5"><ClipboardList className="text-[#d9b77d]"/><p className="mt-3 text-3xl font-semibold">{result.items.length}</p><p className="text-sm text-white/60">Records loaded (max {result.limit})</p></div></div>
      <section className="luxe-card mt-6 p-5 md:p-7"><h2 className="display text-2xl">Investigation queue</h2><div className="mt-5 flex flex-wrap gap-3"><label className="text-sm text-white/70">Status <select className="ml-2 rounded-lg border border-white/20 bg-[#171719] px-3 py-2 text-white" value={filter} onChange={e => setFilter(e.target.value)}><option value="attention">Needs attention</option><option value="all">All open records</option><option value="failed">Failed</option><option value="sending">Sending</option><option value="pending">Pending</option></select></label><label className="flex items-center gap-2 rounded-lg border border-white/20 px-3 text-white/70"><Search size={16}/><span className="sr-only">Search events</span><input className="bg-transparent py-2 text-sm text-white outline-none" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search event or error"/></label></div>
        {result.truncated && <p className="mt-4 text-sm text-[#e8cf9b]">Only the oldest {result.limit} open records are shown. This is not a complete count.</p>}
        {rows.length === 0 ? <div className="mt-6 rounded-xl border border-white/10 p-6 text-white/65"><ShieldCheck className="mb-3 text-[#d9b77d]"/>No records match your filter.</div> : <div className="mt-5 space-y-3">{rows.map(item => <article key={item.id} className="rounded-xl border border-white/10 bg-black/25 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="capitalize text-[#e8cf9b]">{label(item.kind)}</strong><span className="rounded-full border border-[#d9b77d]/40 px-3 py-1 text-xs capitalize text-[#e8cf9b]">{item.status}</span></div><p className="mt-2 text-sm text-white/70">{item.audience} · {time(item.created_at)} ET · {item.attempts} attempt(s)</p><p className="mt-2 break-all text-xs text-white/50">Event: {item.event_key}</p>{item.last_error && <p className="mt-3 break-words rounded-lg bg-[#d9b77d]/10 p-3 text-sm text-[#e8cf9b]">Last error: {item.last_error}</p>}<p className="mt-3 text-xs text-white/45">Reference: {item.id}</p></article>)}</div>}
      </section>
      <section className="luxe-card mt-6 p-5 md:p-7"><h2 className="display text-2xl">Safe recovery checklist</h2><ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-white/70"><li>Check whether the provider or Mailpit already accepted the message before considering a resend.</li><li>Confirm the original event key, attempt count, and latest error.</li><li>Investigate stale sending states separately; their delivery outcome may be unknown.</li><li>Never manually reset an outbox status or replay a payment event without checking for duplicates.</li><li>Use a controlled, audited retry workflow only after it has been implemented and tested.</li></ol><p className="mt-4 text-xs text-white/45">* Stalled is estimated using record creation time, not claim time. It is a triage signal, not proof of a stuck delivery. This view excludes sent records.</p><p className="mt-2 text-xs text-white/45">Checked {time(result.checkedAt)} ET · No changes were made.</p></section>
    </>}
  </main>;
}
