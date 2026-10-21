# Build 3.7.1 — Global Form and Icon Consistency

## Included
- Reusable `components/premium-field.tsx` components with accessible labels and gold icon treatments.
- Customer booking form: service, date, name, email, and phone icons; icon-led time selection and reservation policy.
- Owner services editor: consistent icons on name, description, price, and duration fields.
- Shared responsive styles in `app/globals.css`.

## Install
Back up the current project, copy this complete project over it, and preserve your existing `.env.local`.
Run `npm install`, `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build` before `npm run dev`.

## Security
No payment, availability, or authentication logic was intentionally changed. Keep `ENABLE_STRIPE_CHECKOUT=false` until controlled end-to-end payment tests pass. No new SQL migration is required.

## Manual checks
- `/book`: icons align on desktop/mobile; service/date changes still fetch availability.
- Owner dashboard: service edits still save, including price and duration.
- `/book/confirmation`: invalid or missing checkout session does not show success.
- Owner login and sign-out remain functional.
