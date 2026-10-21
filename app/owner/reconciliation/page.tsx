'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { ArrowLeft, ArrowRight, AlertTriangle, CheckCircle2, ClipboardList, FileText, History, LockKeyhole, RefreshCw, ShieldCheck, X } from 'lucide-react';

type HistoryEntry = { id:string; actor_email:string; action:'note_added'|'resolved'; resolution_kind:string|null; external_reference:string|null; note:string; created_at:string };
type ReviewItem = {
  id:string; appointment_id:string; stripe_event_id:string; stripe_checkout_session_id:string;
  reason:string; amount_cents:number; currency:string; status:'needs_review'|'resolved'; created_at:string;
  resolved_at:string|null; resolution_note:string|null; displayStatus:string;
  appointment: { customerName:string; startsAt:string; storedStatus:string; holdExpired:boolean; paymentReference:string|null; sessionMatches:boolean }|null;
  actions:HistoryEntry[];
};
type Report = { items:ReviewItem[]; asOf:string; notes:string };
const endpoint = '/api/owner/reconciliation';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl,supabaseKey) : null;
const outcomes = [
  {value:'manual_resolved', label:'Other documented resolution'},
  {value:'refund_documented', label:'Refund completed externally'},
  {value:'credit_documented', label:'Credit handled externally'},
] as const;
const dateLabel = (v:string|null|undefined) => v ? new Date(v).toLocaleString('en-US',{timeZone:'America/New_York',dateStyle:'medium',timeStyle:'short'}) + ' ET' : '—';
const money = (cents:number,currency:string) => new Intl.NumberFormat('en-US',{style:'currency',currency:currency.toUpperCase()}).format(cents/100);
const chip = 'inline-flex items-center gap-2 rounded-full border border-[#725a39]/70 px-3 py-1.5 text-xs text-[#eed2a3]';
const panel = 'rounded-[22px] border border-[#78603f]/35 bg-gradient-to-br from-[#1a1918] to-[#101113]';
const field = 'w-full rounded-xl border border-[#776243]/60 bg-[#090a0c] px-4 py-3 text-sm text-[#f7f0e5] outline-none transition focus:border-[#e3c18a] focus:ring-2 focus:ring-[#e3c18a]/20';

