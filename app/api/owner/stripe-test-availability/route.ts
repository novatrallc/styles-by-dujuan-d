import { NextRequest, NextResponse } from 'next/server';
import { authorizeOwner } from '@/lib/owner-auth';
import { availability } from '@/lib/booking-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Private local sandbox availability; does not open public booking. */
export async function GET(request: NextRequest) {
  const owner = await authorizeOwner(request).catch(() => null);
  if (!owner) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } });
  }

  const date = request.nextUrl.searchParams.get('date') ?? '';
  const service = request.nextUrl.searchParams.get('service') ?? '';
  const result = await availability(date, service, true);
  return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
}