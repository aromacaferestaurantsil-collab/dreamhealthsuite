-- Purchase bills: supplier invoice metadata, batch-level receipt details and one-step posting.
alter table public.pharmacy_purchase_orders
  add column if not exists supplier_invoice_number text,
  add column if not exists supplier_invoice_date date,
  add column if not exists received_date date,
  add column if not exists bill_discount_amount numeric(14,2) not null default 0,
  add column if not exists round_off numeric(14,2) not null default 0;

alter table public.pharmacy_purchase_items
  add column if not exists free_quantity numeric(14,3) not null default 0,
  add column if not exists discount_percent numeric(6,3) not null default 0,
  add column if not exists discount_amount numeric(14,2) not null default 0,
  add column if not exists pack_label text,
  add column if not exists hsn_code text,
  add column if not exists batch_number text,
  add column if not exists expiry_date date,
  add column if not exists mrp numeric(14,2),
  add column if not exists selling_rate numeric(14,2);

create unique index if not exists pharmacy_purchase_supplier_invoice_uq
  on public.pharmacy_purchase_orders(tenant_id,supplier_id,lower(supplier_invoice_number))
  where supplier_invoice_number is not null and btrim(supplier_invoice_number)<>'';

create or replace function public.pharmacy_create_purchase_bill(
 p_tenant_id uuid,p_branch_id uuid,p_supplier_id uuid,p_bill_number text,
 p_supplier_invoice_number text,p_invoice_date date,p_received_date date,
 p_bill_discount numeric,p_round_off numeric,p_items jsonb
) returns uuid
language plpgsql security invoker set search_path=pg_catalog,public,private
as $function$
declare
 v_id uuid; v_item jsonb; v_line jsonb; v_lines jsonb:='[]'::jsonb;
 v_qty numeric; v_free numeric; v_rate numeric; v_gst numeric; v_disc_pct numeric;
 v_gross numeric; v_disc numeric; v_net numeric; v_sub numeric:=0; v_tax numeric:=0;
 v_bill_discount numeric:=greatest(coalesce(p_bill_discount,0),0);
 v_round numeric:=coalesce(p_round_off,0); v_alloc_discount numeric;
 v_taxable numeric; v_line_tax numeric; v_total numeric; v_batch uuid;
 v_medicine uuid; v_batch_no text; v_expiry date; v_mrp numeric; v_selling numeric;
 v_pack text; v_hsn text;
