-- HealthSuite 360: membership-checked, read-only entitlement lookup.
-- Existing private.has_module_access remains the transaction authorization boundary.
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
