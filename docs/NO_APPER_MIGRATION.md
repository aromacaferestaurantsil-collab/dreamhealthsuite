# Apper-independent HealthSuite 360 delivery

## Source of truth
The React 19 + Vite application in this repository is the product source. Supabase is the backend platform. Apper is not part of the runtime, build, deployment, or data path.

## Runtime requirements
- Browser configuration: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` only.
- Never put service-role keys, database passwords, OAuth client secrets, payment secrets, or signing keys in browser variables or Git.
- All tenant data access must use canonical Supabase table names and tenant-scoped RLS.
- Privileged integrations must run in authenticated Edge Functions or trusted server services.
- Keep clinical and prescription data private; use synthetic data in CI.

## Environment separation
- Development: separate Supabase project/database, storage bucket, Auth settings, API keys and integration secrets.
- Production: separate project/database and secrets; never run experimental migrations or seed data here.
- CI: build-only credentials/placeholders; no production database writes.
- Docker Desktop is deferred until the feature build is complete, per the agreed delivery sequence.

## Migration status
The previous hosted data SDK has been removed from the HTML runtime and replaced with a fail-closed migration guard so unported legacy screens cannot silently call a hosted SDK. Home and HealthAnalytics now use Supabase directly. The remaining screens that still import the compatibility guard must be migrated to the canonical schema before that guard can be deleted.

## Required migration gates
1. Port all screens and data services away from the compatibility guard.
2. Reconcile the existing hosted database migration history and reconstruct the full baseline.
3. Build and test against an isolated development database; do not mutate production during this phase.
4. Add tenant/branch/role negative tests, auth lifecycle tests and workflow tests.
5. Configure hosting, custom domain, backup/restore, payment providers and OAuth integrations with owner-controlled credentials.
6. Complete browser smoke tests and production deployment review before Android work.

## Current known backend tables
Platform: `tenants`, `branches`, `user_profiles`, `tenant_memberships`, `tenant_module_entitlements`, `audit_events`.
Pharmacy: `medicine_catalogue`, `pharmacy_suppliers`, `medicine_batches`, `pharmacy_purchase_orders`, `pharmacy_purchase_items`, `pharmacy_sales`, `pharmacy_sale_items`, `pharmacy_stock_movements`.
Laboratory: `lab_test_catalogue`, `lab_bookings`, `lab_booking_items`, `lab_samples`, `lab_results`.
Doctors: `doctor_profiles`, `doctor_appointments`, `doctor_consultations`.
Patient: `patients`, `patient_consents`.
Care: `care_service_catalogue`, `care_jobs`, `care_job_events`.
Billing: `subscription_plans`, `tenant_subscriptions`, `billing_invoices`, `billing_payments`.

Do not assume unlisted fields or add legacy `_c` field names to these tables. Inspect the schema before writing queries or migrations.
