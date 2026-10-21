# Build 3.3 — Booking Operations

Adds owner-only appointment status actions with server-side validation and audit trail. **No public appointment creation or Stripe checkout yet.**

## Install
1. Back up the existing project and overlay the `burtons-barbershop` folder contents. Keep your `.env.local`.
2. Run `supabase/migrations/202610130003_b33_appointment_operations.sql` once in Supabase SQL Editor.
3. Run `npm install`, `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run dev`.
4. Sign in at `/owner` and open Appointments. When appointments exist, test cancel/complete/no-show actions and confirm audit records in `appointment_owner_events`.

## Rules
- Only the authenticated, allowlisted owner may use these endpoints.
- Confirmed and pending-payment appointments can be cancelled.
- Only confirmed appointments whose start time has passed may be completed or marked no-show.
- All operations require explicit browser confirmation.
- Changes use a status predicate to reject stale updates.
- The audit insert follows the status update; these are not atomic. If audit insertion fails, the API reports that status may have changed. Before production, replace with a transactional Postgres RPC to ensure all-or-nothing behavior.
- Customer notifications, refunds, rescheduling, public checkout and live booking activation remain out of scope.
- No sample appointments are inserted; an empty list is expected until a later secure booking build.
