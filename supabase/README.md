# HealthSuite 360 database and migration status

## Connected Supabase project
- Project: `healthsuite-360`
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
4. `20261114213109_restrict_rpc_access_and_protect_tenant_owner.sql`
5. `20261114213141_harden_rpc_and_lab_result_workflow.sql`

The first three were copied from the database migration history. The last two harden RPC grants, tenant owner protection, and the lab-result workflow.

## Important baseline limitation
The original table/schema foundation predates the versioned migration history currently visible in Supabase. It has not yet been reconstructed as a complete, tested baseline migration. Therefore this folder is **not yet a complete blank-database rebuild package**. Do not reset or recreate the production database from these migrations alone.

Before a fresh environment can be provisioned, create and review a baseline containing every table, column, default, constraint, index, RLS policy, trigger, function, grant, and extension, then test it against a disposable Supabase project.

## Security review notes
- Anonymous EXECUTE has been revoked from the application RPCs and the private module-access helper.
- Tenant membership management protects the owner membership from being changed through the admin function.
- Lab result UPDATE and DELETE policies were removed; verification/release is performed by the controlled RPC.
- Supabase Security Advisor reports one warning for `public.lab_verify_result` because it intentionally uses SECURITY DEFINER to update results after explicit auth, tenant entitlement, and independent-verification checks. This is a deliberate privileged workflow and must remain under review.
- Advisor checks are not a substitute for authenticated integration tests.

## Application migration status
The React/Vite repository has the Supabase client and service layer scaffolding, but authentication, tenant context, and module screens still contain Apper SDK dependencies. The UI has **not** yet been switched wholesale to Supabase. Do not advertise the web app as fully migrated or production-ready until:
1. Supabase Auth replaces/bridges the current Apper session lifecycle.
2. Tenant and branch context is loaded from the signed-in user's active memberships.
3. Each module screen uses the canonical Postgres schema and RPC workflows.
4. Tenant-isolation, role, branch, module-entitlement, and workflow tests pass.
5. A production build and deployed smoke test pass.

## Deployment configuration
Set these in the hosting provider's environment settings (not in source control):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Never expose the Supabase service-role key to browser code.
