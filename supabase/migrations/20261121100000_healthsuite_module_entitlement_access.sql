-- HealthSuite 360 module entitlement compatibility and membership-checked read API.
-- Existing module keys are preserved; this migration does not grant any access.
create or replace function private.has_module_access(
 p_tenant_id uuid,p_module_key text,p_branch_id uuid default null,p_require_membership boolean default true
) returns boolean
language plpgsql stable security definer set search_path=pg_catalog,public,private
as $$
declare v_user uuid:=auth.uid(); v_membership boolean:=false;
begin
 if v_user is null then return false; end if;
 if p_require_membership then
  select exists(select 1 from public.tenant_memberships m
   where m.tenant_id=p_tenant_id and m.user_id=v_user and m.status='active'
   and (p_branch_id is null or m.branch_id is null or m.branch_id=p_branch_id))
  into v_membership;
  if not v_membership then return false; end if;
 end if;
 return exists(select 1 from public.tenant_module_entitlements e
  where e.tenant_id=p_tenant_id and e.enabled=true
   and e.module_key in (p_module_key,
    case p_module_key
     when 'pharmacy_suite' then 'pharmacy'
     when 'lab_suite' then 'lab'
     when 'doctor_suite' then 'doctor'
     when 'patient_suite' then 'patient'
     when 'care_connect' then 'care'
     when 'health_analytics' then 'analytics'
     else p_module_key end));
end $$;
revoke all on function private.has_module_access(uuid,text,uuid,boolean) from public,anon;
grant execute on function private.has_module_access(uuid,text,uuid,boolean) to authenticated;

create or replace function public.get_my_module_entitlements(p_tenant_id uuid)
returns table(module_key text,enabled boolean)
language plpgsql stable security invoker set search_path=pg_catalog,public
as $$
begin
 if not exists(select 1 from public.tenant_memberships m
   where m.tenant_id=p_tenant_id and m.user_id=auth.uid() and m.status='active') then
  raise exception 'Active membership required';
 end if;
 return query select e.module_key,e.enabled
  from public.tenant_module_entitlements e where e.tenant_id=p_tenant_id order by e.module_key;
end $$;
revoke all on function public.get_my_module_entitlements(uuid) from public,anon;
grant execute on function public.get_my_module_entitlements(uuid) to authenticated;
