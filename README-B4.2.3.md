# Styles by Dujuan D — B4.2.3

## Stripe Test Verification Center & Booking Launch Readiness

This build adds a **read-only, owner-authenticated, LOCAL-ONLY** verification workspace. It is designed to help complete the outstanding $10 Stripe TEST checkout and webhooks end-to-end test, without changing any booking/payment behavior or launching online bookings.

### New pages and files

- **`/owner/stripe-verification`** — premium black-and-gold dashboard showing sandbox safety checks, recent test checkout appointments, payment-reference matching, reconciliation exceptions, sampled webhook event IDs, and a step-by-step test runbook.
- **`/api/owner/stripe-verification`** — `GET` only; requires a valid owner bearer token; refuses queries unless the configured Supabase URL points to `localhost:54421` or `127.0.0.1:54421`. No credentials or customer PII are returned. No writes are performed.
- Owner Business Operations receives one link to the new page.

### What it does NOT do

- **Does not** turn on Stripe or public bookings, charge cards, apply SQL migrations, modify `.env.local`, send notifications, or change any appointments.
- **Does not** prove that a webhook was delivered to your server; inspect Stripe CLI terminal for HTTP 200 and match Stripe event IDs.
- **Does not** prove keys match the correct project; `check-local-config.ps1` also explicitly notes that limitation.
- **Does not** validate live payments, refunds, or production readiness.

### Install (Windows PowerShell)

1. Download/extract this ZIP outside the project folder if practical. Stop `npm run dev` and any `npm run build` first. Leave local Supabase running.
2. Open PowerShell in the extracted folder and run:

```powershell
powershell -ExecutionPolicy Bypass -File .\install-b423.ps1
```

The installer expects `C:\dev\projects\burtons-barbershop` by default. To override:

```powershell
powershell -ExecutionPolicy Bypass -File .\install-b423.ps1 -ProjectRoot 'C:\dev\projects\burtons-barbershop'
```

3. Verify with:

```powershell
cd C:\dev\projects\burtons-barbershop
powershell -ExecutionPolicy Bypass -File '<EXTRACTED_FOLDER>\verify-b423.ps1'
npx tsc --noEmit
npm run build
npm run dev
```

Stop `npm run dev` before `npm run build` (both share `.next`). The check script does not access keys or mutate your database.

4. Sign in at `http://localhost:3000/owner`, then use **Business Operations → Stripe Verification Center**, or open `http://localhost:3000/owner/stripe-verification`.

### Local test procedure — do not skip

Ensure local Supabase and the current `stripe listen` webhook listener are running. Verify `STRIPE_WEBHOOK_SECRET` matches the CLI-provided `whsec_` secret, `STRIPE_SECRET_KEY` starts with `sk_test_`, `APP_ORIGIN=http://localhost:3000`, and `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421`.

Keep these disabled:

```dotenv
ENABLE_STRIPE_CHECKOUT=false
ENABLE_NOTIFICATION_DELIVERY=false
ENABLE_PUBLIC_SERVICE_PRICING=false
```

Only when the Verification Center indicates the safe configuration, temporarily enable `ENABLE_OWNER_STRIPE_TEST_CHECKOUT=true` and restart the dev server. From `/owner/stripe-sandbox`, select a future slot and use fictional customer details; complete the $10 checkout with Stripe's TEST card `4242 4242 4242 4242`, future expiry, any CVC. Watch the Stripe CLI for the `checkout.session.completed` event and **HTTP 200** forwarded to your local webhook. Refresh `/owner/stripe-verification`. Inspect the test appointment for `status=confirmed`, `$10.00` deposit and the matching Checkout session/payment reference. Check `/owner/reconciliation` and the Stripe CLI event ID for irregularities. If the payment outcome is uncertain, do NOT initiate a duplicate checkout for the same hold.

Finally turn `ENABLE_OWNER_STRIPE_TEST_CHECKOUT=false` and restart Next.js. **Do not enable public checkout.**

### Stop-ship concerns and limits

- The current reconciliation function records late payments for owner review, but does not automatically refund them.
- The appointment DB hold expiry must be verified to cover the Checkout session's actual lifetime. A paid session after hold expiry should go to reconciliation, not automatic confirmation.
- The database webhook event table contains event ID/type but cannot link each event to its session by itself; use the Stripe CLI for correlation.
- The 'Recent test appointments' table samples the 100 newest checkout records, displaying up to 25 Stripe test sessions; this is **not** an exhaustive accounting report. The reconciliation and webhook samples are also limited.
- A Stripe test receipt or success redirect alone does **not** prove appointment confirmation; confirm the database result.
- For `503`, check that Supabase local migrations are running and the correct legacy JWT service role key is used. Never copy secrets into screenshots or chat.

### Rollback

Stop Next.js. Restore `app/owner/owner-dashboard.tsx` from the timestamped backup printed by the installer. Delete the newly installed `app/owner/stripe-verification/page.tsx` and `app/api/owner/stripe-verification/route.ts` **only if this build created them**. Restart Next.js. No DB rollback is required.

### Code check status

The package is tested for TypeScript/TSX syntax and read-only route safety; it is **not** tested against your complete local project. Run `npx tsc --noEmit` and `npm run build` in your environment and report any error before proceeding.
