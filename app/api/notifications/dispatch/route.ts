import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/checkout-foundation';
import { renderNotification, type NotificationKind } from '@/lib/notification-templates';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const secret=process.env.NOTIFICATION_DISPATCH_SECRET;
 if(!secret||request.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({error:'Unauthorized'},{status:401});
 if(process.env.ENABLE_NOTIFICATION_DELIVERY!=='true')return NextResponse.json({error:'Notification delivery disabled'},{status:503});
 const apiKey=process.env.RESEND_API_KEY,from=process.env.NOTIFICATION_FROM_EMAIL;
 if(!apiKey||!from)return NextResponse.json({error:'Email provider not configured'},{status:503});
 const db=adminDb();
 const {data:items,error}=await db.rpc('b39_claim_notifications',{p_limit:10});
 if(error)return NextResponse.json({error:'Unable to claim notifications'},{status:503});
 let sent=0,failed=0;
 for(const item of items??[]){
  try{
   const mail=renderNotification({kind:item.kind as NotificationKind,audience:item.audience,customerName:item.customer_name,serviceName:item.service_name,appointmentStart:item.appointment_start});
   const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':`dujuan-${item.id}`},body:JSON.stringify({from,to:[item.recipient_email],subject:mail.subject,html:mail.html,text:mail.text})});
   const result=await response.json() as {id?:string;message?:string};
   if(!response.ok||!result.id)throw new Error(`Provider rejected request (${response.status})`);
   const {error:updateError}=await db.from('notification_outbox').update({status:'sent',sent_at:new Date().toISOString(),provider_message_id:result.id,last_error:null}).eq('id',item.id).eq('status','sending');
   if(updateError)throw updateError;
   sent++;
  }catch{
   await db.from('notification_outbox').update({status:'failed',last_error:'Delivery or persistence failed; review before retrying'}).eq('id',item.id).eq('status','sending');
   failed++;
  }
 }
 return NextResponse.json({processed:(items??[]).length,sent,failed},{headers:{'Cache-Control':'no-store'}});
}
