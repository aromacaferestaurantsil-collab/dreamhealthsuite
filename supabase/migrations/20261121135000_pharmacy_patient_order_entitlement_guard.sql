create or replace function private.pharmacy_submit_customer_order_impl(
 p_tenant_id uuid,p_branch_id uuid,p_order_number text,p_items jsonb,
 p_prescription_path text default null,p_notes text default null
) returns uuid
language plpgsql security definer
set search_path=pg_catalog,public,private,storage
as $function$
declare
 p public.patients%rowtype; v_id uuid; v_item jsonb; v_med uuid; v_name text;
 v_qty numeric; v_requires_rx boolean:=false; v_status text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into p from public.patients
  where tenant_id=p_tenant_id and created_by=auth.uid() and status='active'
  order by created_at desc limit 1;
 if not found then raise exception 'No patient profile is linked to this account'; end if;
 if not exists(select 1 from public.tenant_module_entitlements
  where tenant_id=p_tenant_id and module_key='pharmacy_suite' and enabled=true) then
  raise exception 'PharmaSuite is not enabled for this provider';
 end if;
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
 insert into public.pharmacy_customer_orders(tenant_id,branch_id,patient_id,order_number,order_status,prescription_path,customer_notes)
 values(p_tenant_id,p_branch_id,p.id,btrim(p_order_number),v_status,p_prescription_path,p_notes)
 returning id into v_id;
 for v_item in select value from jsonb_array_elements(p_items) loop
  v_med:=nullif(v_item->>'medicine_id','');
  v_name:=nullif(btrim(v_item->>'requested_name'),'');
  v_qty:=coalesce(nullif(v_item->>'quantity','')::numeric,1);
  insert into public.pharmacy_customer_order_items(tenant_id,order_id,medicine_id,requested_name,quantity)
  values(p_tenant_id,v_id,v_med,v_name,v_qty);
 end loop;
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id)
 values(p_tenant_id,p_branch_id,auth.uid(),'pharmacy.customer_order_submitted','pharmacy_customer_order',v_id::text);
 return v_id;
end;
$function$;
revoke all on function private.pharmacy_submit_customer_order_impl(uuid,uuid,text,jsonb,text,text) from public,anon;
grant execute on function private.pharmacy_submit_customer_order_impl(uuid,uuid,text,jsonb,text,text) to authenticated;
