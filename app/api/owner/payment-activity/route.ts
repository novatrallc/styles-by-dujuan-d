import { NextRequest, NextResponse } from 'next/server';
import { authorizeOwner } from '@/lib/owner-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
const localOnly = () => /^http:\/\/(?:localhost|127\.0\.0\.1):54421\/?$/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '');

type AppointmentRow = {
  id: string; created_at: string; starts_at: string; status: string;
  customer_name: string; deposit_cents: number; stripe_checkout_session_id: string | null;
  payment_reference: string | null; hold_expires_at: string | null;
};
type ReviewRow = {
  id: string; appointment_id: string; stripe_event_id: string; reason: string;
  amount_cents: number; currency: string; status: string; created_at: string;
  resolved_at: string | null;
};
type ActionRow = { id: string; reconciliation_id: string; action: string; note: string; created_at: string };
type EventRow = { stripe_event_id: string; event_type: string };
type Milestone = { id: string; label: string; occurredAt: string | null; detail: string; kind: 'neutral' | 'review' | 'complete' };

/** B4.2.6: owner-only, local-only read model. Never writes payment, appointment, or Stripe data. */
export async function GET(request: NextRequest) {
  const owner = await authorizeOwner(request).catch(() => null);
  if (!owner) return NextResponse.json({ error: 'Owner authentication required.' }, { status: 401, headers });
  if (!localOnly()) return NextResponse.json({ error: 'This development diagnostic requires local Supabase.' }, { status: 503, headers });
  try {
    const db = owner.db;
    const apptResponse = await db.from('appointments')
      .select('id,created_at,starts_at,status,customer_name,deposit_cents,stripe_checkout_session_id,payment_reference,hold_expires_at')
      .not('stripe_checkout_session_id', 'is', null)
      .order('created_at', { ascending: false }).limit(100);
    if (apptResponse.error) throw apptResponse.error;
    const appointments = ((apptResponse.data ?? []) as unknown as AppointmentRow[])
      .filter(row => row.stripe_checkout_session_id?.startsWith('cs_test_')).slice(0, 25);
    const appointmentIds = appointments.map(a => a.id);
    const reviewResponse = appointmentIds.length
      ? await db.from('payment_reconciliation')
        .select('id,appointment_id,stripe_event_id,reason,amount_cents,currency,status,created_at,resolved_at')
        .in('appointment_id', appointmentIds).order('created_at', { ascending: false }).limit(100)
      : { data: [], error: null };
    if (reviewResponse.error) throw reviewResponse.error;
    const reviews = (reviewResponse.data ?? []) as unknown as ReviewRow[];
    const reviewIds = reviews.map(r => r.id);
    const actionResponse = reviewIds.length
      ? await db.from('payment_reconciliation_actions')
        .select('id,reconciliation_id,action,note,created_at')
        .in('reconciliation_id', reviewIds).order('created_at', { ascending: true }).limit(500)
      : { data: [], error: null };
    if (actionResponse.error) throw actionResponse.error;
    const actions = (actionResponse.data ?? []) as unknown as ActionRow[];
    const stripeEventIds = reviews.map(r => r.stripe_event_id);
    const eventResponse = stripeEventIds.length
      ? await db.from('payment_webhook_events')
        .select('stripe_event_id,event_type').in('stripe_event_id', stripeEventIds)
      : { data: [], error: null };
    if (eventResponse.error) throw eventResponse.error;
    const recordedEvents = new Map(((eventResponse.data ?? []) as unknown as EventRow[])
      .map(event => [event.stripe_event_id, event.event_type]));
    const now = Date.now();
    const items = appointments.map(appointment => {
      const incident = reviews.filter(r => r.appointment_id === appointment.id);
      const expired = !!appointment.hold_expires_at && Date.parse(appointment.hold_expires_at) < now;
      const hasReview = incident.some(r => r.status === 'needs_review');
      const milestones: Milestone[] = [{
        id: 'created', label: 'Reservation hold created', occurredAt: appointment.created_at,
        detail: 'Local appointment record was created. This does not prove a card payment.', kind: 'neutral',
      }, {
        id: 'session', label: 'Stripe Checkout session linked', occurredAt: null,
        detail: 'Session ID saved locally; original linkage timestamp is not retained.', kind: 'neutral',
      }];
      if (expired && appointment.status === 'pending_payment') milestones.push({
        id: 'deadline', label: 'Reservation hold deadline passed', occurredAt: appointment.hold_expires_at,
        detail: 'Stored status may still read pending_payment; expired holds must not be automatically confirmed.', kind: 'review',
      });
      if (appointment.status === 'confirmed') milestones.push({
        id: 'confirmed', label: 'Appointment confirmation recorded', occurredAt: null,
        detail: appointment.payment_reference === appointment.stripe_checkout_session_id
          ? 'Stored payment reference matches the Checkout session. Confirmation time was not retained.'
          : 'Payment reference does not match. Investigate before treating this appointment as settled.',
        kind: appointment.payment_reference === appointment.stripe_checkout_session_id ? 'complete' : 'review',
      });
      for (const r of incident) {
        milestones.push({ id: `review-${r.id}`, label: r.reason === 'late_payment' ? 'Late-payment review opened' : 'Payment exception recorded',
          occurredAt: r.created_at, detail: `Review is ${r.status}; event ID ${r.stripe_event_id}.`, kind: 'review' });
        if (recordedEvents.has(r.stripe_event_id)) milestones.push({
          id: `event-${r.stripe_event_id}`, label: 'Webhook event ID recorded', occurredAt: null,
          detail: `Database contains ${recordedEvents.get(r.stripe_event_id)}. It does not record delivery source or receipt time.`, kind: 'complete',
        });
        for (const action of actions.filter(a => a.reconciliation_id === r.id)) milestones.push({
          id: `action-${action.id}`, label: action.action === 'resolved' ? 'Owner closed payment review' : 'Owner review note recorded',
          occurredAt: action.created_at, detail: 'Owner action saved in the local audit trail.', kind: 'neutral',
        });
      }
      return {
        id: appointment.id, customerName: appointment.customer_name, appointmentAt: appointment.starts_at,
        checkoutSessionId: appointment.stripe_checkout_session_id, depositCents: appointment.deposit_cents,
        storedStatus: appointment.status, holdExpired: expired, holdExpiresAt: appointment.hold_expires_at,
        paymentReferenceMatches: appointment.payment_reference === appointment.stripe_checkout_session_id,
        unresolvedReviews: incident.filter(r => r.status === 'needs_review').length,
        displayStatus: hasReview ? 'Paid after hold expiry — owner review required'
          : appointment.status === 'confirmed' && appointment.payment_reference === appointment.stripe_checkout_session_id
            ? 'Confirmed in local database'
            : appointment.status === 'pending_payment' && expired ? 'Hold expired — payment status unverified'
            : appointment.status === 'pending_payment' ? 'Awaiting payment reconciliation'
            : `Stored state: ${appointment.status}`,
        milestones,
      };
    });
    return NextResponse.json({
      items, asOf: new Date().toISOString(),
      limits: 'Up to 25 test appointments from the latest 100 linked appointments; up to 100 related reviews and 500 owner actions.',
      caveat: 'A recorded event ID does NOT establish Stripe CLI forwarding. Confirm the matching event and HTTP 200 in the listener terminal.',
      checks: { localSupabase: true, publicCheckoutDisabled: process.env.ENABLE_STRIPE_CHECKOUT !== 'true',
        notificationDeliveryDisabled: process.env.ENABLE_NOTIFICATION_DELIVERY !== 'true',
        ownerTestCheckoutEnabled: process.env.ENABLE_OWNER_STRIPE_TEST_CHECKOUT === 'true' },
    }, { headers });
  } catch (error) {
    console.error('[B426_ACTIVITY_READ_FAILED]', error instanceof Object && 'code' in error ? (error as { code?: string }).code : 'unknown');
    return NextResponse.json({ error: 'Unable to load payment activity from local Supabase. Check local tables and server logs.' }, { status: 503, headers });
  }
}
