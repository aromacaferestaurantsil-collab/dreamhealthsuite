# HealthSuite 360 — target platform architecture

## Product surface

**HealthSuite 360 Web / PWA** is the primary application surface. It contains the following role- and tenant-scoped workspaces:

- Admin
- Pharmacy
- Laboratory
- Doctors
- Patients
- Care Connect

The web application is the first delivery target. The PWA must be installable and usable in supported desktop and mobile browsers. Native Android work starts only after web/PWA completion and validation.

## Logical architecture

```text
Users and staff
      |
      v
HealthSuite 360 Web / PWA
(Admin | Pharmacy | Laboratory | Doctors | Patients | Care Connect)
      |
      v
Versioned API and integration layer
(REST API | Supabase Edge Functions | Webhooks | OAuth | Payment gateways)
      |
      +----------------------+-----------------------+
      |                      |                       |
      v                      v                       v
Development DB          Production DB          External services
Synthetic/test data     Live customer data     WhatsApp, email,
isolated project        protected project      accounting, payments,
                                               automation providers

GitHub source control and CI/CD
(source -> review -> tests/build -> approved deployment)

Backup infrastructure
(encrypted backups -> separate region/account -> restore tests)
```

## Platform responsibilities

### GitHub
- Canonical source code and version history.
- Pull requests and protected branch review.
- Automated lint, type, unit, integration and production-build checks.
- Deployment workflows with environment-specific secrets and explicit approval gates.
- No production deployment from an unreviewed feature branch.

### Supabase
- PostgreSQL relational data.
- Authentication and tenant membership.
- Row-level security and database grants.
- Storage with private buckets and signed URLs.
- Generated REST interfaces where appropriate.
- Edge Functions for privileged workflows, provider integrations, webhooks and server-side secrets.
- Production and development must use separate Supabase projects and separate credentials.

### Web hosting
- Hosts the built PWA and serves static assets over HTTPS.
- Supports SPA routing, service-worker delivery, cache invalidation and custom domains.
- Hosting provider and deployment target remain selectable; do not create a paid service or alter DNS without explicit approval.

### API and integration layer
- Versioned REST endpoints with an OpenAPI contract.
- Edge Functions enforce JWT, tenant, branch, role, module entitlement, schema validation, audit and idempotency.
- Webhooks verify provider signatures and reject replayed events.
- OAuth connections use authorization code + PKCE, validated state, least-privilege scopes, encrypted server-side token storage and revocation.
- Payment gateways use server-created intents, verified webhooks and reconciliation. Browser callbacks alone never mark invoices paid.
- WhatsApp, email, accounting and automation services connect through tenant-owned credentials and explicit consent.

### Development database
- Separate Supabase project, isolated from live customer data.
- Synthetic/demo records only.
- Test migrations, RLS policies, functions, storage rules, upgrade paths and restore drills here first.
- No production credentials or production customer records in development.

### Production database
- Live customer and operational data.
- Least-privilege access, RLS on every tenant-owned table, auditable privileged actions and encrypted secrets.
- No schema experiments, synthetic seed data or unreviewed migrations.
- Production changes require a reviewed migration, backup/restore plan and approved release.

### Backup infrastructure
- Automated database backups plus encrypted off-site copies in a separate region and preferably a separate account.
- Retention, access control, checksums and documented RPO/RTO.
- Scheduled restoration tests into an isolated environment.
- A backup is considered valid only after a successful restore and integrity verification.
- Provisioning extra storage, cross-region transfer or paid backup products requires budget approval.

## Environment and release rules

| Environment | Data | Purpose | Deployment rule |
|---|---|---|---|
| Development | Synthetic data | Feature work and isolated testing | Feature branches and CI |
| Staging / preview | Synthetic or sanitised data | End-to-end acceptance testing | Deploy from reviewed branch |
| Production | Live customer data | Real operations | Approved release only |

## Delivery sequence

1. Complete HealthSuite 360 Web / PWA features.
2. Build and open the browser preview for user testing.
3. Validate workflows, tenant isolation, roles, branch permissions, RLS, reports and integrations.
4. Finish remaining web/PWA work and resolve acceptance findings.
5. Move to Docker Desktop testing after web builds are complete.
6. Begin Android development only after web/PWA completion.

## Non-negotiable safeguards

- Never copy password hashes, refresh tokens, sessions, service-role keys or provider secrets as application demo data.
- Dummy business data may be copied only into an isolated development database.
- Do not run production migrations during development.
- Do not enable public access to patient, prescription, laboratory or payment records.
- Do not deploy, configure a custom domain, provision paid backup infrastructure or create a paid database branch without the appropriate release/budget approval.
