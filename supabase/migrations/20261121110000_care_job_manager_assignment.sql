-- Manager-controlled assignment and reassignment for Care Connect jobs.
create or replace function public.assign_care_job(
 p_job_id uuid,
 p_assignee_user_id uuid,
 p_notes text default null
) returns void
language plpgsql security invoker set search_path=pg_catalog,public,private
as $$
declare
 j public.care_jobs%rowtype;
 v_actor_role text;
 v_assignee_role text;
 v_assignee_branch uuid;
begin
 select * into j from public.care_jobs where id=p_job_id for update;
 if not found then raise exception 'Care job not found'; end if;
 if not private.has_module_access(j.tenant_id,'care_connect',j.branch_id,true) then
  raise exception 'No care module permission';
 end if;
 select role into v_actor_role
 from public.tenant_memberships
 where tenant_id=j.tenant_id and user_id=auth.uid() and status='active'
   and (branch_id is null or branch_id=j.branch_id);
 if v_actor_role not in ('owner','admin','manager') then
  raise exception 'Only tenant owner, admin or manager may assign care jobs';
 end if;
 select role,branch_id into v_assignee_role,v_assignee_branch
 from public.tenant_memberships
 where tenant_id=j.tenant_id and user_id=p_assignee_user_id and status='active';
 if v_assignee_role is distinct from 'care_worker' then
  raise exception 'Assignee must be an active care worker in this tenant';
 end if;
 if v_assignee_branch is not null and v_assignee_branch<>j.branch_id then
  raise exception 'Care worker is not assigned to this branch';
 end if;
 if j.job_status not in ('approved','assigned') then
  raise exception 'Only approved or currently assigned jobs can be assigned or reassigned';
 end if;
 update public.care_jobs set assigned_to=p_assignee_user_id,job_status='assigned'
 where id=p_job_id;
 insert into public.care_job_events(tenant_id,job_id,event_type,notes,actor_user_id)
 values(j.tenant_id,j.id,'assigned',coalesce(p_notes,'Care worker assignment'),auth.uid());
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id,metadata)
 values(j.tenant_id,j.branch_id,auth.uid(),'care.job_assigned','care_job',j.id::text,
  jsonb_build_object('assignee_user_id',p_assignee_user_id));
end $$;
revoke all on function public.assign_care_job(uuid,uuid,text) from public,anon;
grant execute on function public.assign_care_job(uuid,uuid,text) to authenticated;
