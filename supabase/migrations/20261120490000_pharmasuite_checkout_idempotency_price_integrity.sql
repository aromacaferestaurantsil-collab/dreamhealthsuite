-- Serialize duplicate checkout requests and derive sale prices from locked FEFO batches.
-- Never trust a client-supplied unit_price for a pharmacy sale.
create or replace function public.pharmacy_checkout_v2(
 p_tenant_id uuid,p_branch_id uuid,p_invoice_number text,p_items jsonb,
 p_payment_method text,p_payment_status text,p_idempotency_key uuid,
 p_patient_id uuid default null,p_prescription_reference text default null
)
returns uuid
language plpgsql
security invoker
set search_path=pg_catalog,public,private
as $$
declare
 v_user uuid:=auth.uid(); v_sale uuid; v_item jsonb; v_med uuid;
 v_qty numeric; v_remaining numeric; v_take numeric; v_batch record;
 v_price numeric; v_tax numeric; v_sub numeric:=0; v_tax_total numeric:=0;
 v_line numeric; v_line_tax numeric; v_held numeric; v_pack numeric; v_loose boolean;
begin
 if v_user is null or not private.has_module_access(p_tenant_id,'pharmacy_suite',p_branch_id,true) then
  raise exception 'No pharmacy permission';
 end if;
 if p_payment_status not in ('paid','pending') then raise exception 'Invalid payment status'; end if;
 if p_payment_method not in ('cash','card','upi','bank_transfer') then raise exception 'Invalid payment method'; end if;
 if p_payment_status='paid' and p_payment_method is null then raise exception 'Payment method required'; end if;
 if p_invoice_number is null or btrim(p_invoice_number)='' then raise exception 'Invoice number required'; end if;
 if p_idempotency_key is null then raise exception 'Idempotency key required'; end if;

 -- The unique index remains the final safeguard; this lock makes retries return
 -- the already-committed sale instead of racing into a unique-constraint error.
 perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text||':'||p_idempotency_key::text,0));
 select id into v_sale from public.pharmacy_sales
  where tenant_id=p_tenant_id and idempotency_key=p_idempotency_key;
 if v_sale is not null then return v_sale; end if;

 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then
  raise exception 'At least one item required';
 end if;
 insert into public.pharmacy_sales(
  tenant_id,branch_id,patient_id,invoice_number,sale_status,payment_status,
  payment_method,prescription_reference,sold_by,idempotency_key
 ) values(
  p_tenant_id,p_branch_id,p_patient_id,p_invoice_number,'draft',p_payment_status,
  p_payment_method,p_prescription_reference,v_user,p_idempotency_key
 ) returning id into v_sale;

 for v_item in select value from jsonb_array_elements(p_items) loop
  if coalesce(v_item->>'medicine_id','')='' or coalesce(v_item->>'quantity','')='' then
   raise exception 'Each sale item requires a medicine and quantity';
  end if;
  v_med:=(v_item->>'medicine_id')::uuid;
  v_qty:=(v_item->>'quantity')::numeric;
  if v_qty<=0 then raise exception 'Quantity must be positive'; end if;
  select units_per_pack,allow_loose_sale into v_pack,v_loose
   from public.medicine_catalogue where id=v_med and tenant_id=p_tenant_id and status='active';
  if not found then raise exception 'Active medicine not found'; end if;
  if not v_loose and mod(v_qty,v_pack)<>0 then
   raise exception 'Loose-unit sale is disabled; quantity must be a multiple of pack size %',v_pack;
  end if;
  v_remaining:=v_qty;
  for v_batch in
   select b.id,b.quantity_on_hand,b.selling_rate,b.mrp,m.gst_rate
   from public.medicine_batches b
   join public.medicine_catalogue m on m.id=b.medicine_id and m.tenant_id=b.tenant_id
   where b.tenant_id=p_tenant_id and b.branch_id=p_branch_id and b.medicine_id=v_med
    and b.quantity_on_hand>0 and b.expiry_date>=current_date
   order by b.expiry_date,b.received_at,b.id
   for update of b
  loop
   select coalesce(sum(h.held_quantity),0) into v_held
    from public.pharmacy_stock_holds h
    where h.tenant_id=p_tenant_id and h.branch_id=p_branch_id
     and h.batch_id=v_batch.id and h.hold_status='active';
   v_take:=least(v_remaining,greatest(v_batch.quantity_on_hand-v_held,0));
   if v_take<=0 then continue; end if;

   -- Price is authoritative on the locked batch, not in caller-supplied JSON.
   v_price:=v_batch.selling_rate;
   if v_price is null or v_price<=0 or (v_batch.mrp is not null and v_batch.mrp>0 and v_price>v_batch.mrp) then
    raise exception 'Invalid selling price configured for batch %',v_batch.id;
   end if;
   v_tax:=coalesce(v_batch.gst_rate,0);
   v_line:=round(v_take*v_price,2);
   v_line_tax:=round(v_line*v_tax/100,2);

   update public.medicine_batches set quantity_on_hand=quantity_on_hand-v_take where id=v_batch.id;
   insert into public.pharmacy_sale_items(
    tenant_id,sale_id,medicine_id,batch_id,quantity,unit_price,tax_rate,line_total
   ) values(p_tenant_id,v_sale,v_med,v_batch.id,v_take,v_price,v_tax,v_line+v_line_tax);
   insert into public.pharmacy_stock_movements(
    tenant_id,branch_id,medicine_id,batch_id,movement_type,quantity_delta,
    reference_type,reference_id,actor_user_id
   ) values(p_tenant_id,p_branch_id,v_med,v_batch.id,'sale',-v_take,'pharmacy_sale',v_sale,v_user);
   v_sub:=v_sub+v_line;
   v_tax_total:=v_tax_total+v_line_tax;
   v_remaining:=v_remaining-v_take;
   exit when v_remaining<=0;
  end loop;
  if v_remaining>0 then
   raise exception 'Insufficient available unexpired stock (excluding held stock) for medicine %',v_med;
  end if;
 end loop;

 update public.pharmacy_sales
  set subtotal=v_sub,tax_total=v_tax_total,grand_total=v_sub+v_tax_total,
   sale_status='completed',payment_status=p_payment_status
  where id=v_sale;
 insert into public.audit_events(
  tenant_id,branch_id,actor_user_id,action,entity_type,entity_id,metadata
 ) values(
  p_tenant_id,p_branch_id,v_user,'pharmacy.checkout','pharmacy_sale',v_sale::text,
  jsonb_build_object('invoice',p_invoice_number,'payment_status',p_payment_status,
   'fefo',true,'held_stock_excluded',true,'server_priced',true)
 );
 return v_sale;
