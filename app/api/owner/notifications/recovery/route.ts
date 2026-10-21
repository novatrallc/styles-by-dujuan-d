import { NextResponse } from 'next/server';
import { authorizeOwner } from '@/lib/owner-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

export async function GET(request: Request) {
  const owner = await authorizeOwner(request).catch(() => null);
  if (!owner) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  const { data, error } = await owner.db.from('notification_outbox')
    .select('id,kind,audience,status,attempts,last_error,created_at,provider_message_id,sent_at')
    .eq('status', 'failed').order('created_at', { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: 'Unable to load recovery queue' }, { status: 503, headers });
  return NextResponse.json({ items: data ?? [], deliveryEnabled: process.env.ENABLE_NOTIFICATION_DELIVERY === 'true' }, { headers });
}

export async function POST(request: Request) {
  const owner = await authorizeOwner(request).catch(() => null);
  if (!owner || !owner.user.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  if (process.env.ENABLE_NOTIFICATION_RECOVERY !== 'true')
    return NextResponse.json({ error: 'Recovery is disabled. Set ENABLE_NOTIFICATION_RECOVERY=true only after provider reconciliation.' }, { status: 403, headers });
  // Require deliberate confirmation; never auto-retry ambiguous provider outcomes.
  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers }); }
  if (!payload || typeof payload !== 'object') return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers });
  const { id, acknowledged } = payload as Record<string, unknown>;
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) || acknowledged !== true)
    return NextResponse.json({ error: 'A valid notification and explicit acknowledgement are required' }, { status: 400, headers });
  const { data, error } = await owner.db.rpc('b399_request_notification_retry', { p_id: id, p_actor_email: owner.user.email });
  if (error) return NextResponse.json({ error: 'Unable to request recovery' }, { status: 503, headers });
  if (data !== true) return NextResponse.json({ error: 'Not eligible for retry. It may have changed, been sent, or exhausted its attempts.' }, { status: 409, headers });
  return NextResponse.json({ queued: true, note: 'Requeued only; no email was sent by this action.' }, { headers });
}
