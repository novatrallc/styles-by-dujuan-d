import { NextRequest, NextResponse } from 'next/server';
import { authorizeOwner } from '@/lib/owner-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
const localOnly = () => /^http:\/\/(?:127\.0\.0\.1|localhost):54421\/?$/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '');

/** Owner-only, LOCAL-only, read-only readiness report. Does NOT call payment processors. */
export async function GET(request: NextRequest) {
  // Reject hosted configurations before even attempting owner authentication.
  if (!localOnly()) return NextResponse.json({ error: 'This readiness report requires local Supabase.' }, { status: 503, headers });
  const owner = await authorizeOwner(request).catch(() => null);
  if (!owner) return NextResponse.json({ error: 'Owner authentication required.' }, { status: 401, headers });

  try {
    const db = owner.db;
    const [reviews, events, confirmed] = await Promise.all([
      db.from('payment_reconciliation').select('id', { head: true, count: 'exact' }).eq('status', 'needs_review'),
      db.from('payment_webhook_events').select('stripe_event_id', { head: true, count: 'exact' }),
      db.from('appointments').select('id', { head: true, count: 'exact' }).eq('status', 'confirmed').like('stripe_checkout_session_id', 'cs_test_%'),
    ]);
    if (reviews.error || events.error || confirmed.error) throw reviews.error ?? events.error ?? confirmed.error;

    const flags = {
      localSupabaseConfigured: true,
      stripeTestKeyFormat: (process.env.STRIPE_SECRET_KEY ?? '').startsWith('sk_test_'),
      webhookSigningSecretPresent: (process.env.STRIPE_WEBHOOK_SECRET ?? '').startsWith('whsec_'),
      publicCheckoutOff: process.env.ENABLE_STRIPE_CHECKOUT !== 'true',
      ownerTestCheckoutOff: process.env.ENABLE_OWNER_STRIPE_TEST_CHECKOUT !== 'true',
      notificationDeliveryOff: process.env.ENABLE_NOTIFICATION_DELIVERY !== 'true',
      squarePaymentWritesOff: process.env.ENABLE_SQUARE_PAYMENTS !== 'true',
      squareOnlineCheckoutOff: process.env.ENABLE_SQUARE_ONLINE_CHECKOUT !== 'true',
      squareSandboxCredentialsPresent: process.env.SQUARE_ENVIRONMENT === 'sandbox' &&
        Boolean(process.env.SQUARE_ACCESS_TOKEN) && Boolean(process.env.SQUARE_LOCATION_ID),
    };
    const safeForReadOnly = flags.publicCheckoutOff && flags.ownerTestCheckoutOff &&
      flags.notificationDeliveryOff && flags.squarePaymentWritesOff && flags.squareOnlineCheckoutOff;

    return NextResponse.json({
      build: 'B4.2.7',
      generatedAt: new Date().toISOString(),
      readOnly: true,
      flags,
      safeForReadOnly,
      localRecords: {
        unresolvedReconciliationCount: reviews.count ?? 0,
        recordedStripeWebhookEventCount: events.count ?? 0,
        locallyConfirmedTestAppointments: confirmed.count ?? 0,
      },
      evidence: {
        stripeApiKeyAccountVerified: 'not_verified',
        stripeCliAutomaticForwarding: 'not_verified',
        stripeMerchantOfRecordApproved: 'not_verified',
        applePayEligibleWalletTest: 'not_verified',
        squareSellerAndLocationApproved: 'not_verified',
        squarePOSPaymentLinked: 'not_implemented',
        squareOnlineCheckout: 'deferred',
      },
      caveats: [
        'Key prefixes and environment flags are configuration checks only, not proof of access or account ownership.',
        'Recorded webhook rows do not prove Stripe CLI forwarded them automatically; previous event was replayed locally.',
        'Square credentials, if configured, are not validated or called by this page.',
        'Historical paid-after-expiry reconciliation remains owner-review-only, never a confirmed appointment.',
      ],
    }, { headers });
  } catch (error) {
    console.error('[B427_READINESS_FAILED]', error instanceof Object && 'code' in error ? (error as { code?: string }).code : 'unknown');
    return NextResponse.json({ error: 'Unable to read local payment readiness. Check existing local tables and server logs.' }, { status: 503, headers });
  }
}
