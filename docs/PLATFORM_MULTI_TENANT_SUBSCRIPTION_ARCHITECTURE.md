# HealthSuite 360 — multi-tenant product and portal architecture

## Product modules (six independently licensed products)

1. **PharmaSuite** — pharmacy operations, dispensing, stock, purchasing and finance.
2. **LabSuite** — laboratory orders, sample lifecycle, validation and report delivery.
3. **DoctorSuite** — doctor profiles, schedules, consultations and clinical workflows.
4. **PatientSuite** — patient identity, consent and patient-facing records.
5. **Care Connect** — delivery, collection, field agents and service coordination.
6. **HealthAnalytics** — reporting and operational intelligence.

Each module must be independently deployable and independently usable. A vendor may subscribe to one module or any combination. Shared capabilities (identity, organisation, branches, audit, notifications and integration adapters) are platform services, not a requirement to purchase every module. Cross-module links and dashboards appear only when the vendor owns the relevant entitlements and grants the required staff permissions.

## Separate control plane and vendor data plane

### Super Admin control plane
Super Admin is a platform operator role, not a vendor/tenant role. It has a separate sign-in entry point, application shell, route tree, database/storage boundary and deployment surface. A vendor account must never be able to resolve or navigate to Super Admin routes; direct URL attempts must be denied server-side, not merely hidden in navigation.

The Super Admin console is limited to SaaS administration metadata:
- Vendor/organisation display name and vendor contact name, phone and email.
- Vendor identifier and account lifecycle state.
- Purchased module identifiers, plan, subscription start/end, renewal and subscription status.
- Invoice/payment reference and subscription ledger status (not vendor operational transactions).
- Support complaint/ticket reference, category, status, priority and timestamps.
- Module catalogue, package/release versions, domain/subdomain, price, discounts, offer validity and publication status.

It must not expose vendor patient/customer records, prescriptions, test results, doctor notes, medicine catalogue, stock, sales, supplier records, staff records, financial ledgers or vendor files. Avoid collecting patient information in complaint tickets; use a ticket reference and vendor-authorised, redacted diagnostics.

### Vendor data plane
Every vendor organisation has its own tenant boundary, roles, branches, module entitlements, audit trail and storage connection. Vendor operational and personal data belongs to the vendor and must not be readable by Super Admin staff. The vendor selects and authorises its own online storage provider (for example, its own cloud drive or its own managed database/storage account). OAuth tokens and encryption keys are stored server-side, encrypted, scoped to that vendor and revocable. No vendor may supply a public folder link as a substitute for an authenticated storage connection.

The current Supabase tenant/RLS foundation remains the application data plane until a supported vendor-owned storage adapter is configured and tested. A “vendor chooses a drive” setting must not be represented as active until OAuth, upload/download, permissions, retention, backup and restore have been validated for that provider. Patient records remain private and are not copied into the Super Admin control plane.

## Subscription, entitlements and releases

- The Super Admin publishes six module products, independent module plans and optional bundles.
- Pricing supports currency, billing interval, list price, discounted price, coupon/offer code, start/end time, eligibility and redemption limits.
- Each vendor subscription produces a server-verified entitlement record per module, including active/trial/past-due/suspended/cancelled state and validity dates.
- The API checks the entitlement on every protected module request. Front-end hiding is only a convenience and is never the security boundary.
- A vendor may install a single module package or a bundle. Packages are versioned, signed, and served from module-specific domains/subdomains or a central release catalogue. Release hosting and vendor runtime/data hosting are separate concerns.
- A module can run alone. Shared navigation, cross-module workflow actions and consolidated analytics are enabled only for modules actually purchased and authorised.
- Subscription suspension blocks new protected operations but must preserve the vendor's lawful ability to export its data and access billing/support.

## Applications and role boundaries

### Vendor workspace (desktop and mobile responsive)
Vendor administrators activate purchased modules, configure organisation/branches, invite staff, set module-specific permissions, connect their own storage provider and manage integrations. The vendor workspace is the only place where vendor operational records are managed.

### Patient/customer PWA
A patient enters through a vendor-linked URL, domain, QR code or invitation. The PWA exposes only vendor-enabled patient actions:
- Medicine catalogue search and medicine orders.
- Lab test discovery and bookings.
- Doctor availability and appointment bookings.
- Patient prescriptions and authorised online prescription workflows.
- Results/reports belonging to the signed-in patient, with appropriate verification and consent.

Patients cannot open vendor administration routes, browse staff or supplier data, see stock/financial information, inspect internal operations or access another patient's records. Public catalogue fields are deliberately published by the vendor; private vendor records are never exposed directly.

### Agent PWA
An agent sees only their own identity, assigned jobs where applicable, earned/approved/pending commission, payout history and reconciliation statements. No vendor-wide sales, other agents' commissions, patient clinical records or vendor configuration are visible.

### Doctor PWA
A doctor sees only their authorised vendor/clinic association and assigned/consented patient workflows. Dashboard metrics include bookings, attended patients, new/repeat patients, reporting patients, medicines purchased from that vendor, tests completed by that vendor and reports awaiting/issued. Patient-level detail is shown only where the doctor has a treatment relationship and the applicable consent/role permission. Aggregates must be tenant- and doctor-scoped; no cross-vendor aggregation.

## Complaint and support workflow
Any vendor module can create a support case. The vendor submits module, release version, category, priority, description and optional redacted diagnostics. The Super Admin sees only the support case and minimum vendor contact/subscription metadata needed to respond. A case must not silently copy clinical or commercial data. If a diagnostic export is necessary, the vendor explicitly reviews and approves the redacted attachment before submission. Replies and status changes are visible to the submitting vendor.

## Navigation and responsive behaviour
- One navigation destination per unique route; duplicate page exports must not create duplicate tabs.
- PharmaSuite operational pages remain grouped inside PharmaSuite.
- Desktop uses a collapsible left navigation rail.
- Mobile uses a single slide-out navigation drawer; do not duplicate the same destinations in a bottom tab bar.
- Main content must use min-width: 0, fluid widths, responsive grids, scrollable data tables, stacked forms and touch targets of at least 44px.
- A module is absent from vendor navigation when its entitlement is absent or inactive. Direct route/API access must still be rejected by server-side entitlement checks.

## Security and implementation gates
1. Create a separately authenticated Super Admin control plane and separate storage/database. Do not reuse vendor tenant membership as Super Admin authority.
2. Implement server-side module catalogue, vendor subscription, price/offer, release and support-case APIs with audit logging.
3. Implement signed release manifests and package download authorization.
4. Implement entitlement checks in database/RPC/Edge Function policies before rendering module routes.
5. Add vendor-owned storage OAuth adapters with least privilege and tested restore/export.
6. Add patient, agent and doctor PWA route groups with deny-by-default API policies.
7. Test negative access cases: vendor to Super Admin; patient to vendor operations/other patients; agent to another agent; doctor to unrelated tenant/doctor; vendor A to vendor B; unpurchased module direct URL/API.
8. Do not mark a portal, storage connector, subscription gate or module package as production-ready until its negative tests and end-to-end acceptance tests pass.

## Current delivery note
The existing application has a tenant-scoped vendor workspace, a customer order portal foundation and role/branch-aware module pages. The current branch's responsive navigation change removes the redundant mobile bottom navigation and uses a mobile drawer; route discovery also de-duplicates repeated route paths. This does not by itself implement the separate Super Admin control plane, subscription billing/release service, vendor-owned drive adapters, or the dedicated agent/doctor/customer PWAs. Those require the security and integration gates above and must not be represented as completed until implemented and tested.
