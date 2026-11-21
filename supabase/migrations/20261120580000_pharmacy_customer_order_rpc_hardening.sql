-- Customer order writes must go through audited transactional RPCs.
drop policy if exists customer_orders_insert on public.pharmacy_customer_orders;
drop policy if exists customer_orders_patient_insert on public.pharmacy_customer_orders;
drop policy if exists customer_orders_update on public.pharmacy_customer_orders;
drop policy if exists customer_orders_delete on public.pharmacy_customer_orders;
drop policy if exists customer_order_items_insert on public.pharmacy_customer_order_items;
drop policy if exists customer_order_items_patient_insert on public.pharmacy_customer_order_items;
drop policy if exists customer_order_items_update on public.pharmacy_customer_order_items;
drop policy if exists customer_order_items_delete on public.pharmacy_customer_order_items;
drop policy if exists prescription_reviews_insert on public.pharmacy_prescription_reviews;
drop policy if exists prescription_reviews_update on public.pharmacy_prescription_reviews;
drop policy if exists prescription_reviews_delete on public.pharmacy_prescription_reviews;
drop policy if exists p1_order_events_write on public.pharmacy_customer_order_events;

revoke insert,update,delete on public.pharmacy_customer_orders from authenticated;
revoke insert,update,delete on public.pharmacy_customer_order_items from authenticated;
revoke insert,update,delete on public.pharmacy_prescription_reviews from authenticated;
revoke insert,update,delete on public.pharmacy_customer_order_events from authenticated;
grant select on public.pharmacy_customer_orders,public.pharmacy_customer_order_items,
 public.pharmacy_prescription_reviews,public.pharmacy_customer_order_events to authenticated;

-- Patient order items and reviews inherit branch visibility from their parent order.
drop policy if exists customer_order_items_read on public.pharmacy_customer_order_items;
create policy customer_order_items_read on public.pharmacy_customer_order_items for select to authenticated
 using(
  exists(select 1 from public.pharmacy_customer_orders o
   where o.id=pharmacy_customer_order_items.order_id and o.tenant_id=pharmacy_customer_order_items.tenant_id
    and private.has_module_access(o.tenant_id,'pharmacy_suite',o.branch_id,false))
  or exists(select 1 from public.pharmacy_customer_orders o join public.patients p
   on p.tenant_id=o.tenant_id and p.id=o.patient_id
   where o.id=pharmacy_customer_order_items.order_id and o.tenant_id=pharmacy_customer_order_items.tenant_id
    and p.created_by=(select auth.uid()))
 );
drop policy if exists prescription_reviews_read on public.pharmacy_prescription_reviews;
create policy prescription_reviews_read on public.pharmacy_prescription_reviews for select to authenticated
 using(exists(select 1 from public.pharmacy_customer_orders o
  where o.id=pharmacy_prescription_reviews.order_id and o.tenant_id=pharmacy_prescription_reviews.tenant_id
   and private.has_module_access(o.tenant_id,'pharmacy_suite',o.branch_id,false)));

