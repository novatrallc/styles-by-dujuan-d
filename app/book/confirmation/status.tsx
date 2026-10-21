'use client';
import { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, ShieldAlert, ArrowLeft } from 'lucide-react';
type Status='loading'|'confirmed'|'processing'|'review'|'not_found'|'invalid'|'unavailable';
export function ConfirmationStatus(){
 const [status,setStatus]=useState<Status>('loading');
 useEffect(()=>{
  const session=new URLSearchParams(window.location.search).get('session_id');
  if(!session){setStatus('invalid');return;}
  let cancelled=false;let attempts=0;let timer:ReturnType<typeof setTimeout>;
  async function check(){
   try{const response=await fetch(`/api/checkout/status?session_id=${encodeURIComponent(session!)}`,{cache:'no-store'});const data=await response.json();if(cancelled)return;
    const next:Status=data.status??'unavailable';setStatus(next);
    if(next==='processing'&&++attempts<12)timer=setTimeout(check,2500);
   }catch{if(!cancelled)setStatus('unavailable');}
  }
  void check();return()=>{cancelled=true;clearTimeout(timer)};
 },[]);
 const confirmed=status==='confirmed';
 return <div role="status" aria-live="polite" className="luxe-card mt-8 p-7 md:p-10">
  {confirmed?<CheckCircle2 className="mb-5 text-[#d9b77d]" size={38}/>:status==='processing'||status==='loading'?<Clock3 className="mb-5 text-[#d9b77d]" size={38}/>:<ShieldAlert className="mb-5 text-[#d9b77d]" size={38}/>}
  <h2 className="display text-2xl">{confirmed?'Your appointment is confirmed':status==='processing'||status==='loading'?'Verifying your payment…':'Your reservation needs attention'}</h2>
  <p className="mt-4 leading-7 text-white/70">{confirmed?'Your $10 reservation deposit has been verified. Please retain your Stripe receipt. The remaining service balance is payable in person.':status==='processing'||status==='loading'?'We are waiting for secure payment verification. Please do not submit another payment or assume your appointment is confirmed. This page checks for a short period.':status==='review'?'Your booking is not confirmed. If you were charged, contact the shop with your Stripe receipt so the payment can be reviewed. Do not pay again.':status==='not_found'||status==='invalid'?'We could not identify this checkout session. If you paid, contact the shop with your Stripe receipt.':'We cannot check payment status right now. Please retry later; do not submit another payment.'}</p>
  <a href="/book" className="mt-8 inline-flex items-center gap-2 text-[#d9b77d] hover:underline"><ArrowLeft size={17}/> Back to booking</a>
 </div>;
}
