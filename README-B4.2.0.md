# B4.2.0 — Premium Owner Service Management

This package is for the Styles by Dujuan D Next.js project at `C:\dev\projects\burtons-barbershop`.

## Changes
- Adds an **Add new service** control and form to the existing owner dashboard Services tab.
- New service fields: name, description, price ($10–$10,000), and duration (5–480 minutes).
- Generates a URL-safe unique slug server-side from the service name. Duplicate slug -> HTTP 409.
- Inserts new services as **inactive** by default; owner can review and activate using existing Save action.
- Uses the existing Supabase owner session and service-role-only database access, never anonymous writes.
- Changes the existing editor layout to provide more room for text and **small, classy Save changes buttons**.
- Does not alter current public services/booking catalogs, local or hosted DB schemas, payment settings, or email delivery.

## Install
1. Extract the ZIP to a temporary folder, outside the project.
2. Stop `npm run dev` with Ctrl+C.
3. Open PowerShell in the extracted folder.
4. Run `powershell -ExecutionPolicy Bypass -File .\install-b420.ps1`.
   If your project lives elsewhere, add `-ProjectRoot 'C:\your\path'`.
5. In `C:\dev\projects\burtons-barbershop`, run `npx tsc --noEmit`, then `npm run build`.
6. Run `npm run dev` (keep terminal open), sign in at `/owner`, and go to Services.

The installer refuses to run if it cannot match the expected dashboard anchors or if `app/api/owner/services/route.ts` already exists. It creates a backup in `backups/b420-services-TIMESTAMP/` before modifying files. It is not intended for direct deployment without local testing.

## Test checklist
- Open `/owner` -> **Services**. Confirm existing eight services and prices remain unchanged.
- Verify Save changes buttons fit their text, no horizontal overflow on narrow screens.
- Click **Add new service**; enter `Sandbox Deluxe Grooming`, a description, `$60`, and `60` minutes.
- Submit once. Confirm the new service appears as **inactive**. Active-service count must remain unchanged.
- Attempt to create the same name again; expect a duplicate-name message, not another service.
- Optionally edit name, price, and duration of the newly created inactive test service and click Save changes.
- Confirm the public `/services` and `/book` still display their existing static catalog, and public checkout is still disabled.
- Optional unauthenticated check (read-only): `Invoke-WebRequest -Method Post -Uri http://localhost:3000/api/owner/services -ContentType 'application/json' -Body '{}'` should return HTTP 401.

## Known product follow-up
The public homepage, `/services`, and booking form currently get their service cards/choices from a static `lib/business.ts` catalog. **Newly added services appear in the owner dashboard but do not automatically appear in those public pages.** A subsequent guarded catalog-sync build should connect approved active services without exposing unapproved sandbox prices. We deliberately did not quietly publish test services or prices.

The screenshots also suggest reviewing the time-off feedback flow if a freshly saved time-off block does not appear after reloading. This build does not modify time-off logic.

## Safety
Keep `ENABLE_STRIPE_CHECKOUT=false` and `ENABLE_NOTIFICATION_DELIVERY=false`. If you still have `ENABLE_OWNER_STRIPE_TEST_CHECKOUT=true` from earlier testing, turn it off until you resume the separate controlled Stripe test. No `supabase db push`, linked reset, or migration is required.
