STYLES BY DUJUAN D -- B4.1.9 GLOBAL SECTION SPACING

Purpose:
Apply consistent responsive top and bottom space to first-level content sections
across the site, including public-facing pages and owner page shells. Avoid changing
nested cards, forms, buttons, or scheduling/payment logic.

Installation:
1. Extract all files from this ZIP into one folder.
2. Stop the Next.js development server (Ctrl+C).
3. In PowerShell from the extracted folder, run:
   powershell -ExecutionPolicy Bypass -File .\install-b419-global-spacing.ps1
4. From C:\dev\projects\burtons-barbershop run:
   npx tsc --noEmit
   npm run dev
5. Refresh your browser with Ctrl+Shift+R.

Spacing:
- Mobile: 72px top and bottom
- Tablet (640px+): 92px
- Desktop (1024px+): 128px

Technical note:
The installer adds one marked CSS block at the END of app/globals.css.
It does not replace existing CSS or TSX files. It creates a timestamped CSS backup.
It is idempotent: running it a second time does not duplicate styles.

Rollback:
Restore the timestamped app/globals.css.b419-backup-* file created during install,
or remove the marked block between DUJUAN_GLOBAL_SPACING_B419_START and
DUJUAN_GLOBAL_SPACING_B419_END.

Potential layout differences:
Some custom page sections may already use unusual nested padding. Inspect the
Home, Services, About, Contact, Book, Owner and Stripe Sandbox pages after install.
Send screenshots if any specific section needs an exception or less whitespace.
This package cannot verify the live Windows project until you run it locally.
