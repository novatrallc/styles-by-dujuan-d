# Build 4.1.2 — Owner-only Stripe sandbox checkout

## Scope
Adds one new **owner-authenticated** POST route: `/api/owner/stripe-test-checkout`. Existing public `/api/checkout` and `ENABLE_STRIPE_CHECKOUT=false` are unchanged. No migration or dependencies. This route is strictly for local testing; do not deploy with its feature flag enabled.

## Preconditions
- A **nonproduction Supabase project** with test services and availability. This route creates real rows in the configured Supabase database, even though Stripe money is simulated. Do not point it at the production Supabase project.
- `STRIPE_SECRET_KEY=sk_test_...`, `STRIPE_WEBHOOK_SECRET=whsec_...`, `APP_ORIGIN=http://localhost:3000`, and owner auth (`OWNER_EMAILS` + valid Supabase login).
- Keep `ENABLE_STRIPE_CHECKOUT=false`, `ENABLE_NOTIFICATION_DELIVERY=false`, `ENABLE_NOTIFICATION_RECOVERY=false`.
- Temporarily set `ENABLE_OWNER_STRIPE_TEST_CHECKOUT=true` in **local** `.env.local`, restart `npm run dev`; never deploy this flag enabled.
- Keep Stripe CLI listener forwarding supported events to `localhost:3000/api/stripe/webhook`.

## Run checks
```powershell
npm run typecheck
npm run lint
npm run test
npm run build
```

## Create a test session (PowerShell)
Use an actual service slug and available ISO start/end from your local booking UI. For owner bearer token, sign in to `/owner` and retrieve the current Supabase access token **locally** using your existing authenticated owner workflow; never paste the token into chat. The test API requires `Authorization: Bearer <owner-access-token>`.

```powershell
$token = Read-Host 'Paste owner access token (local only)'
$body = @{
  service = 'REPLACE_WITH_REAL_SERVICE_SLUG'
  start = 'REPLACE_WITH_AVAILABLE_ISO_START'
  end = 'REPLACE_WITH_AVAILABLE_ISO_END'
  customer = @{ name='Stripe Test Customer'; email='YOUR_TEST_EMAIL@example.com'; phone='5550100100' }
} | ConvertTo-Json -Depth 4
$result = Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/owner/stripe-test-checkout' -Headers @{ Authorization="Bearer $token" } -ContentType 'application/json' -Body $body
Start-Process $result.checkoutUrl
```

Use Stripe test card `4242 4242 4242 4242` with future expiration and any CVC. Check Stripe CLI event delivery, Supabase `appointments`, `payment_webhook_events`, and owner reconciliation. Verify one confirmation only. Re-deliver the **same** event to test idempotency. Test expiration separately.

## Safety limitations
- `ENABLE_OWNER_STRIPE_TEST_CHECKOUT` must be turned off immediately after the test and app restarted.
- Only Stripe **test** sessions (`livemode=false`, `cs_test_...`) are accepted. A localhost origin is mandatory.
- If Stripe times out after the hold is created, the hold remains pending for manual reconciliation; this avoids double-selling an uncertain session. A failed save attempts to expire the Stripe session before releasing the hold.
- The existing webhook's late-paid-event reconciliation limitation is **not** solved by this build. Do not enable public payments until that is addressed.
- This build is a test harness, not a production payment readiness certification. It does not automatically run a Stripe transaction.
