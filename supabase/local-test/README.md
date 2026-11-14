# Local isolated database testing (free)

This workflow does not create a Supabase cloud branch and does not modify the live project.

## Prerequisites
- Docker Desktop installed and running.
- Node.js LTS and npm.
- Supabase CLI (recommended through the official installation instructions).
- Git access to this repository.

## Start an isolated local Supabase stack
From the repository root:

```bash
npx supabase init
npx supabase start
npx supabase status
```

If `supabase/config.toml` already exists, do not run init again. Keep the local stack separate from the hosted project. Do not run `supabase db push`, `supabase link`, `supabase db reset` against the production project.

## Schema reconstruction and replay
The hosted database was created before a complete baseline migration was committed. The migration history currently contains the six later migrations only. Therefore:
1. Run `supabase/local-test/catalog-inventory.sql` read-only in the hosted SQL editor and save its JSON result outside the repository.
2. Reconstruct a baseline migration from the inventory, including tables, constraints, indexes, policies, functions, triggers, grants, extensions and default privileges.
3. Apply the baseline only to the local stack.
4. Replay the six tracked migrations in timestamp order.
5. Compare local catalog inventory with the hosted inventory. Resolve differences before declaring parity.

Do not copy production rows or auth users into local. Use synthetic fixtures only.

## Authenticated isolation tests
Use two synthetic tenant owners, two branch-scoped staff users in separate branches, and one user with no membership. Create them through the local Supabase Auth API (never use real patient identities). Obtain normal user access tokens and exercise PostgREST using the `authenticated` role. Do not use the service-role key for authorization assertions: it bypasses RLS.

Required assertions:
- Tenant A cannot SELECT, INSERT, UPDATE or DELETE Tenant B rows.
- Branch A staff cannot read or mutate Branch B rows within the same tenant.
- A tenant-wide owner can access only their own tenant.
- A user with no membership sees no tenant data and cannot create operational records.
- Disabled module entitlement denies access even to an otherwise active member.
- Role restrictions deny writes to unauthorized roles.
- Lab result author cannot verify their own result; authorized independent pathologist can verify/release.
- RPCs reject missing/invalid tenant, branch, role and status transitions.

Record each assertion as PASS/FAIL with the SQL/API request and response. Do not claim a test passed unless it ran against a live authenticated session.

## Safety
- Never place service-role keys, database passwords, access tokens or patient data in Git.
- Keep `.env.local` ignored and use synthetic test data.
- Do not drop/reset or migrate the hosted production database during this exercise.
- The existing project has no application rows at the last recorded inspection, but that is not permission to reset it.
