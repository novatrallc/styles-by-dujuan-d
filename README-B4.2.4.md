# B4.2.4 — Local-only reservation hold fix

## Why this is required

The `public.create_checkout_hold` function intentionally refuses to create a hold when `business_settings.bookings_enabled=false`. Owner-only availability can bypass the public availability gate, but the existing hold function cannot. This package introduces a **separate local-only function** while leaving the public one intact.

## Before you begin

- Use **only** `http://127.0.0.1:54423` (local Supabase Studio). Never run the SQL in hosted Supabase Studio.
- Keep `ENABLE_STRIPE_CHECKOUT=false` and `ENABLE_NOTIFICATION_DELIVERY=false`.
- Only use Stripe **test** keys. Don't paste credentials or test-customer contact details into chats.
- Do **not** run `supabase db push`, `supabase db reset --linked`, or apply this SQL on any hosted instance.
- Stop the Next.js development server before editing source files.

## 1. Add the dedicated function locally

In **local Supabase Studio** -> SQL Editor, open `local-only-owner-sandbox-hold.sql` from this package. Execute the entire file. The final verification query should say:

| field | expected |
| --- | --- |
| sandbox_function_present | true |
| anon_can_execute | false |
| authenticated_can_execute | false |
| service_role_can_execute | true |

The file is intentionally NOT part of normal `supabase/migrations`, to prevent an accidental deployment to hosted environments. This is a throwaway local-only test function and must not be shipped as a production migration.

## 2. Patch only owner-only checkout route

In PowerShell, open the extracted ZIP folder and run:

```powershell
powershell -ExecutionPolicy Bypass -File .\install-b424.ps1
```

The installer checks local `.env.local` settings, confirms the owner route's checks, creates a timestamped route backup, and changes **one call** in `app/api/owner/stripe-test-checkout/route.ts`:

```ts
// Before (public RPC, requires bookings_enabled=true)
db.rpc('create_checkout_hold', {

// After (local sandbox RPC, requires bookings_enabled=false)
db.rpc('create_owner_sandbox_checkout_hold', {
```

It does not invoke Supabase or Stripe. It does not change the public checkout route, hosted DB, webhook, or configuration flags.

## 3. Check files and compile

```powershell
powershell -ExecutionPolicy Bypass -File .\verify-b424.ps1
cd C:\dev\projects\burtons-barbershop
npx tsc --noEmit
npm run build
```

Only start Next.js after the build finishes:

```powershell
npm run dev
```

## 4. Test one future slot

Keep Stripe CLI forwarding events to `localhost:3000/api/stripe/webhook`. Confirm `.env.local` has `ENABLE_OWNER_STRIPE_TEST_CHECKOUT=true` temporarily, `STRIPE_SECRET_KEY=sk_test_...`, and `STRIPE_WEBHOOK_SECRET` matching your **current** CLI listener. Restart Next.js after changes.

At `http://localhost:3000/owner/stripe-sandbox`, select a **currently available future slot** and use fictional customer details. Click once; if it fails, inspect the first attempt before retrying. Only complete checkout if Stripe's page shows **test mode** and **$10 USD**. Use the standard Stripe test card `4242 4242 4242 4242`.

Check Stripe CLI for a **200** webhook response and refresh `http://localhost:3000/owner/stripe-verification` for `confirmed` and no reconciliation exception. The last screen is read-only; it cannot prove Stripe event delivery by itself.

## 5. Lock sandbox again

Restore `ENABLE_OWNER_STRIPE_TEST_CHECKOUT=false` and restart Next.js. Keep `ENABLE_STRIPE_CHECKOUT=false` and `ENABLE_NOTIFICATION_DELIVERY=false` until the actual launch approval process.

## If the hold still fails

A different database constraint may be rejecting it (e.g. overlapping appointment, slot age, or malformed customer contact). Do not retry blindly. Check the Next.js terminal and local appointment rows; preserve any existing pending checkout hold before investigating.
