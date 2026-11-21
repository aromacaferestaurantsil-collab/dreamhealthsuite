-- LabSuite operational controls: branch-scoped sample/result access and audited write RPCs.
create unique index if not exists lab_results_tenant_booking_item_uidx
 on public.lab_results(tenant_id,booking_item_id);

-- Booking items inherit their branch from the parent booking.
drop policy if exists module_read on public.lab_booking_items;
drop policy if exists module_insert on public.lab_booking_items;
drop policy if exists module_update on public.lab_booking_items;
drop policy if exists module_delete on public.lab_booking_items;
create policy lab_booking_items_branch_read on public.lab_booking_items for select to authenticated
 using(exists(
  select 1 from public.lab_bookings b
  where b.id=lab_booking_items.booking_id and b.tenant_id=lab_booking_items.tenant_id
   and private.has_module_access(lab_booking_items.tenant_id,'laboratory_suite',b.branch_id,false)
 ));
create policy lab_booking_items_branch_insert on public.lab_booking_items for insert to authenticated
 with check(exists(
  select 1 from public.lab_bookings b
  where b.id=lab_booking_items.booking_id and b.tenant_id=lab_booking_items.tenant_id
   and private.has_module_access(lab_booking_items.tenant_id,'laboratory_suite',b.branch_id,true)
 ));
create policy lab_booking_items_branch_update on public.lab_booking_items for update to authenticated
 using(exists(
  select 1 from public.lab_bookings b
  where b.id=lab_booking_items.booking_id and b.tenant_id=lab_booking_items.tenant_id
   and private.has_module_access(lab_booking_items.tenant_id,'laboratory_suite',b.branch_id,true)
 ))
 with check(exists(
  select 1 from public.lab_bookings b
  where b.id=lab_booking_items.booking_id and b.tenant_id=lab_booking_items.tenant_id
   and private.has_module_access(lab_booking_items.tenant_id,'laboratory_suite',b.branch_id,true)
 ));
create policy lab_booking_items_branch_delete on public.lab_booking_items for delete to authenticated
 using(exists(
  select 1 from public.lab_bookings b
  where b.id=lab_booking_items.booking_id and b.tenant_id=lab_booking_items.tenant_id
   and private.has_module_access(lab_booking_items.tenant_id,'laboratory_suite',b.branch_id,true)
 ));

-- Samples inherit branch access from their booking item.
drop policy if exists module_read on public.lab_samples;
drop policy if exists module_insert on public.lab_samples;
drop policy if exists module_update on public.lab_samples;
drop policy if exists module_delete on public.lab_samples;
create policy lab_samples_branch_read on public.lab_samples for select to authenticated
 using(exists(
  select 1 from public.lab_booking_items li
  join public.lab_bookings b on b.id=li.booking_id and b.tenant_id=li.tenant_id
  where li.id=lab_samples.booking_item_id and li.tenant_id=lab_samples.tenant_id
   and private.has_module_access(lab_samples.tenant_id,'laboratory_suite',b.branch_id,false)
 ));
revoke insert,update,delete on public.lab_samples from authenticated;

-- Result rows are read by branch and written only through audited RPCs.
drop policy if exists module_read on public.lab_results;
drop policy if exists module_insert on public.lab_results;
drop policy if exists module_delete on public.lab_results;
create policy lab_results_branch_read on public.lab_results for select to authenticated
 using(exists(
  select 1 from public.lab_booking_items li
  join public.lab_bookings b on b.id=li.booking_id and b.tenant_id=li.tenant_id
  where li.id=lab_results.booking_item_id and li.tenant_id=lab_results.tenant_id
   and private.has_module_access(lab_results.tenant_id,'laboratory_suite',b.branch_id,false)
 ));
revoke insert,update,delete on public.lab_results from authenticated;

