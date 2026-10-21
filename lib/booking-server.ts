import { createClient } from '@supabase/supabase-js';
import { business } from '@/lib/business';
import { generateSlots } from '@/lib/scheduling';

function db(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return null;return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});}
export type AvailabilityResponse={ready:boolean;reason?:string;date:string;service:string;slots:{start:string;end:string}[]};
// Intl timezone offset, including DST; reject nonexistent wall-clock times via roundtrip.
export function localToUtc(day:string,time:string,zone=business.timezone):Date|null{
 const wall=`${day}T${time}:00`;const tentative=Date.parse(wall+'Z');if(!Number.isFinite(tentative))return null;
 const parts=(ms:number)=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ms));
 const wallAt=(ms:number)=>{const p=Object.fromEntries(parts(ms).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`};
 let guess=tentative;for(let i=0;i<3;i++){const seen=wallAt(guess);const diff=(Date.parse(wall+'Z')-Date.parse(seen+'Z'));guess+=diff;if(!diff)break;}
 return wallAt(guess)===`${day}T${time}`?new Date(guess):null;
}
export async function availability(day:string,slug:string,ownerSandbox=false):Promise<AvailabilityResponse>{
 const result:AvailabilityResponse={ready:false,date:day,service:slug,slots:[]};
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!/^[-a-z0-9]{1,80}$/.test(slug))return {...result,reason:'Invalid date or service.'};
 const client=db();if(!client)return {...result,reason:'Booking database is not configured.'};
 const [settings,service,barber]=await Promise.all([
  client.from('business_settings').select('bookings_enabled,timezone').eq('id',1).maybeSingle(),
  client.from('services').select('id,slug,price_cents,duration_minutes,is_active').eq('slug',slug).maybeSingle(),
  client.from('barbers').select('id').eq('is_active',true).limit(1).maybeSingle()
 ]);
 if(settings.error||service.error||barber.error)return {...result,reason:'Availability is temporarily unavailable.'};
 const s=service.data,b=barber.data,config=settings.data;
if (!config) {
  return {
    ...result,
    reason: 'Business settings are not configured.'
  };
}
 // The public availability endpoint never sets ownerSandbox. A protected owner-only
 // route may inspect real slots locally even while public booking stays closed.
 const localSandbox = ownerSandbox &&
  /^http:\/\/(127\.0\.0\.1|localhost):54421\/?$/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '') &&
  /^http:\/\/localhost(?::\d+)?$/.test(process.env.APP_ORIGIN ?? '') &&
  process.env.ENABLE_STRIPE_CHECKOUT !== 'true' &&
  process.env.ENABLE_NOTIFICATION_DELIVERY !== 'true';
 if(ownerSandbox && !localSandbox)return {...result,reason:'Owner sandbox requires local Supabase, localhost APP_ORIGIN, and disabled public checkout and notifications.'};
 if(!config?.bookings_enabled && !localSandbox)return {...result,reason:'Online bookings are not open yet.'};
 if(!s?.is_active||!s.duration_minutes||s.price_cents===null||s.price_cents<business.bookingDepositCents)return {...result,reason:'Service details are awaiting confirmation.'};
 if(!b)return {...result,reason:'Barber schedule is not configured.'};
 const midday=localToUtc(day,'12:00',config.timezone);if(!midday)return {...result,reason:'Invalid date.'};
 const weekday=new Date(`${day}T12:00:00Z`).getUTCDay();
 const [hours,exceptions,appointments]=await Promise.all([
  client.from('working_hours').select('start_time,end_time').eq('barber_id',b.id).eq('weekday',weekday),
  client.from('schedule_exceptions').select('starts_at,ends_at').eq('barber_id',b.id).lt('starts_at',new Date(midday.getTime()+36*3600000).toISOString()).gt('ends_at',new Date(midday.getTime()-36*3600000).toISOString()),
  client.from('appointments').select('starts_at,ends_at').eq('barber_id',b.id).in('status',['pending_payment','confirmed']).lt('starts_at',new Date(midday.getTime()+36*3600000).toISOString()).gt('ends_at',new Date(midday.getTime()-36*3600000).toISOString())
 ]);
 if(hours.error||exceptions.error||appointments.error)return {...result,reason:'Could not load the schedule.'};
 const slots=[] as {start:string;end:string}[];
 for(const h of hours.data??[]){for(const candidate of generateSlots({day,startTime:h.start_time.slice(0,5),endTime:h.end_time.slice(0,5),durationMinutes:s.duration_minutes})){
  const from=localToUtc(day,candidate.start.slice(11),config.timezone),to=localToUtc(day,candidate.end.slice(11),config.timezone);
  if(!from||!to||from.getTime()<Date.now()+60*60000)continue;
  const blocked=[...(exceptions.data??[]),...(appointments.data??[])].some(x=>from.getTime()<Date.parse(x.ends_at)&&Date.parse(x.starts_at)<to.getTime());
  if(!blocked)slots.push({start:from.toISOString(),end:to.toISOString()});
 }}
 return {...result,ready:true,slots:slots.sort((a,b)=>a.start.localeCompare(b.start))};
}
