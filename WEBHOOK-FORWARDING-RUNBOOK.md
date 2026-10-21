# B4.2.5 — Prove automatic Stripe webhook forwarding (separate integration test)

This runbook is **not** an automated test and does **not** run Stripe payments by itself. The previous $10 sandbox payment was recorded through a **locally signed historical event replay**; that validated the application reconciliation path, not the automatic CLI listener.

1. Finish review of the original late-payment case in local Supabase. Leave the original expired appointment untouched. Never retry or charge for the old checkout session.
2. Verify `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421`, `APP_ORIGIN=http://localhost:3000`, `STRIPE_SECRET_KEY=sk_test_...`, `ENABLE_STRIPE_CHECKOUT=false`, `ENABLE_NOTIFICATION_DELIVERY=false`, `ENABLE_PUBLIC_SERVICE_PRICING=false`. Do not expose keys in screenshots.
3. **For the separate new sandbox test only**, start Next.js at port 3000 and start Stripe CLI in its own terminal **before initiating checkout**:

   ```powershell
   stripe listen --events checkout.session.completed,checkout.session.expired,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed --forward-to http://localhost:3000/api/stripe/webhook
   ```

4. Compare the **current listener** `whsec_...` with `.env.local`'s `STRIPE_WEBHOOK_SECRET` privately and restart Next.js if this secret changed. A `400` for an unsigned POST is expected but is **not** a signed-forwarding pass.
5. Temporarily enable **only** `ENABLE_OWNER_STRIPE_TEST_CHECKOUT=true`; restart Next.js. From `/owner/stripe-sandbox`, book a **fresh, available future slot**, with fictional details, using Stripe TEST card `4242 4242 4242 4242`. Complete once. Do not retry if the outcome is uncertain.
6. On the active Stripe CLI terminal, require **the matching `checkout.session.completed` event and an HTTP 200 response** for `/api/stripe/webhook`. Check Next.js terminal for the webhook POST as well.
7. Refresh `/owner/stripe-verification`. Query local Supabase for the **new** test session, status, payment reference, and webhook event. If the payment arrives before the hold expires, the appointment should be `confirmed`, with matching `payment_reference`. Otherwise, it should enter reconciliation for review. An event ID alone doesn't prove the right appointment updated.
8. If the CLI reports 400: check matching `whsec_` and raw-body handling. If 404: check forwarding target/port. If 500: inspect server logs/database migration and verify the session exists. **Do not create another payment** until state is known.
9. Turn `ENABLE_OWNER_STRIPE_TEST_CHECKOUT=false` again and restart Next.js. Leave public checkout and notifications OFF.

Do **not** use `stripe trigger checkout.session.completed` to claim success for this app: the synthetic session would not exist in local appointments, so the webhook is designed to reject it with HTTP 500. Also do not treat a locally fabricated signature on a historical event as automatic Stripe forwarding.

**Production stop-ship:** Verify merchant Stripe account identity for Dujuan; current sandbox tests were performed on a different-named merchant account. Production webhook endpoints, signing secrets, refund permissions, merchant ownership, terms, tested holds, and end-to-end live-mode checks require separate approval before go-live.
