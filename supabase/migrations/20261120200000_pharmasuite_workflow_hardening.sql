-- PharmaSuite workflow completion and security hardening.
-- Apply only to the isolated healthbuddy-360 development project.
-- Production must receive a separately reviewed release migration.

-- Stable attendance key: name-based staff can be recorded without an auth account.
alter table public.employee_attendance add column if not exists employee_key text
 generated always as (coalesce(employee_user_id::text, lower(regexp_replace(trim(employee_name), '\s+', ' ', 'g')))) stored;
alter table public.employee_attendance drop constraint if exists employee_attendance_tenant_id_branch_id_employee_user_id_attendance_date_key;
create unique index if not exists employee_attendance_identity_date_uidx
 on public.employee_attendance(tenant_id,branch_id,employee_key,attendance_date);

-- Catalogue barcode, image and controlled-drug classification metadata.
alter table public.medicine_catalogue add column if not exists barcode text;
alter table public.medicine_catalogue add column if not exists image_path text;
alter table public.medicine_catalogue add column if not exists schedule_code text;
create unique index if not exists medicine_catalogue_tenant_barcode_uidx
 on public.medicine_catalogue(tenant_id,barcode) where barcode is not null and barcode<>'';

-- Supplier payment ledger. Each payment is allocated to a purchase order.
create table if not exists public.pharmacy_supplier_payments (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id),
 branch_id uuid not null references public.branches(id),
 supplier_id uuid not null references public.pharmacy_suppliers(id),
 purchase_order_id uuid not null references public.pharmacy_purchase_orders(id),
 amount numeric(14,2) not null check(amount>0),
 payment_method text not null check(payment_method in ('cash','card','upi','bank_transfer','cheque','other')),
 reference_number text,
 paid_at timestamptz not null default now(),
 recorded_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);
create index if not exists pharmacy_supplier_payments_supplier_idx
 on public.pharmacy_supplier_payments(tenant_id,supplier_id,paid_at desc);
create index if not exists pharmacy_supplier_payments_order_idx
 on public.pharmacy_supplier_payments(tenant_id,purchase_order_id,paid_at desc);
alter table public.pharmacy_supplier_offers
 add constraint pharmacy_supplier_offers_tenant_supplier_fk foreign key(tenant_id,supplier_id) references public.pharmacy_suppliers(tenant_id,id),
 add constraint pharmacy_supplier_offers_tenant_medicine_fk foreign key(tenant_id,medicine_id) references public.medicine_catalogue(tenant_id,id);
alter table public.pharmacy_expenses
 add constraint pharmacy_expenses_tenant_branch_fk foreign key(tenant_id,branch_id) references public.branches(tenant_id,id),
 add constraint pharmacy_expenses_tenant_supplier_fk foreign key(tenant_id,supplier_id) references public.pharmacy_suppliers(tenant_id,id);
alter table public.pharmacy_expense_payments
 add constraint pharmacy_expense_payments_tenant_expense_fk foreign key(tenant_id,expense_id) references public.pharmacy_expenses(tenant_id,id);
alter table public.employee_attendance
 add constraint employee_attendance_tenant_branch_fk foreign key(tenant_id,branch_id) references public.branches(tenant_id,id);
alter table public.pharmacy_customer_orders
 add constraint pharmacy_customer_orders_tenant_branch_fk foreign key(tenant_id,branch_id) references public.branches(tenant_id,id),
 add constraint pharmacy_customer_orders_tenant_patient_fk foreign key(tenant_id,patient_id) references public.patients(tenant_id,id);
alter table public.pharmacy_customer_order_items
 add constraint pharmacy_customer_order_items_tenant_order_fk foreign key(tenant_id,order_id) references public.pharmacy_customer_orders(tenant_id,id),
 add constraint pharmacy_customer_order_items_tenant_medicine_fk foreign key(tenant_id,medicine_id) references public.medicine_catalogue(tenant_id,id),
 add constraint pharmacy_customer_order_items_tenant_suggested_medicine_fk foreign key(tenant_id,suggested_medicine_id) references public.medicine_catalogue(tenant_id,id);
alter table public.pharmacy_prescription_reviews
 add constraint pharmacy_prescription_reviews_tenant_order_fk foreign key(tenant_id,order_id) references public.pharmacy_customer_orders(tenant_id,id);
alter table public.pharmacy_referrals
 add constraint pharmacy_referrals_tenant_branch_fk foreign key(tenant_id,branch_id) references public.branches(tenant_id,id),
 add constraint pharmacy_referrals_tenant_referrer_fk foreign key(tenant_id,referrer_patient_id) references public.patients(tenant_id,id),
 add constraint pharmacy_referrals_tenant_referred_fk foreign key(tenant_id,referred_patient_id) references public.patients(tenant_id,id);
