-- PharmaSuite P1: protect return integrity and harden goods receipt pricing.
-- Return records must be created only through the audited transactional RPC.
drop policy if exists pharmacy_returns_insert on public.pharmacy_returns;
drop policy if exists pharmacy_return_items_insert on public.pharmacy_return_items;
revoke insert,update,delete on public.pharmacy_returns from authenticated;
revoke insert,update,delete on public.pharmacy_return_items from authenticated;
grant select on public.pharmacy_returns,public.pharmacy_return_items to authenticated;

create or replace function public.pharmacy_process_return(
 p_tenant_id uuid,p_branch_id uuid,p_return_number text,p_return_type text,p_reason text,
 p_sale_id uuid,p_supplier_id uuid,p_items jsonb
) returns uuid
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
 v_id uuid; v_item jsonb; v_batch public.medicine_batches%rowtype;
 v_sale public.pharmacy_sales%rowtype; v_qty numeric; v_amount numeric;
 v_total numeric:=0; v_sold_qty numeric; v_sold_value numeric;
 v_returned_qty numeric; v_held numeric; v_restock boolean;
begin
 if auth.uid() is null or not private.has_module_access(p_tenant_id,'pharmacy_suite',p_branch_id,true) then
  raise exception 'No pharmacy permission';
 end if;
 if nullif(btrim(p_return_number),'') is null or p_return_type not in ('customer_return','supplier_return')
  or p_reason is null or length(btrim(p_reason))<3
  or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then
  raise exception 'Return number, type, reason and at least one item are required';
 end if;
 if p_return_type='customer_return' then
  if p_sale_id is null or p_supplier_id is not null then raise exception 'Customer return requires only the original sale'; end if;
  select * into v_sale from public.pharmacy_sales
   where id=p_sale_id and tenant_id=p_tenant_id and branch_id=p_branch_id
   for update;
  if not found or v_sale.sale_status<>'completed' then
   raise exception 'Original completed sale not found for this branch';
  end if;
 else
  if p_supplier_id is null or p_sale_id is not null then raise exception 'Supplier return requires only a supplier'; end if;
  if not exists(select 1 from public.pharmacy_suppliers where id=p_supplier_id and tenant_id=p_tenant_id and status='active') then
   raise exception 'Active supplier not found';
  end if;
 end if;

 insert into public.pharmacy_returns(tenant_id,branch_id,return_number,return_type,sale_id,supplier_id,reason,created_by)
 values(p_tenant_id,p_branch_id,btrim(p_return_number),p_return_type,p_sale_id,p_supplier_id,btrim(p_reason),auth.uid())
 returning id into v_id;

 for v_item in select value from jsonb_array_elements(p_items) loop
  if coalesce(v_item->>'batch_id','')='' or coalesce(v_item->>'medicine_id','')='' or coalesce(v_item->>'quantity','')='' then
   raise exception 'Each return line requires a medicine, batch and quantity';
  end if;
  v_qty:=(v_item->>'quantity')::numeric;
  if v_qty<=0 then raise exception 'Return quantity must be positive'; end if;
  select * into v_batch from public.medicine_batches
   where id=(v_item->>'batch_id')::uuid and tenant_id=p_tenant_id and branch_id=p_branch_id
   for update;
  if not found or v_batch.medicine_id<>(v_item->>'medicine_id')::uuid then
   raise exception 'Batch not found or does not match the selected medicine';
  end if;

  if p_return_type='customer_return' then
   select coalesce(sum(si.quantity),0),coalesce(sum(si.line_total),0)
    into v_sold_qty,v_sold_value
    from public.pharmacy_sale_items si
    where si.tenant_id=p_tenant_id and si.sale_id=p_sale_id
     and si.batch_id=v_batch.id and si.medicine_id=v_batch.medicine_id;
   select coalesce(sum(ri.quantity),0) into v_returned_qty
    from public.pharmacy_return_items ri
    join public.pharmacy_returns rr on rr.id=ri.return_id and rr.tenant_id=ri.tenant_id
    where rr.tenant_id=p_tenant_id and rr.sale_id=p_sale_id
     and rr.return_type='customer_return' and rr.status='posted' and ri.batch_id=v_batch.id;
   if v_sold_qty<=0 or v_qty+v_returned_qty>v_sold_qty then
    raise exception 'Return exceeds the remaining quantity sold from this batch';
   end if;
   -- Derive the refund from the original sale line (including its tax); never trust client unit_amount.
   v_amount:=round(v_sold_value/v_sold_qty,2);
   v_restock:=coalesce((v_item->>'restock')::boolean,true);
   if v_restock and v_batch.expiry_date<current_date then v_restock:=false; end if;
   if v_restock then
    update public.medicine_batches set quantity_on_hand=quantity_on_hand+v_qty where id=v_batch.id;
    insert into public.pharmacy_stock_movements(
     tenant_id,branch_id,medicine_id,batch_id,movement_type,quantity_delta,reference_type,reference_id,actor_user_id
    ) values(p_tenant_id,p_branch_id,v_batch.medicine_id,v_batch.id,'sale_return',v_qty,'pharmacy_return',v_id,auth.uid());
   end if;
  else
   if v_batch.supplier_id is distinct from p_supplier_id then
    raise exception 'Selected batch was not received from this supplier';
   end if;
   select coalesce(sum(h.held_quantity),0) into v_held
    from public.pharmacy_stock_holds h
    where h.tenant_id=p_tenant_id and h.branch_id=p_branch_id
     and h.batch_id=v_batch.id and h.hold_status='active';
   if v_qty>v_batch.quantity_on_hand-v_held then
    raise exception 'Supplier return exceeds unheld available stock';
   end if;
   -- Supplier credit is based on the recorded batch purchase cost, not client input.
   v_amount:=coalesce(v_batch.purchase_rate,0);
   v_restock:=false;
   update public.medicine_batches set quantity_on_hand=quantity_on_hand-v_qty where id=v_batch.id;
   insert into public.pharmacy_stock_movements(
    tenant_id,branch_id,medicine_id,batch_id,movement_type,quantity_delta,reference_type,reference_id,actor_user_id
   ) values(p_tenant_id,p_branch_id,v_batch.medicine_id,v_batch.id,'purchase_return',-v_qty,'pharmacy_return',v_id,auth.uid());
  end if;

  insert into public.pharmacy_return_items(tenant_id,return_id,medicine_id,batch_id,quantity,unit_amount,restock)
  values(p_tenant_id,v_id,v_batch.medicine_id,v_batch.id,v_qty,v_amount,v_restock);
  v_total:=v_total+v_qty*v_amount;
 end loop;

 update public.pharmacy_returns set total_amount=round(v_total,2) where id=v_id;
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id,metadata)
 values(p_tenant_id,p_branch_id,auth.uid(),'pharmacy.return_posted','pharmacy_return',v_id::text,
  jsonb_build_object('return_type',p_return_type,'total_amount',round(v_total,2),'server_priced',true));
 return v_id;
