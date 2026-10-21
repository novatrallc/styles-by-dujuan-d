# Build 3.7 — Payment status and customer confirmation (test only)

## Changes
- Stripe success redirect now carries `{CHECKOUT_SESSION_ID}` to `/book/confirmation`.
- Confirmation page polls a read-only server status endpoint up to 12 times (~30 seconds).
- Confirmation is displayed **only** if the database appointment status is `confirmed` after a verified webhook.
- No customer PII is returned by the status endpoint or embedded in the confirmation URL.
- Expired, cancelled, missing and unknown reservations never show a successful booking.

## Install
Preserve `.env.local`; replace project files; `npm install && npm run verify`.
No new SQL migration is required for this incremental release.
Keep `ENABLE_STRIPE_CHECKOUT=false` until Stripe TEST webhook end-to-end verification is complete.

## Test plan
1. Verify all checks pass; confirm booking remains off.
2. Configure Stripe test keys, webhook secret, service pricing, working hours and availability in a test Supabase project.
3. With test-only settings, pay using a Stripe test card; verify webhook marks appointment `confirmed` and confirmation page shows success.
4. Test cancellation, failed payment, webhook delay, duplicate webhook, and expired hold; none should claim confirmation.
5. Switch booking and checkout flags back off.

## Remaining production blockers
- Late paid-but-unfulfilled reconciliation/refund workflow: current B3.6 webhook RPC raises and retries on late payment; operations must review Stripe payments manually until durable reconciliation is built.
- Implement owner-facing refunds/reconciliation, transactional emails, durable receipts, expired-hold cleanup, concurrency integration tests, and payment-provider error monitoring.
- Stripe webhook signature validation should be replaced with Stripe SDK verification (including multi-signature handling) before live mode.
- Customer confirmation depends on webhook delivery; a Stripe redirect alone never proves payment.
- Do not turn on live payments or publicly launch until production readiness review.
