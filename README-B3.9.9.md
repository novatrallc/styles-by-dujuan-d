# Build 3.9.9 — Controlled Notification Recovery

Install into `C:\dev\projects\burtons-barbershop` preserving folder paths. Adds new files only; no existing files overwritten.

1. Run `supabase/migrations/202610140003_b399_notification_recovery.sql` in Supabase SQL Editor, after the B3.9 migration.
2. Keep `ENABLE_NOTIFICATION_RECOVERY=false` in `.env.local` during initial testing (default is off even if unset). Keep `ENABLE_NOTIFICATION_DELIVERY=false` and Stripe checkout disabled.
3. Run `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.
4. Sign in at `/owner`, then open `/owner/notifications/recovery`.
5. Confirm the empty state or existing failed rows appear. Test the endpoint returns 401 when signed out. With recovery disabled, a POST must return 403.
6. Only after checking provider history for possible prior delivery should you consider setting `ENABLE_NOTIFICATION_RECOVERY=true` and restarting. This enables a manual requeue operation, **not delivery**. Delivery remains independently gated.

## Important safety limitations

- A failed status does not prove an email was not delivered. Requeueing can duplicate email if the provider accepted the original request before a timeout. The existing dispatcher uses a stable idempotency key, but the provider may limit how long it honors it.
- No automatic retry, no retry of `sending` or `sent`, no reset of attempts, and no retry if provider message ID or sent timestamp exists. Row-level locking and an audit entry accompany each accepted request.
- The server validates the owner via existing `authorizeOwner`; never put the Supabase service-role key in browser code.
- `ENABLE_NOTIFICATION_RECOVERY` is an operational guard, not a replacement for provider-side reconciliation. Do not enable production delivery until full Stripe, webhook, and mail-provider integration testing is complete.
- No Resend account required to view the recovery page. This build does not connect SMTP production delivery.

## New routes

- `/owner/notifications/recovery`
- `/api/owner/notifications/recovery` (owner-only bearer authentication)

No existing navigation files are overwritten. Add a dashboard link after the route is verified.