alter table public.pharmacy_stock_holds
 add constraint pharmacy_stock_holds_tenant_branch_fk foreign key(tenant_id,branch_id) references public.branches(tenant_id,id),
 add constraint pharmacy_stock_holds_tenant_batch_fk foreign key(tenant_id,batch_id) references public.medicine_batches(tenant_id,id);
alter table public.pharmacy_supplier_payments
 add constraint pharmacy_supplier_payments_tenant_branch_fk foreign key(tenant_id,branch_id) references public.branches(tenant_id,id),
 add constraint pharmacy_supplier_payments_tenant_supplier_fk foreign key(tenant_id,supplier_id) references public.pharmacy_suppliers(tenant_id,id),
 add constraint pharmacy_supplier_payments_tenant_order_fk foreign key(tenant_id,purchase_order_id) references public.pharmacy_purchase_orders(tenant_id,id);
alter table public.pharmacy_supplier_payments enable row level security;
grant select,insert on public.pharmacy_supplier_payments to authenticated;
create policy supplier_payments_read on public.pharmacy_supplier_payments for select to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,false));
create policy supplier_payments_insert on public.pharmacy_supplier_payments for insert to authenticated
 with check(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true));

-- Controlled / scheduled medicine register; pharmacist-recorded, immutable entries.
create table if not exists public.pharmacy_controlled_drug_register (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id),
 branch_id uuid not null references public.branches(id),
 medicine_id uuid not null references public.medicine_catalogue(id),
 batch_id uuid references public.medicine_batches(id),
 transaction_type text not null check(transaction_type in ('purchase','sale','return_in','return_out','adjustment')),
 quantity_in numeric(14,3) not null default 0 check(quantity_in>=0),
 quantity_out numeric(14,3) not null default 0 check(quantity_out>=0),
 patient_id uuid references public.patients(id),
 prescription_reference text,
 external_reference text,
 notes text,
 recorded_by uuid not null references auth.users(id),
 recorded_at timestamptz not null default now(),
 check((quantity_in>0 and quantity_out=0) or (quantity_out>0 and quantity_in=0))
);
create index if not exists pharmacy_controlled_register_date_idx
 on public.pharmacy_controlled_drug_register(tenant_id,branch_id,recorded_at desc);
alter table public.pharmacy_controlled_drug_register
 add constraint pharmacy_controlled_register_tenant_branch_fk foreign key(tenant_id,branch_id) references public.branches(tenant_id,id),
 add constraint pharmacy_controlled_register_tenant_medicine_fk foreign key(tenant_id,medicine_id) references public.medicine_catalogue(tenant_id,id),
 add constraint pharmacy_controlled_register_tenant_batch_fk foreign key(tenant_id,batch_id) references public.medicine_batches(tenant_id,id),
 add constraint pharmacy_controlled_register_tenant_patient_fk foreign key(tenant_id,patient_id) references public.patients(tenant_id,id);
alter table public.pharmacy_controlled_drug_register enable row level security;
grant select,insert on public.pharmacy_controlled_drug_register to authenticated;
create policy controlled_register_read on public.pharmacy_controlled_drug_register for select to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,false));
create policy controlled_register_insert on public.pharmacy_controlled_drug_register for insert to authenticated
 with check(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true) and recorded_by=(select auth.uid()));

-- Human-confirmed medicine photo/catalogue suggestions; no automatic identity claims.
create table if not exists public.pharmacy_catalogue_photo_suggestions (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id),
 branch_id uuid not null references public.branches(id),
 medicine_id uuid references public.medicine_catalogue(id),
 image_path text not null,
 suggested_name text,
 suggested_strength text,
 suggestion_source text not null default 'manual' check(suggestion_source in ('manual','assisted')),
 review_status text not null default 'pending' check(review_status in ('pending','approved','rejected')),
 reviewer_id uuid references auth.users(id),
 reviewed_at timestamptz,
 review_notes text,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create index if not exists pharmacy_photo_suggestions_queue_idx
 on public.pharmacy_catalogue_photo_suggestions(tenant_id,branch_id,review_status,created_at desc);
alter table public.pharmacy_catalogue_photo_suggestions
 add constraint pharmacy_photo_suggestions_tenant_branch_fk foreign key(tenant_id,branch_id) references public.branches(tenant_id,id),
 add constraint pharmacy_photo_suggestions_tenant_medicine_fk foreign key(tenant_id,medicine_id) references public.medicine_catalogue(tenant_id,id);
alter table public.pharmacy_catalogue_photo_suggestions enable row level security;
grant select,insert,update on public.pharmacy_catalogue_photo_suggestions to authenticated;
create policy photo_suggestions_read on public.pharmacy_catalogue_photo_suggestions for select to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,false));
create policy photo_suggestions_insert on public.pharmacy_catalogue_photo_suggestions for insert to authenticated
 with check(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true) and created_by=(select auth.uid()));
create policy photo_suggestions_update on public.pharmacy_catalogue_photo_suggestions for update to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true))
 with check(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true));

