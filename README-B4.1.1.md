# Build 4.1.1 — Stripe Test-Mode Verification Harness

## Scope
Adds **contract tests and a read-only local readiness checker**. No payment route, webhook, database migration, booking UI, or production configuration is changed. This is not proof of Stripe/Supabase end-to-end operation: the signed fixtures and SQL checks are offline. Live integration must be verified manually before production.

## Install
Extract this ZIP into `C:\dev\projects\burtons-barbershop`, retaining directories. Build 4.1 must already be installed. No dependencies or migrations.

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
powershell -ExecutionPolicy Bypass -File .\scripts\check-stripe-test-readiness.ps1
```

## Controlled Stripe TEST-mode verification — operator checklist
1. Confirm `.env.local` uses `sk_test_...`, the matching test-mode Stripe webhook signing secret, and **never** a live key. Do not share secrets in chat. Leave `ENABLE_NOTIFICATION_DELIVERY=false`.
2. In a dedicated local test window only, start `npm run dev`, use Stripe CLI `stripe login` and `stripe listen --forward-to localhost:3000/api/stripe/webhook`. Use the `whsec_...` printed by the CLI for `STRIPE_WEBHOOK_SECRET` and restart Next.js. Keep `ENABLE_STRIPE_CHECKOUT=false` until ready for a supervised test transaction.
3. Use test-only services and a free future slot in the isolated test database. Confirm `APP_ORIGIN=http://localhost:3000`, Supabase test project, and a test-mode Stripe key. Temporarily set `ENABLE_STRIPE_CHECKOUT=true` **only on localhost** and restart the dev server. Do not deploy this toggle.
4. Book through `/book` and pay using Stripe's documented test card `4242 4242 4242 4242` (any future expiration, any CVC). Confirm Stripe shows a **$10 USD test payment**. Verify **one** appointment transitions from `pending_payment` to `confirmed` and has the expected Stripe Checkout session ID.
5. In the Supabase SQL Editor (test project), query the appointment and webhook events (queries below). Verify a single `stripe_event_id` for each Stripe event. Re-send the **same** signed event using Stripe CLI/dashboard redelivery; confirm no extra appointment or confirmation notification is created.
6. Test unpaid Checkout expiration and unsuccessful payment separately. Verify pending holds become `expired`, and availability returns appropriately. Check late payment behavior: **currently a late paid event returns 500 and requires manual reconciliation/refund**, so do not launch until this case has a defined handling workflow.
7. Inspect `/owner/reconciliation`, `/owner/notifications/health`, and `/owner/notifications/investigations` for mismatches. No live email should be delivered.
8. Reset `ENABLE_STRIPE_CHECKOUT=false`, restart, and confirm `/api/checkout/readiness` reflects disabled checkout. Keep all live credentials and production delivery disabled.

### Read-only SQL inspection (test database only)
```sql
select id, status, starts_at, hold_expires_at, deposit_cents,
       stripe_checkout_session_id, payment_reference
from public.appointments
order by starts_at desc limit 20;

select stripe_event_id, event_type
from public.payment_webhook_events
order by stripe_event_id desc limit 20;

select event_key, kind, status, attempts
from public.notification_outbox
order by created_at desc limit 20;
```

## Stop-ship checks
- A paid Checkout is not confirmed exactly once.
- A failed/expired Checkout confirms an appointment.
- A payment amount/currency mismatch is accepted.
- Duplicate event delivery creates duplicate confirmations.
- A paid event arrives after hold expiry: requires explicit owner review and refund handling.
- Stripe/Supabase are pointed at production or live-mode keys during testing.

## What this build does not do
It does not automatically initiate Stripe payments, call Stripe CLI, run a Supabase instance, or verify external provider settlement. Those require your local credentials and hands-on test results. It does not fix the known late-payment reconciliation limitation.
