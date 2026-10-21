# Build 3.2 — Owner Console Usability & Timezone Safety

## Included
- Owner dashboard split into Overview, Appointments, Services, Working Hours, Time Off, and Settings tabs.
- Status filtering for appointments and overview counts.
- Time-off form now sends business-local times to the server; server converts using the configured business timezone, independent of the owner's device timezone.
- Responsive tab navigation and reusable card spacing.
- No database migration required. Public booking and Stripe remain disabled.

## Installation
Back up your existing project. Merge the contents of the `burtons-barbershop` directory into `C:\dev\projects\burtons-barbershop`, preserving `.env.local`.

Run `npm install`, `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, then `npm run dev`.

## Verify
1. Sign in at `/owner` and switch through all six tabs.
2. Save a service, refresh, and confirm persistence.
3. Add a working-hours interval, refresh, then remove it.
4. Create a time-off block in the business timezone and verify it displays correctly after refreshing.
5. Check appointments status filter and sign-out.
6. Confirm `/book` still shows that checkout is disabled.

## Limits
- This build improves owner management UX; it does not enable live customer bookings or payment collection.
- Existing appointment list is limited to the 100 records returned by the owner API.
- Overlapping hours and DST ambiguity should be fully regression-tested before launch.
