# HealthSuite 360 — Apper-independent reconstruction blueprint

**Status:** implementation blueprint; reconstructed items are proposals until tested.
**Target:** React 19 + Vite + Supabase PostgreSQL/Auth/Storage/Edge Functions.
**Branch:** `platform/no-apper-foundation`.

## Delivery rule

Apper is not a dependency. Rebuild every required workflow in this repository. Prefer the canonical Supabase schema and existing transactional RPCs. When the former hosted screen or workflow cannot be recovered, implement the workflow described below as a clearly documented reconstruction. Do not leave a dead-end screen, pretend an unimplemented action works, or silently write clinical/financial records.

## Product-wide foundations

1. Authentication: email/password sign-in, registration, email confirmation, password reset, password change, session refresh, sign-out.
2. Organisation: tenant creation, invitations, memberships, role changes, branch selection, active tenant/branch context.
3. Access: tenant + branch + role + module entitlement checks in UI and enforced by RLS/RPC on the server.
4. Shared records: one patient identity across licensed modules; consent and minimum-necessary disclosure.
5. Audit: append audit events for sensitive clinical, financial, inventory, membership and platform actions.
6. Files: private Supabase Storage buckets, signed downloads, MIME/size validation, tenant-scoped paths.
7. UX: responsive desktop/tablet/mobile web and PWA; accessible forms, validation, empty/loading/error states, pagination, search, filters and exports.
8. Synthetic test data only in development/CI. Never seed production. Never copy password hashes, refresh tokens, session tokens, service-role keys or other secrets.

## Module reconstruction scope

### PharmaSuite
- Catalogue: medicine name, generic, strength, form, pack, barcode, tax, manufacturer and active status.
- Suppliers: contacts, GST details, opening balance and ledger.
- Purchasing: multi-line purchase orders, approvals, partial receipts, batch creation, landed cost and supplier payable.
- Inventory: branch-wise batches, FEFO issue, transfers, adjustments with reasons, expiry/near-expiry, low-stock and reorder suggestions.
- POS: barcode/search cart, quantity/discount/tax, patient/prescription linkage, cash/UPI/card/credit/split tender, invoice, returns, voids, refunds and shift closing.
- Reporting: sales, gross margin, stock valuation, expiry, fast/slow movers, purchase and supplier balances.
- Existing RPCs to reuse after schema validation: `pharmacy_checkout`, `pharmacy_checkout_v2`, `pharmacy_create_purchase_order`, `pharmacy_receive_purchase_item`, `pharmacy_adjust_stock`, `pharmacy_process_return`.

### LabSuite
- Test catalogue, panels/packages, specimen requirements, pricing and reference ranges.
- Walk-in/online booking, patient lookup, payment/discount, booking items and receipt.
- Sample labels/barcodes, collection assignment, receiving, rejection/recollection, processing and outsourced tests.
- Result entry with units/reference ranges/flags, attachments, pathologist review, independent verification and controlled release.
- Patient/doctor report access with consent and audit trail; printable/PDF report.
- Work queues for booked, collected, received, processing, verification, released and rejected states; turnaround reporting.
- Reuse `lab_verify_result`; never bypass verification or write released results directly from the browser.

### DoctorSuite
- Doctor profile, qualifications, registration, specialities, locations, consultation fee and schedules.
- Appointment booking, slot availability, rescheduling, cancellation, check-in and no-show.
- Consultation record, vitals, diagnosis, notes, prescription and diagnostic orders.
- Follow-up plan, patient history, printable prescription and doctor schedule/earnings reports.
- Keep clinical notes private and tenant-scoped; no fabricated medical advice or auto-release.

### PatientSuite
- Patient registration, duplicate detection, demographics and unique patient number.
- Consent management, linked appointments, prescriptions, lab reports, medicine orders and payments.
- Patient portal with secure access, download history and communication preferences.
- Staff access must be role-limited; expose only the minimum data needed for the task.

### CareConnect
- Service catalogue and coverage area.
- Job creation from delivery, sample collection or service request; assignment/reassignment.
- Staff work queue, route/visit status, OTP/handover confirmation, barcode scan, proof of completion and failure reason.
- Patient contact/address revealed only for assigned jobs and only as required.
- Job event history, staff performance, cash/collection reconciliation.

### HealthAnalytics
- Tenant/branch/date filters and role-aware dashboards.
- Pharmacy revenue, cost, margin, stock, expiry and purchasing metrics.
- Lab bookings, revenue, pending samples/results, release counts and turnaround.
- Doctor appointments, consultations and utilisation.
- Care job completion and SLA.
- Subscription, module usage and invoice metrics.
- All metrics must be computed from real tenant-scoped records; show empty states rather than invented values.

### Platform administration and licensing
- Product/module catalogue, plan entitlements, release channels and version history.
- Tenant subscription, licence request, issue/activate/renew/suspend/revoke and audit history.
- Platform-admin operations are server-only and fail closed; no browser-side privileged key.
- Release publishing and licence lifecycle must be atomic/idempotent before enabling write actions.

## Reconstructed data and test strategy

- Existing production project is not a development sandbox. Do not apply migrations, seed, reset, or write test records there.
- Reconstruct a fresh baseline migration from read-only catalog metadata: tables, columns, defaults, enums, PK/FK/check constraints, indexes, RLS, policies, grants, triggers and function definitions.
- Preserve historical migration ledger facts. Do not fabricate missing migration SQL or backdate a reconstructed baseline as an applied migration.
- Use a new clearly named baseline migration for clean-room replay; replay later migrations in order only after duplicate-object and dependency review.
- Copy only explicitly authorised dummy business/test rows into an isolated development database once its schema exists. Recreate dummy Auth users through invitation/password reset; never copy auth hashes, identities, refresh tokens or sessions.
- If no isolated database is available without cost, complete code, static checks and synthetic fixture generation in the repository; defer database integration tests rather than touching production.

## Definition of done

A module is not complete merely because its route renders. Each workflow needs:
- Supabase-backed list/detail/create/update operations with tenant/branch scope.
- Server-side validation and transactional RPC for multi-record/financial/clinical state transitions.
- Permission checks and negative tenant-isolation tests.
- Loading, empty, validation, success and error states.
- Search/filter/pagination and responsive layouts.
- Synthetic fixtures and automated tests for happy path, invalid transition, duplicate submission, unauthorised role and cross-tenant access.
- Browser smoke test and production build.

## Current implementation gaps to close

- Audit every import/call of the former Apper SDK, including auth, file upload, lookup and people pickers.
- Replace compatibility-guard calls with Supabase services; remove the guard only when no imports remain.
- Convert module capability shells into operational workflows above.
- Complete the database baseline reconstruction and test it in a disposable development environment.
- Validate existing licensing/release Edge Functions for transactionality, idempotency, RLS and authorization.
- Run CI/build and browser smoke tests. Do not merge, deploy, configure a custom domain, or start native builds as part of this tranche.