-- Private uploads: customer prescriptions and staff catalogue photos.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values
 ('pharmacy-prescriptions','pharmacy-prescriptions',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp']),
 ('pharmacy-catalogue-photos','pharmacy-catalogue-photos',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists pharmacy_prescription_customer_upload on storage.objects;
create policy pharmacy_prescription_customer_upload on storage.objects for insert to authenticated
 with check(bucket_id='pharmacy-prescriptions'
  and exists(select 1 from public.patients p
   where p.tenant_id=(storage.foldername(name))[1]::uuid
    and p.id=(storage.foldername(name))[2]::uuid
    and p.created_by=(select auth.uid())));
drop policy if exists pharmacy_prescription_customer_read on storage.objects;
create policy pharmacy_prescription_customer_read on storage.objects for select to authenticated
 using(bucket_id='pharmacy-prescriptions'
  and exists(select 1 from public.patients p
   where p.tenant_id=(storage.foldername(name))[1]::uuid
    and p.id=(storage.foldername(name))[2]::uuid
    and p.created_by=(select auth.uid())));
drop policy if exists pharmacy_prescription_staff_read on storage.objects;
create policy pharmacy_prescription_staff_read on storage.objects for select to authenticated
 using(bucket_id='pharmacy-prescriptions'
  and private.has_module_access((storage.foldername(name))[1]::uuid,'pharmacy_suite',null,false));
drop policy if exists pharmacy_photo_staff_upload on storage.objects;
create policy pharmacy_photo_staff_upload on storage.objects for insert to authenticated
 with check(bucket_id='pharmacy-catalogue-photos'
  and private.has_module_access((storage.foldername(name))[1]::uuid,'pharmacy_suite',null,true));
drop policy if exists pharmacy_photo_staff_read on storage.objects;
create policy pharmacy_photo_staff_read on storage.objects for select to authenticated
 using(bucket_id='pharmacy-catalogue-photos'
  and private.has_module_access((storage.foldername(name))[1]::uuid,'pharmacy_suite',null,false));

-- Expense payment RPC: atomically posts a payment and recomputes the balance status.
create or replace function public.pharmacy_record_expense_payment(
 p_tenant_id uuid,p_expense_id uuid,p_amount numeric,p_payment_method text,p_reference text default null
) returns uuid language plpgsql security invoker set search_path=pg_catalog,public,private
as $$
declare e public.pharmacy_expenses%rowtype; v_paid numeric; v_id uuid;
begin
 if auth.uid() is null or p_amount<=0 then raise exception 'Authentication and a positive payment are required'; end if;
 select * into e from public.pharmacy_expenses where id=p_expense_id and tenant_id=p_tenant_id for update;
 if not found or not private.has_module_access(p_tenant_id,'pharmacy_suite',e.branch_id,true) then raise exception 'Expense not found or access denied'; end if;
 select coalesce(sum(amount),0) into v_paid from public.pharmacy_expense_payments where expense_id=e.id;
 if v_paid+p_amount>e.amount then raise exception 'Payment exceeds the outstanding expense balance'; end if;
 insert into public.pharmacy_expense_payments(tenant_id,expense_id,amount,payment_method,reference_number,recorded_by)
 values(p_tenant_id,e.id,p_amount,p_payment_method,p_reference,auth.uid()) returning id into v_id;
 v_paid:=v_paid+p_amount;
 update public.pharmacy_expenses set payment_status=case when v_paid>=e.amount then 'paid' when v_paid>0 then 'part_paid' else 'unpaid' end
 where id=e.id;
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id,metadata)
 values(p_tenant_id,e.branch_id,auth.uid(),'pharmacy.expense_payment_recorded','pharmacy_expense',e.id::text,jsonb_build_object('amount',p_amount,'paid_total',v_paid));
 return v_id;
end $$;

-- Supplier payment RPC: prevents overpayment against an order and writes the audit trail.
create or replace function public.pharmacy_record_supplier_payment(
 p_tenant_id uuid,p_order_id uuid,p_amount numeric,p_payment_method text,p_reference text default null
) returns uuid language plpgsql security invoker set search_path=pg_catalog,public,private
as $$
declare o public.pharmacy_purchase_orders%rowtype; v_paid numeric; v_id uuid;
begin
 if auth.uid() is null or p_amount<=0 then raise exception 'Authentication and a positive payment are required'; end if;
 select * into o from public.pharmacy_purchase_orders where id=p_order_id and tenant_id=p_tenant_id for update;
 if not found or not private.has_module_access(p_tenant_id,'pharmacy_suite',o.branch_id,true) then raise exception 'Purchase order not found or access denied'; end if;
 if o.status not in ('received','partially_received','part_received') then raise exception 'Only received purchase orders can be settled'; end if;
 select coalesce(sum(amount),0) into v_paid from public.pharmacy_supplier_payments where purchase_order_id=o.id;
 if v_paid+p_amount>o.total then raise exception 'Payment exceeds the purchase order balance'; end if;
 insert into public.pharmacy_supplier_payments(tenant_id,branch_id,supplier_id,purchase_order_id,amount,payment_method,reference_number,recorded_by)
 values(p_tenant_id,o.branch_id,o.supplier_id,o.id,p_amount,p_payment_method,p_reference,auth.uid()) returning id into v_id;
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id,metadata)
 values(p_tenant_id,o.branch_id,auth.uid(),'pharmacy.supplier_payment_recorded','pharmacy_purchase_order',o.id::text,jsonb_build_object('amount',p_amount,'paid_total',v_paid+p_amount));
 return v_id;