create or replace function private.pharmacy_submit_customer_order_impl(
 p_tenant_id uuid,p_branch_id uuid,p_order_number text,p_items jsonb,
 p_prescription_path text default null,p_notes text default null
) returns uuid
language plpgsql security definer
set search_path=pg_catalog,public,private,storage
as $$
declare
 p public.patients%rowtype; v_id uuid; v_item jsonb; v_med uuid; v_name text;
 v_qty numeric; v_requires_rx boolean:=false; v_status text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into p from public.patients
  where tenant_id=p_tenant_id and created_by=auth.uid() and status='active'
  order by created_at desc limit 1;
 if not found then raise exception 'No patient profile is linked to this account'; end if;
 if not exists(select 1 from public.branches where tenant_id=p_tenant_id and id=p_branch_id and status='active') then
  raise exception 'Branch not found';
 end if;
 if nullif(btrim(p_order_number),'') is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then
  raise exception 'Order number and items are required';
 end if;
 if length(coalesce(p_notes,''))>1000 then raise exception 'Order notes are too long'; end if;
 if p_prescription_path is not null then
  if split_part(p_prescription_path,'/',1)<>p_tenant_id::text or split_part(p_prescription_path,'/',2)<>p.id::text then
   raise exception 'Prescription file path does not match the patient account';
  end if;
  if not exists(select 1 from storage.objects so where so.bucket_id='pharmacy-prescriptions' and so.name=p_prescription_path) then
   raise exception 'Uploaded prescription file was not found';
  end if;
 end if;

 for v_item in select value from jsonb_array_elements(p_items) loop
  v_med:=nullif(v_item->>'medicine_id','')::uuid;
  v_name:=nullif(btrim(v_item->>'requested_name'),'');
  v_qty:=coalesce(nullif(v_item->>'quantity','')::numeric,1);
  if v_qty<=0 or v_qty>10000 or (v_med is null and v_name is null) then
   raise exception 'Each order line needs a medicine or requested name and a valid positive quantity';
  end if;
  if v_med is not null then
   select coalesce(prescription_required,false) into v_requires_rx
    from public.medicine_catalogue where id=v_med and tenant_id=p_tenant_id and status='active';
   if not found then raise exception 'Medicine is not available in this catalogue'; end if;
   if v_requires_rx and p_prescription_path is null then
    raise exception 'A valid prescription is required for one or more selected medicines';
   end if;
  end if;
 end loop;

 v_status:=case when p_prescription_path is not null then 'review_required' else 'submitted' end;
 insert into public.pharmacy_customer_orders(
  tenant_id,branch_id,patient_id,order_number,order_status,prescription_path,customer_notes
 ) values(p_tenant_id,p_branch_id,p.id,btrim(p_order_number),v_status,p_prescription_path,p_notes)
 returning id into v_id;

 for v_item in select value from jsonb_array_elements(p_items) loop
  v_med:=nullif(v_item->>'medicine_id','')::uuid;
  v_name:=nullif(btrim(v_item->>'requested_name'),'');
  v_qty:=coalesce(nullif(v_item->>'quantity','')::numeric,1);
  insert into public.pharmacy_customer_order_items(tenant_id,order_id,medicine_id,requested_name,quantity)
  values(p_tenant_id,v_id,v_med,v_name,v_qty);
 end loop;

 insert into public.pharmacy_customer_order_events(
  tenant_id,branch_id,order_id,event_type,event_status,note,visible_to_customer,actor_user_id
 ) values(p_tenant_id,p_branch_id,v_id,'order_submitted',v_status,null,true,auth.uid());
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id)
 values(p_tenant_id,p_branch_id,auth.uid(),'pharmacy.customer_order_submitted','pharmacy_customer_order',v_id::text);
 return v_id;
end;
$$;

