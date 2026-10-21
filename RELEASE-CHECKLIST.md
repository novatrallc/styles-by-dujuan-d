# B4.2.6 release checklist

## Build files delivered
- [x] Read-only owner-local Payment Activity API
- [x] On-demand Stripe TEST session snapshot API, validates appointment/session/amount/currency
- [x] Branded owner Payment Activity Timeline UI
- [x] B4.2.5 filter/detail mismatch corrected by installer patch
- [x] Dashboard Payment Activity link added by installer patch
- [x] Backup-first/re-runnable/rollback-capable Windows PowerShell installer
- [x] 8 Node static safety tests — passed in preparation environment
- [x] TS/TSX transpile/syntax checks — passed in preparation environment
- [ ] Windows `npx tsc --noEmit` and `npm run build` — user must run in full project
- [ ] Stripe genuine automatic event forwarding — requires fresh intentional test checkout
- [ ] Correct live merchant account/production launch — NOT approved

This package makes no schema, webhook, Stripe write, booking update, refund, or notification change.
