-- Make workspace-level settings truly unique when branch_id is NULL (PostgreSQL 15+).
create unique index if not exists pharmacy_settings_scope_key_uniq on public.pharmacy_settings (tenant_id, branch_id, setting_key) nulls not distinct;
