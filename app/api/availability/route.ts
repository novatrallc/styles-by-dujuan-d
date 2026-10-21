import { NextRequest, NextResponse } from 'next/server';
import { availability } from '@/lib/booking-server';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){const date=request.nextUrl.searchParams.get('date')??'';const service=request.nextUrl.searchParams.get('service')??'';const result=await availability(date,service);return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});}
