import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/checkout-foundation';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// The Stripe Checkout session ID is an unguessable bearer reference. Never return PII.
export async function GET(request: NextRequest) {
 const session = request.nextUrl.searchParams.get('session_id') ?? '';
 if (!/^cs_(test|live)_[A-Za-z0-9]{10,250}$/.test(session)) return NextResponse.json({status:'invalid'}, {status:400,headers:{'Cache-Control':'no-store'}});
 try {
  const {data,error}=await adminDb().from('appointments').select('status,hold_expires_at').eq('stripe_checkout_session_id',session).maybeSingle();
  if(error)throw error;
  if(!data)return NextResponse.json({status:'not_found'},{status:404,headers:{'Cache-Control':'no-store'}});
  const status = data.status==='confirmed'?'confirmed':data.status==='pending_payment'?(data.hold_expires_at&&Date.parse(data.hold_expires_at)<Date.now()?'review':'processing'):'review';
  return NextResponse.json({status},{headers:{'Cache-Control':'no-store, private','X-Robots-Tag':'noindex'}});
 }catch{return NextResponse.json({status:'unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