begin
 if auth.uid() is null or not private.has_module_access(p_tenant_id,'pharmacy_suite',p_branch_id,true) then raise exception 'No pharmacy permission'; end if;
 if nullif(btrim(p_bill_number),'') is null or nullif(btrim(p_supplier_invoice_number),'') is null
  or p_invoice_date is null or p_received_date is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then
  raise exception 'Bill number, supplier invoice, dates and at least one medicine are required';
 end if;
 if v_bill_discount<0 or abs(v_round)>100000 then raise exception 'Invalid bill discount or round off'; end if;
 if not exists(select 1 from public.pharmacy_suppliers where id=p_supplier_id and tenant_id=p_tenant_id and status='active') then raise exception 'Active supplier not found'; end if;
 if exists(select 1 from public.pharmacy_purchase_orders where tenant_id=p_tenant_id and supplier_id=p_supplier_id and lower(supplier_invoice_number)=lower(btrim(p_supplier_invoice_number))) then raise exception 'This supplier invoice number is already recorded'; end if;
 for v_item in select value from jsonb_array_elements(p_items) loop
  v_medicine:=(v_item->>'medicine_id')::uuid; v_qty:=(v_item->>'quantity')::numeric;
  v_free:=coalesce((v_item->>'free_quantity')::numeric,0); v_rate:=(v_item->>'purchase_rate')::numeric;
  v_gst:=coalesce((v_item->>'gst_rate')::numeric,0); v_disc_pct:=coalesce((v_item->>'discount_percent')::numeric,0);
  v_batch_no:=nullif(btrim(v_item->>'batch_number'),''); v_expiry:=(v_item->>'expiry_date')::date;
  v_mrp:=coalesce((v_item->>'mrp')::numeric,0); v_selling:=coalesce((v_item->>'selling_rate')::numeric,0);
  v_pack:=nullif(btrim(v_item->>'pack_label'),''); v_hsn:=nullif(btrim(v_item->>'hsn_code'),'');
  if v_qty<=0 or v_free<0 or v_rate<0 or v_gst<0 or v_gst>100 or v_disc_pct<0 or v_disc_pct>100
   or v_batch_no is null or v_expiry is null or v_expiry<p_received_date or v_mrp<0 or v_selling<0 then
   raise exception 'Invalid quantity, batch, expiry, rate, discount, GST or selling price';
  end if;
  if not exists(select 1 from public.medicine_catalogue where id=v_medicine and tenant_id=p_tenant_id and status='active') then raise exception 'Medicine does not belong to this tenant or is inactive'; end if;
  v_gross:=round(v_qty*v_rate,2); v_disc:=round(v_gross*v_disc_pct/100,2); v_net:=v_gross-v_disc; v_sub:=v_sub+v_net;
  v_lines:=v_lines||jsonb_build_array(jsonb_build_object('medicine_id',v_medicine,'quantity',v_qty,'free_quantity',v_free,'purchase_rate',v_rate,'gst_rate',v_gst,'discount_percent',v_disc_pct,'gross',v_gross,'line_discount',v_disc,'net',v_net,'batch_number',v_batch_no,'expiry_date',v_expiry,'mrp',v_mrp,'selling_rate',v_selling,'pack_label',v_pack,'hsn_code',v_hsn));
 end loop;
 if v_bill_discount>v_sub then raise exception 'Bill discount cannot exceed taxable goods value'; end if;
 insert into public.pharmacy_purchase_orders(tenant_id,branch_id,supplier_id,order_number,status,order_date,subtotal,tax_total,total,created_by,supplier_invoice_number,supplier_invoice_date,received_date,bill_discount_amount,round_off)
 values(p_tenant_id,p_branch_id,p_supplier_id,btrim(p_bill_number),'received',p_received_date,v_sub,0,0,auth.uid(),btrim(p_supplier_invoice_number),p_invoice_date,p_received_date,v_bill_discount,v_round) returning id into v_id;
 for v_line in select value from jsonb_array_elements(v_lines) loop
  v_qty:=(v_line->>'quantity')::numeric; v_free:=(v_line->>'free_quantity')::numeric;
  v_rate:=(v_line->>'purchase_rate')::numeric; v_gst:=(v_line->>'gst_rate')::numeric;
  v_gross:=(v_line->>'gross')::numeric; v_disc:=(v_line->>'line_discount')::numeric; v_net:=(v_line->>'net')::numeric;
  v_alloc_discount:=case when v_sub=0 then 0 else round(v_bill_discount*v_net/v_sub,2) end;
  v_taxable:=v_net-v_alloc_discount; v_line_tax:=round(v_taxable*v_gst/100,2); v_tax:=v_tax+v_line_tax;
  insert into public.pharmacy_purchase_items(tenant_id,purchase_order_id,medicine_id,quantity_ordered,quantity_received,unit_cost,tax_rate,free_quantity,discount_percent,discount_amount,pack_label,hsn_code,batch_number,expiry_date,mrp,selling_rate)
  values(p_tenant_id,v_id,(v_line->>'medicine_id')::uuid,v_qty+v_free,v_qty+v_free,v_rate,v_gst,v_free,(v_line->>'discount_percent')::numeric,v_disc+v_alloc_discount,v_line->>'pack_label',v_line->>'hsn_code',v_line->>'batch_number',(v_line->>'expiry_date')::date,(v_line->>'mrp')::numeric,(v_line->>'selling_rate')::numeric);
  insert into public.medicine_batches(tenant_id,branch_id,medicine_id,supplier_id,batch_number,expiry_date,quantity_on_hand,purchase_rate,mrp,selling_rate,received_at)
  values(p_tenant_id,p_branch_id,(v_line->>'medicine_id')::uuid,p_supplier_id,v_line->>'batch_number',(v_line->>'expiry_date')::date,v_qty+v_free,round(v_taxable/(v_qty+v_free),4),(v_line->>'mrp')::numeric,(v_line->>'selling_rate')::numeric,(p_received_date::timestamp at time zone 'Asia/Kolkata')) returning id into v_batch;
  insert into public.pharmacy_stock_movements(tenant_id,branch_id,medicine_id,batch_id,movement_type,quantity_delta,reference_type,reference_id,notes,actor_user_id)
  values(p_tenant_id,p_branch_id,(v_line->>'medicine_id')::uuid,v_batch,'purchase',v_qty+v_free,'purchase_order',v_id,'Supplier invoice '||btrim(p_supplier_invoice_number),auth.uid());
 end loop;
 v_total:=round(v_sub-v_bill_discount+v_tax+v_round,2);
 update public.pharmacy_purchase_orders set tax_total=v_tax,total=v_total where id=v_id;
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id)
 values(p_tenant_id,p_branch_id,auth.uid(),'pharmacy.purchase_bill_created','pharmacy_purchase_order',v_id::text);
 return v_id;
end;
$function$;
revoke all on function public.pharmacy_create_purchase_bill(uuid,uuid,uuid,text,text,date,date,numeric,numeric,jsonb) from public,anon;
grant execute on function public.pharmacy_create_purchase_bill(uuid,uuid,uuid,text,text,date,date,numeric,numeric,jsonb) to authenticated;
