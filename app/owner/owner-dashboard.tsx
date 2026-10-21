"use client";
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { ServiceActionDialog } from './service-action-dialog';
import { OwnerActionDialog } from './owner-action-dialog';
import { LayoutDashboard, CalendarDays, Scissors, Clock3, CalendarOff, Settings2, LogIn, LogOut, ShieldCheck, LockKeyhole, Mail, Eye, EyeOff, X, ArrowRight, FileText, BadgeDollarSign, Timer, Type, BellRing, CreditCard, PanelsTopLeft, FlaskConical, Activity, ClipboardList, RotateCcw, ExternalLink } from 'lucide-react';
import { canChangeAppointment, type AppointmentStatus, type OwnerAction } from '@/lib/appointment-operations';

type Service = {id:string;slug:string;name:string;description:string;price_cents:number|null;duration_minutes:number|null;is_active:boolean};
type Hour = {id:string;weekday:number;start_time:string;end_time:string};
type Off = {id:string;starts_at:string;ends_at:string;reason:string|null};
type Appt = {id:string;starts_at:string;ends_at:string;status:AppointmentStatus;customer_name:string;customer_email:string;customer_phone:string;service_id:string};
type Data = {services:Service[];hours:Hour[];exceptions:Off[];appointments:Appt[];barber:{display_name:string}|null;settings:{bookings_enabled:boolean;timezone:string}|null};
const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const client=url&&anon?createClient(url,anon):null;
const panel:React.CSSProperties={background:'#171719',border:'1px solid #4b3c29',borderRadius:18,padding:24,marginTop:24};
const field:React.CSSProperties={background:'#0b0c0e',border:'1px solid #665139',borderRadius:8,color:'#f7f0e5',padding:'10px 12px',maxWidth:'100%'};
type OperationsLink = { href: string; title: string; description: string; Icon: typeof BellRing; tag: string };
const operationsLinks: OperationsLink[] = [
  {href:'/owner/payment-readiness',title:'Payment Provider Readiness',description:'Review Stripe, Apple Pay and Square rollout gates without moving money.',Icon:ShieldCheck,tag:'PAYMENT FOUNDATION'},
  {href:'/owner/payment-activity',title:'Payment Activity Timeline',description:'Inspect local test payment milestones and verify a linked Stripe session on demand.',Icon:ShieldCheck,tag:'PAYMENT ACTIVITY'},
  {href:'/owner/stripe-verification',title:'Stripe Verification Center',description:'Audit local test bookings, payment events, and readiness safeguards.',Icon:ShieldCheck,tag:'PAYMENT READINESS'},
{
  href: '/owner/stripe-sandbox',
  title: 'Stripe Sandbox Lab',
  description: 'Safely test the $10 reservation deposit using Stripe test mode.',
  Icon: CreditCard,
  tag: 'TEST PAYMENTS'
},
 {href:'/owner/notifications/health',title:'Delivery Health',description:'Monitor queue counts, failed messages, and sending readiness.',Icon:Activity,tag:'SYSTEM HEALTH'},
 {href:'/owner/notifications/investigations',title:'Failure Investigations',description:'Review failed or stalled notifications and follow safe recovery guidance.',Icon:ClipboardList,tag:'INCIDENT REVIEW'},
 {href:'/owner/notifications/recovery',title:'Recovery Console',description:'Review eligible failed notifications and request a guarded manual requeue when enabled.',Icon:RotateCcw,tag:'MANUAL RECOVERY'},
 {href:'/owner/notifications',title:'Notification Center',description:'Review queued, sent, and failed customer and owner messages.',Icon:BellRing,tag:'MESSAGE OPERATIONS'},
 {href:'/owner/reconciliation',title:'Payment Reconciliation',description:'Inspect payments that require manual owner review.',Icon:CreditCard,tag:'PAYMENT OVERSIGHT'},
 {href:'/owner/notifications/preview',title:'Signature Email Studio',description:'Preview premium HTML and plain-text email designs.',Icon:PanelsTopLeft,tag:'BRAND EXPERIENCE'},
 {href:'/owner/notifications/local-test',title:'Local Email Lab',description:'Send fictional test emails to the local Mailpit inbox.',Icon:FlaskConical,tag:'DEVELOPMENT ONLY'},
];
function BusinessOperations(){
 return <section style={panel} aria-labelledby="owner-operations-title">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div><p className="text-xs font-semibold tracking-[.22em] text-[#d9b77d]">OWNER WORKSPACE</p><h2 id="owner-operations-title" className="display mt-2 text-2xl md:text-3xl">Business operations</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">Your private command center for customer communication, payment exceptions, and safe email testing.</p></div>
   <span className="rounded-full border border-[#d9b77d]/30 bg-[#d9b77d]/10 px-3 py-1.5 text-xs text-[#e8cf9b]">Owner access only</span>
  </div>
  <div className="mt-6 grid gap-3 sm:grid-cols-2">
   {operationsLinks.map(({href,title,description,Icon,tag})=><Link key={href} href={href} className="group flex min-h-40 flex-col justify-between rounded-2xl border border-[#6a5335]/55 bg-[#101012] p-5 transition-colors hover:border-[#d9b77d] hover:bg-[#201b17] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d9b77d]">
    <div className="flex items-start justify-between gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#d9b77d]/25 bg-[#d9b77d]/10 text-[#d9b77d]"><Icon size={21} strokeWidth={1.7} aria-hidden="true"/></span><ExternalLink size={17} className="text-[#d9b77d]/70 transition-colors group-hover:text-[#e8cf9b]" aria-hidden="true"/></div>
    <div className="mt-4"><p className="text-[10px] font-semibold tracking-[.17em] text-[#d9b77d]">{tag}</p><h3 className="mt-1 text-lg font-semibold text-white">{title}</h3><p className="mt-1 text-sm leading-6 text-white/60">{description}</p></div>
   </Link>)}
  </div>
  <p className="mt-5 text-xs leading-5 text-white/45">Email previews and local simulations do not enable production delivery. Stripe checkout remains subject to its separate launch checks.</p>
 </section>;
}
export function OwnerDashboard(){
 const [token,setToken]=useState<string|null>(null),[email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [data,setData]=useState<Data|null>(null),[message,setMessage]=useState(''),[loading,setLoading]=useState(false);
 const [weekday,setWeekday]=useState(1),[start,setStart]=useState('09:00'),[end,setEnd]=useState('17:00');
 const [offStart,setOffStart]=useState(''),[offEnd,setOffEnd]=useState(''),[reason,setReason]=useState('');
 const [tab,setTab]=useState<'overview'|'appointments'|'services'|'hours'|'timeoff'|'settings'>('overview');
 const [statusFilter,setStatusFilter]=useState('all');
 const [showAddService,setShowAddService]=useState(false);
 const [serviceAction,setServiceAction]=useState<{service:Service;operation:'deactivate'|'delete'}|null>(null);
 const [ownerConfirmation,setOwnerConfirmation]=useState<null|{kind:'appointment';appointment:Appt;operation:OwnerAction}|{kind:'timeoff';block:Off}>(null);
 const [authDialog,setAuthDialog]=useState<'signin'|'signout'|null>(null);
 const [showPassword,setShowPassword]=useState(false);
 const load=useCallback(async(t:string)=>{const r=await fetch('/api/owner',{headers:{Authorization:`Bearer ${t}`},cache:'no-store'});if(!r.ok){setMessage('Owner access denied or server configuration missing.');setData(null);return;}setData(await r.json());setMessage('');},[]);
 useEffect(()=>{if(!client)return;void client.auth.getSession().then(({data})=>{setToken(data.session?.access_token??null)});const {data:sub}=client.auth.onAuthStateChange((_e,s)=>setToken(s?.access_token??null));return()=>sub.subscription.unsubscribe();},[]);
 useEffect(()=>{if(token)void load(token);else setData(null);},[token,load]);
 async function signIn(e:React.FormEvent){e.preventDefault();if(!client)return;setAuthDialog(null);setLoading(true);const {error}=await client.auth.signInWithPassword({email,password});setPassword('');setShowPassword(false);setMessage(error?.message??'');setLoading(false);}
 async function send(action:string,body:Record<string,unknown>){if(!client)return;setLoading(true);setMessage('');const {data:session}=await client.auth.getSession();const t=session.session?.access_token;if(!t){setMessage('Please sign in again.');setLoading(false);return;}const r=await fetch('/api/owner',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${t}`},body:JSON.stringify({action,...body})});const result=await r.json();if(!r.ok)setMessage(result.error??'Save failed');else{await load(t);setMessage('Saved successfully.');}setLoading(false);}
 async function addService(values:{name:string;description:string;price_cents:number;duration_minutes:number}):Promise<boolean>{
  if(!client)return false;
  setLoading(true);
  setMessage('');
  try {
   const {data:session}=await client.auth.getSession();
   const t=session.session?.access_token;
   if(!t){setMessage('Please sign in again.');return false;}
   const response=await fetch('/api/owner/services',{
    method:'POST',
    headers:{'Content-Type':'application/json',Authorization:`Bearer ${t}`},
    body:JSON.stringify(values),
    cache:'no-store',
   });
   const result=await response.json().catch(()=>({error:'Could not read the service response.'}));
   if(!response.ok){setMessage(result.error??'Could not create service.');return false;}
   await load(t);
   setMessage('New service added as inactive. Review it below and activate when ready.');
   setShowAddService(false);
   return true;
  }catch{setMessage('Could not reach the server. Please try again.');return false;}
  finally{setLoading(false);}
 }
 async function removeService(service:Service, operation:'deactivate'|'delete'):Promise<void>{
  if(!client)return;
  setLoading(true);setMessage('');
  try{
   const {data:session}=await client.auth.getSession();
   const t=session.session?.access_token;
   if(!t){setMessage('Please sign in again.');return;}
   const response=await fetch('/api/owner/services/remove',{
    method:'POST',
    headers:{'Content-Type':'application/json',Authorization:`Bearer ${t}`},
    body:JSON.stringify({id:service.id,operation}),
    cache:'no-store',
   });
   const result=await response.json().catch(()=>({error:'Unable to read the service response.'}));
   if(!response.ok){setMessage(result.error??'Service action failed.');return;}
   await load(t);
   setMessage(operation==='deactivate'
    ? `"${service.name}" is now inactive. Its appointment history has been preserved.`
    : `"${service.name}" was permanently deleted from local Supabase.`);
  }catch{setMessage('Could not reach the server. Please try again.');}
  finally{setLoading(false);}
 }
 function changeAppointment(a:Appt, operation:OwnerAction){
  setOwnerConfirmation({kind:'appointment',appointment:a,operation});
 }
 function removeTimeOff(block:Off){
  setOwnerConfirmation({kind:'timeoff',block});
 }
 function confirmedOwnerAction(){
  const action=ownerConfirmation;
  if(!action)return;
  setOwnerConfirmation(null);
  if(action.kind==='appointment'){
   void send('appointment_status',{id:action.appointment.id,operation:action.operation});
  }else{
   void send('delete_time_off',{id:action.block.id});
  }
 }
 function ownerConfirmationDetails(){
  const action=ownerConfirmation;
  if(!action)return null;
  if(action.kind==='timeoff'){
   const zone=data?.settings?.timezone??'America/New_York';
   const when=new Date(action.block.starts_at).toLocaleString('en-US',{timeZone:zone,dateStyle:'medium',timeStyle:'short'});
   return { eyebrow:'SCHEDULE MANAGEMENT',title:'Remove this time-off block?',subject:when,
    description:'Removing this block restores the availability of these hours, subject to other appointments and schedule restrictions. This does not cancel any existing appointment.',
    confirmLabel:'Remove block',tone:'warning' as const };
  }
  const a=action.appointment;
  const name=`${a.customer_name} · ${new Date(a.starts_at).toLocaleString('en-US',{timeZone:data?.settings?.timezone??'America/New_York',dateStyle:'medium',timeStyle:'short'})}`;
  if(action.operation==='cancel')return {eyebrow:'APPOINTMENT MANAGEMENT',title:'Cancel this appointment?',subject:name,
   description:'The appointment will be cancelled. No automatic email or refund will be sent. Review the payment and notify the customer separately if needed.',
   confirmLabel:'Cancel appointment',tone:'warning' as const};
  if(action.operation==='complete')return {eyebrow:'APPOINTMENT MANAGEMENT',title:'Mark as completed?',subject:name,
   description:'This marks the appointment as completed in the owner console. It does not charge a customer or send an email.',
   confirmLabel:'Mark completed',tone:'neutral' as const};
  return {eyebrow:'APPOINTMENT MANAGEMENT',title:'Mark as no-show?',subject:name,
   description:'This marks the appointment as a no-show. Any refund or customer notification must be handled separately.',
   confirmLabel:'Mark no-show',tone:'warning' as const};
 }
 async function signOut(){setAuthDialog(null);await client?.auth.signOut();setData(null);}
 const confirmationDetails=ownerConfirmationDetails();
 return <main className="section-wrap section-space" style={{minHeight:'75vh'}}><div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'center'}}><div><p className="gold" style={{letterSpacing:3}}>PRIVATE BUSINESS CONSOLE</p><h1 className="display" style={{fontSize:'clamp(2rem,5vw,3.5rem)',margin:'12px 0'}}>Dujuan’s Dashboard</h1></div>{token&&<button type="button" className="owner-signout" onClick={()=>setAuthDialog('signout')}><LogOut size={17} aria-hidden="true"/> Sign out</button>}</div>
 {!client&&<p role="alert">Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart Next.js.</p>}
 {client&&!token&&<form onSubmit={e=>{e.preventDefault();if(email&&password)setAuthDialog('signin');}} style={{...panel,maxWidth:460,display:'grid',gap:16}}><div className="owner-login-brand"><div className="owner-login-mark"><LockKeyhole size={28} aria-hidden="true"/></div><div><span className="owner-eyebrow">PRIVATE ACCESS</span><h2 className="display" style={{margin:0}}>Welcome back, Dujuan.</h2><p style={{margin:'8px 0 0',color:'#c5b7a2'}}>Sign in to manage your business.</p></div></div><div className="owner-login-field"><label htmlFor="owner-email">Email address</label><div className="owner-input-wrap"><Mail size={19} aria-hidden="true" className="owner-input-icon"/><input id="owner-email" type="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="username"/></div></div><div className="owner-login-field"><label htmlFor="owner-password">Password</label><div className="owner-input-wrap"><LockKeyhole size={19} aria-hidden="true" className="owner-input-icon"/><input id="owner-password" type={showPassword?'text':'password'} placeholder="Enter your password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/><button className="owner-password-toggle" type="button" aria-label={showPassword?'Hide password':'Show password'} aria-pressed={showPassword} title={showPassword?'Hide password':'Show password'} onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff size={20} aria-hidden="true"/>:<Eye size={20} aria-hidden="true"/>}</button></div></div><button type="button" className="button-gold owner-login-button" disabled={loading||!email||!password} onClick={()=>setAuthDialog('signin')}><LogIn size={17} aria-hidden="true"/> Secure sign in <ArrowRight size={16} aria-hidden="true"/></button><small>Owner accounts are created privately in Supabase. Public sign-up is disabled.</small></form>}
 {message&&<p role="status" style={{color:'#e8c586',marginTop:18}}>{message}</p>}
 {token&&!data&&<p>Loading owner data…</p>}
 {data&&<><nav aria-label="Owner sections" className="owner-tabs">{(['overview','appointments','services','hours','timeoff','settings'] as const).map(k=>{const Icon=({overview:LayoutDashboard,appointments:CalendarDays,services:Scissors,hours:Clock3,timeoff:CalendarOff,settings:Settings2} as const)[k];return <button key={k} type="button" aria-current={tab===k?'page':undefined} aria-pressed={tab===k} className={tab===k?'owner-tab active':'owner-tab'} onClick={()=>setTab(k)}><Icon size={17} strokeWidth={1.8} aria-hidden="true"/><span>{({overview:'Overview',appointments:'Appointments',services:'Services',hours:'Working Hours',timeoff:'Time Off',settings:'Settings'} as const)[k]}</span></button>})}</nav>
 {tab==='overview'&&<><section style={panel}><h2 className="display">Business overview</h2><div className="owner-stats"><div><strong>{data.services.filter(s=>s.is_active).length}</strong><span>Active services</span></div><div><strong>{data.hours.length}</strong><span>Weekly shifts</span></div><div><strong>{data.appointments.length}</strong><span>Recent & upcoming appointments</span></div><div><strong>{data.exceptions.length}</strong><span>Upcoming time-off blocks</span></div></div></section><BusinessOperations/><section style={panel}><h2 className="display">Launch readiness</h2><p>Online booking: <strong style={{color:'#e8c586'}}>OFF — payments not connected</strong></p><p>Timezone: {data.settings?.timezone??'Not configured'} · Owner: {data.barber?.display_name??'Not configured'}</p><p>Booking activation is intentionally locked until secure payment verification is implemented.</p></section>
 </>}{tab==='services'&&<section style={panel}>
 <div className="flex flex-wrap items-start justify-between gap-4">
  <div>
   <p className="text-xs font-semibold tracking-[.22em] text-[#d9b77d]">SERVICE MANAGEMENT</p>
   <h2 className="display mt-2 text-2xl sm:text-3xl">Services & pricing</h2>
   <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">Edit your existing services or create a new one. New services are inactive until you review and activate them.</p>
  </div>
  <button type="button" disabled={loading} onClick={()=>setShowAddService(v=>!v)} aria-expanded={showAddService} className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#d9b77d]/60 px-5 py-2.5 text-sm font-semibold text-[#e8ca91] transition-colors hover:bg-[#d9b77d]/10 disabled:opacity-50">
   <span aria-hidden="true">{showAddService?'−':'+'}</span> {showAddService?'Close form':'Add new service'}
  </button>
 </div>
 {showAddService&&<NewServiceForm disabled={loading} onAdd={addService}/>}
 <div className="mt-8 grid gap-5">
  {data.services.map(s=><ServiceEditor key={`${s.id}:${s.is_active}`} service={s} disabled={loading} save={v=>send('service',v)} onRemove={operation=>setServiceAction({service:s,operation})}/>)}
 </div>
 </section>
 }{tab==='hours'&&<section style={panel}><h2 className="display">Weekly working hours</h2><p>Times are entered in the business timezone. Multiple shifts per day are supported.</p><div style={{display:'grid',gap:8}}>{data.hours.map(h=><div key={h.id} style={{display:'flex',gap:16,alignItems:'center',flexWrap:'wrap'}}><span>{days[h.weekday]}: {h.start_time.slice(0,5)}–{h.end_time.slice(0,5)}</span><button style={field} disabled={loading} onClick={()=>send('delete_hours',{id:h.id})}>Remove</button></div>)}</div><form onSubmit={e=>{e.preventDefault();void send('hours',{weekday,start_time:start,end_time:end});}} style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'end',marginTop:20}}><label>Day<br/><select style={field} value={weekday} onChange={e=>setWeekday(Number(e.target.value))}>{days.map((d,i)=><option key={d} value={i}>{d}</option>)}</select></label><label>From<br/><input style={field} type="time" value={start} onChange={e=>setStart(e.target.value)} required/></label><label>To<br/><input style={field} type="time" value={end} onChange={e=>setEnd(e.target.value)} required/></label><button className="button-gold" disabled={loading}>Add hours</button></form></section>
 }{tab==='timeoff'&&<section style={panel}><h2 className="display">Time off & blocked periods</h2><p>Enter local date and time. Blocks will be stored in UTC.</p>{data.exceptions.length===0&&<p className="my-5 text-sm leading-6 text-white/55">No upcoming time-off blocks. Use the form below to block a holiday, appointment, or unavailable hours.</p>}{data.exceptions.map(x=><div key={x.id} style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap',marginBottom:10}}><span>{new Date(x.starts_at).toLocaleString('en-US',{timeZone:data.settings?.timezone??'America/New_York'})} — {new Date(x.ends_at).toLocaleString('en-US',{timeZone:data.settings?.timezone??'America/New_York'})} {x.reason&&`(${x.reason})`}</span><button type="button" disabled={loading} onClick={()=>removeTimeOff(x)} className="rounded-full border border-[#8a6a43]/70 px-4 py-2 text-xs font-semibold text-[#e6c58b] transition hover:bg-[#d9b77d]/10 disabled:opacity-50">Remove block</button></div>)}<form onSubmit={e=>{e.preventDefault();if(!offStart||!offEnd)return;void send('time_off_local',{start_local:offStart,end_local:offEnd,reason});}} style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'end'}}><label>Start<br/><input style={field} type="datetime-local" value={offStart} onChange={e=>setOffStart(e.target.value)} required/></label><label>End<br/><input style={field} type="datetime-local" value={offEnd} onChange={e=>setOffEnd(e.target.value)} required/></label><label>Reason<br/><input style={field} value={reason} onChange={e=>setReason(e.target.value)} maxLength={200}/></label><button className="button-gold" disabled={loading}>Block time</button></form><p style={{fontSize:12,color:'#c5b7a2'}}>Times are interpreted in {data.settings?.timezone??'America/New_York'}, regardless of your computer timezone. Nonexistent daylight-saving times are rejected; avoid ambiguous fall-back-hour entries until launch validation is complete.</p></section>
 }{tab==='appointments'&&<section style={panel}><h2 className="display">Appointments</h2><p>Manage existing appointments only. Cancellation and completion actions require confirmation and are logged. No customer notifications are sent yet.</p><label style={{display:'inline-block',marginTop:16}}>Status filter <select style={field} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">All statuses</option>{Array.from(new Set(data.appointments.map(a=>a.status))).map(st=><option key={st} value={st}>{st.replaceAll('_',' ')}</option>)}</select></label>{data.appointments.filter(a=>statusFilter==='all'||a.status===statusFilter).length===0?<p>No appointments yet.</p>:<div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left',borderSpacing:'12px 16px'}}><thead><tr><th>Time</th><th>Customer</th><th>Service</th><th>Status</th><th>Actions</th></tr></thead><tbody>{data.appointments.filter(a=>statusFilter==='all'||a.status===statusFilter).map(a=><tr key={a.id}><td>{new Date(a.starts_at).toLocaleString('en-US',{timeZone:data.settings?.timezone??'America/New_York'})}</td><td>{a.customer_name}</td><td>{data.services.find(s=>s.id===a.service_id)?.name??'Unknown'}</td><td>{a.status.replaceAll('_',' ')}</td><td><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{(['cancel','complete','no_show'] as const).filter(op=>canChangeAppointment(a.status,op,Date.parse(a.starts_at))).map(op=><button key={op} type="button" style={field} disabled={loading} onClick={()=>void changeAppointment(a,op)}>{op==='no_show'?'No-show':op==='complete'?'Complete':'Cancel'}</button>)}</div></td></tr>)}</tbody></table></div>}</section>}{tab==='settings'&&<section style={panel}><h2 className="display">Business settings</h2><p>Timezone: <strong>{data.settings?.timezone??'Not configured'}</strong></p><p>Barber: <strong>{data.barber?.display_name??'Not configured'}</strong></p><p>Online booking is locked until secure reservation payments and server-side confirmation are verified. This dashboard cannot turn it on.</p></section>}</>}
 {serviceAction&&<ServiceActionDialog serviceName={serviceAction.service.name} operation={serviceAction.operation} onCancel={()=>setServiceAction(null)} onConfirm={()=>{const selected=serviceAction;setServiceAction(null);void removeService(selected.service,selected.operation);}}/>}
 {ownerConfirmation&&confirmationDetails&&<OwnerActionDialog {...confirmationDetails} onCancel={()=>setOwnerConfirmation(null)} onConfirm={confirmedOwnerAction}/>} 
 {authDialog&&<div className="owner-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!loading)setAuthDialog(null)}}><div className="owner-modal" role="alertdialog" aria-modal="true" aria-labelledby="owner-modal-title" aria-describedby="owner-modal-description"><button className="owner-modal-close" type="button" aria-label="Close dialog" disabled={loading} onClick={()=>setAuthDialog(null)}><X size={20}/></button><div className="owner-modal-icon">{authDialog==='signin'?<ShieldCheck size={27}/>:<LogOut size={27}/>}</div><span className="owner-eyebrow">{authDialog==='signin'?'SECURE OWNER ACCESS':'SESSION SECURITY'}</span><h2 id="owner-modal-title" className="display">{authDialog==='signin'?'Enter your private console?':'Sign out of your dashboard?'}</h2><p id="owner-modal-description">{authDialog==='signin'?'Your services, appointments, and business settings are available only to authorized owners.':'Your session will end on this device. You can sign in again whenever you need to manage appointments.'}</p><div className="owner-modal-actions"><button type="button" className="owner-modal-secondary" disabled={loading} onClick={()=>setAuthDialog(null)}>Stay here</button><button type="button" className="button-gold" disabled={loading} onClick={()=>{if(authDialog==='signin'){void signIn({preventDefault:()=>{}} as React.FormEvent)}else void signOut()}}>{loading?'Please wait…':authDialog==='signin'?'Continue securely':'Yes, sign out'} <ArrowRight size={16}/></button></div></div></div>}
 </main>;
}
function ServiceEditor({service,save,disabled,onRemove}:{service:Service;save:(v:Record<string,unknown>)=>void;disabled:boolean;onRemove:(operation:'deactivate'|'delete')=>void}){
 const [name,setName]=useState(service.name),[description,setDescription]=useState(service.description),[price,setPrice]=useState(service.price_cents===null?'':(service.price_cents/100).toFixed(2)),[duration,setDuration]=useState(service.duration_minutes?.toString()??''),[active,setActive]=useState(service.is_active);
 return <form onSubmit={e=>{e.preventDefault();save({id:service.id,name,description,price_cents:Math.round(Number(price)*100),duration_minutes:Number(duration),is_active:active});}} style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,230px),1fr))',gap:16,border:'1px solid #4b3c29',borderRadius:14,background:'#101012',padding:20}}><label>Service name<br/><span className="owner-console-field"><Type size={17}/><input value={name} onChange={e=>setName(e.target.value)} maxLength={120} required/></span></label><label>Description<br/><span className="owner-console-field"><FileText size={17}/><input value={description} onChange={e=>setDescription(e.target.value)} maxLength={1000}/></span></label><label>Price ($)<br/><span className="owner-console-field"><BadgeDollarSign size={17}/><input type="number" min="10" max="10000" step="0.01" value={price} onChange={e=>setPrice(e.target.value)} required/></span></label><label>Duration (minutes)<br/><span className="owner-console-field"><Timer size={17}/><input type="number" min="5" max="480" step="1" value={duration} onChange={e=>setDuration(e.target.value)} required/></span></label><label style={{alignSelf:'center'}}><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/> Active service</label><div style={{display:'flex',flexWrap:'wrap',gap:10,alignItems:'center',alignSelf:'end'}}>
 <button type="submit" className="button-gold" style={{width:'auto',minWidth:0,padding:'10px 20px',fontSize:13,borderRadius:999}} disabled={disabled}>Save changes</button>
 <button type="button" disabled={disabled} onClick={()=>onRemove(service.is_active?'deactivate':'delete')}
  className="rounded-full border px-4 py-2.5 text-xs font-semibold transition-colors disabled:opacity-50"
  style={{borderColor:service.is_active?'#766043':'#8b4c4c',color:service.is_active?'#e8ca91':'#edb3b3',background:'#121113'}}>
  {service.is_active?'Deactivate':'Delete permanently'}
 </button>
</div></form>;
}
function NewServiceForm({disabled,onAdd}:{disabled:boolean;onAdd:(values:{name:string;description:string;price_cents:number;duration_minutes:number})=>Promise<boolean>}){
 const [name,setName]=useState('');
 const [description,setDescription]=useState('');
 const [price,setPrice]=useState('');
 const [duration,setDuration]=useState('');
 const inputClass='mt-2 block w-full min-w-0 rounded-xl border border-[#665139] bg-[#0b0c0e] px-4 py-3 text-sm text-[#f7f0e5] outline-none focus:border-[#d9b77d]';
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();
  const priceCents=Math.round(Number(price)*100);
  const durationMinutes=Number(duration);
  if(!name.trim()||!Number.isInteger(priceCents)||priceCents<1000||priceCents>1000000||!Number.isInteger(durationMinutes)||durationMinutes<5||durationMinutes>480)return;
  const added=await onAdd({name:name.trim(),description:description.trim(),price_cents:priceCents,duration_minutes:durationMinutes});
  if(added){setName('');setDescription('');setPrice('');setDuration('');}
 }
 return <form onSubmit={e=>void submit(e)} className="mt-7 rounded-2xl border border-[#d9b77d]/40 bg-[#100f0e] p-5 sm:p-7">
  <div className="flex flex-wrap items-start justify-between gap-2">
   <div><h3 className="display text-xl sm:text-2xl">Create a service</h3><p className="mt-1 text-sm text-white/60">Enter the service details. A URL-friendly identifier is generated from its name.</p></div>
   <span className="rounded-full border border-[#d9b77d]/30 px-3 py-1 text-xs font-semibold text-[#e8ca91]">DRAFT · INACTIVE</span>
  </div>
  <div className="mt-5 grid gap-4 sm:grid-cols-2">
   <label className="min-w-0 text-sm text-white/85">Service name <span className="text-[#e8ca91]">*</span>
    <input className={inputClass} value={name} onChange={e=>setName(e.target.value)} maxLength={120} placeholder="e.g., Deluxe Grooming" required/>
   </label>
   <label className="min-w-0 text-sm text-white/85">Description
    <input className={inputClass} value={description} onChange={e=>setDescription(e.target.value)} maxLength={1000} placeholder="A short description"/>
   </label>
   <label className="min-w-0 text-sm text-white/85">Price ($) <span className="text-[#e8ca91]">*</span>
    <input className={inputClass} type="number" min="10" max="10000" step="0.01" value={price} onChange={e=>setPrice(e.target.value)} placeholder="40.00" required/>
   </label>
   <label className="min-w-0 text-sm text-white/85">Duration (minutes) <span className="text-[#e8ca91]">*</span>
    <input className={inputClass} type="number" min="5" max="480" step="1" value={duration} onChange={e=>setDuration(e.target.value)} placeholder="45" required/>
   </label>
  </div>
  <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-5">
   <p className="max-w-md text-xs leading-5 text-white/50">Creating a service does not activate online booking or change the existing public service menu.</p>
   <button type="submit" disabled={disabled} className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#ecd09a] to-[#c99a50] px-5 py-2.5 text-sm font-semibold text-[#17110a] transition hover:brightness-110 disabled:opacity-50">{disabled?'Please wait...':'Create service'}</button>
  </div>
 </form>;
}
