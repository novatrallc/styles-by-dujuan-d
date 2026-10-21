import { NextResponse } from 'next/server';
import { business } from '@/lib/business';
export async function GET(){return NextResponse.json({reservationFeeCents:business.bookingDepositCents,onlinePaymentEnabled:false,bookingConfirmationEnabled:false,message:'Payments and booking confirmation are not yet enabled.'},{headers:{'Cache-Control':'no-store'}});}
