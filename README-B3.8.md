# Build 3.8 — Verified Payment Reconciliation

## Scope
- Verified paid Stripe events arriving after a hold expires are recorded for manual reconciliation, **never** confirmed as appointments.
- Duplicate Stripe events are idempotent via existing `payment_webhook_events` unique ID.
- Owner-only read-only endpoint: `GET /api/owner/reconciliation`. Never public.
- Does **not** automatically refund, send email, or change the customer-facing booking policy.

## Setup
1. Back up your project and database.
2. Replace project files with this package; preserve `.env.local`.
3. In Supabase SQL Editor, run `supabase/migrations/202610140001_b38_payment_reconciliation.sql` **once after B3.6**.
4. `npm install`, `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.
5. Keep `ENABLE_STRIPE_CHECKOUT=false` until controlled Stripe test-mode checkout, webhook signature verification, late-payment scenario and refund operations are verified.

## Manual verification
- Unauthenticated `GET /api/owner/reconciliation` -> HTTP 401.
- Authenticated owner -> HTTP 200 with `{items:[]}` when empty.
- Test webhook `checkout.session.completed` with correct paid amount and active hold -> confirmed.
- Test webhook paid after hold expiry -> `payment_reconciliation.needs_review` row; appointment **not confirmed**; Stripe receives 200.
- Replay same event ID -> no duplicate row.
- Amount/currency mismatch -> webhook processing fails; no confirmation.

## Operations
The owner must independently inspect the Stripe Dashboard for any reconciliation item, confirm actual funds received, then refund or resolve the issue through an approved documented process. This release intentionally provides **no automatic refund or resolution endpoint**. Do not send a customer a confirmation for an expired reservation.