end;
$$;

alter function public.pharmacy_process_return(uuid,uuid,text,text,text,uuid,uuid,jsonb) security definer;
revoke all on function public.pharmacy_process_return(uuid,uuid,text,text,text,uuid,uuid,jsonb) from public,anon;
grant execute on function public.pharmacy_process_return(uuid,uuid,text,text,text,uuid,uuid,jsonb) to authenticated;

-- Goods receipt validates batch prices on the server and retains the canonical
-- 'part_received' state used by the receiving UI and subsequent receipts.
create or replace function public.pharmacy_receive_purchase_item(
 p_tenant_id uuid,p_order_id uuid,p_item_id uuid,p_quantity numeric,p_batch_number text,p_expiry_date date,
 p_mrp numeric,p_selling_rate numeric
) returns uuid
language plpgsql
security invoker
set search_path=pg_catalog,public,private
as $$
declare
 o public.pharmacy_purchase_orders%rowtype;
 i public.pharmacy_purchase_items%rowtype;
 v_batch uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into o from public.pharmacy_purchase_orders
  where id=p_order_id and tenant_id=p_tenant_id for update;
 if not found or not private.has_module_access(p_tenant_id,'pharmacy_suite',o.branch_id,true) then
  raise exception 'Purchase order not found or access denied';
 end if;
 select * into i from public.pharmacy_purchase_items
  where id=p_item_id and purchase_order_id=o.id and tenant_id=p_tenant_id for update;
 if not found then raise exception 'Purchase item not found'; end if;
 if o.status not in ('ordered','part_received') then raise exception 'Order is not open for receiving'; end if;
 if p_quantity is null or p_quantity<=0 or p_quantity>(i.quantity_ordered-i.quantity_received) then
  raise exception 'Received quantity exceeds outstanding quantity';
 end if;
 if p_expiry_date is null or p_expiry_date<current_date or nullif(btrim(p_batch_number),'') is null then
  raise exception 'Valid batch number and non-expired expiry date are required';
 end if;
 if p_mrp is null or p_mrp<=0 or p_selling_rate is null or p_selling_rate<=0 or p_selling_rate>p_mrp then
  raise exception 'MRP and selling rate must be positive; selling rate cannot exceed MRP';
 end if;
 insert into public.medicine_batches(
  tenant_id,branch_id,medicine_id,supplier_id,batch_number,expiry_date,quantity_on_hand,purchase_rate,mrp,selling_rate
 ) values(
  p_tenant_id,o.branch_id,i.medicine_id,o.supplier_id,btrim(p_batch_number),p_expiry_date,
  p_quantity,i.unit_cost,p_mrp,p_selling_rate
 ) returning id into v_batch;
 update public.pharmacy_purchase_items set quantity_received=quantity_received+p_quantity where id=i.id;
 update public.pharmacy_purchase_orders set status=case
  when not exists(
   select 1 from public.pharmacy_purchase_items x
   where x.purchase_order_id=o.id
    and x.quantity_received+(case when x.id=i.id then p_quantity else 0 end)<x.quantity_ordered
  ) then 'received' else 'part_received' end
 where id=o.id;
 insert into public.pharmacy_stock_movements(
  tenant_id,branch_id,medicine_id,batch_id,movement_type,quantity_delta,reference_type,reference_id,actor_user_id
 ) values(p_tenant_id,o.branch_id,i.medicine_id,v_batch,'purchase',p_quantity,'purchase_order',o.id,auth.uid());
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id,metadata)
 values(p_tenant_id,o.branch_id,auth.uid(),'pharmacy.purchase_received','pharmacy_purchase_order',o.id::text,
  jsonb_build_object('item_id',i.id,'batch_id',v_batch,'quantity',p_quantity));
 return v_batch;
end;
$$;
revoke all on function public.pharmacy_receive_purchase_item(uuid,uuid,uuid,numeric,text,date,numeric,numeric) from public,anon;
grant execute on function public.pharmacy_receive_purchase_item(uuid,uuid,uuid,numeric,text,date,numeric,numeric) to authenticated;
