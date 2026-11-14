
create or replace function private.has_module_access(p_tenant uuid,p_module text,p_branch uuid default null,p_write boolean default false)
returns boolean language sql stable security invoker set search_path=pg_catalog
as $$
 select exists(
  select 1 from public.tenant_memberships m
  join public.tenant_module_entitlements e on e.tenant_id=m.tenant_id and e.module_key=p_module and e.enabled
  where m.tenant_id=p_tenant and m.user_id=(select auth.uid()) and m.status='active'
  and (p_branch is null or m.branch_id is null or m.branch_id=p_branch)
  and (not p_write or
    m.role in ('owner','admin','manager') or
    (p_module='patient_suite' and m.role in ('doctor','receptionist')) or
    (p_module='pharmacy_suite' and m.role='pharmacist') or
    (p_module='laboratory_suite' and m.role in ('lab_technician','pathologist')) or
    (p_module='doctor_suite' and m.role='doctor') or
    (p_module='care_connect' and m.role='care_worker') or
    (p_module='analytics' and m.role='analyst')
  )
 )
$$;
grant execute on function private.has_module_access(uuid,text,uuid,boolean) to authenticated;
