import { NextRequest,NextResponse } from 'next/server';
import { availability } from '@/lib/booking-server';
import { adminDb,checkoutEnabled,validCustomer,validSlot } from '@/lib/checkout-foundation';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest){
 if(!checkoutEnabled())return NextResponse.json({error:'Secure checkout is not enabled.'},{status:503});
 let body:unknown;try{body=await request.json();}catch{return NextResponse.json({error:'Invalid JSON.'},{status:400});}
 if(!body||typeof body!=='object')return NextResponse.json({error:'Invalid request.'},{status:400});
 const v=body as Record<string,unknown>,customer=v.customer;
 if(typeof v.service!=='string'||typeof v.start!=='string'||typeof v.end!=='string'||!validCustomer(customer))return NextResponse.json({error:'Invalid booking details.'},{status:400});
 const start=v.start,end=v.end;
 if(!Number.isFinite(Date.parse(start)))return NextResponse.json({error:'Invalid date.'},{status:400});
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(start));
 if(!Number.isFinite(Date.parse(start)))return NextResponse.json({error:'Invalid date.'},{status:400});
 try{
  const slots=await availability(day,v.service);
  if(!slots.ready||!slots.slots.some(s=>s.start===start&&s.end===end))return NextResponse.json({error:'Time is no longer available.'},{status:409});
  const db=adminDb();
  const [{data:service,error:se},{data:barber,error:be}]=await Promise.all([
   db.from('services').select('id,name,price_cents,duration_minutes,is_active').eq('slug',v.service).maybeSingle(),
   db.from('barbers').select('id').eq('is_active',true).limit(1).maybeSingle()
  ]);
  if(se||be||!service||!barber||!service.is_active||!service.price_cents||!service.duration_minutes||!validSlot(start,end,service.duration_minutes))return NextResponse.json({error:'Service unavailable.'},{status:409});
  const c=customer as {name:string;email:string;phone:string};
  const {data:hold,error:holdError}=await db.rpc('create_checkout_hold',{p_barber_id:barber.id,p_service_id:service.id,p_start:start,p_end:end,p_name:c.name,p_email:c.email,p_phone:c.phone,p_total:service.price_cents});
  if(holdError||!hold)return NextResponse.json({error:'This time was just reserved. Choose another slot.'},{status:409});
  const origin=process.env.APP_ORIGIN!;
  if(!/^https:\/\//.test(origin) && !/^http:\/\/localhost(?::\d+)?$/.test(origin))return NextResponse.json({error:'Invalid application origin.'},{status:503});
  const form=new URLSearchParams({mode:'payment',success_url:`${origin}/book/confirmation?session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${origin}/book?checkout=cancelled`,customer_email:c.email,'line_items[0][price_data][currency]':'usd','line_items[0][price_data][unit_amount]':'1000','line_items[0][price_data][product_data][name]':`Reservation deposit — ${service.name}`,'line_items[0][quantity]':'1','metadata[appointment_id]':hold,'payment_method_types[0]':'card',expires_at:String(Math.floor(Date.now()/1000)+1800)});
  const response=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:`Bearer ${process.env.STRIPE_SECRET_KEY}`,'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':`dujuan-${hold}`},body:form.toString(),cache:'no-store'});
  const session=await response.json() as {id?:string;url?:string};
  if(!response.ok||!session.id||!session.url){await db.from('appointments').update({status:'expired'}).eq('id',hold);return NextResponse.json({error:'Checkout is temporarily unavailable.'},{status:502});}
  const {error:saveError}=await db.from('appointments').update({stripe_checkout_session_id:session.id}).eq('id',hold).eq('status','pending_payment');
  if(saveError){await db.from('appointments').update({status:'expired'}).eq('id',hold);return NextResponse.json({error:'Could not initialize reservation.'},{status:502});}
  return NextResponse.json({checkoutUrl:session.url},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Unable to start checkout.'},{status:500});}
}
