# Styles by Dujuan D — Build 2.1

## Changes
- Removed sticky header behavior that caused the navigation to appear in the middle of full-page screenshots.
- Added an accessible, toggleable mobile navigation with real route links and a booking CTA.
- Polished hero CTA and service-card hover treatments.
- Retained both approved logo assets and all Build 2 pages.
- Booking and payment processing remain intentionally disabled until owner confirms services, prices, durations, availability and payment credentials.

## Install
Extract the `burtons-barbershop` folder over your existing project (back it up first), then run:

```powershell
cd C:\dev\projects\burtons-barbershop
npm install
npm run typecheck
npm run lint
npm run test
npm run build
npm run dev
```

Visit http://localhost:3000. Verify desktop navigation stays at the top of the document and mobile menu opens/closes correctly.
