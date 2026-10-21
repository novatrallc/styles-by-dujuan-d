# STYLES BY DUJUAN D — Build 3.9.4: Local Email Atelier

## What this patch does
- Adds a **local SMTP test** endpoint at `/api/owner/notifications/local-test` and a luxury-styled UI at `/owner/notifications/local-test`.
- Adds a **Local email lab** link to the existing Notification Center. The notification-center page is a full replacement based on Build 3.9.3.
- Uses existing `authorizeOwner` and `renderNotification` helpers. All sample details are fictional; recipients are fixed `.test` addresses. Mailpit captures email on your machine and does not forward it.
- No database migrations. No Resend setup. No real payments, appointments, production email dispatch, or outbox changes.

## Install
1. Back up your project. Extract ZIP into `C:\dev\projects\burtons-barbershop`, preserving directories. It adds two new routes, a Docker compose file, and replaces `app/owner/notifications/page.tsx` only.
2. Install dependencies: `npm install nodemailer` and `npm install -D @types/nodemailer`.
3. Start Docker Desktop. Run: `docker compose -f docker-compose.mailpit.yml up -d`.
4. Add `ENABLE_LOCAL_MAIL_TEST=true` to `.env.local`. Keep `ENABLE_NOTIFICATION_DELIVERY=false`, `ENABLE_NOTIFICATION_TEST_SEND=false`, and Stripe checkout disabled.
5. Restart Next.js: `npm run dev`.
6. Open `/owner/notifications` → **Local email lab**. Choose each template, send, then open `http://localhost:8025` to inspect HTML/text and subject.
7. Run `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.

## Security and constraints
- API requires Supabase owner bearer token and OWNER_EMAILS allowlist.
- Only works when NODE_ENV=development AND ENABLE_LOCAL_MAIL_TEST=true.
- SMTP is hardcoded to loopback 127.0.0.1:1025; Docker ports are bound to loopback only.
- No arbitrary recipient or HTML input accepted. Sends fixed fictional templates to `customer@dujuan.test` / `owner@dujuan.test`.
- Basic 3-second per-owner in-memory throttle, not a distributed production rate limiter.
- Docker image uses a floating tag for ease of local setup; pin an audited digest for controlled environments.
- **Main owner dashboard navigation is not modified:** its latest local source was not provided. This build integrates the Notification Center, not the top-level owner dashboard. Send `app/owner/page.tsx` or its navigation component for safe integration in a follow-up.
- Mailpit is for development only. Do not deploy this Compose service publicly or enable the local-test flag in production.