end $$;

-- Customer order submission is limited to a patient profile explicitly linked to the signed-in user.
create or replace function public.pharmacy_submit_customer_order(
 p_tenant_id uuid,p_branch_id uuid,p_order_number text,p_items jsonb,p_prescription_path text default null,p_notes text default null
) returns uuid language plpgsql security invoker set search_path=pg_catalog,public,private
as $$
declare p public.patients%rowtype; v_id uuid; v_item jsonb; v_med uuid; v_name text; v_qty numeric;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into p from public.patients where tenant_id=p_tenant_id and created_by=auth.uid() and status='active' limit 1;
 if not found then raise exception 'No patient profile is linked to this account'; end if;
 if not exists(select 1 from public.branches where tenant_id=p_tenant_id and id=p_branch_id and status='active') then raise exception 'Branch not found'; end if;
 if p_order_number is null or btrim(p_order_number)='' or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Order number and items are required'; end if;
 if p_prescription_path is not null and (split_part(p_prescription_path,'/',1)<>p_tenant_id::text or split_part(p_prescription_path,'/',2)<>p.id::text) then raise exception 'Prescription file path does not match the patient account'; end if;
 insert into public.pharmacy_customer_orders(tenant_id,branch_id,patient_id,order_number,order_status,prescription_path,customer_notes)
 values(p_tenant_id,p_branch_id,p.id,btrim(p_order_number),case when p_prescription_path is null then 'submitted' else 'review_required' end,p_prescription_path,p_notes)
 returning id into v_id;
 for v_item in select value from jsonb_array_elements(p_items) loop
  v_med:=nullif(v_item->>'medicine_id','')::uuid; v_name:=nullif(btrim(v_item->>'requested_name'),''); v_qty:=coalesce(nullif(v_item->>'quantity','')::numeric,1);
  if v_qty<=0 or (v_med is null and v_name is null) then raise exception 'Each order line needs a medicine or requested name and positive quantity'; end if;
  if v_med is not null and not exists(select 1 from public.medicine_catalogue where id=v_med and tenant_id=p_tenant_id and status='active') then raise exception 'Medicine is not available in this catalogue'; end if;
  insert into public.pharmacy_customer_order_items(tenant_id,order_id,medicine_id,requested_name,quantity)
  values(p_tenant_id,v_id,v_med,v_name,v_qty);
 end loop;
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id)
 values(p_tenant_id,p_branch_id,auth.uid(),'pharmacy.customer_order_submitted','pharmacy_customer_order',v_id::text);
 return v_id;
end $$;

-- Pharmacist/tenant-admin review with item-level approval decisions.
create or replace function public.pharmacy_review_customer_order(
 p_tenant_id uuid,p_order_id uuid,p_decision text,p_notes text default null,p_item_decisions jsonb default '[]'::jsonb
) returns void language plpgsql security invoker set search_path=pg_catalog,public,private
as $$
declare o public.pharmacy_customer_orders%rowtype; v_item jsonb; v_item_id uuid; v_status text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into o from public.pharmacy_customer_orders where id=p_order_id and tenant_id=p_tenant_id for update;
 if not found or not private.has_module_access(p_tenant_id,'pharmacy_suite',o.branch_id,true) then raise exception 'Order not found or access denied'; end if;
 if not exists(select 1 from public.tenant_memberships m where m.tenant_id=p_tenant_id and m.user_id=auth.uid()
   and m.status='active' and m.role in ('owner','admin','pharmacist')) then raise exception 'Pharmacist review permission required'; end if;
 if p_decision not in ('approved','rejected','clarification_required') then raise exception 'Invalid review decision'; end if;
 if o.order_status not in ('submitted','review_required') then raise exception 'Order is not awaiting review'; end if;
 for v_item in select value from jsonb_array_elements(coalesce(p_item_decisions,'[]'::jsonb)) loop
  v_item_id:=(v_item->>'item_id')::uuid; v_status:=v_item->>'item_status';
  if v_status not in ('approved','substituted','unavailable','rejected') then raise exception 'Invalid item decision'; end if;
  update public.pharmacy_customer_order_items set item_status=v_status,
   suggested_medicine_id=nullif(v_item->>'suggested_medicine_id','')::uuid,
   pharmacist_note=nullif(v_item->>'note','')
  where id=v_item_id and order_id=o.id and tenant_id=p_tenant_id;
  if not found then raise exception 'Order item not found'; end if;
 end loop;
 insert into public.pharmacy_prescription_reviews(tenant_id,order_id,reviewer_id,decision,notes)
 values(p_tenant_id,o.id,auth.uid(),p_decision,p_notes);
 update public.pharmacy_customer_orders set order_status=case when p_decision='approved' then 'approved' when p_decision='rejected' then 'rejected' else 'review_required' end,
  reviewed_by=auth.uid(),reviewed_at=now() where id=o.id;
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id,metadata)
 values(p_tenant_id,o.branch_id,auth.uid(),'pharmacy.customer_order_reviewed','pharmacy_customer_order',o.id::text,jsonb_build_object('decision',p_decision));
