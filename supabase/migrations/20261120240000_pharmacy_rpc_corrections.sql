-- Correct status and movement codes to match the canonical checks in the core schema.
create or replace function public.pharmacy_receive_purchase_item(
 p_tenant_id uuid,p_order_id uuid,p_item_id uuid,p_quantity numeric,p_batch_number text,p_expiry_date date,
 p_mrp numeric,p_selling_rate numeric
) returns uuid language plpgsql security invoker set search_path=pg_catalog,public,private
as $$
declare o public.pharmacy_purchase_orders%rowtype; i public.pharmacy_purchase_items%rowtype; v_batch uuid;
begin
 select * into o from public.pharmacy_purchase_orders where id=p_order_id and tenant_id=p_tenant_id for update;
 if not found or not private.has_module_access(p_tenant_id,'pharmacy_suite',o.branch_id,true) then raise exception 'Purchase order not found or access denied'; end if;
 select * into i from public.pharmacy_purchase_items where id=p_item_id and purchase_order_id=o.id and tenant_id=p_tenant_id for update;
 if not found then raise exception 'Purchase item not found'; end if;
 if o.status not in ('ordered','part_received') then raise exception 'Order is not open for receiving'; end if;
 if p_quantity<=0 or p_quantity>(i.quantity_ordered-i.quantity_received) then raise exception 'Received quantity exceeds outstanding quantity'; end if;
 if p_expiry_date<current_date or p_batch_number is null or btrim(p_batch_number)='' then raise exception 'Valid batch number and non-expired expiry date are required'; end if;
 insert into public.medicine_batches(tenant_id,branch_id,medicine_id,supplier_id,batch_number,expiry_date,quantity_on_hand,purchase_rate,mrp,selling_rate)
 values(p_tenant_id,o.branch_id,i.medicine_id,o.supplier_id,btrim(p_batch_number),p_expiry_date,p_quantity,i.unit_cost,p_mrp,p_selling_rate)
 returning id into v_batch;
 update public.pharmacy_purchase_items set quantity_received=quantity_received+p_quantity where id=i.id;
 update public.pharmacy_purchase_orders set status=case
  when not exists(select 1 from public.pharmacy_purchase_items x where x.purchase_order_id=o.id
   and x.quantity_received+(case when x.id=i.id then p_quantity else 0 end)<x.quantity_ordered)
  then 'received' else 'part_received' end where id=o.id;
 insert into public.pharmacy_stock_movements(tenant_id,branch_id,medicine_id,batch_id,movement_type,quantity_delta,reference_type,reference_id,actor_user_id)
 values(p_tenant_id,o.branch_id,i.medicine_id,v_batch,'purchase',p_quantity,'purchase_order',o.id,auth.uid());
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id)
 values(p_tenant_id,o.branch_id,auth.uid(),'pharmacy.purchase_received','pharmacy_purchase_order',o.id::text);
 return v_batch;
end $$;

