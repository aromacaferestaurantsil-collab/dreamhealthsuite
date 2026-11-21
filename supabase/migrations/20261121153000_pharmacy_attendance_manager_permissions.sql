drop policy if exists employee_attendance_delete on public.employee_attendance;
create policy employee_attendance_delete on public.employee_attendance
for delete to authenticated
using (
 private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true)
 and exists(select 1 from public.tenant_memberships m where m.tenant_id=employee_attendance.tenant_id
  and m.user_id=auth.uid() and m.status='active' and m.role in ('owner','admin','manager'))
);
drop policy if exists employee_attendance_insert on public.employee_attendance;
create policy employee_attendance_insert on public.employee_attendance
for insert to authenticated
with check (
 private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true)
 and exists(select 1 from public.tenant_memberships m where m.tenant_id=employee_attendance.tenant_id
  and m.user_id=auth.uid() and m.status='active' and m.role in ('owner','admin','manager'))
);
drop policy if exists employee_attendance_update on public.employee_attendance;
create policy employee_attendance_update on public.employee_attendance
for update to authenticated
using (
 private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true)
 and exists(select 1 from public.tenant_memberships m where m.tenant_id=employee_attendance.tenant_id
  and m.user_id=auth.uid() and m.status='active' and m.role in ('owner','admin','manager'))
)
with check (
 private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true)
 and exists(select 1 from public.tenant_memberships m where m.tenant_id=employee_attendance.tenant_id
  and m.user_id=auth.uid() and m.status='active' and m.role in ('owner','admin','manager'))
);
