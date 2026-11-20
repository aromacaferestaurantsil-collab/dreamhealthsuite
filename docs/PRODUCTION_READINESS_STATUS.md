# HealthBuddy 360 — Production Readiness Status

Last verified: 2026-11-20

## Verified in this development release

- Frontend production build succeeds on commit `5d86533ae1353b9750406e990d259c6d5b031bdc`.
- Vercel-hosted preview responds with HTTP 200 for `/`, `/login`, `/pharmacy-workflows`, `/pharmacy-intelligence`, `/pharmacy-order`, `/manifest.webmanifest`, and `/sw.js`.
- SPA fallback rewrite is committed in `vercel.json`.
- Supabase project is healthy; 17 migrations are applied.
- All 46 exposed public tables have RLS enabled; Supabase security advisor returned no findings.
- Active owner membership and tenant bootstrap were verified under the PostgreSQL `authenticated` role using the real owner identity.
- Tenant isolation check returned only the owner's tenant records and zero records from other tenants.
- Rollback-only authenticated RPC tests passed for purchase order creation, goods receiving/batch creation, supplier payment, POS checkout/stock deduction, customer-order review, stock hold/release, stock adjustment, expense payment, and scheduled-drug register entry. These tests were rolled back; no test financial or stock transactions were retained.
- Supplier balance and batch availability reporting reads work under the authenticated role.
- Prescription and catalogue-photo storage buckets are private and have tenant/staff/customer-scoped storage policies.
- Production dependency audit: zero vulnerabilities. Full development dependency audit reports four moderate findings in the legacy shadcn/ts-morph/minimatch toolchain; npm audit identifies a major-version shadcn upgrade as the available fix.

## Not yet certified for live production

- The currently seeded workspace is **HealthBuddy Demo Workspace** and contains synthetic records. Do not enter real patient, prescription, stock, or financial data into it.
- End-to-end UI testing in a real browser session for each role (owner, pharmacist, staff, patient) remains outstanding; SQL role simulations are not a substitute for those full UI tests.
- Patient portal submission needs a patient account with a verified matching email and patient profile.
- Production Auth site URL and redirect allowlist have not been independently verified against the permanent hostname.
- GitHub is not connected to the Vercel account currently available to deployment tooling. The dedicated `healthbuddy-360` Vercel project exists but does not yet have a Git-linked deployment. The public alias currently points to the claimed preview deployment, not the dedicated project.
- Backup/restore drill, monitoring/alerting, and production data migration sign-off remain outstanding.

## Release rule

Keep the pull request in draft and do not label this release production-ready until the demo tenant is replaced by a real tenant, the production hostname and Auth redirects are verified, and real browser tests pass for each required role.
