import { NextRequest, NextResponse } from 'next/server';
import { authorizeOwner } from '@/lib/owner-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'private, no-store' };

function isLocalSupabase(): boolean {
  // B4.2.3 is a LOCAL development diagnostic; never query the hosted database.
  return /^http:\/\/(?:127\.0\.0\.1|localhost):54421\/?$/.test(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  );
}

/** Read-only diagnostic. No Stripe request, status update, or payment action occurs here. */
export async function GET(request: NextRequest) {
  const owner = await authorizeOwner(request).catch(() => null);
  if (!owner) {
    return NextResponse.json({ error: 'Owner authentication required.' }, { status: 401, headers: noStore });
  }
  if (!isLocalSupabase()) {
    return NextResponse.json(
      { error: 'This development-only verification center requires local Supabase on port 54421.' },
      { status: 503, headers: noStore },
    );
  }

  const checks = {
    localSupabase: true,
    stripeTestKey: (process.env.STRIPE_SECRET_KEY ?? '').startsWith('sk_test_'),
    webhookSecretPresent: (process.env.STRIPE_WEBHOOK_SECRET ?? '').startsWith('whsec_'),
    localhostOrigin: /^http:\/\/localhost(?::\d+)?$/.test(process.env.APP_ORIGIN ?? ''),
    publicCheckoutDisabled: process.env.ENABLE_STRIPE_CHECKOUT !== 'true',
    notificationDeliveryDisabled: process.env.ENABLE_NOTIFICATION_DELIVERY !== 'true',
    ownerSandboxCheckoutEnabled: process.env.ENABLE_OWNER_STRIPE_TEST_CHECKOUT === 'true',
    publicCatalogEnabled: process.env.ENABLE_PUBLIC_SERVICE_CATALOG === 'true',
    publicPricingEnabled: process.env.ENABLE_PUBLIC_SERVICE_PRICING === 'true',
  };

  try {
    const db = owner.db;
    const [appointments, reconciliations, events] = await Promise.all([
      db.from('appointments')
        .select('id,created_at,starts_at,status,deposit_cents,stripe_checkout_session_id,payment_reference,hold_expires_at')
        .not('stripe_checkout_session_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100),
      db.from('payment_reconciliation')
        .select('id,appointment_id,stripe_event_id,stripe_checkout_session_id,reason,amount_cents,currency,status,created_at')
        .order('created_at', { ascending: false })
        .limit(25),
      // B3.x stores event ID and type but does not store Checkout session ID here.
      // These rows are a sample, NOT a per-appointment delivery confirmation.
      db.from('payment_webhook_events')
        .select('stripe_event_id,event_type')
        .limit(25),
    ]);
    if (appointments.error || reconciliations.error || events.error) {
      console.error('[B423_VERIFICATION_QUERY_FAILED]', {
        appointments: appointments.error?.code,
        reconciliations: reconciliations.error?.code,
        events: events.error?.code,
      });
      return NextResponse.json(
        { error: 'Could not read one or more local payment tables. Check the local migrations and server log.' },
        { status: 503, headers: noStore },
      );
    }
    // Avoid exposing unrelated live checkout records if mistakenly copied into a local DB.
    const testAppointments = (appointments.data ?? [])
      .filter(row => typeof row.stripe_checkout_session_id === 'string' && row.stripe_checkout_session_id.startsWith('cs_test_'))
      .slice(0, 25);
    const testAppointmentIds = new Set(testAppointments.map(row => row.id));
    const reviewItems = (reconciliations.data ?? []).filter(row =>
      testAppointmentIds.has(row.appointment_id) ||
      (typeof row.stripe_checkout_session_id === 'string' && row.stripe_checkout_session_id.startsWith('cs_test_')),
    );

    return NextResponse.json({
      checks,
      appointments: testAppointments,
      reconciliation: reviewItems,
      webhookEventSample: events.data ?? [],
      notes: {
        appointments: 'Showing up to 25 test checkout appointments from the 100 most recently created checkout appointments.',
        webhookEvents: 'Webhook event rows are an unordered sample. The event table does not map events to sessions; check Stripe CLI event IDs for delivery status.',
        reconciliation: 'Showing up to 25 recent reconciliation records, filtered to Stripe test session IDs or displayed test appointments.',
      },
      checkedAt: new Date().toISOString(),
    }, { headers: noStore });
  } catch {
    return NextResponse.json(
      { error: 'Unable to read the local sandbox verification data.' },
      { status: 500, headers: noStore },
    );
  }
}
