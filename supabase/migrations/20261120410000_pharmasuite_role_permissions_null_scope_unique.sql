-- Ensure workspace-level role permission overrides are unique when branch_id is NULL.
create unique index if not exists pharmacy_role_permissions_scope_key_uniq on public.pharmacy_role_permissions (tenant_id, role_key, permission_key, branch_id) nulls not distinct;
