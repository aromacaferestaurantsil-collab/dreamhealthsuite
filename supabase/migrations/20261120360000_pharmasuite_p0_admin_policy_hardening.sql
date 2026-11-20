-- Restrict configuration and backup administration to tenant owners/admins.
drop policy if exists pharmacy_settings_write on public.pharmacy_settings;
create policy pharmacy_settings_write on public.pharmacy_settings for all to authenticated
 using (
  private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true)
  and exists(select 1 from public.tenant_memberships m where m.tenant_id=pharmacy_settings.tenant_id and m.user_id=auth.uid() and m.status='active' and m.role in ('owner','admin'))
 )
 with check (
  private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true)
  and exists(select 1 from public.tenant_memberships m where m.tenant_id=pharmacy_settings.tenant_id and m.user_id=auth.uid() and m.status='active' and m.role in ('owner','admin'))
 );
drop policy if exists pharmacy_role_permissions_write on public.pharmacy_role_permissions;
create policy pharmacy_role_permissions_write on public.pharmacy_role_permissions for all to authenticated
 using (
  private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true)
  and exists(select 1 from public.tenant_memberships m where m.tenant_id=pharmacy_role_permissions.tenant_id and m.user_id=auth.uid() and m.status='active' and m.role in ('owner','admin'))
 )
 with check (
  private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true)
  and exists(select 1 from public.tenant_memberships m where m.tenant_id=pharmacy_role_permissions.tenant_id and m.user_id=auth.uid() and m.status='active' and m.role in ('owner','admin'))
 );
drop policy if exists pharmacy_backup_jobs_write on public.pharmacy_backup_jobs;
create policy pharmacy_backup_jobs_write on public.pharmacy_backup_jobs for insert to authenticated
 with check (
  private.has_module_access(tenant_id,'pharmacy_suite',null,true)
  and exists(select 1 from public.tenant_memberships m where m.tenant_id=pharmacy_backup_jobs.tenant_id and m.user_id=auth.uid() and m.status='active' and m.role in ('owner','admin'))
 );
