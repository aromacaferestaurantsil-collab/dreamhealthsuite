-- Keep the privileged lab transition implementation outside the exposed API schema.
create or replace function private.lab_verify_result_impl(p_result_id uuid,p_release boolean default false)
returns void language plpgsql security definer set search_path=pg_catalog,public,private
as $$
declare r public.lab_results%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into r from public.lab_results where id=p_result_id for update;
 if not found then raise exception 'Result not found'; end if;
 if not private.has_module_access(r.tenant_id,'laboratory_suite',null,true) then raise exception 'No laboratory permission'; end if;
 if r.result_status not in ('entered','verified') then raise exception 'Only entered or verified results may be verified/released'; end if;
 if p_release then
  if r.result_status<>'verified' then raise exception 'Result must be verified before release'; end if;
  if r.entered_by=r.verified_by or r.verified_by is null then raise exception 'Independent verification is required before release'; end if;
  update public.lab_results set result_status='released',released_at=now(),updated_at=now() where id=p_result_id;
 else
  if r.entered_by=auth.uid() then raise exception 'Result author cannot verify their own result'; end if;
  update public.lab_results set result_status='verified',verified_by=auth.uid(),verified_at=now(),updated_at=now() where id=p_result_id;
 end if;
 insert into public.audit_events(tenant_id,actor_user_id,action,entity_type,entity_id)
 values(r.tenant_id,auth.uid(),case when p_release then 'lab.result_released' else 'lab.result_verified' end,'lab_result',p_result_id::text);
end $$;

create or replace function public.lab_verify_result(p_result_id uuid,p_release boolean default false)
returns void language plpgsql security invoker set search_path=pg_catalog,public,private
as $$ begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 perform private.lab_verify_result_impl(p_result_id,p_release);
end $$;
revoke execute on function private.lab_verify_result_impl(uuid,boolean) from public,anon;
grant execute on function private.lab_verify_result_impl(uuid,boolean) to authenticated;
revoke execute on function public.lab_verify_result(uuid,boolean) from public,anon;
grant execute on function public.lab_verify_result(uuid,boolean) to authenticated;