create or replace function private.lab_create_sample_impl(
 p_tenant_id uuid,p_booking_item_id uuid,p_sample_code text,p_specimen_type text
) returns uuid
language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare v_user uuid:=auth.uid(); v_branch uuid; v_id uuid;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 select b.branch_id into v_branch
 from public.lab_booking_items li
 join public.lab_bookings b on b.id=li.booking_id and b.tenant_id=li.tenant_id
 where li.id=p_booking_item_id and li.tenant_id=p_tenant_id
 for update of li;
 if not found then raise exception 'Booking item not found'; end if;
 if not private.has_module_access(p_tenant_id,'laboratory_suite',v_branch,true)
  or not exists(select 1 from public.tenant_memberships m where m.tenant_id=p_tenant_id
   and m.user_id=v_user and m.status='active' and m.role in ('lab_technician','pathologist')
   and (m.branch_id is null or m.branch_id=v_branch)) then
  raise exception 'Lab technician or pathologist access required for this branch';
 end if;
 if nullif(btrim(p_sample_code),'') is null or nullif(btrim(p_specimen_type),'') is null then
  raise exception 'Sample code and specimen type are required';
 end if;
 insert into public.lab_samples(tenant_id,booking_item_id,sample_code,specimen_type,sample_status)
 values(p_tenant_id,p_booking_item_id,btrim(p_sample_code),btrim(p_specimen_type),'pending')
 returning id into v_id;
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id,metadata)
 values(p_tenant_id,v_branch,v_user,'lab.sample_registered','lab_sample',v_id::text,
  jsonb_build_object('booking_item_id',p_booking_item_id,'sample_code',p_sample_code));
 return v_id;
end;
$$;

create or replace function private.lab_update_sample_status_impl(
 p_tenant_id uuid,p_sample_id uuid,p_new_status text,p_rejection_reason text default null
) returns void
language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare v_user uuid:=auth.uid(); v_sample public.lab_samples%rowtype; v_branch uuid;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 select * into v_sample from public.lab_samples
  where id=p_sample_id and tenant_id=p_tenant_id for update;
 if not found then raise exception 'Sample not found'; end if;
 select b.branch_id into v_branch
 from public.lab_booking_items li
 join public.lab_bookings b on b.id=li.booking_id and b.tenant_id=li.tenant_id
 where li.id=v_sample.booking_item_id and li.tenant_id=p_tenant_id;
 if not found then raise exception 'Sample booking branch not found'; end if;
 if not private.has_module_access(p_tenant_id,'laboratory_suite',v_branch,true)
  or not exists(select 1 from public.tenant_memberships m where m.tenant_id=p_tenant_id
   and m.user_id=v_user and m.status='active' and m.role in ('lab_technician','pathologist')
   and (m.branch_id is null or m.branch_id=v_branch)) then
  raise exception 'Lab technician or pathologist access required for this branch';
 end if;
 if not (
  (v_sample.sample_status='pending' and p_new_status in ('collected','rejected')) or
  (v_sample.sample_status='collected' and p_new_status in ('received','rejected')) or
  (v_sample.sample_status='received' and p_new_status in ('processed','rejected'))
 ) then raise exception 'Invalid sample status transition'; end if;
 if p_new_status='rejected' and length(btrim(coalesce(p_rejection_reason,'')))<3 then
  raise exception 'A rejection reason is required';
 end if;
 update public.lab_samples set
  sample_status=p_new_status,
  collected_at=case when p_new_status='collected' then now() else collected_at end,
  collected_by=case when p_new_status='collected' then v_user else collected_by end,
  received_at=case when p_new_status='received' then now() else received_at end,
  rejection_reason=case when p_new_status='rejected' then btrim(p_rejection_reason) else rejection_reason end
 where id=p_sample_id;
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id,metadata)
 values(p_tenant_id,v_branch,v_user,'lab.sample_status_changed','lab_sample',p_sample_id::text,
  jsonb_build_object('from',v_sample.sample_status,'to',p_new_status,'reason',p_rejection_reason));
end;
$$;

