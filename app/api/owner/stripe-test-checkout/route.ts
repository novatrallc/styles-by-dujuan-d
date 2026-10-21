import { NextRequest, NextResponse } from 'next/server';
import { authorizeOwner } from '@/lib/owner-auth';
import { availability } from '@/lib/booking-server';
import { validCustomer, validSlot } from '@/lib/checkout-foundation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const noStore = { 'Cache-Control': 'private, no-store' };
const respond = (message: string, status: number) => NextResponse.json({ error: message }, { status, headers: noStore });

/** Owner-only, sandbox-only Checkout Session creation. Never enables public checkout. */
export async function POST(request: NextRequest) {
  const owner = await authorizeOwner(request).catch(() => null);
  if (!owner) return respond('Unauthorized', 401);
  if (process.env.ENABLE_OWNER_STRIPE_TEST_CHECKOUT !== 'true') return respond('Owner test checkout is disabled.', 403);
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

if (!/^http:\/\/(localhost|127\.0\.0\.1):54421\/?$/.test(supabaseUrl)) {
  return respond('Owner sandbox checkout requires local Supabase.', 503);
}
  const key = process.env.STRIPE_SECRET_KEY ?? '';
  const origin = process.env.APP_ORIGIN ?? '';
  if (!key.startsWith('sk_test_') || !process.env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_') || !/^http:\/\/localhost(?::\d+)?$/.test(origin)) {
    return respond('Sandbox credentials and localhost APP_ORIGIN are required.', 503);
  }
  let payload: unknown;
  try { payload = await request.json(); } catch { return respond('Invalid JSON.', 400); }
  if (!payload || typeof payload !== 'object') return respond('Invalid request.', 400);
  const body = payload as Record<string, unknown>;
  if (typeof body.service !== 'string' || typeof body.start !== 'string' || typeof body.end !== 'string' || !validCustomer(body.customer)) return respond('Invalid booking details.', 400);
  const customer = body.customer;
  const { start, end } = body;
  if (!Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end))) return respond('Invalid date.', 400);
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(start));
  let holdId: string | null = null;
  try {
    const slots = await availability(day, body.service, true);
    if (!slots.ready || !slots.slots.some(slot => slot.start === start && slot.end === end)) return respond('Time is no longer available.', 409);
    const db = owner.db;
    const [{ data: service, error: serviceError }, { data: barber, error: barberError }] = await Promise.all([
      db.from('services').select('id,name,price_cents,duration_minutes,is_active').eq('slug', body.service).maybeSingle(),
      db.from('barbers').select('id').eq('is_active', true).limit(1).maybeSingle(),
    ]);
    if (serviceError || barberError || !service || !barber || !service.is_active || !service.price_cents || !service.duration_minutes || !validSlot(start, end, service.duration_minutes)) return respond('Service unavailable.', 409);
    const { data: hold, error: holdError } = await db.rpc('create_owner_sandbox_checkout_hold', {
      p_barber_id: barber.id, p_service_id: service.id, p_start: start, p_end: end,
      p_name: customer.name, p_email: customer.email, p_phone: customer.phone, p_total: service.price_cents,
    });
    if (holdError || typeof hold !== 'string') return respond('Unable to reserve this slot.', 409);
    holdId = hold;
    const params = new URLSearchParams({
      mode: 'payment', success_url: `${origin}/book/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/book?checkout=cancelled`, customer_email: customer.email,
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][unit_amount]': '1000',
      'line_items[0][price_data][product_data][name]': `Reservation deposit - ${service.name}`,
      'line_items[0][quantity]': '1', 'metadata[appointment_id]': hold,
      'metadata[test_checkout]': 'owner_sandbox', 'payment_method_types[0]': 'card',
      expires_at: String(Math.floor(Date.now() / 1000) + 1800),
    });
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': `dujuan-${hold}` },
      body: params.toString(), cache: 'no-store', signal: AbortSignal.timeout(15000),
    });
    const session = await response.json() as { id?: string; url?: string; livemode?: boolean };
    if (!response.ok || session.livemode !== false || !session.id?.startsWith('cs_test_') || !session.url?.startsWith('https://checkout.stripe.com/')) {
      await db.from('appointments').update({ status: 'expired' }).eq('id', hold).eq('status', 'pending_payment');
      return respond('Stripe sandbox checkout could not be created.', 502);
    }
    const { data: saved, error: saveError } = await db.from('appointments').update({ stripe_checkout_session_id: session.id }).eq('id', hold).eq('status', 'pending_payment').select('id').maybeSingle();
    if (saveError || !saved) {
      // A Stripe session may exist: explicitly expire it before releasing the appointment.
      const expired = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(session.id)}/expire`, {
        method: 'POST', headers: { Authorization: `Bearer ${key}` }, cache: 'no-store', signal: AbortSignal.timeout(15000),
      }).catch(() => null);
      if (expired?.ok) await db.from('appointments').update({ status: 'expired' }).eq('id', hold).eq('status', 'pending_payment');
      return respond('Could not save checkout session. Review Stripe and appointment state before retrying.', 502);
    }
    return NextResponse.json({ checkoutUrl: session.url, appointmentId: hold, testMode: true }, { headers: noStore });
  } catch {
    if (holdId) {
      // An uncertain network outcome may have created a Stripe session. Keep the hold
      // pending for reconciliation rather than risk selling the slot twice.
      return respond('Checkout outcome uncertain. Inspect Stripe and the pending hold before retrying.', 502);
    }
    return respond('Unable to prepare test checkout.', 500);
  }
}
