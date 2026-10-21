import { NextResponse } from 'next/server';
import { authorizeOwner } from '@/lib/owner-auth';
import { renderNotification, type NotificationKind } from '@/lib/notification-templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const kinds: NotificationKind[] = ['booking_confirmed', 'booking_cancelled', 'booking_rescheduled', 'payment_review'];
export async function GET(request: Request) {
  const auth = await authorizeOwner(request).catch(() => null);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  const kind = new URL(request.url).searchParams.get('kind') ?? 'booking_confirmed';
  if (!kinds.includes(kind as NotificationKind)) return NextResponse.json({ error: 'Invalid preview' }, { status: 400 });
  const audience = kind === 'payment_review' ? 'owner' : 'customer';
  const preview = renderNotification({ kind: kind as NotificationKind, audience, customerName: 'Alex Morgan (sample)', serviceName: 'Signature Haircut (sample)', appointmentStart: '2026-11-12T19:00:00.000Z' });
  return NextResponse.json({ ...preview, kind, audience, sample: true }, { headers: { 'Cache-Control': 'no-store' } });
}
