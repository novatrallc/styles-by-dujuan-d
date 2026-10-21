Styles by Dujuan D — B4.2.6 Build Hotfix

Fixes ONLY:
1. TypeScript mistakenly checking TSX files under project/backups (adds backups to tsconfig exclude).
2. Unescaped apostrophe in app/owner/payment-activity/page.tsx (listener's => listener&apos;s).
3. Unused Clock3 icon import in app/owner/reconciliation/page.tsx.

Requires project path C:\dev\projects\burtons-barbershop and installed TypeScript package.
STOP npm run dev/start before building. Do not use npm run build while npm run dev is active.

From the folder containing fix-b426-build.ps1:
  powershell -ExecutionPolicy Bypass -File .\fix-b426-build.ps1

Then from project root:
  cd C:\dev\projects\burtons-barbershop
  npx tsc --noEmit
  npm run build
  npm run start

If any step fails, share the error; do not rerun repeatedly.
The hotfix is idempotent and saves copies in project/backups/b426-build-fix-TIMESTAMP.
No Supabase, Stripe, migrations, checkout flags, or appointment records are changed.
