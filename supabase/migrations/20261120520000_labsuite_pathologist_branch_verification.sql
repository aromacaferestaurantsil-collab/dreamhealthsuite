-- LabSuite: scope result verification to the booking branch and require a pathologist.
create or replace function public.lab_verify_result(p_result_id uuid,p_release boolean default false)
returns void
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
 r public.lab_results%rowtype;
 v_branch_id uuid;
 v_user uuid:=auth.uid();
begin
 if v_user is null then raise exception 'Authentication required'; end if;

 select lr.* into r
 from public.lab_results lr
 where lr.id=p_result_id
 for update;
 if not found then raise exception 'Result not found'; end if;

 select lb.branch_id into v_branch_id
 from public.lab_booking_items li
 join public.lab_bookings lb on lb.id=li.booking_id and lb.tenant_id=li.tenant_id
 where li.id=r.booking_item_id and li.tenant_id=r.tenant_id;
 if not found or v_branch_id is null then raise exception 'Result booking branch not found'; end if;

 if not private.has_module_access(r.tenant_id,'laboratory_suite',v_branch_id,true) then
  raise exception 'No laboratory permission for this branch';
 end if;
 if not exists(
  select 1 from public.tenant_memberships m
  where m.tenant_id=r.tenant_id and m.user_id=v_user
   and m.status='active' and m.role='pathologist'
   and (m.branch_id is null or m.branch_id=v_branch_id)
 ) then raise exception 'Only an assigned pathologist can verify or release results'; end if;

 if p_release then
  if r.result_status<>'verified' then raise exception 'Result must be independently verified before release'; end if;
  if r.verified_by is null or r.entered_by=r.verified_by then
   raise exception 'Independent verification is required before release';
  end if;
  update public.lab_results set result_status='released',released_at=now(),updated_at=now()
   where id=p_result_id;
 else
  if r.result_status<>'entered' then raise exception 'Only an entered result can be verified'; end if;
  if r.entered_by=v_user then raise exception 'Result author cannot verify their own result'; end if;
  update public.lab_results set result_status='verified',verified_by=v_user,verified_at=now(),updated_at=now()
   where id=p_result_id;
 end if;

 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id,metadata)
 values(r.tenant_id,v_branch_id,v_user,
  case when p_release then 'lab.result_released' else 'lab.result_verified' end,
  'lab_result',p_result_id::text,jsonb_build_object('result_status',case when p_release then 'released' else 'verified' end));
end;
$$;
revoke all on function public.lab_verify_result(uuid,boolean) from public,anon;
grant execute on function public.lab_verify_result(uuid,boolean) to authenticated;
