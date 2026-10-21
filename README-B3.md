# STYLES BY DUJUAN D — Build 3.0

## What is implemented
- Customer-facing service/date/time/customer details booking wizard (preview only).
- Live read-only availability API `/api/availability?service=haircut&date=2026-11-02` backed by Supabase.
- Working hours, exceptions, and active appointment conflicts; Eastern timezone and daylight saving conversion.
- Database appointments table with PostgreSQL exclusion constraint preventing double bookings even under concurrent inserts.
- Customer payment/confirmation is **intentionally disabled** until verified Stripe integration.
- No anonymous access to private customer appointment data.

## Setup
1. Back up project. Extract this archive into `C:\dev\projects` replacing the existing `burtons-barbershop` directory contents.
2. Run SQL migrations B1, B2, B3 in order in Supabase SQL Editor (do not rerun already applied migrations unnecessarily).
3. Configure `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and server-only `SUPABASE_SERVICE_ROLE_KEY` (never prefix it with `NEXT_PUBLIC_`, never commit it).
4. `npm install`, `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run dev`.
5. Test `/book`. Initially it shows booking unavailable because `business_settings.bookings_enabled=false`, which is intentional.
6. For internal scheduling preview ONLY, populate accurate service prices/durations, barber working hours, activate services, then set `bookings_enabled=true`. **This exposes available slots but still cannot accept or confirm bookings.** Set it back to false when done.

## Remaining for Build 3.1 / 4
- Owner-authenticated admin calendar, settings, hours and time off management.
- Stripe Checkout + verified webhook + short-lived reservation holds + expiry cleanup + idempotency.
- Confirmation emails and customer reschedule links with enforced 24-hour notice.
- Tests against a real Supabase project, concurrent inserts, DST transitions and payment failure cases.

Never send a service-role key to the browser. Do not activate paid reservations until payment webhooks and all readiness checks pass.
