# Build 3.6 — Customer Checkout and Payment Hardening (test-only)

## Setup
1. Back up project and `.env.local`; extract ZIP, do not overwrite secrets.
2. Run SQL migration `supabase/migrations/202610130005_b36_checkout_hardening.sql` after B3.5.
3. Run `npm install`, `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.
4. Configure Stripe TEST credentials in `.env.local`: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `APP_ORIGIN=http://localhost:3000`, `ENABLE_STRIPE_CHECKOUT=false` initially. Never share keys.
5. Stripe CLI for local testing: `stripe listen --forward-to localhost:3000/api/stripe/webhook`; use the printed test webhook signing secret. Keep the CLI running.
6. Confirm service price/duration, weekly hours, timezone, active barber, and business_settings bookings_enabled. These are prerequisites to availability.
7. In a controlled **test-only** environment, enable checkout and bookings for a short test window, use Stripe test cards, verify confirmed appointment and single webhook event, then turn both OFF again.

## Important unresolved production work
- Do not enable live payments. Late successful payments after hold expiry are rejected for manual refund/reconciliation; build a durable paid-but-unfulfilled queue before production.
- Checkout session creation failure leaves an expired hold; verify all failure paths.
- Webhook signature verifier needs Stripe SDK / robust multi-signature parsing before production.
- Add a scheduled hold cleanup job, durable checkout status endpoint, customer receipt/email, cancellation/refund policy, and integration tests for races and retries.
- Verify database exclusion constraints and security policies in deployed Supabase.
- B3.6 intentionally does not assert a confirmed appointment from the browser redirect.
