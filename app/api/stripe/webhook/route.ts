import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/checkout-foundation';
import { parseCheckoutEvent, verifyStripeSignature } from '@/lib/stripe-webhook-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supportedEvents = new Set([
  'checkout.session.completed',
  'checkout.session.expired',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
]);

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'Webhook not configured.' }, { status: 503 });
  const payload = await request.text();
  if (payload.length > 256_000) return NextResponse.json({ error: 'Payload too large.' }, { status: 413 });
  if (!verifyStripeSignature(payload, request.headers.get('stripe-signature') ?? '', secret)) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }
  const event = parseCheckoutEvent(payload);
  if (!event) return NextResponse.json({ error: 'Invalid event.' }, { status: 400 });
  if (!supportedEvents.has(event.type)) return NextResponse.json({ received: true });
  try {
    const { error } = await adminDb().rpc('apply_checkout_event', {
      p_event_id: event.id,
      p_type: event.type,
      p_session: event.data.object.id,
      p_payment_status: event.data.object.payment_status ?? '',
      p_amount_total: event.data.object.amount_total ?? -1,
      p_currency: event.data.object.currency ?? '',
    });
    if (error) throw error;
    return NextResponse.json({ received: true });
  } catch {
    // Stripe retries 5xx. Never report success if the database did not settle the event.
    return NextResponse.json({ error: 'Unable to process event.' }, { status: 500 });
  }
}
