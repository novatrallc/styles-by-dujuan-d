# Build 3.9.10 — Notification Operations Finalization

## Prerequisites
- Install Build 3.9.9 and run `supabase/migrations/202610140003_b399_notification_recovery.sql` first.
- Keep `ENABLE_NOTIFICATION_RECOVERY=false`, `ENABLE_NOTIFICATION_DELIVERY=false`, and `ENABLE_STRIPE_CHECKOUT=false` for initial verification.
- Back up the three files listed below before replacing them. Do not overwrite `.env.local`.

## Install
Extract the ZIP into `C:\dev\projects\burtons-barbershop`, preserving directories. This build replaces only:
- `app/owner/owner-dashboard.tsx`
- `app/owner/notifications/page.tsx`
- `app/owner/notifications/health/page.tsx`

No new SQL migration or dependencies. The Build 3.9.9 recovery API and page are left unchanged.

## Verification
Run:
```
npm run typecheck
npm run lint
npm run test
npm run build
npm run dev
```

Sign in to `/owner` and verify the new **Recovery Console** card in Business Operations. Verify navigation from `/owner/notifications` and `/owner/notifications/health` to `/owner/notifications/recovery`. Confirm the existing appointment, service, and scheduling tabs still work.

Signed-out access to the recovery API must return 401. With `ENABLE_NOTIFICATION_RECOVERY=false`, a correctly authenticated POST must be rejected (403). Do not enable retries without reviewing provider delivery records; a failed response can still represent a delivered email.

## Scope
Navigation integration only: no automatic retries, delivery activation, Stripe changes, new database writes, or changes to the recovery API. The prior Build 3.9.9 audit and retry behavior requires separate end-to-end verification against the database before production use.