end $$;

-- Hold/release workflows; held stock remains on hand but is not available for dispensing.
create or replace function public.pharmacy_place_stock_hold(
 p_tenant_id uuid,p_branch_id uuid,p_batch_id uuid,p_quantity numeric,p_hold_type text,p_reason text,p_reference text default null
) returns uuid language plpgsql security invoker set search_path=pg_catalog,public,private
as $$
declare b public.medicine_batches%rowtype; v_held numeric; v_id uuid;
begin
 if auth.uid() is null or p_quantity<=0 or p_hold_type not in ('quarantine','recall') then raise exception 'Valid authenticated hold request required'; end if;
 if not private.has_module_access(p_tenant_id,'pharmacy_suite',p_branch_id,true) then raise exception 'No pharmacy permission'; end if;
 select * into b from public.medicine_batches where id=p_batch_id and tenant_id=p_tenant_id and branch_id=p_branch_id for update;
 if not found then raise exception 'Batch not found'; end if;
 select coalesce(sum(held_quantity),0) into v_held from public.pharmacy_stock_holds where batch_id=b.id and hold_status='active';
 if p_quantity>b.quantity_on_hand-v_held then raise exception 'Hold quantity exceeds available stock'; end if;
 insert into public.pharmacy_stock_holds(tenant_id,branch_id,batch_id,hold_type,reason,reference_number,held_quantity,created_by)
 values(p_tenant_id,p_branch_id,b.id,p_hold_type,p_reason,p_reference,p_quantity,auth.uid()) returning id into v_id;
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id,metadata)
 values(p_tenant_id,p_branch_id,auth.uid(),'pharmacy.stock_held','medicine_batch',b.id::text,jsonb_build_object('hold_id',v_id,'quantity',p_quantity,'type',p_hold_type));
 return v_id;
end $$;

create or replace function public.pharmacy_release_stock_hold(p_tenant_id uuid,p_hold_id uuid,p_disposition text default 'released')
returns void language plpgsql security invoker set search_path=pg_catalog,public,private
as $$
declare h public.pharmacy_stock_holds%rowtype;
begin
 select * into h from public.pharmacy_stock_holds where id=p_hold_id and tenant_id=p_tenant_id for update;
 if not found or not private.has_module_access(p_tenant_id,'pharmacy_suite',h.branch_id,true) then raise exception 'Stock hold not found or access denied'; end if;
 if h.hold_status<>'active' or p_disposition not in ('released','destroyed') then raise exception 'Hold is not active or disposition is invalid'; end if;
 update public.pharmacy_stock_holds set hold_status=p_disposition,released_by=auth.uid(),released_at=now() where id=h.id;
 if p_disposition='destroyed' then
  update public.medicine_batches set quantity_on_hand=quantity_on_hand-h.held_quantity where id=h.batch_id and tenant_id=p_tenant_id;
  insert into public.pharmacy_stock_movements(tenant_id,branch_id,medicine_id,batch_id,movement_type,quantity_delta,reference_type,reference_id,notes,actor_user_id)
  select p_tenant_id,h.branch_id,b.medicine_id,h.batch_id,'expiry',-h.held_quantity,'stock_hold',h.id,'Destroyed quarantined/recall stock',auth.uid()
  from public.medicine_batches b where b.id=h.batch_id;
 end if;
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id,metadata)
 values(p_tenant_id,h.branch_id,auth.uid(),'pharmacy.stock_hold_'||p_disposition,'pharmacy_stock_hold',h.id::text,jsonb_build_object('batch_id',h.batch_id,'quantity',h.held_quantity));
end $$;

