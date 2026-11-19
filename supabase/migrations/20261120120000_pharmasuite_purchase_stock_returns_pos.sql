-- PharmaSuite operational workflows. Apply only to an isolated/local database after the baseline has been reconstructed.
alter table public.pharmacy_sales add column if not exists idempotency_key uuid;
create unique index if not exists pharmacy_sales_tenant_idempotency_uidx on public.pharmacy_sales(tenant_id,idempotency_key) where idempotency_key is not null;

create table if not exists public.pharmacy_returns (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null,
 branch_id uuid not null,
 return_number text not null,
 return_type text not null check (return_type in ('customer_return','supplier_return')),
 sale_id uuid null references public.pharmacy_sales(id),
 supplier_id uuid null references public.pharmacy_suppliers(id),
 status text not null default 'posted' check (status in ('posted','voided')),
 reason text not null,
 total_amount numeric not null default 0,
 created_by uuid,
 created_at timestamptz not null default now(),
 unique(tenant_id,return_number)
);
create table if not exists public.pharmacy_return_items (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null,
 return_id uuid not null references public.pharmacy_returns(id) on delete restrict,
 medicine_id uuid not null references public.medicine_catalogue(id),
 batch_id uuid not null references public.medicine_batches(id),
 quantity numeric not null check(quantity>0),
 unit_amount numeric not null default 0,
 restock boolean not null default true,
 created_at timestamptz not null default now()
);
alter table public.pharmacy_returns enable row level security;
alter table public.pharmacy_return_items enable row level security;
drop policy if exists pharmacy_returns_select on public.pharmacy_returns;
create policy pharmacy_returns_select on public.pharmacy_returns for select to authenticated using (private.has_module_access(tenant_id,'pharmacy_suite',branch_id,false));
drop policy if exists pharmacy_returns_insert on public.pharmacy_returns;
create policy pharmacy_returns_insert on public.pharmacy_returns for insert to authenticated with check (private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true));
drop policy if exists pharmacy_return_items_select on public.pharmacy_return_items;
create policy pharmacy_return_items_select on public.pharmacy_return_items for select to authenticated using (private.has_module_access(tenant_id,'pharmacy_suite',null,false));
drop policy if exists pharmacy_return_items_insert on public.pharmacy_return_items;
create policy pharmacy_return_items_insert on public.pharmacy_return_items for insert to authenticated with check (private.has_module_access(tenant_id,'pharmacy_suite',null,true));
grant select,insert on public.pharmacy_returns,public.pharmacy_return_items to authenticated;

create or replace function public.pharmacy_create_purchase_order(
 p_tenant_id uuid,p_branch_id uuid,p_supplier_id uuid,p_order_number text,p_order_date date,
 p_expected_date date,p_items jsonb
) returns uuid language plpgsql security invoker set search_path=pg_catalog,public,private
as $$
declare v_id uuid; v_item jsonb; v_sub numeric:=0; v_tax numeric:=0; v_qty numeric; v_cost numeric; v_rate numeric; v_line numeric;
begin
 if auth.uid() is null or not private.has_module_access(p_tenant_id,'pharmacy_suite',p_branch_id,true) then raise exception 'No pharmacy permission'; end if;
 if p_order_number is null or btrim(p_order_number)='' or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Order number and at least one item are required'; end if;
 if not exists(select 1 from public.pharmacy_suppliers where id=p_supplier_id and tenant_id=p_tenant_id and status='active') then raise exception 'Active supplier not found'; end if;
 insert into public.pharmacy_purchase_orders(tenant_id,branch_id,supplier_id,order_number,status,order_date,expected_date,created_by)
 values(p_tenant_id,p_branch_id,p_supplier_id,btrim(p_order_number),'draft',coalesce(p_order_date,current_date),p_expected_date,auth.uid()) returning id into v_id;
 for v_item in select value from jsonb_array_elements(p_items) loop
  v_qty:=(v_item->>'quantity')::numeric; v_cost:=(v_item->>'unit_cost')::numeric; v_rate:=coalesce((v_item->>'tax_rate')::numeric,0);
  if v_qty<=0 or v_cost<0 or v_rate<0 or v_rate>100 then raise exception 'Invalid quantity, cost or tax rate'; end if;
  if not exists(select 1 from public.medicine_catalogue where id=(v_item->>'medicine_id')::uuid and tenant_id=p_tenant_id) then raise exception 'Medicine does not belong to tenant'; end if;
  v_line:=round(v_qty*v_cost,2); v_sub:=v_sub+v_line; v_tax:=v_tax+round(v_line*v_rate/100,2);
  insert into public.pharmacy_purchase_items(tenant_id,purchase_order_id,medicine_id,quantity_ordered,unit_cost,tax_rate)
  values(p_tenant_id,v_id,(v_item->>'medicine_id')::uuid,v_qty,v_cost,v_rate);
 end loop;
 update public.pharmacy_purchase_orders set subtotal=v_sub,tax_total=v_tax,total=v_sub+v_tax,status='ordered' where id=v_id;
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id)
 values(p_tenant_id,p_branch_id,auth.uid(),'pharmacy.purchase_order_created','pharmacy_purchase_order',v_id::text);
 return v_id;
