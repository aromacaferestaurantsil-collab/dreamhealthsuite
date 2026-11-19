# HealthBuddy 360 development preview

## Environment boundary

- Supabase development project: `healthbuddy-360` (`klivmyonjuygukbfyymo`).
- Production project remains separate and has not received these migrations or synthetic records.
- The development database contains only reconstructed schema and fictional demo records.
- The public browser bundle uses the development project's publishable key only. No service-role key is shipped to the browser.

## Development migrations

The development project has the reconstructed core schema snapshot followed by PharmaSuite workflows, security hardening, patient portal access, synthetic demo data, and RPC write isolation. The baseline is an explicit reconstruction from read-only schema inspection; it is not the missing historical source migration.

## First-time tester flow

1. Open the web app and choose **Create an account**.
2. Confirm the email if Supabase email confirmation is enabled.
3. Sign in. New accounts are directed to `/demo-workspace`.
4. Claim the seeded demo workspace. It is a single shared demo tenant and can be claimed by one tester account.
5. Open **Business dashboard** and **Operations & registers** in PharmaSuite.

The demo tenant includes synthetic medicines, batches, a supplier, supplier scheme, purchase order, 12 months of sample sales, an expiry batch, a quarantined batch, sample expenses, attendance, a referral and an order awaiting pharmacist review.

## Review routes

- `/pharmacy-intelligence` — sales, purchases, seasonal/CRM demand recommendations, supplier offers, expenses and attendance.
- `/pharmacy-workflows` — goods receiving, supplier/expense payments, customer-order review, quarantine/recall, controlled-drug register, photo confirmation, barcode lookup, referrals and exports.
- `/pharmacy-order` — patient medicine ordering and private prescription upload. A verified sign-in email must match the email stored on the patient record; otherwise the clinic must add the email to the patient record first.

## PWA behavior

- Installable manifest and service worker are included.
- The app shell and static build assets are cached.
- Authentication, database, storage, prescription and patient records are deliberately not cached offline.
- USB/Bluetooth keyboard-wedge barcode scanners are supported through the barcode input. Camera-based barcode recognition is not claimed.
- CSV exports open in Excel; the Tally XML output is a starter purchase-voucher mapping and must be checked against the target Tally company before import. Browser print can save reports as PDF.

## Deployment

The GitHub Pages preview workflow builds the PWA from this branch and deploys the `dist` folder when repository Pages and Actions permissions are enabled. Supabase Auth must allow the deployed preview origin as a redirect URL before email confirmation and OAuth redirects will work.

Do not use this development environment for live patient records. Do not merge or promote the migration set to production without a separate release review.
