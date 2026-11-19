# Browser-only schema reconstruction and later test plan

This repository is being prepared without Docker Desktop, local database installation, paid Supabase branches, or new subscriptions.

## Current working mode

- The connected hosted Supabase database is inspected read-only.
- No SQL migrations, DDL, test fixtures, or application writes are run against the hosted database.
- GitHub is used to assemble and review the migration source.
- The existing Apper application and hosted database remain untouched while the build is in progress.

## Schema reconstruction

The hosted schema predates the tracked migration history. The live migration history currently contains six post-baseline migrations:

1. `20261114212450_transactional_module_workflows`
2. `20261114212504_tenant_admin_audit_controls`
3. `20261114212509_lab_pathologist_role_access`
4. `20261114213109_restrict_rpc_access_and_protect_tenant_owner`
5. `20261114213141_harden_rpc_and_lab_result_workflow`
6. `20261114213435_expose_authenticated_tenant_bootstrap_rpc`

The repository currently has a filename/content mismatch for migration 4 (the hosted history lists it, but the expected file path is missing) and migration 6 is currently stored under a different timestamp. These must be reconciled against the actual hosted migration history before any replay is attempted.

The next engineering work is to reconstruct and document:
- all 31 public tables, columns, defaults and nullability
- primary, foreign, unique and check constraints
- indexes
- all RLS policies
- functions, security modes and grants
- triggers and trigger functions
- schema/table/function privileges and required extensions

The baseline will be committed only after its DDL is complete and internally reviewed. A baseline assembled from partial catalog output must not be treated as a restore package.

## Testing boundary

True isolated replay and authenticated cross-tenant tests require a separate database environment. They cannot be truthfully performed against production, and read-only catalog inspection is not a substitute for those tests.

When a genuinely separate test environment becomes available within the agreed no-cost constraints, use synthetic identities only:
- Tenant A owner and Tenant B owner
- branch-scoped staff in separate branches
- a user with no tenant membership

Test tenant and branch SELECT/INSERT/UPDATE/DELETE isolation, module entitlements, role restrictions, lab independent verification, RPC authorization, appointment collision handling, stock depletion, and care-job transitions. Use normal authenticated user tokens for RLS assertions; service-role access bypasses RLS and is not valid evidence of user isolation.

Record each executed assertion as PASS/FAIL with the request and response. Never label an unexecuted test as passed.

## Safety

- Never put service-role keys, database passwords, access tokens, auth exports or patient data in Git.
- Never reset, delete, migrate, seed, or otherwise mutate the hosted production database during this preparation phase.
- Do not create a paid branch or ask the user to install Docker, Supabase CLI, or other local tooling.
- Production-readiness review and any production deployment are separate later approval steps.