create or replace function private.lab_enter_result_impl(
 p_tenant_id uuid,p_booking_item_id uuid,p_result_text text,p_result_data jsonb default '{}'::jsonb,p_abnormal_flag boolean default false
) returns uuid
language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare v_user uuid:=auth.uid(); v_branch uuid; v_id uuid;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 select b.branch_id into v_branch
 from public.lab_booking_items li
 join public.lab_bookings b on b.id=li.booking_id and b.tenant_id=li.tenant_id
 where li.id=p_booking_item_id and li.tenant_id=p_tenant_id
 for update of li;
 if not found then raise exception 'Booking item not found'; end if;
 if not private.has_module_access(p_tenant_id,'laboratory_suite',v_branch,true)
  or not exists(select 1 from public.tenant_memberships m where m.tenant_id=p_tenant_id
   and m.user_id=v_user and m.status='active' and m.role in ('lab_technician','pathologist')
   and (m.branch_id is null or m.branch_id=v_branch)) then
  raise exception 'Lab technician or pathologist access required for this branch';
 end if;
 if length(btrim(coalesce(p_result_text,'')))=0 and coalesce(p_result_data,'{}'::jsonb)='{}'::jsonb then
  raise exception 'Enter a result value before saving';
 end if;
 if not exists(select 1 from public.lab_samples s where s.tenant_id=p_tenant_id
  and s.booking_item_id=p_booking_item_id and s.sample_status='processed') then
  raise exception 'A processed sample is required before entering a result';
 end if;
 insert into public.lab_results(tenant_id,booking_item_id,result_data,result_text,abnormal_flag,result_status,entered_by)
 values(p_tenant_id,p_booking_item_id,coalesce(p_result_data,'{}'::jsonb),nullif(btrim(p_result_text),''),coalesce(p_abnormal_flag,false),'entered',v_user)
 returning id into v_id;
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id,metadata)
 values(p_tenant_id,v_branch,v_user,'lab.result_entered','lab_result',v_id::text,
  jsonb_build_object('booking_item_id',p_booking_item_id,'abnormal_flag',coalesce(p_abnormal_flag,false)));
 return v_id;
end;
$$;

create or replace function public.lab_create_sample(p_tenant_id uuid,p_booking_item_id uuid,p_sample_code text,p_specimen_type text)
returns uuid language sql security invoker set search_path=pg_catalog,public,private
as $$ select private.lab_create_sample_impl(p_tenant_id,p_booking_item_id,p_sample_code,p_specimen_type) $$;
create or replace function public.lab_update_sample_status(p_tenant_id uuid,p_sample_id uuid,p_new_status text,p_rejection_reason text default null)
returns void language sql security invoker set search_path=pg_catalog,public,private
as $$ select private.lab_update_sample_status_impl(p_tenant_id,p_sample_id,p_new_status,p_rejection_reason) $$;
create or replace function public.lab_enter_result(p_tenant_id uuid,p_booking_item_id uuid,p_result_text text,p_result_data jsonb default '{}'::jsonb,p_abnormal_flag boolean default false)
returns uuid language sql security invoker set search_path=pg_catalog,public,private
as $$ select private.lab_enter_result_impl(p_tenant_id,p_booking_item_id,p_result_text,p_result_data,p_abnormal_flag) $$;

revoke all on function private.lab_create_sample_impl(uuid,uuid,text,text) from public,anon;
revoke all on function private.lab_update_sample_status_impl(uuid,uuid,text,text) from public,anon;
revoke all on function private.lab_enter_result_impl(uuid,uuid,text,jsonb,boolean) from public,anon;
grant execute on function private.lab_create_sample_impl(uuid,uuid,text,text) to authenticated;
grant execute on function private.lab_update_sample_status_impl(uuid,uuid,text,text) to authenticated;
grant execute on function private.lab_enter_result_impl(uuid,uuid,text,jsonb,boolean) to authenticated;

revoke all on function public.lab_create_sample(uuid,uuid,text,text) from public,anon;
revoke all on function public.lab_update_sample_status(uuid,uuid,text,text) from public,anon;
revoke all on function public.lab_enter_result(uuid,uuid,text,jsonb,boolean) from public,anon;
grant execute on function public.lab_create_sample(uuid,uuid,text,text) to authenticated;
grant execute on function public.lab_update_sample_status(uuid,uuid,text,text) to authenticated;
grant execute on function public.lab_enter_result(uuid,uuid,text,jsonb,boolean) to authenticated;
