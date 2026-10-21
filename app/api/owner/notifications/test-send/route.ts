import { NextResponse } from 'next/server';
import { authorizeOwner } from '@/lib/owner-auth';
import { renderNotification, type NotificationKind } from '@/lib/notification-templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const kinds: NotificationKind[] = ['booking_confirmed', 'booking_cancelled', 'booking_rescheduled', 'payment_review'];
const headers = { 'Cache-Control': 'no-store' };

export async function POST(request: Request) {
  const auth = await authorizeOwner(request).catch(() => null);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  if (process.env.ENABLE_NOTIFICATION_TEST_SEND !== 'true') return NextResponse.json({ error: 'Test sending is disabled' }, { status: 403, headers });
  const destination = process.env.NOTIFICATION_TEST_EMAIL?.trim().toLowerCase();
  const from = process.env.NOTIFICATION_FROM_EMAIL;
  const key = process.env.RESEND_API_KEY;
  if (!destination || !from || !key) return NextResponse.json({ error: 'Test email configuration is incomplete' }, { status: 503, headers });
  // Restrict test delivery to a verified owner email, never arbitrary customer input.
  const owners = (process.env.OWNER_EMAILS ?? '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  if (!owners.includes(destination) || destination !== auth.user.email?.toLowerCase()) return NextResponse.json({ error: 'Test destination must match the signed-in owner and OWNER_EMAILS' }, { status: 403, headers });
  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers }); }
  const kind = typeof payload === 'object' && payload !== null && 'kind' in payload ? (payload as { kind: unknown }).kind : null;
  if (typeof kind !== 'string' || !kinds.includes(kind as NotificationKind)) return NextResponse.json({ error: 'Invalid template' }, { status: 400, headers });
  const mail = renderNotification({ kind: kind as NotificationKind, audience: kind === 'payment_review' ? 'owner' : 'customer', customerName: 'Alex Morgan (TEST ONLY)', serviceName: 'Signature Haircut (TEST ONLY)', appointmentStart: '2026-11-12T19:00:00.000Z' });
  let response: Response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [destination], subject: `[TEST — NO RESERVATION] ${mail.subject}`, html: mail.html, text: `TEST EMAIL — NO ACTUAL RESERVATION\n\n${mail.text}` }),
      signal: AbortSignal.timeout(12000),
      cache: 'no-store',
    });
  } catch { return NextResponse.json({ error: 'Email provider unavailable' }, { status: 502, headers }); }
  if (!response.ok) return NextResponse.json({ error: `Email provider rejected the test (${response.status})` }, { status: 502, headers });
  const result: unknown = await response.json().catch(() => null);
  const id = typeof result === 'object' && result !== null && 'id' in result && typeof result.id === 'string' ? result.id : null;
  if (!id) return NextResponse.json({ error: 'Provider did not confirm acceptance' }, { status: 502, headers });
  return NextResponse.json({ accepted: true, recipient: destination, providerMessageId: id, note: 'Provider acceptance does not guarantee inbox delivery.' }, { headers });
}
