import { NextRequest, NextResponse } from 'next/server';
import { authorizeOwner } from '@/lib/owner-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
const localOnly = () => /^http:\/\/(?:localhost|127\.0\.0\.1):54421\/?$/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '');
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers });

type CheckoutSnapshot = {
  id?: string; object?: string; status?: string; payment_status?: string;
  amount_total?: number; currency?: string; livemode?: boolean;
  metadata?: { appointment_id?: string };
};

/** On-demand, read-only Stripe test-session lookup, restricted to a locally stored appointment. */
export async function GET(request: NextRequest) {
  const owner = await authorizeOwner(request).catch(() => null);
  if (!owner) return fail('Owner authentication required.', 401);
  if (!localOnly()) return fail('Local Supabase required.', 503);
  const key = process.env.STRIPE_SECRET_KEY ?? '';
  if (!key.startsWith('sk_test_')) return fail('Stripe TEST secret required.', 503);
  const appointmentId = request.nextUrl.searchParams.get('appointmentId') ?? '';
  if (!uuidPattern.test(appointmentId)) return fail('Invalid appointment ID.', 400);
  try {
    const { data: appointment, error } = await owner.db.from('appointments')
      .select('id,deposit_cents,stripe_checkout_session_id')
      .eq('id', appointmentId).maybeSingle();
    if (error || !appointment || typeof appointment.stripe_checkout_session_id !== 'string' ||
        !/^cs_test_[A-Za-z0-9]+$/.test(appointment.stripe_checkout_session_id)) {
      return fail('No locally linked Stripe TEST session for this appointment.', 404);
    }
    const sessionId = appointment.stripe_checkout_session_id;
    // URL is fixed to Stripe's API. Session ID is loaded from the authenticated owner's local database.
    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { Authorization: `Bearer ${key}` }, cache: 'no-store', signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return fail('Stripe could not retrieve this TEST session with the configured account. Check account/key pairing.', 502);
    const session = await response.json() as CheckoutSnapshot;
    if (session.object !== 'checkout.session' || session.id !== sessionId || session.livemode !== false) {
      return fail('Stripe session identity or test-mode validation failed.', 502);
    }
    const matches = {
      linkedSession: session.id === sessionId,
      appointmentMetadata: session.metadata?.appointment_id === appointment.id,
      depositAmount: session.amount_total === appointment.deposit_cents,
      usdCurrency: session.currency?.toLowerCase() === 'usd',
    };
    return NextResponse.json({ id: sessionId, status: session.status ?? 'unknown',
      paymentStatus: session.payment_status ?? 'unknown', amountCents: session.amount_total ?? null,
      currency: session.currency ?? null, testMode: true, matches, checkedAt: new Date().toISOString(),
      note: 'Stripe API snapshot only. This does not alter appointments or prove automatic webhook forwarding.'
    }, { headers });
  } catch {
    return fail('Stripe lookup could not be completed. No payment or booking changes were made.', 502);
  }
}
