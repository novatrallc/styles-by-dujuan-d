# Build 3.9 — Classy notifications & owner alerts

Additive patch for Styles by Dujuan D. Copy these folders into your existing project; **do not delete or replace your existing app**.

## Features
- Premium dark/champagne-gold HTML + plain text email templates.
- Database outbox for confirmed/cancelled customer appointments and owner new-booking alerts.
- Owner payment-reconciliation alerts queued automatically.
- Owner-only read API at `/api/owner/notifications` (requires the existing bearer-token authentication, just like reconciliation).
- Protected dispatch endpoint for Resend; **off by default**.
- Idempotent event keys, provider idempotency keys, and bounded attempts. Failed deliveries are held for manual review rather than auto-retried blindly.

## Install
1. Back up your project. Copy `lib/`, `app/`, `supabase/`, and `tests/` into the matching project root folders.
2. Run `supabase/migrations/202610140002_b39_notifications.sql` in Supabase SQL Editor **after Build 3.8**.
3. Set owner alert email in Supabase SQL Editor (replace example):
   `insert into public.notification_settings(key,value) values ('owner_alert_email','owner@example.com') on conflict(key) do update set value=excluded.value;`
4. Run `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.
5. Keep `ENABLE_NOTIFICATION_DELIVERY=false` while previewing/testing. Outbox records queue, but **no email is sent**.
6. To enable delivery later, verify a sending domain with Resend and set server-only `RESEND_API_KEY`, `NOTIFICATION_FROM_EMAIL` (e.g. `STYLES BY DUJUAN D <appointments@yourverifieddomain.com>`), and a long random `NOTIFICATION_DISPATCH_SECRET`. Then set `ENABLE_NOTIFICATION_DELIVERY=true`.
7. A server-side scheduler must POST to `/api/notifications/dispatch` with `Authorization: Bearer <NOTIFICATION_DISPATCH_SECRET>`. **No scheduler is included or enabled**. Do not call this from a browser or expose the secret in NEXT_PUBLIC variables.

## Scope / next integration
- This build queues confirmation/cancellation when the **database appointment status changes** and owner payment exceptions when a reconciliation row is inserted.
- Reschedule notification is a template-only placeholder; rescheduling flow needs explicit event wiring in a future build.
- No automatic customer cancellation emails are generated for pending unpaid holds that expire.
- No automatic refunds, payment receipt generation, email scheduling, or customer self-service changes.
- Reconciliation emails never claim an appointment was confirmed.
- The notification queue is private and contains customer information. Never expose the service role key.
- Production-grade email operations will require delivery webhooks, suppression/unsubscribe decisions for non-transactional mail, dead-letter review, and robust recovery of stuck `sending` rows.
