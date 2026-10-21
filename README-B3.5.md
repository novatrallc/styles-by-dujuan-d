# Build 3.5 — Secure checkout foundation (test mode only)

This is an opt-in server-side Stripe Checkout integration. Public bookings remain OFF by default. **Do not enable for customers before an end-to-end Stripe test and operational review.**

## Migration
Apply `supabase/migrations/202610130004_b35_checkout_foundation.sql` after B3.3.

## Environment (.env.local; never commit)
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `STRIPE_SECRET_KEY` (Stripe test secret key)
- `STRIPE_WEBHOOK_SECRET` (Stripe CLI / test endpoint signing secret)
- `APP_ORIGIN=http://localhost:3000` (your own trusted origin; no trailing slash)
- `ENABLE_STRIPE_CHECKOUT=false` (default; set true **only in a controlled test**)

## Test flow
1. Configure active service with price >= $10, duration, working hours and owner settings. Turn on `bookings_enabled` **only in the test database**.
2. Set `ENABLE_STRIPE_CHECKOUT=true` in test environment; restart server.
3. POST `/api/checkout` JSON: `{ "service":"haircut", "start":"<ISO UTC>", "end":"<ISO UTC>", "customer": {"name":"Test Client", "email":"test@example.com", "phone":"555-0100"}}` using a slot returned by `/api/availability`.
4. Open returned `checkoutUrl` and use Stripe test payment credentials. Use Stripe CLI to forward webhook to `/api/stripe/webhook`.
5. Confirm appointment becomes `confirmed` **only after a signed paid webhook**. Confirm duplicate webhook is idempotent; overlapping slot returns 409.
6. Keep production bookings disabled until checkout expiry, cancellation, refund, notification, payment reconciliation and owner workflows are reviewed.

## Known limitations / production blockers
- The current booking UI does not yet call `/api/checkout`; this build supplies server APIs and database foundation only.
- A hold expires after 15 minutes, while Stripe Checkout may stay open 30 minutes; payment after hold expiration can race with a newly booked slot. Align both lifetimes and ensure paid-after-expiry reconciliation before launch.
- Checkout creation failure after Stripe session creation can leave an orphan session; add session-expiry cleanup/reconciliation.
- Rate limiting, bot protection, owner notifications, refund policies, and full test coverage remain necessary.
- The webhook does not verify amount/currency or metadata against the appointment yet. Add Stripe session verification and settlement reconciliation before launch.
- Do not use live Stripe keys with this foundation.