create or replace function private.pharmacy_review_customer_order_impl(
 p_tenant_id uuid,p_order_id uuid,p_decision text,p_notes text default null,p_item_decisions jsonb default '[]'::jsonb
) returns void
language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare
 o public.pharmacy_customer_orders%rowtype; v_item jsonb; v_item_id uuid;
 v_status text; v_suggested uuid; v_total integer; v_decided integer; v_approved integer;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into o from public.pharmacy_customer_orders
  where id=p_order_id and tenant_id=p_tenant_id for update;
 if not found or not private.has_module_access(p_tenant_id,'pharmacy_suite',o.branch_id,true) then
  raise exception 'Order not found or access denied';
 end if;
 if not exists(select 1 from public.tenant_memberships m
  where m.tenant_id=p_tenant_id and m.user_id=auth.uid() and m.status='active'
   and m.role in ('owner','admin','pharmacist') and (m.branch_id is null or m.branch_id=o.branch_id)) then
  raise exception 'Pharmacist review permission required';
 end if;
 if p_decision not in ('approved','rejected','clarification_required') then raise exception 'Invalid review decision'; end if;
 if o.order_status not in ('submitted','review_required') then raise exception 'Order is not awaiting review'; end if;
 if p_decision='approved' and exists(
  select 1 from public.pharmacy_customer_order_items i
  join public.medicine_catalogue m on m.id=i.medicine_id and m.tenant_id=i.tenant_id
  where i.tenant_id=p_tenant_id and i.order_id=o.id and m.prescription_required=true
 ) and o.prescription_path is null then
  raise exception 'Cannot approve a prescription medicine without a prescription';
 end if;
 if jsonb_typeof(coalesce(p_item_decisions,'[]'::jsonb))<>'array' then
  raise exception 'Item decisions must be an array';
 end if;
 if p_decision='approved' then
  select count(*) into v_total from public.pharmacy_customer_order_items where tenant_id=p_tenant_id and order_id=o.id;
  select count(*),count(distinct value->>'item_id') into v_decided,v_approved
   from jsonb_array_elements(coalesce(p_item_decisions,'[]'::jsonb));
  if v_total=0 or v_decided<>v_total or v_approved<>v_total then
   raise exception 'Every order item must receive exactly one decision before approval';
  end if;
 end if;
 for v_item in select value from jsonb_array_elements(coalesce(p_item_decisions,'[]'::jsonb)) loop
  v_item_id:=nullif(v_item->>'item_id','')::uuid;
  v_status:=v_item->>'item_status';
  v_suggested:=nullif(v_item->>'suggested_medicine_id','')::uuid;
  if v_item_id is null or v_status not in ('approved','substituted','unavailable','rejected') then
   raise exception 'Invalid item decision';
  end if;
  if v_status='substituted' then
   if v_suggested is null or not exists(select 1 from public.medicine_catalogue
    where id=v_suggested and tenant_id=p_tenant_id and status='active') then
    raise exception 'A valid active substitute medicine is required';
   end if;
  elsif v_suggested is not null then
   raise exception 'A substitute medicine can only be set for a substituted item';
  end if;
  update public.pharmacy_customer_order_items set item_status=v_status,
   suggested_medicine_id=v_suggested,pharmacist_note=nullif(v_item->>'note','')
  where id=v_item_id and order_id=o.id and tenant_id=p_tenant_id;
  if not found then raise exception 'Order item not found'; end if;
 end loop;
 if p_decision='approved' then
  select count(*) into v_approved from public.pharmacy_customer_order_items
   where tenant_id=p_tenant_id and order_id=o.id and item_status in ('approved','substituted');
  if v_approved=0 then raise exception 'At least one item must be approved or substituted'; end if;
 elsif p_decision='rejected' then
  update public.pharmacy_customer_order_items set item_status='rejected'
   where tenant_id=p_tenant_id and order_id=o.id and item_status='pending';
 end if;

 insert into public.pharmacy_prescription_reviews(tenant_id,order_id,reviewer_id,decision,notes)
 values(p_tenant_id,o.id,auth.uid(),p_decision,p_notes);
 update public.pharmacy_customer_orders set order_status=case
  when p_decision='approved' then 'approved'
  when p_decision='rejected' then 'rejected'
  else 'review_required' end,
  reviewed_by=auth.uid(),reviewed_at=now()
 where id=o.id;
 insert into public.pharmacy_customer_order_events(
  tenant_id,branch_id,order_id,event_type,event_status,note,visible_to_customer,actor_user_id
 ) values(p_tenant_id,o.branch_id,o.id,'order_reviewed',p_decision,p_notes,true,auth.uid());
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id,metadata)
 values(p_tenant_id,o.branch_id,auth.uid(),'pharmacy.customer_order_reviewed',
  'pharmacy_customer_order',o.id::text,jsonb_build_object('decision',p_decision));
end;
$$;

create or replace function public.pharmacy_submit_customer_order(
 p_tenant_id uuid,p_branch_id uuid,p_order_number text,p_items jsonb,
 p_prescription_path text default null,p_notes text default null
) returns uuid language sql security invoker
set search_path=pg_catalog,public,private,storage
as $$ select private.pharmacy_submit_customer_order_impl(p_tenant_id,p_branch_id,p_order_number,p_items,p_prescription_path,p_notes) $$;

create or replace function public.pharmacy_review_customer_order(
 p_tenant_id uuid,p_order_id uuid,p_decision text,p_notes text default null,p_item_decisions jsonb default '[]'::jsonb
) returns void language sql security invoker
set search_path=pg_catalog,public,private
as $$ select private.pharmacy_review_customer_order_impl(p_tenant_id,p_order_id,p_decision,p_notes,p_item_decisions) $$;

revoke all on function private.pharmacy_submit_customer_order_impl(uuid,uuid,text,jsonb,text,text) from public,anon;
revoke all on function private.pharmacy_review_customer_order_impl(uuid,uuid,text,text,jsonb) from public,anon;
grant execute on function private.pharmacy_submit_customer_order_impl(uuid,uuid,text,jsonb,text,text) to authenticated;
grant execute on function private.pharmacy_review_customer_order_impl(uuid,uuid,text,text,jsonb) to authenticated;
revoke all on function public.pharmacy_submit_customer_order(uuid,uuid,text,jsonb,text,text) from public,anon;
revoke all on function public.pharmacy_review_customer_order(uuid,uuid,text,text,jsonb) from public,anon;
grant execute on function public.pharmacy_submit_customer_order(uuid,uuid,text,jsonb,text,text) to authenticated;
grant execute on function public.pharmacy_review_customer_order(uuid,uuid,text,text,jsonb) to authenticated;
