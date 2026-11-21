drop policy if exists pharmacy_backup_jobs_read on public.pharmacy_backup_jobs;
create policy pharmacy_backup_jobs_read on public.pharmacy_backup_jobs
for select to authenticated
using (
 private.has_module_access(tenant_id,'pharmacy_suite',null,true)
 and exists(select 1 from public.tenant_memberships m
  where m.tenant_id=pharmacy_backup_jobs.tenant_id
   and m.user_id=auth.uid() and m.status='active' and m.role in ('owner','admin'))
);
drop policy if exists pharmacy_backup_jobs_write on public.pharmacy_backup_jobs;
create policy pharmacy_backup_jobs_write on public.pharmacy_backup_jobs
for insert to authenticated
with check (
 requested_by=auth.uid()
 and private.has_module_access(tenant_id,'pharmacy_suite',null,true)
 and exists(select 1 from public.tenant_memberships m
  where m.tenant_id=pharmacy_backup_jobs.tenant_id
   and m.user_id=auth.uid() and m.status='active' and m.role in ('owner','admin'))
);
