# STYLES BY DUJUAN D — B4.2.9 Startup Safety Kit

Created for the local Windows Next.js project at `C:\dev\projects\burtons-barbershop`. This is a **non-destructive, pre-launch local** operational kit. It is not an automatic patch to your Next.js app and cannot be certified against your private repository without inspecting its config and running on your machine.

## What's included

- `doctor.ps1`: read-only checks: project Next.js processes, ports 3000/3001, build directory assets, local safety flags; displays no key values.
- `stop-next.ps1`: asks permission before stopping ONLY verified Next.js processes associated with this exact project; does not target Docker/Supabase/Stripe.
- `build-production.ps1`: refuses to build with Next.js already running; validates local sandbox flags; TypeScript checks; builds production; refuses incomplete CSS/JS assets.
- `start-production.ps1`: runs exactly one guarded production server on localhost:3000 after verifying build assets.
- `start-development.ps1`: starts a development server on localhost:3001, using an isolated `.next-dev` directory (requires the one-line config patch).
- `smoke-test.ps1`: checks HTTP 200 on `/` and `/owner`, extracts actual compiled CSS and JS references and requests them over HTTP; fails if static assets missing.

## Installation (NO existing files overwritten)

1. Extract this ZIP anywhere, e.g. `C:\Users\Owner\Downloads\B429_Startup_Guard`.
2. In PowerShell run (adjust extracted folder name if necessary):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\B429_Startup_Guard\INSTALL.ps1"
```

3. Read `C:\dev\projects\burtons-barbershop\scripts\b429\NEXT_CONFIG_PATCH.md`. Add the ONE distDir property to your existing Next config; preserve all existing options. If your config is complex, STOP and share its contents for a precise integration.
4. Confirm `.env.local` remains **local**, public checkout off, owner test checkout off, notifications off, and `sk_test_` Stripe test key. These scripts purposely fail closed if unsafe.

## Daily commands (run from the project directory)

```powershell
cd C:\dev\projects\burtons-barbershop
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\b429\doctor.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\b429\stop-next.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\b429\build-production.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\b429\start-production.ps1
```

While `start-production.ps1` is running in one PowerShell window, open another and verify the site:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\b429\smoke-test.ps1
```

For UI development, stop the production server first, then:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\b429\start-development.ps1
```

Dev site is at `http://localhost:3001` and is **not configured for localhost:3000 Stripe Checkout returns**. Use guarded production mode for local Stripe test once its safety controls are explicitly reviewed. This kit does NOT provide a payment-test override and will not enable owner checkout.

## Stop-and-investigate cases

- Guard sees another Next.js process: close its terminal or run `stop-next.ps1`, review the PID list, and confirm termination.
- Port is occupied by another project: DO NOT kill it blindly; inspect it.
- CSS/JS assets absent: do not launch; inspect build output and current Next config.
- Browser reports broken styling but file checks pass: inspect browser Network tab for failing `/_next/static/*` requests, service worker, proxy, cache and base path.
- A smoke test fails: don't make a payment; share exact output.

## Safety boundaries

- No Supabase schemas or rows changed, no reset or migration, no Stripe event replay, no checkout, no notification delivery.
- No `npm install`, `npm update`, or dependency changes.
- The launcher may stop project-owned processes ONLY after prompting or explicit user permission.
- Do not run `npm run dev` and `npm run build` concurrently. Separating build dirs prevents one form of conflict but doesn't repair all possible code, network or environment failures.
- The current HoneyBee Creation LLC Stripe sandbox is not proof of Dujuan's merchant onboarding.
- At time of kit creation, a newer $10 sandbox checkout made without a listener still requires independent investigation; this kit makes no changes to it.
