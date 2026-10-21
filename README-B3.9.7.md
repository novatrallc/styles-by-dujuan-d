# Build 3.9.7 — Notification Investigations (read-only)

Copy the `app/` folder into the existing project. No existing files are overwritten.

## New routes
- `/owner/notifications/investigations` — owner-only UI
- `/api/owner/notifications/investigations` — bearer-token-protected API (direct browser navigation returns 401)

## Verify
```powershell
npm run typecheck
npm run lint
npm run test
npm run build
npm run dev
```
Sign in at `/owner` and open `/owner/notifications/investigations`.

## Safety and scope
- No migration, new dependency, provider account, or outgoing email required.
- No automatic retries or state mutation.
- Reads up to the oldest 200 pending/sending/failed rows. No recipient email, customer name, or appointment details are returned.
- Stalled indicator uses `created_at` (the current schema has no `claimed_at`), so it is only a heuristic.
- API errors and owner auth are handled without exposing service-role credentials.
- No changes to existing notification center or owner dashboard files; add a navigation link in a later integration if desired.
