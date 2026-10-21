import { createClient } from '@supabase/supabase-js';
export function checkoutEnabled(): boolean {
 return process.env.ENABLE_STRIPE_CHECKOUT === 'true' && Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.APP_ORIGIN);
}
export function adminDb() {
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key) throw new Error('Database not configured');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export function validCustomer(value:unknown): value is {name:string;email:string;phone:string} {
 if(!value||typeof value!=='object')return false;
 const v=value as Record<string,unknown>;
 return typeof v.name==='string'&&v.name.trim().length>0&&v.name.length<=150&&typeof v.email==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)&&v.email.length<=254&&typeof v.phone==='string'&&v.phone.trim().length>=5&&v.phone.length<=40;
}
export function validSlot(start:string,end:string,duration:number):boolean {
 const a=Date.parse(start),b=Date.parse(end);
 return Number.isFinite(a)&&Number.isFinite(b)&&a>Date.now()+60*60000&&b-a===duration*60000;
}
