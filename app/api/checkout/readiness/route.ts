import { NextResponse } from 'next/server';
import { adminDb, checkoutEnabled } from '@/lib/checkout-foundation';
export const dynamic='force-dynamic';
export async function GET(){
 if(!checkoutEnabled())return NextResponse.json({enabled:false},{headers:{'Cache-Control':'no-store'}});
 try{const {data,error}=await adminDb().from('business_settings').select('bookings_enabled').eq('id',1).maybeSingle();return NextResponse.json({enabled:!error&&data?.bookings_enabled===true},{headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json({enabled:false});}
}
