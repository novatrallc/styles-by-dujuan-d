# B4.1.3 — Local sandbox integration (safe setup)

This package contains an idempotent local seed and a read-only environment guard. It does **not** automatically edit your production environment, enable checkout, or charge a card.

## Install
1. Extract this ZIP into `C:\dev\projects\burtons-barbershop` (merge folders). The `supabase/seed.sql` file fixes the missing seed warning and loads Dujuan's weekly standard hours on the next **local** database reset. Note: `supabase start` on an existing initialized database does not necessarily rerun the seed.
2. To populate hours **without resetting anything**, open the local Supabase Studio SQL Editor at `http://127.0.0.1:54423`, paste the contents of `supabase/seed.sql`, and run it. This inserts missing days only. Verify with `SELECT weekday, start_time, end_time FROM public.working_hours ORDER BY weekday;` (Sunday=0).
3. In local Studio inspect `services`: checkout requires active services with non-null prices and durations. Do not invent or overwrite Dujuan's pricing. Check `business_settings.bookings_enabled` and do not enable until availability tests are ready.

## Isolate local Next.js configuration
1. Make a private backup of `.env.local` (do not commit or share it).
2. Run `npx supabase status` locally. Use its API URL and **matching local public and service role keys** to update `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or the key your application actually reads), and `SUPABASE_SERVICE_ROLE_KEY` together. Do not paste these keys into chat.
3. Use `APP_ORIGIN=http://localhost:3000`, `STRIPE_SECRET_KEY=sk_test_...`, and the current Stripe CLI `STRIPE_WEBHOOK_SECRET=whsec_...` (from the active listener).
4. Keep `ENABLE_STRIPE_CHECKOUT=false`, `ENABLE_NOTIFICATION_DELIVERY=false`, `ENABLE_NOTIFICATION_RECOVERY=false`, `ENABLE_OWNER_STRIPE_TEST_CHECKOUT=false` until the local login and scheduling checks pass.
5. Run `powershell -ExecutionPolicy Bypass -File .\scripts\check-local-config.ps1`, then restart `npm run dev`.
6. Local Supabase Auth is independent of hosted Auth. Create a **local test owner** through local Supabase Auth and configure `OWNER_EMAILS` to match. Never use production credentials or copy real customer records into the sandbox.

## Verify before checkout
- `npm run typecheck`; `npm run lint`; `npm run test`; `npm run build`.
- Confirm local Studio shows one active barber, eight services, seven weekly working-hours records, and no appointments.
- Confirm a standard booking slot is available from the local Next.js application. Note: the app's business settings and service activation/prices may still require owner setup.
- Only after these checks: temporarily enable `ENABLE_OWNER_STRIPE_TEST_CHECKOUT=true`, use the owner-only B4.1.2 route and Stripe CLI to test a $10 test deposit. Do not enable public checkout. Turn the test flag off afterwards.

## Known limitations
- The B4.1.2 README documents a late-paid-event reconciliation limitation. Resolve it before live checkout.
- After Dark 3x pricing and 25% deposit require a separate migration because the existing schema enforces a $10 deposit. They are NOT enabled in this package.
- Do not run `supabase db push`, `supabase db reset --linked`, or any production-targeted SQL for this test.
