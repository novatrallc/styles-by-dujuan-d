# Build 3.9.1 — Owner Notification Center

This is an **additive patch** to Build 3.9. Copy `app/owner/notifications/page.tsx` to the identical path inside `C:\dev\projects\burtons-barbershop`. Do not delete existing files.

## Prerequisites
- Build 3.9 notification SQL migration `202610140002_b39_notifications.sql` has been applied.
- Build 3.9 `/api/owner/notifications` route exists.
- Existing owner login works and owner email is in server-side `OWNER_EMAILS`.
- `lucide-react` is installed (used in previous builds).

## Verify
```
npm run typecheck
npm run lint
npm run test
npm run build
npm run dev
```

Sign in at `http://localhost:3000/owner`, then open `http://localhost:3000/owner/notifications`.

## Included
- Luxury dark/champagne-gold notification center with mobile-friendly event cards.
- Summary counters, status filters, search, refresh, Eastern-time timestamps, and accessible empty/error/loading states.
- Uses the existing Supabase browser session to attach a bearer token to the protected Build 3.9 API.
- Read-only: does not send email, change notification statuses, or expose provider secrets.

## Notes
- The API currently returns the latest 100 events. Filter counts and search cover those 100, not the entire database.
- `pending` includes any unrecognized status that is not sent or in the attention group; this is a presentation classification only.
- Do not enable delivery until Resend, dispatcher authorization, and test-mode delivery are validated.
- This patch intentionally does not modify the owner dashboard navigation. The page is reachable directly and through its back link; dashboard navigation can be integrated after reviewing your existing dashboard component.
