-- Restrict RPC execution and protect tenant ownership from admin membership edits.
revoke all on function private.has_module_access(uuid,text,uuid,boolean) from public, anon;
grant execute on function private.has_module_access(uuid,text,uuid,boolean) to authenticated;
revoke all on function private.create_tenant_with_owner(text,text,text,text,text) from public, anon;
grant execute on function private.create_tenant_with_owner(text,text,text,text,text) to authenticated;
revoke all on function public.pharmacy_checkout(uuid,uuid,text,jsonb,text,uuid,text) from public, anon;
grant execute on function public.pharmacy_checkout(uuid,uuid,text,jsonb,text,uuid,text) to authenticated;
revoke all on function public.lab_verify_result(uuid,boolean) from public, anon;
grant execute on function public.lab_verify_result(uuid,boolean) to authenticated;
revoke all on function public.create_doctor_appointment(uuid,uuid,uuid,uuid,text,timestamptz,timestamptz,text) from public, anon;
grant execute on function public.create_doctor_appointment(uuid,uuid,uuid,uuid,text,timestamptz,timestamptz,text) to authenticated;
revoke all on function public.transition_care_job(uuid,text,text,jsonb) from public, anon;
grant execute on function public.transition_care_job(uuid,text,text,jsonb) to authenticated;
revoke all on function public.manage_tenant_member(uuid,uuid,text,uuid,boolean) from public, anon;
grant execute on function public.manage_tenant_member(uuid,uuid,text,uuid,boolean) to authenticated;
revoke all on function public.set_module_entitlement(uuid,text,boolean) from public, anon;
grant execute on function public.set_module_entitlement(uuid,text,boolean) to authenticated;

create or replace function public.manage_tenant_member(
 p_tenant_id uuid,p_user_id uuid,p_role text,p_branch_id uuid default null,p_activate boolean default false
) returns uuid language plpgsql security invoker set search_path=pg_catalog,public,private
as $$
declare v_id uuid; v_actor_role text; v_target_role text;
begin
 select role into v_actor_role from public.tenant_memberships
 where tenant_id=p_tenant_id and user_id=auth.uid() and status='active';
 if v_actor_role not in ('owner','admin') then raise exception 'Only tenant owner/admin can manage memberships'; end if;
 if p_role not in ('admin','manager','doctor','pharmacist','lab_technician','pathologist','care_worker','receptionist','analyst','staff') then raise exception 'Invalid or privileged role'; end if;
 if v_actor_role='admin' and p_role='admin' then raise exception 'Only the tenant owner can appoint another admin'; end if;
 select role into v_target_role from public.tenant_memberships where tenant_id=p_tenant_id and user_id=p_user_id for update;
 if v_target_role='owner' then raise exception 'The tenant owner membership cannot be changed here'; end if;
 if p_branch_id is not null and not exists(select 1 from public.branches b where b.id=p_branch_id and b.tenant_id=p_tenant_id) then raise exception 'Branch does not belong to tenant'; end if;
 insert into public.tenant_memberships(tenant_id,user_id,branch_id,role,status,invited_by)
 values(p_tenant_id,p_user_id,p_branch_id,p_role,case when p_activate then 'active' else 'invited' end,auth.uid())
 on conflict(tenant_id,user_id) do update set branch_id=excluded.branch_id,role=excluded.role,status=excluded.status,invited_by=auth.uid(),updated_at=now()
 returning id into v_id;
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id,metadata)
 values(p_tenant_id,p_branch_id,auth.uid(),'tenant.member_managed','tenant_membership',v_id::text,jsonb_build_object('role',p_role,'status',case when p_activate then 'active' else 'invited' end));
 return v_id;
end $$;
revoke all on function public.manage_tenant_member(uuid,uuid,text,uuid,boolean) from public,anon;
grant execute on function public.manage_tenant_member(uuid,uuid,text,uuid,boolean) to authenticated;

-- Lab results may only be verified/released through the controlled workflow RPC.
drop policy if exists module_update on public.lab_results;
drop policy if exists module_delete on public.lab_results;
create or replace function public.lab_verify_result(p_result_id uuid,p_release boolean default false)
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
revoke all on function public.lab_verify_result(uuid,boolean) from public,anon;
grant execute on function public.lab_verify_result(uuid,boolean) to authenticated;
