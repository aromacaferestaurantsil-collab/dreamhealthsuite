do $$
declare p record; v_qual text;
begin
 for p in
  select schemaname,tablename,policyname,qual
  from pg_policies
  where schemaname='public'
   and (tablename like 'pharmacy_%' or tablename in ('medicine_catalogue','medicine_batches','employee_attendance'))
   and policyname not in ('pharmacy_settings_read','pharmacy_role_permissions_read','employee_attendance_read')
   and cmd='SELECT'
   and coalesce(qual,'') ilike '%private.has_module_access%'
   and coalesce(qual,'') ilike '%false%'
 loop
  v_qual:=replace(p.qual,', false)',', true)');
  execute format('alter policy %I on %I.%I using (%s)',p.policyname,p.schemaname,p.tablename,v_qual);
 end loop;
end $$;

drop policy if exists pharmacy_settings_read on public.pharmacy_settings;
create policy pharmacy_settings_read on public.pharmacy_settings
for select to authenticated
using (
 private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true)
 and exists(select 1 from public.tenant_memberships m
  where m.tenant_id=pharmacy_settings.tenant_id and m.user_id=auth.uid()
   and m.status='active' and m.role in ('owner','admin','manager'))
);

drop policy if exists pharmacy_role_permissions_read on public.pharmacy_role_permissions;
create policy pharmacy_role_permissions_read on public.pharmacy_role_permissions
for select to authenticated
using (
 private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true)
 and exists(select 1 from public.tenant_memberships m
  where m.tenant_id=pharmacy_role_permissions.tenant_id and m.user_id=auth.uid()
   and m.status='active' and m.role in ('owner','admin'))
);

drop policy if exists employee_attendance_read on public.employee_attendance;
create policy employee_attendance_read on public.employee_attendance
for select to authenticated
using (
 private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true)
 and exists(select 1 from public.tenant_memberships m
  where m.tenant_id=employee_attendance.tenant_id and m.user_id=auth.uid()
   and m.status='active' and m.role in ('owner','admin','manager'))
);
