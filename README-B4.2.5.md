# STYLES BY DUJUAN D — B4.2.5
## Payment Reliability & Reconciliation Pro (Local-safe)

The already-paid $10 Stripe TEST Checkout was confirmed in Stripe and its signed historical event replay was accepted by `/api/stripe/webhook` with HTTP 200. Local Supabase recorded `late_payment / needs_review`, correctly **without confirming an expired appointment**. Automatic forwarding from Stripe CLI remains unverified.

### What's new

- New premium `/owner/reconciliation` workflow, keeping the existing owner dashboard link: readable incident state, appointment/session match, Stripe event ID, effective expired-hold label, audit history, review notes, and guarded resolution dialog.
- `GET /api/owner/reconciliation` now returns the owner-authorized local review queue with appointment context and audit history. Data is sampled (100 reviews, 500 audit events).
- New owner-authorized `POST /api/owner/reconciliation/actions` for writing an audit note or documenting resolution. Both checkout flags must be **off**. Only local Supabase API port 54421 is accepted.
- `sql/LOCAL-ONLY-b425-reconciliation-audit.sql` adds an append-only owner action log and atomic, idempotency-keyed resolution RPC. It stores a resolution note and changes **only the reconciliation item's review status**, not the appointment/payment, Stripe status, or customer communication.
- `WEBHOOK-FORWARDING-RUNBOOK.md` guides a *separate future* automatic CLI-forwarding test with a new Stripe TEST transaction; no second charge is made by installing B4.2.5.

### Important resolution safeguards

- **Add note**: requires 20–1200 characters, recorded with owner identity and time.
- **Close review**: requires at least 20 characters, a documented outcome, a check-box attestation and typing `RESOLVE` in the dialog. If owner reports an external refund, a `re_...` reference is required. The reference is **owner-supplied and is NOT verified through Stripe**. The system does not make refunds or credits.
- No auto-confirming or automatically expiring appointments; the page displays `Paid after hold expired — review required` based on the stored expiry time without mutating booking records.
- Audit entries cannot be edited or deleted through the API; the database trigger also blocks updates/deletes to audit rows. An action UUID prevents duplicate submissions from repeated calls using the same key.
- The route never calls the Stripe API or handles card data.

### Installation (Windows)

**1. Local Supabase only:** Confirm local Studio URL is `http://127.0.0.1:54423`. Open SQL Editor and run `sql/LOCAL-ONLY-b425-reconciliation-audit.sql`. NEVER run this file in hosted Supabase; NEVER run `supabase db push`, `db reset --linked`, or place this SQL under shared migrations. The final SQL query should show `present=true`, `anon_can_execute=false`, `authenticated_can_execute=false`, `service_role_can_execute=true`. Run it before using the new UI.

**2. Stop Next.js** (`Ctrl+C`); do not run `npm run dev` and `npm run build` together. Extract ZIP anywhere; open PowerShell **inside the extracted folder**:

```powershell
powershell -ExecutionPolicy Bypass -File .\install-b425.ps1
```

This installer backs up `app/owner/reconciliation/page.tsx` and `app/api/owner/reconciliation/route.ts` and adds `/api/owner/reconciliation/actions/route.ts`. It rejects an unexpected existing action API and has rollback on copy failure. It **does not** run SQL or edit `.env.local`, public checkout, owner dashboard, Stripe, webhooks, or appointment tables. If output indicates unexpected code, STOP and share the error.

**3. Keep all payment switches OFF:**

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421
ENABLE_STRIPE_CHECKOUT=false
ENABLE_OWNER_STRIPE_TEST_CHECKOUT=false
ENABLE_NOTIFICATION_DELIVERY=false
```

**4. Verify with Next.js stopped:**

```powershell
powershell -ExecutionPolicy Bypass -File .\verify-b425.ps1
cd C:\dev\projects\burtons-barbershop
npx tsc --noEmit
npm run build
npm run start
```

Use `npm run start` **only after the build completes**. Don't mix dev/start/build in the same `.next` directory.

**5. Test:** Sign in to local owner dashboard, visit `/owner/reconciliation`. See the $10 `late_payment` review. Add an internal note. Refresh and confirm the audit entry. Review the resolution dialog with **Keep in review** first. Only close the review when Dujuan has actually documented the appropriate external follow-up. Closing does not trigger a refund or booking confirmation.

### Read-only SQL verification

```sql
select id,status,reason,amount_cents,resolution_note,resolved_at from public.payment_reconciliation order by created_at desc limit 5;
select reconciliation_id,action,actor_email,note,created_at from public.payment_reconciliation_actions order by created_at desc limit 10;
```

### Rollback

Stop Next.js. Restore the two original files from the timestamped `backups/b425-payment-review-...` folder. Delete `app/api/owner/reconciliation/actions/route.ts` only if this installer created it. **Do not drop the audit table** if any actions have been recorded. If no actions were ever recorded, the SQL can remain harmlessly installed in local Supabase.

### Testing scope and known limitations

- Typescript/TSX parser and installer package checks performed in this environment. Complete Next.js build cannot be asserted until checked on your Windows project.
- Local Supabase schema is grounded in B3.8 payment reconciliation and observed local SQL output; service-role privileges depend on the local key matching the same local instance.
- A stored `pending_payment` with an expired hold remains unchanged; the UI labels the incident clearly. A later hardening build can implement an atomic expired-hold cleanup policy with payment reconciliation awareness.
- The post-payment confirmation page may temporarily say 'Verifying'; Stripe success redirects alone do not prove app confirmation.
- Hosted project and actual Stripe merchant payout identity are **not** validated by this local build.
