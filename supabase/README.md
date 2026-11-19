# HealthSuite 360 database and migration status

## Connected Supabase project
- Project name: not confirmed; this is an existing Supabase project, not a newly provisioned dedicated HealthSuite 360 project.
- Project ref: `whahizgrklmmspioyrhp`
- Region: `ap-south-1` (Mumbai)
- API URL: `https://whahizgrklmmspioyrhp.supabase.co`

Do not commit service-role keys, patient records, auth exports, or production secrets. The browser app must use only the Supabase publishable key and rely on RLS.

## Current schema inventory
The active database contains 31 public tables, all with row-level security enabled:
- Platform/tenant: tenants, branches, user_profiles, tenant_memberships, tenant_module_entitlements, audit_events
- Patient Suite: patients, patient_consents
- Pharmacy Suite: medicine_catalogue, pharmacy_suppliers, medicine_batches, pharmacy_purchase_orders, pharmacy_purchase_items, pharmacy_sales, pharmacy_sale_items, pharmacy_stock_movements
- Laboratory Suite: lab_test_catalogue, lab_bookings, lab_booking_items, lab_samples, lab_results
- Doctor Suite: doctor_profiles, doctor_appointments, doctor_consultations
- Care Connect: care_service_catalogue, care_jobs, care_job_events
- Billing: subscription_plans, tenant_subscriptions, billing_invoices, billing_payments

All 31 tables were observed with RLS enabled at the time of this inventory. The database contained no application rows during the inspection.

## Versioned migrations in this repository
1. `20261114212450_transactional_module_workflows.sql`
2. `20261114212504_tenant_admin_audit_controls.sql`
3. `20261114212509_lab_pathologist_role_access.sql`
4. `20261114213109_restrict_rpc_access_and_protect_tenant_owner.sql` (listed in hosted migration history; expected repository file currently returns not found)
5. `20261114213141_harden_rpc_and_lab_result_workflow.sql`
6. Hosted migration history records `20261114213435_expose_authenticated_tenant_bootstrap_rpc`; repository currently stores the corresponding SQL as `20261115110000_expose_authenticated_tenant_bootstrap_rpc.sql`.

The migration filenames and versions are not yet aligned. Reconcile the missing fourth file and bootstrap timestamp with the authoritative migration SQL before replay. Do not rename or reapply migrations against the hosted database.

## Important baseline limitation
The original table/schema foundation predates the versioned migration history currently visible in Supabase. Catalog inspection has confirmed the current 31-table structure, columns, constraints, indexes, policies, triggers, and functions, but the full DDL has not yet been assembled into an ordered, replay-tested baseline migration. Therefore this folder is **not yet a complete blank-database rebuild package**. Do not reset or recreate the production database from these migrations alone.

Before a fresh environment can be provisioned, create and review a baseline containing every table, column, default, constraint, index, RLS policy, trigger, function, grant, and extension, then test it against a disposable Supabase project.

## Security review notes
- Anonymous EXECUTE has been revoked from the application RPCs and the private module-access helper.
- Tenant membership management protects the owner membership from being changed through the admin function.
- Lab result UPDATE and DELETE policies were removed; verification/release is performed by the controlled RPC.
- Supabase Security Advisor reports one warning for `public.lab_verify_result` because it intentionally uses SECURITY DEFINER to update results after explicit auth, tenant entitlement, and independent-verification checks. This is a deliberate privileged workflow and must remain under review.
- Advisor checks are not a substitute for authenticated integration tests.

## Application migration status
The React/Vite repository now uses Supabase Auth for email/password login and registration, loads active tenant memberships in the root auth context, exposes a tenant context hook, and provides a workspace switcher. The Pharmacy POS has been switched to tenant-scoped Supabase queries and the transactional checkout RPC. The general Pharmacy catalogue, PatientSuite, LabSuite, DoctorSuite, CareConnect, and HealthAnalytics screens still contain Apper SDK dependencies. The UI has **not** yet been switched wholesale to Supabase. Do not advertise the web app as fully migrated or production-ready until:
1. Reconstruct all baseline DDL, grants, policies, triggers, functions and extensions into ordered, replay-tested migrations.
2. Validate Supabase Auth confirmation, password reset, session expiry and account recovery.
3. Complete tenant onboarding and branch context selection for memberships with no default branch.
4. Migrate the Pharmacy catalogue, PatientSuite, LabSuite, DoctorSuite, CareConnect and HealthAnalytics screens to the canonical Postgres schema.
5. Tenant-isolation, role, branch, module-entitlement and workflow integration tests pass.
6. A production build and deployed smoke test pass.

## Deployment configuration
Set these in the hosting provider's environment settings (not in source control):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Never expose the Supabase service-role key to browser code.


## Tenant onboarding implementation update (2026-11-15)

- Added `src/pages/WorkspaceOnboarding.jsx`, which calls the authenticated `create_tenant_with_owner` RPC. It collects legal/display names, slug and first-branch details; it does not write tenant tables directly from the browser.
- Updated `RootLayout` to route authenticated users with no active membership to `/workspace/new`, and route existing members away from that page.
- This is code-level implementation only. Signup confirmation, owner bootstrap, membership refresh, duplicate-slug handling and multi-tenant switching still require browser tests with real test accounts.
- The current Supabase migration history contains six post-baseline migrations only. It still does **not** recreate the original 31-table schema from an empty database. Do not reset the live project or use this repository as a blank-database restore until the foundational schema, policies, indexes, triggers and grants have been reconstructed and replay-tested.
- The Supabase security advisor previously reported warnings for authenticated execution of SECURITY DEFINER RPCs, including `public.create_tenant_with_owner` and `public.lab_verify_result`. These privileged workflows still need formal permission review and negative tests.
- Catalog inspection confirms the `public` schema grants USAGE to `anon`, `authenticated`, and `service_role`; this alone does not establish table access safety. Effective table privileges, RLS policies, and function execution grants must be reviewed together. The broad default-looking table grant entries require a focused ACL check before production approval.
- No authenticated tenant/branch isolation tests, clinical module workflow tests, or successful frontend build have yet been recorded.


## Current engineering work (2026-11-20)

- The browser-only preparation plan now explicitly prohibits Docker, local tooling installation, paid branches, and hosted database mutations. Catalog reconstruction is read-only.
- Pharmacy POS now requires the operator to check an explicit confirmation that payment was received before invoking the current checkout RPC. This is a UI safeguard only: the database RPC still records every successful checkout as paid, so a proper payment-state and reconciliation design remains a required engineering item before production use.
- No successful frontend build or authenticated browser integration test has been observed for the recent changes. CI status has not reported a completed check for the latest commit.


## Web/PWA-first delivery decision (2026-11-20)

- Delivery order confirmed: complete the responsive web application and PWA feature set first; begin native Android app work only after the web/PWA features are complete and accepted.
- Browser-based review is the interim validation path. Docker Desktop will be used later, after the feature build is complete, for local isolated database replay and authenticated integration testing.
- No other project has been paused. FlatSync may be considered for a temporary pause only if a concrete capacity or dependency conflict arises; no project has been stopped or altered as part of this decision.
- PharmaSuite catalogue, supplier register and branch-scoped batch inventory have now been migrated from Apper SDK calls to Supabase queries/inserts. Browser runtime validation remains pending.
