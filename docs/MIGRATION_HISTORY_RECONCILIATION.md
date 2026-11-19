# Migration history reconciliation

## Live database migration ledger (read-only inspection, 2026-11-20)

The connected Supabase project's `supabase_migrations.schema_migrations` ledger reports these applied versions:

| Applied version | Applied migration name | Repository file |
|---|---|---|
| 20261114212450 | transactional_module_workflows | Present |
| 20261114212504 | tenant_admin_audit_controls | Present |
| 20261114212509 | lab_pathologist_role_access | Present |
| 20261114213109 | restrict_rpc_access_and_protect_tenant_owner | **Missing** |
| 20261114213141 | harden_rpc_and_lab_result_workflow | Present |
| 20261114213435 | expose_authenticated_tenant_bootstrap_rpc | Present after filename correction |

The tenant bootstrap SQL had been stored as `20261115110000_expose_authenticated_tenant_bootstrap_rpc.sql`, although the database ledger records version `20261114213435`. The file was renamed to match the authoritative applied version. Do not retain both names: Supabase migration versions must be unique and must match the database ledger.

## Missing migration source: 20261114213109

The live ledger confirms this migration was applied, but its original SQL file is not present in the repository and no copy was found in repository history. Its name indicates RPC privilege restrictions and protection of tenant ownership. Later migration `20261114213141_harden_rpc_and_lab_result_workflow.sql` repeats several privilege revocations and contains the hardened tenant-member and lab-result workflows, but that is not proof of the exact earlier SQL.

**Do not invent a replacement migration under the already-applied version.** Doing so could make fresh database replay diverge from the live project. The exact original SQL must be recovered from the original deployment artifact, backup, or migration author. Until then, a full clean-room replay from the repository is blocked.

## New migration files in this branch

The following are branch-only proposals and have not been applied to the live project:

- `20261120120000_pharmasuite_purchase_stock_returns_pos.sql`
- `20261120150000_standalone_software_releases.sql`
- `20261120170000_platform_licensing_release_control_plane.sql`
- `20261120171000_platform_audit_and_atomic_license_activation.sql`

They must be replayed and validated on an isolated development database after the missing baseline migration is recovered. Do not mark these versions as applied manually and do not run them on production as a shortcut.

## Data handling and environment safety

- The tracked `.env` file is intentionally deleted. Keep it deleted; the master-branch change to that file was resolved in favour of secret removal.
- No production data was copied, seeded, reset, or migrated during this audit.
- The live database ledger was queried read-only. The live database contains six applied migrations; that fact is not evidence that the repository can currently recreate the database.
- The custom domain remains deferred. No DNS, Pages domain, CNAME, or production deployment work is part of this migration tranche.