-- Controlled-drug register entry is explicit and pharmacist-authorized.
create or replace function public.pharmacy_record_controlled_drug(
 p_tenant_id uuid,p_branch_id uuid,p_medicine_id uuid,p_batch_id uuid,p_transaction_type text,
 p_quantity_in numeric,p_quantity_out numeric,p_patient_id uuid default null,p_prescription_reference text default null,p_notes text default null
) returns uuid language plpgsql security invoker set search_path=pg_catalog,public,private
as $$
declare v_id uuid;
begin
 if auth.uid() is null or not private.has_module_access(p_tenant_id,'pharmacy_suite',p_branch_id,true) then raise exception 'No pharmacy permission'; end if;
 if not exists(select 1 from public.tenant_memberships m where m.tenant_id=p_tenant_id and m.user_id=auth.uid()
   and m.status='active' and m.role in ('owner','admin','pharmacist')) then raise exception 'Pharmacist register permission required'; end if;
 if p_transaction_type not in ('purchase','sale','return_in','return_out','adjustment') or
   ((p_quantity_in>0)::int+(p_quantity_out>0)::int)<>1 then raise exception 'Invalid register movement'; end if;
 if not exists(select 1 from public.medicine_catalogue where id=p_medicine_id and tenant_id=p_tenant_id) then raise exception 'Medicine not found'; end if;
 insert into public.pharmacy_controlled_drug_register(tenant_id,branch_id,medicine_id,batch_id,transaction_type,quantity_in,quantity_out,patient_id,prescription_reference,notes,recorded_by)
 values(p_tenant_id,p_branch_id,p_medicine_id,p_batch_id,p_transaction_type,p_quantity_in,p_quantity_out,p_patient_id,p_prescription_reference,p_notes,auth.uid())
 returning id into v_id;
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id)
 values(p_tenant_id,p_branch_id,auth.uid(),'pharmacy.controlled_drug_entry','pharmacy_controlled_drug_register',v_id::text);
 return v_id;
end $$;

-- Confirm a photo suggestion before it updates the catalogue.
create or replace function public.pharmacy_review_catalogue_photo(
 p_tenant_id uuid,p_suggestion_id uuid,p_decision text,p_medicine_id uuid default null,p_notes text default null
) returns void language plpgsql security invoker set search_path=pg_catalog,public,private
as $$
declare s public.pharmacy_catalogue_photo_suggestions%rowtype;
begin
 select * into s from public.pharmacy_catalogue_photo_suggestions where id=p_suggestion_id and tenant_id=p_tenant_id for update;
 if not found or not private.has_module_access(p_tenant_id,'pharmacy_suite',s.branch_id,true) then raise exception 'Photo suggestion not found or access denied'; end if;
 if not exists(select 1 from public.tenant_memberships m where m.tenant_id=p_tenant_id and m.user_id=auth.uid()
   and m.status='active' and m.role in ('owner','admin','pharmacist')) then raise exception 'Pharmacist review permission required'; end if;
 if s.review_status<>'pending' or p_decision not in ('approved','rejected') then raise exception 'Suggestion is not pending or decision invalid'; end if;
 if p_decision='approved' then
  if p_medicine_id is null or not exists(select 1 from public.medicine_catalogue where id=p_medicine_id and tenant_id=p_tenant_id) then raise exception 'Choose a valid catalogue medicine before confirming the photo'; end if;
  update public.medicine_catalogue set image_path=s.image_path where id=p_medicine_id and tenant_id=p_tenant_id;
 end if;
 update public.pharmacy_catalogue_photo_suggestions set review_status=p_decision,medicine_id=coalesce(p_medicine_id,medicine_id),reviewer_id=auth.uid(),reviewed_at=now(),review_notes=p_notes where id=s.id;
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id)
 values(p_tenant_id,s.branch_id,auth.uid(),'pharmacy.catalogue_photo_'||p_decision,'pharmacy_catalogue_photo_suggestion',s.id::text);
end $$;

-- A safe availability view for POS and reporting; stock holds reduce sellable quantity.
create or replace view public.pharmacy_batch_availability with (security_invoker=true) as
select b.tenant_id,b.branch_id,b.id as batch_id,b.medicine_id,b.batch_number,b.expiry_date,
 b.quantity_on_hand,
 greatest(0,b.quantity_on_hand-coalesce(h.held_quantity,0)) as available_quantity,
 coalesce(h.held_quantity,0) as held_quantity,b.selling_rate,b.mrp
from public.medicine_batches b
left join lateral (select sum(x.held_quantity) as held_quantity from public.pharmacy_stock_holds x
 where x.batch_id=b.id and x.hold_status='active') h on true;
grant select on public.pharmacy_batch_availability to authenticated;

-- Supplier creditor balances and pharmacy reporting views.
create or replace view public.pharmacy_supplier_balances with (security_invoker=true) as
select po.tenant_id,po.branch_id,po.supplier_id,s.name as supplier_name,
 count(*) filter(where po.status<>'cancelled') as purchase_orders,
 coalesce(sum(po.total) filter(where po.status<>'cancelled'),0) as purchase_total,
 coalesce(sum(pay.paid),0) as paid_total,
 greatest(0,coalesce(sum(po.total) filter(where po.status<>'cancelled'),0)-coalesce(sum(pay.paid),0)) as outstanding
