import { NextResponse } from 'next/server';
import { authorizeOwner } from '@/lib/owner-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
const localOnly = () => /^http:\/\/(?:localhost|127\.0\.0\.1):54421\/?$/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '');

/** B4.2.5: owner-only LOCAL payment incident review. Never modifies payment data. */
export async function GET(request: Request) {
  const owner = await authorizeOwner(request).catch(() => null);
  if (!owner) return NextResponse.json({ error: 'Owner authentication required.' }, { status: 401, headers });
  if (!localOnly()) return NextResponse.json({ error: 'Local Supabase required for B4.2.5.' }, { status: 503, headers });
  const db = owner.db;
  try {
    const { data: rows, error: reviewError } = await db.from('payment_reconciliation')
      .select('id,appointment_id,stripe_event_id,stripe_checkout_session_id,reason,amount_cents,currency,status,created_at,resolved_at,resolution_note')
      .order('created_at', { ascending: false }).limit(100);
    if (reviewError) throw reviewError;
    const items = rows ?? [];
    const ids = [...new Set(items.map(r => r.appointment_id).filter((v): v is string => typeof v === 'string'))];
    const reviewIds = items.map(r => r.id);
    const [appts, history] = await Promise.all([
      ids.length ? db.from('appointments')
        .select('id,customer_name,starts_at,status,hold_expires_at,deposit_cents,payment_reference,stripe_checkout_session_id')
        .in('id', ids) : Promise.resolve({ data: [], error: null }),
      reviewIds.length ? db.from('payment_reconciliation_actions')
        .select('id,reconciliation_id,actor_email,action,resolution_kind,external_reference,note,created_at')
        .in('reconciliation_id', reviewIds).order('created_at', { ascending: false }).limit(500)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (appts.error || history.error) throw appts.error ?? history.error;
    const apptById = new Map((appts.data ?? []).map(a => [a.id, a]));
    const actionsById = new Map<string, typeof history.data>();
    for (const a of history.data ?? []) {
      const existing = actionsById.get(a.reconciliation_id) ?? [];
      existing.push(a);
      actionsById.set(a.reconciliation_id, existing);
    }
    const now = Date.now();
    return NextResponse.json({
      items: items.map(item => {
        const appointment = apptById.get(item.appointment_id) ?? null;
        const holdExpired = appointment?.hold_expires_at ? Date.parse(appointment.hold_expires_at) < now : false;
        return {
          ...item,
          appointment: appointment ? {
            customerName: appointment.customer_name,
            startsAt: appointment.starts_at,
            storedStatus: appointment.status,
            holdExpired,
            paymentReference: appointment.payment_reference,
            sessionMatches: appointment.stripe_checkout_session_id === item.stripe_checkout_session_id,
          } : null,
          // A display-only classification; never changes appointment DB status.
          displayStatus: item.status === 'needs_review'
            ? (holdExpired ? 'Paid after hold expired — review required' : 'Payment exception — review required')
            : 'Review resolved — audit retained',
          actions: actionsById.get(item.id) ?? [],
        };
      }),
      asOf: new Date().toISOString(),
      notes: 'Up to 100 most recent reviews and 500 latest audit actions. Not a complete accounting export.',
    }, { headers });
  } catch (error) {
    console.error('[B425_RECONCILIATION_READ_FAILED]', error instanceof Object && 'code' in error ? (error as {code?: string}).code : 'unknown');
    return NextResponse.json({ error: 'Unable to load payment reviews. Confirm the LOCAL B4.2.5 SQL is installed.' }, { status: 503, headers });
  }
}
