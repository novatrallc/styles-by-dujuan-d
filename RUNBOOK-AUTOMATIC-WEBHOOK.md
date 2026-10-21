# B4.2.6 — Proof of genuine automatic Stripe webhook forwarding

**Status: NOT YET VERIFIED.** The historical $10 paid session was processed by a locally signed replay after its hold expired. That proves local handler/database reconciliation, **not** automatic Stripe CLI forwarding.

## Before attempting a fresh payment
- Choose a separate, NEW test appointment only when you intentionally want another Stripe **TEST** payment. Never re-pay the previous `cs_test_...` session.
- Public checkout remains `false`; outbound delivery remains `false`; public service pricing remains off unless separately approved.
- Confirm your `.env.local` Supabase URL points to local `:54421`, Stripe secret begins `sk_test_`, APP_ORIGIN is `http://localhost:3000`.
- Verify the Stripe sandbox account is the intended *test* account. Your earlier tests used a **HoneyBee Creation LLC** sandbox; this is not approval for production on Dujuan's behalf.
- Confirm the owner-only sandbox hold RPC is `create_owner_sandbox_checkout_hold` and its SQL permissions are service-role only. Do not change original `create_checkout_hold`.
- `npm run build` and `npm run dev` must never run simultaneously against `.next`.

## Set up two foreground terminals
1. Start Next.js (`npm run start` after a successful build, or `npm run dev` in isolation) on port 3000.
2. **Before starting checkout**, start a separate Stripe CLI terminal:

```powershell
stripe listen --events checkout.session.completed,checkout.session.expired,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed --forward-to http://localhost:3000/api/stripe/webhook
```

Wait for **Ready!** and privately copy this listener's current `whsec_...` into `.env.local` `STRIPE_WEBHOOK_SECRET`. Restart Next.js if that value changes. A webhook secret is not a test card and must never be pasted into chat.

## Controlled one-time payment
1. Temporarily enable only `ENABLE_OWNER_STRIPE_TEST_CHECKOUT=true`, restarting Next.js so the server reads the flag.
2. From `/owner/stripe-sandbox`, select a fresh future available slot with fictional name, email and phone. **Don't repeat or reuse the original expired slot.**
3. Make ONE $10 Stripe **TEST** payment using `4242 4242 4242 4242`, future expiry, and any 3-digit CVC.
4. Listener must log the *matching new* `checkout.session.completed` event, an HTTP POST to `http://localhost:3000/api/stripe/webhook`, and `200`. The Next.js terminal should also show the POST. Capture event ID and timestamp without exposing secrets or real customer data.
5. Open `/owner/payment-activity`. Select the **NEW** appointment. Verify Stripe status is `complete`, `paid`, amount 1000 USD and all 4 association checks match.
6. Refresh `/owner/stripe-verification`. If the payment completed while hold was valid, DB `appointments.status` should be `confirmed`, with `payment_reference = stripe_checkout_session_id`. If it arrived after expiry, the review queue must show an exception instead — do NOT manually confirm the expired appointment.
7. Cross-check the new event ID in `payment_webhook_events`. **Its ID alone isn't proof of CLI delivery**; the matching listener log and POST response are required.
8. Revert `ENABLE_OWNER_STRIPE_TEST_CHECKOUT=false` and restart Next.js. Keep public checkout and notifications OFF.

## Failures and no-retry rule
- `400` — Stripe CLI `whsec_` mismatch or signature/raw-body verification failure; verify listener and server secrets. Do not disable signature verification.
- `404` — wrong forwarding URL/port or Next.js routing.
- `500` — database settlement failed. Inspect Next.js server logs; ensure linked session and pending appointment exist. The Stripe event is retriable; do not make a new charge.
- Stripe `paid` but no listener event — confirm Stripe CLI started before payment, that it is still running, and account/environment match. Check the original session from Stripe and local DB before deciding on any remedy.
- `pending_payment` after expired hold — stop; inspect reconciliation and related events. **Never force-confirm an expired hold.**
- **DO NOT use `stripe trigger checkout.session.completed` as proof for this app.** Synthetic sessions won't match the local reservation database.
- **DO NOT use the old locally-signed replay script as proof of automatic forwarding.** It is an application reconciliation simulation, not a Stripe-to-CLI delivery test.

## Production gate
Genuine fresh-event forwarding is necessary but not sufficient for live launch. Confirm merchant account identity, real production webhook endpoint, actual account ownership, policies, refunds and compliance, alerting/monitoring, idempotency, hold alignment, and end-to-end customer communication. Obtain owner sign-off before switching public checkout on.