end;
$$;

revoke all on function public.pharmacy_checkout_v2(uuid,uuid,text,jsonb,text,text,uuid,uuid,text) from public,anon;
grant execute on function public.pharmacy_checkout_v2(uuid,uuid,text,jsonb,text,text,uuid,uuid,text) to authenticated;

-- Keep the manual opening-stock intake atomic: a batch must never be committed
-- without its corresponding stock movement and audit event.
create or replace function public.pharmacy_receive_opening_batch(
 p_tenant_id uuid,p_branch_id uuid,p_medicine_id uuid,p_supplier_id uuid,
 p_batch_number text,p_expiry_date date,p_quantity numeric,
 p_purchase_rate numeric,p_mrp numeric,p_selling_rate numeric
)
returns uuid
language plpgsql
security invoker
set search_path=pg_catalog,public,private
as $$
declare v_user uuid:=auth.uid(); v_batch uuid;
begin
 if v_user is null or not private.has_module_access(p_tenant_id,'pharmacy_suite',p_branch_id,true) then
  raise exception 'No pharmacy permission';
 end if;
 if p_batch_number is null or btrim(p_batch_number)='' or p_expiry_date is null or p_expiry_date<current_date then
  raise exception 'A batch number and non-expired expiry date are required';
 end if;
 if p_quantity is null or p_quantity<=0 then raise exception 'Received quantity must be positive'; end if;
 if p_purchase_rate is null or p_purchase_rate<0 or p_mrp is null or p_mrp<=0
  or p_selling_rate is null or p_selling_rate<=0 or p_selling_rate>p_mrp then
  raise exception 'Purchase rate, MRP and selling rate are invalid';
 end if;
 if not exists(select 1 from public.branches where id=p_branch_id and tenant_id=p_tenant_id and status='active') then
  raise exception 'Active branch not found';
 end if;
 if not exists(select 1 from public.medicine_catalogue where id=p_medicine_id and tenant_id=p_tenant_id and status='active') then
  raise exception 'Active medicine not found';
 end if;
 if p_supplier_id is not null and not exists(
  select 1 from public.pharmacy_suppliers where id=p_supplier_id and tenant_id=p_tenant_id and status='active'
 ) then raise exception 'Active supplier not found'; end if;

 insert into public.medicine_batches(
  tenant_id,branch_id,medicine_id,supplier_id,batch_number,expiry_date,
  quantity_on_hand,purchase_rate,mrp,selling_rate
 ) values(
  p_tenant_id,p_branch_id,p_medicine_id,p_supplier_id,btrim(p_batch_number),p_expiry_date,
  p_quantity,p_purchase_rate,p_mrp,p_selling_rate
 ) returning id into v_batch;

 insert into public.pharmacy_stock_movements(
  tenant_id,branch_id,medicine_id,batch_id,movement_type,quantity_delta,
  reference_type,notes,actor_user_id
 ) values(
  p_tenant_id,p_branch_id,p_medicine_id,v_batch,'purchase',p_quantity,
  'opening_stock','Opening stock batch intake',v_user
 );
 insert into public.audit_events(
  tenant_id,branch_id,actor_user_id,action,entity_type,entity_id,metadata
 ) values(
  p_tenant_id,p_branch_id,v_user,'pharmacy.opening_stock_received','medicine_batch',v_batch::text,
  jsonb_build_object('batch_number',p_batch_number,'quantity',p_quantity,'expiry_date',p_expiry_date)
 );
 return v_batch;
end;
$$;
revoke all on function public.pharmacy_receive_opening_batch(uuid,uuid,uuid,uuid,text,date,numeric,numeric,numeric,numeric) from public,anon;
grant execute on function public.pharmacy_receive_opening_batch(uuid,uuid,uuid,uuid,text,date,numeric,numeric,numeric,numeric) to authenticated;
