'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { ArrowLeft, RotateCcw, ShieldAlert, RefreshCw } from 'lucide-react';

type Item = { id: string; kind: string; audience: string; status: string; attempts: number; last_error: string | null; created_at: string; provider_message_id: string | null; sent_at: string | null };
type Result = { items: Item[]; deliveryEnabled: boolean };
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = url && key ? createClient(url, key) : null;

export default function RecoveryPage() {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [ack, setAck] = useState<Record<string, boolean>>({});
  const sessionToken = async () => {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) throw new Error('Sign in to the owner dashboard first.');
    return data.session.access_token;
  };
  const refresh = useCallback(async () => {
    setBusy(true); setError('');
    try {
      if (!supabase) throw new Error('Supabase is not configured.');
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) throw new Error('Sign in to the owner dashboard first.');
      const response = await fetch('/api/owner/notifications/recovery', { headers: { Authorization: `Bearer ${data.session.access_token}` }, cache: 'no-store' });
      if (!response.ok) throw new Error(response.status === 401 ? 'Owner access denied.' : 'Could not load recovery queue.');
      setResult(await response.json() as Result);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load.'); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  async function requestRetry(item: Item) {
    if (!ack[item.id] || !window.confirm('Requeue this notification? Only proceed after checking the provider for possible delivery.')) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const token = await sessionToken();
      const response = await fetch('/api/owner/notifications/recovery', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: item.id, acknowledged: true }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Retry request rejected.');
      setNotice('Requeued for the gated dispatcher. No email has been sent yet.');
      setAck(v => ({ ...v, [item.id]: false }));
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Recovery request failed.'); }
    finally { setBusy(false); }
  }
  return <main className="section-wrap section-space min-h-[75vh]">
    <Link href="/owner/notifications/investigations" className="inline-flex items-center gap-2 text-sm text-[#d9b77d]"><ArrowLeft size={17}/> Back to investigations</Link>
    <p className="gold mt-8 text-xs tracking-[.25em]">PRIVATE BUSINESS CONSOLE</p>
    <h1 className="display mt-3 text-4xl md:text-5xl">Notification recovery</h1>
    <p className="mt-4 max-w-3xl text-white/60">A controlled review queue for failed emails. Requeueing is disabled by default and never sends a message directly.</p>
    <div className="luxe-card mt-8 p-6"><div className="flex items-center gap-3 text-[#e8cf9b]"><ShieldAlert size={22}/><h2 className="display text-2xl">Delivery safety first</h2></div>
      <p className="mt-3 text-sm leading-6 text-white/65">Before requesting a retry, verify the provider did not already accept or deliver the original email. A network timeout can look like a failure even after successful delivery. Retrying may cause duplicates. The original notification ID and provider idempotency key are retained, but provider guarantees may expire.</p>
      <p className="mt-3 text-sm text-white/55">Live delivery: {result?.deliveryEnabled ? 'Enabled — use extra caution' : 'Disabled'} · Manual recovery requires ENABLE_NOTIFICATION_RECOVERY=true.</p>
    </div>
    <div className="mt-8 flex items-center justify-between gap-4"><h2 className="display text-2xl">Failed notifications ({result?.items.length ?? '—'})</h2><button type="button" onClick={() => void refresh()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-[#d9b77d]/40 px-4 py-2 text-[#e8cf9b] disabled:opacity-50"><RefreshCw size={16}/> Refresh</button></div>
    {error && <p role="alert" className="mt-4 text-rose-300">{error}</p>}{notice && <p role="status" className="mt-4 text-[#e8cf9b]">{notice}</p>}
    {result?.items.length === 0 && <div className="luxe-card mt-5 p-8 text-white/60">No failed notifications need review.</div>}
    <div className="mt-5 grid gap-4">{result?.items.map(item => {
      const eligible = item.attempts < 3 && !item.provider_message_id && !item.sent_at;
      return <section key={item.id} className="luxe-card p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="text-lg text-[#e8cf9b]">{item.kind.replaceAll('_', ' ')} · {item.audience}</h3><p className="mt-1 text-xs text-white/50">{item.id} · {item.attempts}/3 attempts</p><p className="mt-3 text-sm text-white/65">{item.last_error ?? 'No failure details recorded.'}</p></div><span className="rounded-full border border-rose-400/30 px-3 py-1 text-xs text-rose-200">Failed</span></div>
        {eligible ? <div className="mt-5 flex flex-wrap items-center gap-4"><label className="flex max-w-2xl items-start gap-2 text-sm text-white/70"><input type="checkbox" checked={ack[item.id] ?? false} onChange={e => setAck(v => ({ ...v, [item.id]: e.target.checked }))} className="mt-1"/> I checked the provider for prior delivery and understand a duplicate email may still be possible.</label><button type="button" onClick={() => void requestRetry(item)} disabled={busy || !ack[item.id]} className="inline-flex items-center gap-2 rounded-xl border border-[#d9b77d]/60 px-4 py-2 text-sm text-[#e8cf9b] disabled:opacity-40"><RotateCcw size={16}/> Request retry</button></div> : <p className="mt-4 text-sm text-white/50">Manual review only — provider receipt exists or retry limit reached.</p>}
      </section>;
    })}</div>
  </main>;
}