end $$;

create or replace function public.pharmacy_receive_purchase_item(
 p_tenant_id uuid,p_order_id uuid,p_item_id uuid,p_quantity numeric,p_batch_number text,p_expiry_date date,
 p_mrp numeric,p_selling_rate numeric
) returns uuid language plpgsql security invoker set search_path=pg_catalog,public,private
as $$
declare o public.pharmacy_purchase_orders%rowtype; i public.pharmacy_purchase_items%rowtype; v_batch uuid; v_remaining numeric;
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
 update public.pharmacy_purchase_orders set status=case when not exists(select 1 from public.pharmacy_purchase_items x where x.purchase_order_id=o.id and x.quantity_received+(case when x.id=i.id then p_quantity else 0 end)<x.quantity_ordered) then 'received' else 'partially_received' end where id=o.id;
 insert into public.pharmacy_stock_movements(tenant_id,branch_id,medicine_id,batch_id,movement_type,quantity_delta,reference_type,reference_id,actor_user_id)
 values(p_tenant_id,o.branch_id,i.medicine_id,v_batch,'purchase',p_quantity,'purchase_order',o.id,auth.uid());
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id)
 values(p_tenant_id,o.branch_id,auth.uid(),'pharmacy.purchase_received','pharmacy_purchase_order',o.id::text);
 return v_batch;
end $$;

