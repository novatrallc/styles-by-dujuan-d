# Build 3.1 — Owner Console

## Install
1. Back up your existing project and merge these files. Preserve `.env.local`.
2. `npm install` then `npm run typecheck && npm run lint && npm run test && npm run build`.
3. In Supabase Authentication → Users, create the owner user with a strong password and confirmed email. Do not enable public owner signup.
4. In `.env.local`, configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase publishable/anon key), `SUPABASE_SERVICE_ROLE_KEY` (server only), and `OWNER_EMAILS=the-owner-email@example.com`. Do not expose service-role key. Restart server.
5. Visit `/owner`, sign in, set prices and durations, and add weekly hours.

## Security
- Every owner API request verifies a Supabase Auth JWT server-side and checks the email against `OWNER_EMAILS`.
- All writes use the server-only service-role key after authorization. No public writes or registration are enabled.
- Booking activation is intentionally unavailable. Do not manually set `bookings_enabled=true` until verified checkout exists.
- Owner console is a first release; use only one trusted owner account. For production, replace email allowlist with durable role assignment and add rate limiting, audit logs, and robust session handling.
- Time-off form currently interprets input in the browser's local timezone. Use an Eastern Time device until timezone-aware inputs are added.

## No new migration
This release uses the existing B1–B3 tables, so no SQL is required.

## Test
- Signed-out `/api/owner` returns HTTP 401.
- Non-allowlisted Supabase user cannot read or change data.
- Owner can edit service, add/remove working hours and time off.
- Booking activation endpoint is absent; public booking remains disabled.
