# STYLES BY DUJUAN D — Build 2

## What's included
Premium marketing pages, both approved logo images, services, story, contact and a non-transactional booking information page. **No appointment is created, and no payment is taken.**

## Install (PowerShell)
1. Back up your current project.
2. Extract the B2 ZIP into `C:\dev\projects\burtons-barbershop` (merge/replace files). Preserve your existing `.env.local` and any additional work.
3. `cd C:\dev\projects\burtons-barbershop`
4. `npm install`
5. `npm run typecheck; npm run lint; npm run test; npm run build`
6. `npm run dev` and visit `http://localhost:3000`.

## Important
- The B2 brand-update migration changes only the original seed barber's name, not custom records. Apply via Supabase SQL Editor if B1 migration was already applied. Verify the actual barber's name with Dujuan.
- Service prices/durations, hours, contact information and **physical address** remain unconfirmed.
- The two logo PNGs are high-resolution artwork, not editable vectors. For small header/favicon use, a clean simplified SVG should be created after final approval.
- Booking engine, scheduling collisions, Stripe checkout, dashboard, reminders, and authentication are **not** implemented in B2.
- The $10 fee is non-refundable under the planned policy and credited toward service price. Confirm final wording and local legal requirements before launch.
