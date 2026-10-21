import { NextResponse } from 'next/server';
import { authorizeOwner } from '@/lib/owner-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'private, no-store' };
const statuses = ['pending', 'sending', 'sent', 'failed'] as const;

export async function GET(request: Request) {
  const owner = await authorizeOwner(request).catch(() => null);
  if (!owner) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStore });

  try {
    const results = await Promise.all(statuses.map(status =>
      owner.db.from('notification_outbox').select('id', { count: 'exact', head: true }).eq('status', status)
    ));
    if (results.some(result => result.error)) throw new Error('Counts unavailable');

    const oldest = await owner.db.from('notification_outbox')
      .select('created_at').eq('status', 'pending').order('created_at', { ascending: true }).limit(1);
    if (oldest.error) throw new Error('Pending age unavailable');

    const counts = Object.fromEntries(statuses.map((status, index) => [status, results[index].count ?? 0]));
    return NextResponse.json({ counts, oldestPendingAt: oldest.data?.[0]?.created_at ?? null,
      deliveryEnabled: process.env.ENABLE_NOTIFICATION_DELIVERY === 'true',
      checkedAt: new Date().toISOString(), scope: 'all_notification_records' }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: 'Notification health is temporarily unavailable' }, { status: 503, headers: noStore });
  }
}
