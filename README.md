# B4.2.1a — Premium Service Confirmation Dialog

Replaces the browser-native confirmation **only for service deactivation and deletion** with a luxury black-and-gold accessible modal. Existing API authorization, deletion safeguards, Stripe, Supabase configuration, and public booking are unchanged.

## Install

1. Stop your Next.js dev server (`Ctrl+C`).
2. Extract this ZIP to a local folder.
3. In PowerShell **inside the extracted folder**, execute:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\install-b421a-modal.ps1
   ```

4. In your project:

   ```powershell
   cd C:\dev\projects\burtons-barbershop
   npx tsc --noEmit
   npm run build
   npm run dev
   ```

5. Visit `/owner` → Services. Click Deactivate; confirm that a styled modal appears. Click **Keep service** first to verify cancellation. You can also check that inactive services present the distinct permanent-delete warning; do not delete an existing service just to test the modal.

## Installer safety

- Requires the exact B4.2.1 service-management handler and UI anchors.
- Backs up the dashboard file before writing.
- If the new component already exists and differs from the package, stops.
- If already installed, exits without changes.
- Does not modify SQL migrations or environment variables.

## Rollback

Restore `app/owner/owner-dashboard.tsx` from the backup path printed by the installer and remove `app/owner/service-action-dialog.tsx` if the installer created it.