from public.pharmacy_purchase_orders po
join public.pharmacy_suppliers s on s.id=po.supplier_id and s.tenant_id=po.tenant_id
left join lateral (select sum(p.amount) as paid from public.pharmacy_supplier_payments p where p.purchase_order_id=po.id) pay on true
group by po.tenant_id,po.branch_id,po.supplier_id,s.name;
grant select on public.pharmacy_supplier_balances to authenticated;

-- Security: revoke PostgreSQL's default PUBLIC EXECUTE on every public function, then
-- explicitly grant only authenticated RPCs. RLS remains the row-level boundary.
revoke execute on all functions in schema public from public, anon;
grant execute on function public.create_tenant_with_owner(text,text,text,text,text) to authenticated;
grant execute on function public.lab_verify_result(uuid,boolean) to authenticated;
grant execute on function public.manage_tenant_member(uuid,uuid,text,uuid,boolean) to authenticated;
grant execute on function public.pharmacy_checkout(uuid,uuid,text,jsonb,text,uuid,text) to authenticated;
grant execute on function public.create_doctor_appointment(uuid,uuid,uuid,uuid,text,timestamptz,timestamptz,text) to authenticated;
grant execute on function public.transition_care_job(uuid,text,text,jsonb) to authenticated;
grant execute on function public.set_module_entitlement(uuid,text,boolean) to authenticated;
grant execute on function public.pharmacy_create_purchase_order(uuid,uuid,uuid,text,date,date,jsonb) to authenticated;
grant execute on function public.pharmacy_receive_purchase_item(uuid,uuid,uuid,numeric,text,date,numeric,numeric) to authenticated;
grant execute on function public.pharmacy_adjust_stock(uuid,uuid,uuid,numeric,text) to authenticated;
grant execute on function public.pharmacy_process_return(uuid,uuid,text,text,text,uuid,uuid,jsonb) to authenticated;
grant execute on function public.pharmacy_checkout_v2(uuid,uuid,text,jsonb,text,text,uuid,uuid,text) to authenticated;
grant execute on function public.pharmacy_record_expense_payment(uuid,uuid,numeric,text,text) to authenticated;
grant execute on function public.pharmacy_record_supplier_payment(uuid,uuid,numeric,text,text) to authenticated;
grant execute on function public.pharmacy_submit_customer_order(uuid,uuid,text,jsonb,text,text) to authenticated;
grant execute on function public.pharmacy_review_customer_order(uuid,uuid,text,text,jsonb) to authenticated;
grant execute on function public.pharmacy_place_stock_hold(uuid,uuid,uuid,numeric,text,text,text) to authenticated;
grant execute on function public.pharmacy_release_stock_hold(uuid,uuid,text) to authenticated;
grant execute on function public.pharmacy_record_controlled_drug(uuid,uuid,uuid,uuid,text,numeric,numeric,uuid,text,text) to authenticated;
grant execute on function public.pharmacy_review_catalogue_photo(uuid,uuid,text,uuid,text) to authenticated;
revoke execute on all functions in schema private from public, anon;
grant execute on function private.has_module_access(uuid,text,uuid,boolean) to authenticated;

-- Eliminate overlapping SELECT policies: keep read policies, split writes by command.
drop policy if exists supplier_offers_write on public.pharmacy_supplier_offers;
create policy supplier_offers_insert on public.pharmacy_supplier_offers for insert to authenticated
 with check(private.has_module_access(tenant_id,'pharmacy_suite',null,true));
create policy supplier_offers_update on public.pharmacy_supplier_offers for update to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',null,true))
 with check(private.has_module_access(tenant_id,'pharmacy_suite',null,true));
create policy supplier_offers_delete on public.pharmacy_supplier_offers for delete to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',null,true));

drop policy if exists pharmacy_expenses_write on public.pharmacy_expenses;
create policy pharmacy_expenses_insert on public.pharmacy_expenses for insert to authenticated
 with check(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true));
create policy pharmacy_expenses_update on public.pharmacy_expenses for update to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true))
 with check(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true));
create policy pharmacy_expenses_delete on public.pharmacy_expenses for delete to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true));

drop policy if exists employee_attendance_write on public.employee_attendance;
create policy employee_attendance_insert on public.employee_attendance for insert to authenticated
 with check(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true));
create policy employee_attendance_update on public.employee_attendance for update to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true))
 with check(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true));
create policy employee_attendance_delete on public.employee_attendance for delete to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true));

drop policy if exists customer_orders_write on public.pharmacy_customer_orders;
create policy customer_orders_insert on public.pharmacy_customer_orders for insert to authenticated
 with check(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true));
create policy customer_orders_patient_read on public.pharmacy_customer_orders for select to authenticated
 using(exists(select 1 from public.patients p where p.tenant_id=pharmacy_customer_orders.tenant_id
  and p.id=pharmacy_customer_orders.patient_id and p.created_by=(select auth.uid())));