create or replace function public.pharmacy_process_return(
 p_tenant_id uuid,p_branch_id uuid,p_return_number text,p_return_type text,p_reason text,
 p_sale_id uuid,p_supplier_id uuid,p_items jsonb
) returns uuid language plpgsql security invoker set search_path=pg_catalog,public,private
as $$
declare v_id uuid; v_item jsonb; v_batch public.medicine_batches%rowtype; v_qty numeric; v_amount numeric; v_total numeric:=0; v_sale_item public.pharmacy_sale_items%rowtype;
begin
 if not private.has_module_access(p_tenant_id,'pharmacy_suite',p_branch_id,true) then raise exception 'No pharmacy permission'; end if;
 if p_return_type not in ('customer_return','supplier_return') or p_reason is null or length(btrim(p_reason))<3 or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Return type, reason and items are required'; end if;
 if p_return_type='customer_return' and p_sale_id is null then raise exception 'Customer return requires original sale'; end if;
 if p_return_type='supplier_return' and p_supplier_id is null then raise exception 'Supplier return requires supplier'; end if;
 insert into public.pharmacy_returns(tenant_id,branch_id,return_number,return_type,sale_id,supplier_id,reason,created_by)
 values(p_tenant_id,p_branch_id,p_return_number,p_return_type,p_sale_id,p_supplier_id,btrim(p_reason),auth.uid()) returning id into v_id;
 for v_item in select value from jsonb_array_elements(p_items) loop
  v_qty:=(v_item->>'quantity')::numeric; v_amount:=coalesce((v_item->>'unit_amount')::numeric,0);
  if v_qty<=0 or v_amount<0 then raise exception 'Invalid return quantity or amount'; end if;
  select * into v_batch from public.medicine_batches where id=(v_item->>'batch_id')::uuid and tenant_id=p_tenant_id and branch_id=p_branch_id for update;
  if not found then raise exception 'Batch not found'; end if;
  if v_batch.medicine_id<>(v_item->>'medicine_id')::uuid then raise exception 'Batch and medicine mismatch'; end if;
  if p_return_type='customer_return' then
   select si.* into v_sale_item from public.pharmacy_sale_items si join public.pharmacy_sales s on s.id=si.sale_id
    where si.sale_id=p_sale_id and si.batch_id=v_batch.id and si.medicine_id=v_batch.medicine_id
     and s.tenant_id=p_tenant_id and s.branch_id=p_branch_id limit 1;
   if not found or v_qty+coalesce((select sum(ri.quantity) from public.pharmacy_return_items ri join public.pharmacy_returns rr on rr.id=ri.return_id
     where rr.sale_id=p_sale_id and rr.return_type='customer_return' and rr.status='posted' and ri.batch_id=v_batch.id),0)
     >(select coalesce(sum(quantity),0) from public.pharmacy_sale_items where sale_id=p_sale_id and batch_id=v_batch.id)
   then raise exception 'Return exceeds remaining original sold quantity for batch'; end if;
   if coalesce(v_item->>'restock','true')='true' then
    update public.medicine_batches set quantity_on_hand=quantity_on_hand+v_qty where id=v_batch.id;
    insert into public.pharmacy_stock_movements(tenant_id,branch_id,medicine_id,batch_id,movement_type,quantity_delta,reference_type,reference_id,actor_user_id)
    values(p_tenant_id,p_branch_id,v_batch.medicine_id,v_batch.id,'sale_return',v_qty,'pharmacy_return',v_id,auth.uid());
   end if;
  else
   if v_batch.supplier_id is distinct from p_supplier_id then raise exception 'Selected batch was not received from this supplier'; end if;
   if v_qty>v_batch.quantity_on_hand then raise exception 'Supplier return exceeds available batch stock'; end if;
   update public.medicine_batches set quantity_on_hand=quantity_on_hand-v_qty where id=v_batch.id;
   insert into public.pharmacy_stock_movements(tenant_id,branch_id,medicine_id,batch_id,movement_type,quantity_delta,reference_type,reference_id,actor_user_id)
   values(p_tenant_id,p_branch_id,v_batch.medicine_id,v_batch.id,'purchase_return',-v_qty,'pharmacy_return',v_id,auth.uid());
  end if;
  insert into public.pharmacy_return_items(tenant_id,return_id,medicine_id,batch_id,quantity,unit_amount,restock)
  values(p_tenant_id,v_id,v_batch.medicine_id,v_batch.id,v_qty,v_amount,coalesce((v_item->>'restock')::boolean,true));
  v_total:=v_total+v_qty*v_amount;
 end loop;
 update public.pharmacy_returns set total_amount=v_total where id=v_id;
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id)
 values(p_tenant_id,p_branch_id,auth.uid(),'pharmacy.return_posted','pharmacy_return',v_id::text);
 return v_id;
end $$;

revoke execute on function public.pharmacy_receive_purchase_item(uuid,uuid,uuid,numeric,text,date,numeric,numeric) from public,anon;
revoke execute on function public.pharmacy_process_return(uuid,uuid,text,text,text,uuid,uuid,jsonb) from public,anon;
grant execute on function public.pharmacy_receive_purchase_item(uuid,uuid,uuid,numeric,text,date,numeric,numeric) to authenticated;
grant execute on function public.pharmacy_process_return(uuid,uuid,text,text,text,uuid,uuid,jsonb) to authenticated;
