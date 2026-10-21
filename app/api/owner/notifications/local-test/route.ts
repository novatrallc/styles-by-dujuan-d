import { NextResponse } from 'next/server';
import { authorizeOwner } from '@/lib/owner-auth';
import { renderNotification, type NotificationKind } from '@/lib/notification-templates';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };
const kinds: NotificationKind[] = ['booking_confirmed', 'booking_cancelled', 'booking_rescheduled', 'payment_review'];
const lastSent = new Map<string, number>();

export async function POST(request: Request) {
  const auth = await authorizeOwner(request).catch(() => null);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  if (process.env.NODE_ENV !== 'development' || process.env.ENABLE_LOCAL_MAIL_TEST !== 'true') {
    return NextResponse.json({ error: 'Local test sending is disabled' }, { status: 403, headers });
  }
  const email = auth.user.email?.trim().toLowerCase();
  const owners = (process.env.OWNER_EMAILS ?? '').split(',').map(v => v.trim().toLowerCase());
  if (!email || !owners.includes(email)) return NextResponse.json({ error: 'Owner not allowed' }, { status: 403, headers });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers }); }
  const kind = body && typeof body === 'object' && 'kind' in body ? (body as { kind: unknown }).kind : null;
  if (typeof kind !== 'string' || !kinds.includes(kind as NotificationKind)) {
    return NextResponse.json({ error: 'Invalid template' }, { status: 400, headers });
  }
  const now = Date.now();
  if (now - (lastSent.get(email) ?? 0) < 3000) {
    return NextResponse.json({ error: 'Wait 3 seconds between tests' }, { status: 429, headers });
  }
  lastSent.set(email, now);
  const mail = renderNotification({
    kind: kind as NotificationKind,
    audience: kind === 'payment_review' ? 'owner' : 'customer',
    customerName: 'Alex Morgan (FICTIONAL)',
    serviceName: 'Signature Haircut (SAMPLE)',
    appointmentStart: '2026-11-12T19:00:00.000Z',
  });
  // Fixed .test recipient: no customer address is accepted or used.
  const recipient = kind === 'payment_review' ? 'owner@dujuan.test' : 'customer@dujuan.test';
  const transport = nodemailer.createTransport({ host: '127.0.0.1', port: 1025, secure: false,
    tls: { rejectUnauthorized: true }, connectionTimeout: 4000, greetingTimeout: 4000, socketTimeout: 4000 });
  try {
    const result = await transport.sendMail({
      from: 'STYLES BY DUJUAN D <notifications@dujuan.test>', to: recipient,
      subject: `[LOCAL TEST — NO RESERVATION] ${mail.subject}`,
      html: mail.html, text: `LOCAL TEST — NO ACTUAL RESERVATION\n\n${mail.text}`,
    });
    return NextResponse.json({ accepted: true, recipient, messageId: result.messageId,
      note: 'Captured by local Mailpit; not delivered to the internet.' }, { headers });
  } catch {
    return NextResponse.json({ error: 'Mailpit unavailable. Start Docker and check port 1025.' }, { status: 502, headers });
  }
}
