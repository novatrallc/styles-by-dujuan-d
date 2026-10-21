# Build 4.1 — Stripe Webhook Security & Verification

## Install
Extract at `C:\dev\projects\burtons-barbershop`, preserving directories. Replaces `app/api/stripe/webhook/route.ts`; adds `lib/stripe-webhook-security.ts` and `tests/stripe-webhook-security.test.ts`.

No new dependencies or SQL migration. This build does **not** enable live payments.

## Verify
```
npm run typecheck
npm run lint
npm run test
npm run build
```

## What is covered
- Stripe raw-payload HMAC verification with 5-minute timestamp tolerance.
- Signature rotation support (multiple v1 signatures).
- Malformed header/event rejection and checkout-session object validation.
- Existing database RPC `apply_checkout_event` continues to handle idempotency and appointment settlement.
- 5xx on database failure to permit Stripe retry.

## Manual Stripe TEST-MODE checklist (not automated)
1. Leave `ENABLE_STRIPE_CHECKOUT=false` until the controlled test window.
2. Confirm all Stripe credentials are TEST-mode and use a TEST-mode webhook signing secret; never put keys in chat.
3. Use Stripe CLI to forward test events to `http://localhost:3000/api/stripe/webhook`.
4. Check invalid signatures return HTTP 400 and unrelated signed events are acknowledged.
5. Create a test reservation through the actual checkout journey during an explicitly controlled test window, and verify a paid $10 test checkout confirms exactly one appointment.
6. Replay the same event and confirm no duplicate booking or outbox notifications.
7. Verify expired holds cannot become confirmed and are surfaced for manual payment review/refund; check this carefully before production.
8. Verify asynchronous payment, cancellations, and provider outage recovery with real test events.

## Known production blockers
- This is a security/contract test build, not proof of real Stripe-to-database settlement.
- Existing SQL raises an error on late paid events; reconcile/refund handling requires full manual validation.
- Checkout's server-side slot hold, session persistence, idempotency, webhook processing, and payment reconciliation need integrated tests against an isolated Supabase database.
- Production email and live payment toggles remain disabled.