create policy customer_orders_patient_insert on public.pharmacy_customer_orders for insert to authenticated
 with check(order_status in ('submitted','review_required') and reviewed_by is null and reviewed_at is null
  and exists(select 1 from public.patients p where p.tenant_id=pharmacy_customer_orders.tenant_id
   and p.id=pharmacy_customer_orders.patient_id and p.created_by=(select auth.uid())));
create policy customer_orders_update on public.pharmacy_customer_orders for update to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true))
 with check(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true));
create policy customer_orders_delete on public.pharmacy_customer_orders for delete to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true));

drop policy if exists customer_order_items_write on public.pharmacy_customer_order_items;
create policy customer_order_items_insert on public.pharmacy_customer_order_items for insert to authenticated
 with check(private.has_module_access(tenant_id,'pharmacy_suite',null,true));
create policy customer_order_items_patient_read on public.pharmacy_customer_order_items for select to authenticated
 using(exists(select 1 from public.pharmacy_customer_orders o join public.patients p
  on p.tenant_id=o.tenant_id and p.id=o.patient_id
  where o.tenant_id=pharmacy_customer_order_items.tenant_id and o.id=pharmacy_customer_order_items.order_id
   and p.created_by=(select auth.uid())));
create policy customer_order_items_patient_insert on public.pharmacy_customer_order_items for insert to authenticated
 with check(exists(select 1 from public.pharmacy_customer_orders o join public.patients p
  on p.tenant_id=o.tenant_id and p.id=o.patient_id
  where o.tenant_id=pharmacy_customer_order_items.tenant_id and o.id=pharmacy_customer_order_items.order_id
   and o.order_status in ('submitted','review_required') and p.created_by=(select auth.uid())));
create policy customer_order_items_update on public.pharmacy_customer_order_items for update to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',null,true))
 with check(private.has_module_access(tenant_id,'pharmacy_suite',null,true));
create policy customer_order_items_delete on public.pharmacy_customer_order_items for delete to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',null,true));

drop policy if exists prescription_reviews_write on public.pharmacy_prescription_reviews;
create policy prescription_reviews_insert on public.pharmacy_prescription_reviews for insert to authenticated
 with check(private.has_module_access(tenant_id,'pharmacy_suite',null,true));
create policy prescription_reviews_update on public.pharmacy_prescription_reviews for update to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',null,true))
 with check(private.has_module_access(tenant_id,'pharmacy_suite',null,true));
create policy prescription_reviews_delete on public.pharmacy_prescription_reviews for delete to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',null,true));

drop policy if exists pharmacy_referrals_write on public.pharmacy_referrals;
create policy pharmacy_referrals_insert on public.pharmacy_referrals for insert to authenticated
 with check(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true));
create policy pharmacy_referrals_update on public.pharmacy_referrals for update to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true))
 with check(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true));
create policy pharmacy_referrals_delete on public.pharmacy_referrals for delete to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true));

drop policy if exists pharmacy_stock_holds_write on public.pharmacy_stock_holds;
create policy pharmacy_stock_holds_insert on public.pharmacy_stock_holds for insert to authenticated
 with check(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true));
create policy pharmacy_stock_holds_update on public.pharmacy_stock_holds for update to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true))
 with check(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true));
create policy pharmacy_stock_holds_delete on public.pharmacy_stock_holds for delete to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true));

-- Guard direct stock mutations from consuming quantities that are under an active hold.
create or replace function private.prevent_held_stock_depletion()
returns trigger language plpgsql set search_path=pg_catalog,public
as $$
declare v_held numeric;
begin
 if new.quantity_on_hand < old.quantity_on_hand then
  select coalesce(sum(held_quantity),0) into v_held from public.pharmacy_stock_holds
   where batch_id=old.id and hold_status='active';
  if new.quantity_on_hand < v_held then raise exception 'Stock is quarantined/held and cannot be dispensed or adjusted below held quantity'; end if;
 end if;
 return new;
end $$;
drop trigger if exists prevent_held_stock_depletion on public.medicine_batches;
create trigger prevent_held_stock_depletion before update of quantity_on_hand on public.medicine_batches
for each row execute function private.prevent_held_stock_depletion();

-- Index common new foreign keys for joins and audit/report performance.
create index if not exists pharmacy_expense_payments_expense_idx on public.pharmacy_expense_payments(expense_id);
create index if not exists pharmacy_customer_orders_patient_idx on public.pharmacy_customer_orders(tenant_id,patient_id,created_at desc);
create index if not exists pharmacy_customer_order_items_order_idx on public.pharmacy_customer_order_items(order_id);
create index if not exists pharmacy_prescription_reviews_order_idx on public.pharmacy_prescription_reviews(order_id,created_at desc);
create index if not exists pharmacy_catalogue_photo_medicine_idx on public.pharmacy_catalogue_photo_suggestions(medicine_id);
create index if not exists pharmacy_stock_holds_batch_idx on public.pharmacy_stock_holds(batch_id,hold_status);