create or replace function public.pharmacy_adjust_stock(
 p_tenant_id uuid,p_branch_id uuid,p_batch_id uuid,p_quantity_delta numeric,p_reason text
) returns void language plpgsql security invoker set search_path=pg_catalog,public,private
as $$
declare b public.medicine_batches%rowtype;
begin
 if p_quantity_delta=0 or p_reason is null or length(btrim(p_reason))<3 then raise exception 'Non-zero adjustment and reason are required'; end if;
 if not private.has_module_access(p_tenant_id,'pharmacy_suite',p_branch_id,true) then raise exception 'No pharmacy permission'; end if;
 select * into b from public.medicine_batches where id=p_batch_id and tenant_id=p_tenant_id and branch_id=p_branch_id for update;
 if not found then raise exception 'Batch not found'; end if;
 if b.quantity_on_hand+p_quantity_delta<0 then raise exception 'Adjustment cannot make stock negative'; end if;
 update public.medicine_batches set quantity_on_hand=quantity_on_hand+p_quantity_delta where id=b.id;
 insert into public.pharmacy_stock_movements(tenant_id,branch_id,medicine_id,batch_id,movement_type,quantity_delta,reference_type,reference_id,notes,actor_user_id)
 values(p_tenant_id,p_branch_id,b.medicine_id,b.id,'adjustment',p_quantity_delta,'manual_adjustment',b.id,p_reason,auth.uid());
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id,metadata)
 values(p_tenant_id,p_branch_id,auth.uid(),'pharmacy.stock_adjusted','medicine_batch',b.id::text,jsonb_build_object('delta',p_quantity_delta,'reason',p_reason));
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
   select si.* into v_sale_item from public.pharmacy_sale_items si join public.pharmacy_sales s on s.id=si.sale_id where si.sale_id=p_sale_id and si.batch_id=v_batch.id and si.medicine_id=v_batch.medicine_id and s.tenant_id=p_tenant_id and s.branch_id=p_branch_id limit 1;
   if not found or v_qty>(select coalesce(sum(quantity),0) from public.pharmacy_sale_items where sale_id=p_sale_id and batch_id=v_batch.id) then raise exception 'Return exceeds original sold quantity for batch'; end if;
   if coalesce(v_item->>'restock','true')='true' then
    update public.medicine_batches set quantity_on_hand=quantity_on_hand+v_qty where id=v_batch.id;
    insert into public.pharmacy_stock_movements(tenant_id,branch_id,medicine_id,batch_id,movement_type,quantity_delta,reference_type,reference_id,actor_user_id)
    values(p_tenant_id,p_branch_id,v_batch.medicine_id,v_batch.id,'customer_return',v_qty,'pharmacy_return',v_id,auth.uid());
   end if;
  else
   if v_qty>v_batch.quantity_on_hand then raise exception 'Supplier return exceeds available batch stock'; end if;
   update public.medicine_batches set quantity_on_hand=quantity_on_hand-v_qty where id=v_batch.id;
   insert into public.pharmacy_stock_movements(tenant_id,branch_id,medicine_id,batch_id,movement_type,quantity_delta,reference_type,reference_id,actor_user_id)
   values(p_tenant_id,p_branch_id,v_batch.medicine_id,v_batch.id,'supplier_return',-v_qty,'pharmacy_return',v_id,auth.uid());
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

