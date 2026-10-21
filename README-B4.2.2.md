# Styles by Dujuan D — B4.2.2

**Dynamic Service Catalog & Owner Operations Polish**

## Changes

1. **Public catalog is opt-in.** Home and Services pages use a shared server-side service projection when `ENABLE_PUBLIC_SERVICE_CATALOG=true`. Only `services.is_active=true` rows are included. Until you explicitly opt in, the current curated menu continues to appear. If the service query fails, the curated menu is shown without prices.
2. **Pricing has a SECOND, independent launch gate.** `ENABLE_PUBLIC_SERVICE_PRICING=true` is required *in addition to* the catalog gate before any service prices appear. Both flags default to off. This keeps the temporary local test prices private until Dujuan approves them.
3. **Owner confirmation dialogs:** Appointment Cancel / Complete / No-show and Time Off Remove now use a branded black-and-champagne-gold dialog with keyboard Escape / focus management, matching the Service Lifecycle dialog.
4. **Time Off clarity:** A friendly empty state appears when there are no upcoming blocks, and the Remove block control is more refined. Existing protected owner API actions are reused.
5. **No migrations.** No change to Stripe, webhook, hosted Supabase, booking availability, RLS, or outbound email settings.

## Important publishing behavior

No `.env.local` changes are performed by the installer. The new flags are optional and **default to OFF**:

```dotenv
ENABLE_PUBLIC_SERVICE_CATALOG=false
ENABLE_PUBLIC_SERVICE_PRICING=false
ENABLE_STRIPE_CHECKOUT=false
ENABLE_NOTIFICATION_DELIVERY=false
```

For a **local, read-only, no-price preview** *after you've reviewed the code*, you may set only:

```dotenv
ENABLE_PUBLIC_SERVICE_CATALOG=true
ENABLE_PUBLIC_SERVICE_PRICING=false
```

Restart Next.js to preview only active local services. This does not enable public booking or Stripe checkout. Revert the catalog flag to false after preview if you are not ready to publish.

**Do not enable public prices until the owner explicitly approves them**, and verify hosted project and environment configuration separately before launch.

## Installation on Windows

1. Extract this ZIP to a folder. The script expects its `app/`, `lib/`, and `patches/` folders beside it.
2. Stop Next.js (`Ctrl+C`) and stop any active `npm run build`. Leave Supabase and Stripe listener alone.
3. Open PowerShell inside the extracted folder and run:

```powershell
powershell -ExecutionPolicy Bypass -File .\install-b422.ps1
```

The default project root is `C:\dev\projects\burtons-barbershop`. To override:

```powershell
powershell -ExecutionPolicy Bypass -File .\install-b422.ps1 -ProjectRoot "C:\dev\projects\burtons-barbershop"
```

Then in the project root:

```powershell
npx tsc --noEmit
npm run build
npm run dev
```

Do not run `npm run dev` and `npm run build` simultaneously; they share `.next` and can cause missing CSS.

## Test checklist

- `/` and `/services`: same curated names, with no prices revealed by default.
- `/owner` → Services: **Add new service**, **Deactivate**, and existing luxury modal continue to work.
- `/owner` → Time Off: empty state when zero upcoming blocks; removing a block opens the new premium confirmation; **Keep unchanged** makes no change.
- `/owner` → Appointments: eligible Cancel / Complete / No-show opens the new confirmation and requires deliberate confirmation. No emails or refunds are automatically sent.
- Local catalog preview (optional): active services display; inactive services do not; prices stay hidden without the pricing flag.
- `/book`: public checkout still disabled. This build does not activate booking.

For Time Off, if the server reports a save but the new block is not displayed, capture the `/api/owner` response and the saved database record. This build improves feedback and confirmations but does not claim to change the underlying time-off SQL.

## Installer safety

The installer matches the **B4.2.1a** dashboard and **B4.1.8** homepage, as verified against the project snapshots shared earlier. It checks every code anchor before writing. If a required structure differs, it stops and **prints an error instead of guessing**. It creates timestamped backups under the project's `backups/b422-catalog-ops-*` folder and restores modified files if installation fails.

Files changed:

- `app/page.tsx` (surgical data/price wiring; rest of luxury layout kept)
- `app/services/page.tsx` (updated premium service catalog design)
- `app/owner/owner-dashboard.tsx` (surgical modal/action changes)
- `app/owner/owner-action-dialog.tsx` (new)
- `lib/public-service-catalog.ts` (new)

## Rollback

1. Stop the Next.js server.
2. Restore the three backed-up TSX files printed by the installer, to their original paths.
3. Delete the newly created `app/owner/owner-action-dialog.tsx` and `lib/public-service-catalog.ts` files (only if this build created them).
4. Restart Next.js and hard refresh.

## Post-install status

The package syntax has been checked against a simulated B4.2.1a dashboard. **Full `npm run build` and interactive tests must still run on your Windows project.**