export default function PaymentReconciliationPro() {
  const [items,setItems] = useState<ReviewItem[]>([]);
  const [selectedId,setSelectedId] = useState<string|null>(null);
  const [filter,setFilter] = useState<'needs_review'|'resolved'|'all'>('needs_review');
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [note,setNote] = useState('');
  const [resolutionKind,setResolutionKind] = useState<(typeof outcomes)[number]['value']>('manual_resolved');
  const [externalReference,setExternalReference] = useState('');
  const [dialog,setDialog] = useState(false);
  const [confirmText,setConfirmText] = useState('');
  const [acknowledge,setAcknowledge] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const pendingKey = useRef<string|null>(null);

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      if (!supabase) throw new Error('Owner authentication configuration is missing.');
      const {data,error:sessionError} = await supabase.auth.getSession();
      if (sessionError || !data.session?.access_token) throw new Error('Sign in on the owner dashboard first.');
      const response = await fetch(endpoint,{headers:{Authorization:`Bearer ${data.session.access_token}`},cache:'no-store'});
      const result = await response.json() as Report & {error?:string};
      if (!response.ok) throw new Error(result.error ?? 'Unable to load reviews.');
      setItems(result.items ?? []);
      setSelectedId(current => (result.items ?? []).some(i=>i.id===current) ? current : (result.items ?? []).find(i=>i.status==='needs_review')?.id ?? result.items?.[0]?.id ?? null);
    } catch (cause) {
      setItems([]); setError(cause instanceof Error ? cause.message : 'Unable to load review records.');
    } finally { setLoading(false); }
  },[]);
  useEffect(()=>{ void refresh(); },[refresh]);
  useEffect(()=>{ if(dialog) { cancelRef.current?.focus(); const handle=(e:KeyboardEvent)=>{ if(e.key==='Escape') setDialog(false); }; document.addEventListener('keydown',handle); return ()=>document.removeEventListener('keydown',handle); } },[dialog]);
  const filtered = items.filter(i=>filter==='all'||i.status===filter);
  const selected = filtered.find(i=>i.id===selectedId) ?? filtered[0] ?? null;
  const pendingCount = items.filter(i=>i.status==='needs_review').length;
  const resolvedCount = items.filter(i=>i.status==='resolved').length;

  async function submit(action:'add_note'|'resolve') {
    if(!selected||saving||note.trim().length<20) return;
    if(action==='resolve' && (!acknowledge||confirmText!=='RESOLVE')) return;
    setSaving(true);setError('');setNotice('');
    try {
      if(!supabase) throw new Error('Owner session unavailable.');
      const {data}=await supabase.auth.getSession();
      if(!data.session?.access_token) throw new Error('Please sign in again.');
      pendingKey.current = pendingKey.current ?? crypto.randomUUID();
      const body = {actionKey:pendingKey.current,reconciliationId:selected.id,action,
        note:note.trim(), ...(action==='resolve' ? {resolutionKind, externalReference:externalReference.trim()||undefined, acknowledged:true} : {})};
      const response = await fetch(`${endpoint}/actions`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify(body),cache:'no-store'});
      const result = await response.json() as {ok?:boolean;error?:string};
      if(!response.ok||!result.ok) throw new Error(result.error ?? 'Unable to record the action.');
      pendingKey.current=null;setDialog(false);setConfirmText('');setAcknowledge(false);setNote('');setExternalReference('');
      setNotice(action==='resolve'?'Review closed with an audit record. No payment or appointment was changed.':'Review note recorded in the audit trail.');
      await refresh();
    } catch(cause) {
      setError((cause instanceof Error?cause.message:'Unable to save.')+' If the outcome is uncertain, refresh before retrying.');
      setDialog(false);
    } finally {setSaving(false);}
  }
  function choose(item:ReviewItem){setSelectedId(item.id);setNote('');setError('');setNotice('');pendingKey.current=null;setDialog(false);setConfirmText('');setAcknowledge(false);setExternalReference('');}
  return <main className="section-wrap section-space min-h-[75vh] text-[#f7f0e5]">
    <Link href="/owner" className="inline-flex items-center gap-2 text-sm text-[#dfbc7e] hover:underline"><ArrowLeft size={17}/> Back to owner dashboard</Link>
    <div className="mt-4"><Link href="/owner/payment-activity" className="inline-flex items-center gap-2 text-sm text-[#eac98f] hover:underline"><History size={16}/> Payment activity timeline</Link></div>
    <div className="mt-8 flex flex-wrap items-start justify-between gap-5">
      <div><p className="text-xs font-semibold uppercase tracking-[.28em] text-[#d9b77d]">Owner finance workspace · B4.2.5</p><h1 className="display mt-3 text-4xl md:text-5xl">Payment review &amp; resolution</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-white/60">Review late payments, document follow-up and keep a permanent local audit trail. No money moves from this page.</p></div>
      <button type="button" onClick={()=>void refresh()} disabled={loading||saving} className="inline-flex items-center gap-2 rounded-full border border-[#8f7048] px-5 py-3 text-sm text-[#e5c589] hover:bg-[#d9b77d]/10 disabled:opacity-40"><RefreshCw size={17}/> Refresh</button>
    </div>
    <div className={`${panel} mt-7 flex items-start gap-3 p-5 text-sm text-[#edd2a2]`}><ShieldCheck size={20} className="shrink-0"/><div><p className="font-semibold">Local-only review · no automatic refund or booking confirmation</p><p className="mt-1 leading-6 text-white/55">An externally documented refund or credit is an owner declaration, not verification by Stripe. The original expired appointment remains unchanged.</p></div></div>
    <div className="mt-7 grid gap-4 sm:grid-cols-3">
      <div className={`${panel} p-5`}><p className="text-[11px] uppercase tracking-[.2em] text-[#d9b77d]">Needs attention</p><p className="display mt-3 text-4xl">{pendingCount}</p></div>
      <div className={`${panel} p-5`}><p className="text-[11px] uppercase tracking-[.2em] text-[#d9b77d]">Reviewed &amp; closed</p><p className="display mt-3 text-4xl">{resolvedCount}</p></div>
      <div className={`${panel} p-5`}><p className="text-[11px] uppercase tracking-[.2em] text-[#d9b77d]">Visible records</p><p className="display mt-3 text-4xl">{items.length}</p></div>
    </div>
    {error&&<p role="alert" className="mt-5 rounded-xl border border-red-500/40 bg-red-950/20 p-4 text-sm text-red-200">{error}</p>}
    {notice&&<p role="status" className="mt-5 rounded-xl border border-[#d9b77d]/40 bg-[#d9b77d]/10 p-4 text-sm text-[#f0d5a4]">{notice}</p>}
    <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(240px,.8fr)_minmax(0,1.4fr)]">
      <section className={`${panel} p-5 sm:p-6`} aria-label="Payment review queue">
        <h2 className="display text-2xl">Review queue</h2>
        <div className="mt-5 flex flex-wrap gap-2">{(['needs_review','resolved','all'] as const).map(k=><button key={k} type="button" aria-pressed={filter===k} onClick={()=>setFilter(k)} className={`rounded-full border px-3 py-2 text-xs ${filter===k?'border-[#d9b77d] bg-[#d9b77d] text-[#1b140c]':'border-[#695336] text-white/70 hover:border-[#d9b77d]'}`}>{k==='needs_review'?'Needs review':k==='resolved'?'Resolved':'All'}</button>)}</div>
        {loading?<p className="mt-6 text-sm text-white/60">Loading payment reviews…</p>:filtered.length===0?<p className="mt-6 text-sm leading-6 text-white/55">No records in this view.</p>:<div className="mt-5 grid gap-3">{filtered.map(item=><button type="button" key={item.id} onClick={()=>choose(item)} aria-pressed={selected?.id===item.id} className={`rounded-2xl border p-4 text-left transition ${selected?.id===item.id?'border-[#d9b77d] bg-[#d9b77d]/10':'border-white/10 bg-black/25 hover:border-[#866943]'}`}>
          <div className="flex flex-wrap items-start justify-between gap-2"><span className="text-sm font-semibold text-[#f3d69e]">{money(item.amount_cents,item.currency)}</span><span className="text-[11px] text-white/55">{item.status==='resolved'?'Resolved':'Action required'}</span></div>
          <p className="mt-2 text-sm text-white/80">{item.appointment?.customerName||'Appointment review'}</p>
          <p className="mt-1 text-xs leading-5 text-white/50">{item.reason==='late_payment'?'Late payment':'Unexpected reservation state'} · {dateLabel(item.created_at)}</p>
        </button>)}</div>}
      </section>
      <section className={`${panel} min-w-0 p-5 sm:p-7`} aria-label="Selected payment review">
        {!selected?<div className="py-12 text-center"><ClipboardList className="mx-auto text-[#d9b77d]" size={32}/><p className="mt-4 text-white/65">Select a payment review to see details and the audit trail.</p></div>:<>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-[.24em] text-[#d9b77d]">Incident details</p><h2 className="display mt-2 text-3xl">{selected.reason==='late_payment'?'Late payment':'Payment exception'}</h2></div><span className={chip}>{selected.status==='resolved'?<CheckCircle2 size={15}/>:<AlertTriangle size={15}/>} {selected.status==='resolved'?'Resolved':'Action required'}</span></div>
          <p className="mt-4 text-sm leading-7 text-white/65">{selected.displayStatus}. {selected.appointment?.holdExpired?'The original checkout hold has expired. Do not automatically confirm this appointment.':'Review the payment and reservation state before taking any action.'}</p>
          <div className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm sm:grid-cols-2 sm:p-5">
            <div><p className="text-xs text-white/50">Payment amount</p><p className="mt-1 text-lg font-semibold text-[#eac789]">{money(selected.amount_cents,selected.currency)}</p></div>
            <div><p className="text-xs text-white/50">Appointment status (stored)</p><p className="mt-1 capitalize">{selected.appointment?.storedStatus.replaceAll('_',' ')??'Not found'}</p></div>
            <div><p className="text-xs text-white/50">Booked appointment (ET)</p><p className="mt-1">{dateLabel(selected.appointment?.startsAt)}</p></div>
            <div><p className="text-xs text-white/50">Checkout / appointment match</p><p className="mt-1">{selected.appointment?.sessionMatches?'Matched':'Requires investigation'}</p></div>
          </div>
          <div className="mt-5 grid gap-2 text-xs text-white/55"><p className="break-all">Stripe event: <span className="font-mono text-white/70">{selected.stripe_event_id}</span></p><p className="break-all">Checkout session: <span className="font-mono text-white/70">{selected.stripe_checkout_session_id}</span></p><p className="break-all">Appointment ID: <span className="font-mono text-white/70">{selected.appointment_id}</span></p></div>
          <div className="mt-7 border-t border-white/10 pt-6"><h3 className="flex items-center gap-2 text-lg font-semibold"><History size={19} className="text-[#d9b77d]"/> Owner audit history</h3>
            {selected.actions.length===0?<p className="mt-3 text-sm text-white/50">No owner actions recorded yet.</p>:<div className="mt-4 grid gap-3">{selected.actions.map(h=><div key={h.id} className="rounded-xl border border-white/10 bg-[#0c0c0e] p-4"><p className="text-sm font-semibold text-[#e7c98f]">{h.action==='resolved'?'Review resolved':'Note added'} <span className="font-normal text-white/45">· {dateLabel(h.created_at)}</span></p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/75">{h.note}</p><p className="mt-2 text-xs text-white/40">{h.actor_email}{h.external_reference?` · Owner-reported reference: ${h.external_reference}`:''}</p></div>)}</div>}
          </div>
          {selected.status==='resolved'?<div className="mt-7 rounded-2xl border border-[#d9b77d]/25 bg-[#d9b77d]/5 p-5"><p className="flex items-center gap-2 font-semibold text-[#e8cb94]"><CheckCircle2 size={18}/> Review closed</p><p className="mt-2 text-sm leading-6 text-white/60">{selected.resolution_note??'Resolution recorded.'}</p><p className="mt-2 text-xs text-white/45">Closed {dateLabel(selected.resolved_at)}. The appointment was not modified by this action.</p></div>:
          <div className="mt-7 border-t border-white/10 pt-6"><h3 className="flex items-center gap-2 text-lg font-semibold"><FileText size={19} className="text-[#d9b77d]"/> Document an owner action</h3><label className="mt-4 block text-xs font-medium text-white/65" htmlFor="review-note">Internal review note (minimum 20 characters)</label><textarea id="review-note" rows={4} maxLength={1200} value={note} onChange={e=>{setNote(e.target.value);pendingKey.current=null;}} placeholder="What was verified with Stripe? What follow-up is required, and who is handling it?" className={`${field} mt-2 resize-y`}/><p className="mt-1 text-right text-xs text-white/40">{note.trim().length}/1200</p>
          <div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={saving||note.trim().length<20} onClick={()=>void submit('add_note')} className="inline-flex items-center gap-2 rounded-full border border-[#a18456] px-5 py-3 text-sm text-[#ecd19e] hover:bg-white/10 disabled:opacity-40"><FileText size={16}/> Save review note</button><button type="button" disabled={saving||note.trim().length<20} onClick={()=>{setDialog(true);setConfirmText('');setAcknowledge(false);}} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#f0daa8] to-[#c79a50] px-5 py-3 text-sm font-semibold text-[#20160d] hover:brightness-110 disabled:opacity-40">Review resolution <ArrowRight size={16}/></button></div>
          <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-white/45"><LockKeyhole className="mt-0.5 shrink-0" size={16}/> Resolving is an owner-attested recordkeeping action. It does not issue a refund, apply credit, change booking status, or contact a customer.</p></div>}
        </>}
      </section>
    </div>
    <p className="mt-6 text-xs text-white/40">Local records only · Showing up to 100 reviews and 500 recent audit actions · No automatic Stripe delivery claim is made by this page.</p>
    {dialog&&selected&&<div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-md" onMouseDown={e=>{if(e.target===e.currentTarget&&!saving)setDialog(false);}}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="resolution-modal-title" aria-describedby="resolution-modal-description" className="relative my-auto w-full max-w-lg rounded-[24px] border border-[#967346] bg-[#171618] p-6 shadow-[0_30px_100px_#000d] sm:p-8">
        <button type="button" aria-label="Close resolution dialog" disabled={saving} onClick={()=>setDialog(false)} className="absolute right-5 top-5 rounded-full border border-white/15 p-2 text-white/60"><X size={18}/></button>
        <div className="mb-4 inline-flex rounded-2xl border border-[#a08150]/50 bg-[#d9b77d]/10 p-3 text-[#e5c58b]"><ShieldCheck size={25}/></div>
        <p className="text-[11px] font-semibold uppercase tracking-[.25em] text-[#d9b77d]">Private payment operations</p>
        <h2 id="resolution-modal-title" className="display mt-3 text-3xl">Close this payment review?</h2>
        <p id="resolution-modal-description" className="mt-3 text-sm leading-6 text-white/65">Record a documented outcome for {money(selected.amount_cents,selected.currency)}. This will close the review and keep its audit history. It does not change the original reservation or move any funds.</p>
        <label className="mt-5 block text-xs text-white/65" htmlFor="resolution-outcome">Documented outcome</label>
        <select id="resolution-outcome" value={resolutionKind} onChange={e=>{setResolutionKind(e.target.value as typeof resolutionKind);pendingKey.current=null;}} className={`${field} mt-2`}>{outcomes.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>
        {resolutionKind!=='manual_resolved'&&<><label htmlFor="reference" className="mt-4 block text-xs text-white/65">{resolutionKind==='refund_documented'?'External Stripe refund ID (re_…)':'External credit reference'}</label><input id="reference" value={externalReference} onChange={e=>{setExternalReference(e.target.value);pendingKey.current=null;}} className={`${field} mt-2`} maxLength={120} placeholder={resolutionKind==='refund_documented'?'re_...':'Reference supplied by owner'}/></>}
        <div className="mt-5 rounded-xl border border-[#7f623b]/40 bg-[#090a0c] p-4"><label className="flex items-start gap-3 text-sm leading-6 text-white/75"><input type="checkbox" className="mt-1 accent-[#d9b77d]" checked={acknowledge} onChange={e=>setAcknowledge(e.target.checked)}/><span>I have verified the outcome outside this application and understand that this action does not process a refund or confirm the appointment.</span></label></div>
        <label htmlFor="resolve-confirm" className="mt-4 block text-xs text-white/65">Type <strong className="text-[#eac789]">RESOLVE</strong> to confirm</label><input id="resolve-confirm" className={`${field} mt-2`} autoComplete="off" value={confirmText} onChange={e=>setConfirmText(e.target.value)} placeholder="RESOLVE" />
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row"><button ref={cancelRef} type="button" disabled={saving} onClick={()=>setDialog(false)} className="flex-1 rounded-full border border-[#856c49] px-5 py-3 text-sm">Keep in review</button><button type="button" disabled={saving||!acknowledge||confirmText!=='RESOLVE'||(resolutionKind==='refund_documented'&&!/^re_[A-Za-z0-9]{6,}$/.test(externalReference.trim()))||(resolutionKind==='credit_documented'&&externalReference.trim().length<6)} onClick={()=>void submit('resolve')} className="flex-1 rounded-full bg-gradient-to-r from-[#eed6a1] to-[#bd8f46] px-5 py-3 text-sm font-semibold text-[#17120b] disabled:opacity-40">{saving?'Recording…':'Close review'}</button></div>
      </div>
    </div>}
  </main>;
}
