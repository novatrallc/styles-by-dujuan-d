import { NextResponse } from 'next/server';
import { authorizeOwner } from '@/lib/owner-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

export async function GET(request: Request) {
  const owner = await authorizeOwner(request).catch(() => null);
  if (!owner) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  const { data, error } = await owner.db.from('notification_outbox')
    .select('id,kind,audience,status,attempts,last_error,created_at,sent_at,provider_message_id,event_key')
    .in('status', ['failed', 'sending', 'pending'])
    .order('created_at', { ascending: true }).limit(200);
  if (error) return NextResponse.json({ error: 'Unable to load notification investigations' }, { status: 503, headers });
  return NextResponse.json({ items: data ?? [], checkedAt: new Date().toISOString(), limit: 200, truncated: (data?.length ?? 0) === 200 }, { headers });
}