create or replace function public.pharmacy_checkout_v2(
 p_tenant_id uuid,p_branch_id uuid,p_invoice_number text,p_items jsonb,p_payment_method text,
 p_payment_status text,p_idempotency_key uuid,p_patient_id uuid default null,p_prescription_reference text default null
) returns uuid language plpgsql security invoker set search_path=pg_catalog,public,private
as $$
declare v_user uuid:=auth.uid(); v_sale uuid; v_item jsonb; v_med uuid; v_qty numeric; v_remaining numeric; v_take numeric; v_batch record; v_price numeric; v_tax numeric; v_sub numeric:=0; v_tax_total numeric:=0; v_line numeric; v_line_tax numeric;
begin
 if v_user is null or not private.has_module_access(p_tenant_id,'pharmacy_suite',p_branch_id,true) then raise exception 'No pharmacy permission'; end if;
 if p_payment_status not in ('paid','pending') then raise exception 'Invalid payment status'; end if;
 if p_payment_status='paid' and p_payment_method is null then raise exception 'Payment method required'; end if;
 if p_idempotency_key is null then raise exception 'Idempotency key required'; end if;
 select id into v_sale from public.pharmacy_sales where tenant_id=p_tenant_id and idempotency_key=p_idempotency_key;
 if v_sale is not null then return v_sale; end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'At least one item required'; end if;
 insert into public.pharmacy_sales(tenant_id,branch_id,patient_id,invoice_number,sale_status,payment_status,payment_method,prescription_reference,sold_by,idempotency_key)
 values(p_tenant_id,p_branch_id,p_patient_id,p_invoice_number,'draft',p_payment_status,p_payment_method,p_prescription_reference,v_user,p_idempotency_key) returning id into v_sale;
 for v_item in select value from jsonb_array_elements(p_items) loop
  v_med:=(v_item->>'medicine_id')::uuid; v_qty:=(v_item->>'quantity')::numeric;
  if v_qty<=0 then raise exception 'Quantity must be positive'; end if;
  v_remaining:=v_qty;
  for v_batch in select b.id,b.quantity_on_hand,b.selling_rate,m.gst_rate from public.medicine_batches b join public.medicine_catalogue m on m.id=b.medicine_id and m.tenant_id=b.tenant_id where b.tenant_id=p_tenant_id and b.branch_id=p_branch_id and b.medicine_id=v_med and b.quantity_on_hand>0 and b.expiry_date>=current_date order by b.expiry_date,b.received_at,b.id for update of b loop
   exit when v_remaining<=0; v_take:=least(v_remaining,v_batch.quantity_on_hand); v_price:=coalesce(nullif(v_item->>'unit_price','')::numeric,v_batch.selling_rate); v_tax:=v_batch.gst_rate; v_line:=round(v_take*v_price,2); v_line_tax:=round(v_line*v_tax/100,2);
   update public.medicine_batches set quantity_on_hand=quantity_on_hand-v_take where id=v_batch.id;
   insert into public.pharmacy_sale_items(tenant_id,sale_id,medicine_id,batch_id,quantity,unit_price,tax_rate,line_total) values(p_tenant_id,v_sale,v_med,v_batch.id,v_take,v_price,v_tax,v_line+v_line_tax);
   insert into public.pharmacy_stock_movements(tenant_id,branch_id,medicine_id,batch_id,movement_type,quantity_delta,reference_type,reference_id,actor_user_id) values(p_tenant_id,p_branch_id,v_med,v_batch.id,'sale',-v_take,'pharmacy_sale',v_sale,v_user);
   v_sub:=v_sub+v_line; v_tax_total:=v_tax_total+v_line_tax; v_remaining:=v_remaining-v_take;
  end loop;
  if v_remaining>0 then raise exception 'Insufficient unexpired stock for medicine %',v_med; end if;
 end loop;
 update public.pharmacy_sales set subtotal=v_sub,tax_total=v_tax_total,grand_total=v_sub+v_tax_total,sale_status='completed',payment_status=p_payment_status where id=v_sale;
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id,metadata) values(p_tenant_id,p_branch_id,v_user,'pharmacy.checkout','pharmacy_sale',v_sale::text,jsonb_build_object('invoice',p_invoice_number,'payment_status',p_payment_status));
 return v_sale;
end $$;

revoke all on function public.pharmacy_create_purchase_order(uuid,uuid,uuid,text,date,date,jsonb) from public,anon;
revoke all on function public.pharmacy_receive_purchase_item(uuid,uuid,uuid,numeric,text,date,numeric,numeric) from public,anon;
revoke all on function public.pharmacy_adjust_stock(uuid,uuid,uuid,numeric,text) from public,anon;
revoke all on function public.pharmacy_process_return(uuid,uuid,text,text,text,uuid,uuid,jsonb) from public,anon;
revoke all on function public.pharmacy_checkout_v2(uuid,uuid,text,jsonb,text,text,uuid,uuid,text) from public,anon;
grant execute on function public.pharmacy_create_purchase_order(uuid,uuid,uuid,text,date,date,jsonb) to authenticated;
grant execute on function public.pharmacy_receive_purchase_item(uuid,uuid,uuid,numeric,text,date,numeric,numeric) to authenticated;
grant execute on function public.pharmacy_adjust_stock(uuid,uuid,uuid,numeric,text) to authenticated;
grant execute on function public.pharmacy_process_return(uuid,uuid,text,text,text,uuid,uuid,jsonb) to authenticated;
grant execute on function public.pharmacy_checkout_v2(uuid,uuid,text,jsonb,text,text,uuid,uuid,text) to authenticated;
