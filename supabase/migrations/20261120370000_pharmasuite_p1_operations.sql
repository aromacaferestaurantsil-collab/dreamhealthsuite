-- PharmaSuite P1: stock locations/counts, expiry claims, GST support, refill reminders and order timeline.
alter table public.medicine_batches add column if not exists location_id uuid;
alter table public.pharmacy_suppliers add column if not exists drug_license_number text;
alter table public.pharmacy_suppliers add column if not exists drug_license_expiry date;
alter table public.pharmacy_suppliers add column if not exists payment_terms_days integer not null default 30 check(payment_terms_days>=0);
alter table public.pharmacy_suppliers add column if not exists credit_limit numeric(14,2) not null default 0 check(credit_limit>=0);

create table if not exists public.pharmacy_stock_locations (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id),
 branch_id uuid not null references public.branches(id), location_code text not null,
 location_name text not null, location_type text not null default 'rack' check(location_type in ('rack','bin','shelf','godown','cold_storage')),
 parent_location_id uuid references public.pharmacy_stock_locations(id), is_active boolean not null default true,
 created_at timestamptz not null default now(), unique(tenant_id,branch_id,location_code)
);
alter table public.medicine_batches drop constraint if exists medicine_batches_location_id_fkey;
alter table public.medicine_batches add constraint medicine_batches_location_id_fkey foreign key(location_id) references public.pharmacy_stock_locations(id);

create table if not exists public.pharmacy_stock_counts (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id),
 branch_id uuid not null references public.branches(id), count_number text not null,
 count_type text not null default 'cycle' check(count_type in ('cycle','blind','full','rack')),
 status text not null default 'draft' check(status in ('draft','counting','submitted','approved','rejected')),
 location_id uuid references public.pharmacy_stock_locations(id), started_by uuid references auth.users(id),
 approved_by uuid references auth.users(id), notes text, started_at timestamptz not null default now(),
 submitted_at timestamptz, approved_at timestamptz, unique(tenant_id,count_number)
);
create table if not exists public.pharmacy_stock_count_items (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id),
 count_id uuid not null references public.pharmacy_stock_counts(id) on delete cascade,
 batch_id uuid not null references public.medicine_batches(id), system_quantity numeric(14,3) not null,
 counted_quantity numeric(14,3), variance numeric(14,3) generated always as (counted_quantity-system_quantity) stored,
 counted_by uuid references auth.users(id), counted_at timestamptz,
 unique(tenant_id,count_id,batch_id)
);

create table if not exists public.pharmacy_expiry_claims (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id),
 branch_id uuid not null references public.branches(id), supplier_id uuid not null references public.pharmacy_suppliers(id),
 batch_id uuid not null references public.medicine_batches(id), claim_number text not null,
 claim_type text not null check(claim_type in ('expiry','damage','shortage','recall')),
 quantity numeric(14,3) not null check(quantity>0), claim_amount numeric(14,2) not null default 0 check(claim_amount>=0),
 status text not null default 'draft' check(status in ('draft','submitted','accepted','rejected','credited','closed')),
 supplier_reference text, notes text, created_by uuid references auth.users(id), created_at timestamptz not null default now(),
 resolved_at timestamptz, unique(tenant_id,claim_number)
);

create table if not exists public.pharmacy_gst_reconciliations (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id),
 branch_id uuid not null references public.branches(id), period_start date not null, period_end date not null,
 reconciliation_type text not null check(reconciliation_type in ('sales_gstr1','sales_gstr3b','purchase_gstr2b')),
 status text not null default 'draft' check(status in ('draft','reviewed','filed','locked')),
 source_totals jsonb not null default '{}'::jsonb, reported_totals jsonb not null default '{}'::jsonb,
 variance_totals jsonb not null default '{}'::jsonb, notes text, prepared_by uuid references auth.users(id),
 reviewed_by uuid references auth.users(id), created_at timestamptz not null default now(),
 check(period_end>=period_start)
);
create table if not exists public.pharmacy_gst_reconciliation_lines (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id),
 reconciliation_id uuid not null references public.pharmacy_gst_reconciliations(id) on delete cascade,
 document_number text, document_date date, counterparty_gstin text, hsn_code text,
 taxable_value numeric(14,2) not null default 0, cgst numeric(14,2) not null default 0,
 sgst numeric(14,2) not null default 0, igst numeric(14,2) not null default 0,
 source_reference text, reported_reference text, match_status text not null default 'unmatched'
  check(match_status in ('matched','unmatched','value_mismatch','duplicate','excluded')), notes text
);

create table if not exists public.pharmacy_refill_reminders (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id),
 branch_id uuid not null references public.branches(id), patient_id uuid not null references public.patients(id),
 medicine_id uuid not null references public.medicine_catalogue(id), last_sale_id uuid references public.pharmacy_sales(id),
 expected_refill_date date not null, reminder_status text not null default 'scheduled'
  check(reminder_status in ('scheduled','sent','snoozed','completed','cancelled','opted_out')),
 channel text not null default 'in_app' check(channel in ('in_app','sms','whatsapp','email','push')),
 consent_recorded boolean not null default false, consent_recorded_at timestamptz,
 sent_at timestamptz, snoozed_until date, created_by uuid references auth.users(id), created_at timestamptz not null default now(),
 check(reminder_status not in ('sent') or consent_recorded=true)
);
create index if not exists pharmacy_refill_due_idx on public.pharmacy_refill_reminders(tenant_id,branch_id,expected_refill_date) where reminder_status='scheduled';

create table if not exists public.pharmacy_customer_order_events (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id),
 branch_id uuid not null references public.branches(id), order_id uuid not null references public.pharmacy_customer_orders(id) on delete cascade,
 event_type text not null, event_status text, note text, visible_to_customer boolean not null default true,
 actor_user_id uuid references auth.users(id), occurred_at timestamptz not null default now()
);
create index if not exists pharmacy_order_events_timeline_idx on public.pharmacy_customer_order_events(tenant_id,order_id,occurred_at);

do $$
declare t text;
begin
 foreach t in array array['pharmacy_stock_locations','pharmacy_stock_counts','pharmacy_stock_count_items','pharmacy_expiry_claims','pharmacy_gst_reconciliations','pharmacy_gst_reconciliation_lines','pharmacy_refill_reminders','pharmacy_customer_order_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon',t);
  execute format('grant select,insert,update on public.%I to authenticated',t);
 end loop;
end $$;
create policy p1_locations_read on public.pharmacy_stock_locations for select to authenticated using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,false));
create policy p1_locations_write on public.pharmacy_stock_locations for all to authenticated using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true)) with check(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true));
create policy p1_counts_read on public.pharmacy_stock_counts for select to authenticated using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,false));
create policy p1_counts_write on public.pharmacy_stock_counts for all to authenticated using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true)) with check(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true));
create policy p1_count_items_read on public.pharmacy_stock_count_items for select to authenticated using(private.has_module_access(tenant_id,'pharmacy_suite',null,false));
create policy p1_count_items_write on public.pharmacy_stock_count_items for all to authenticated using(private.has_module_access(tenant_id,'pharmacy_suite',null,true)) with check(private.has_module_access(tenant_id,'pharmacy_suite',null,true));
create policy p1_expiry_claims_read on public.pharmacy_expiry_claims for select to authenticated using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,false));
create policy p1_expiry_claims_write on public.pharmacy_expiry_claims for all to authenticated using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true)) with check(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true));
create policy p1_gst_read on public.pharmacy_gst_reconciliations for select to authenticated using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,false));
create policy p1_gst_write on public.pharmacy_gst_reconciliations for all to authenticated using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true)) with check(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true));
create policy p1_gst_lines_read on public.pharmacy_gst_reconciliation_lines for select to authenticated using(private.has_module_access(tenant_id,'pharmacy_suite',null,false));
create policy p1_gst_lines_write on public.pharmacy_gst_reconciliation_lines for all to authenticated using(private.has_module_access(tenant_id,'pharmacy_suite',null,true)) with check(private.has_module_access(tenant_id,'pharmacy_suite',null,true));
create policy p1_refills_read on public.pharmacy_refill_reminders for select to authenticated using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,false));
create policy p1_refills_write on public.pharmacy_refill_reminders for all to authenticated using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true)) with check(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true));
create policy p1_order_events_read on public.pharmacy_customer_order_events for select to authenticated using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,false));
create policy p1_order_events_write on public.pharmacy_customer_order_events for insert to authenticated with check(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true));

-- Existing checkout already consumes batches in expiry-date order. Harden it to exclude held/quarantined stock.
create or replace function public.pharmacy_checkout_v2(p_tenant_id uuid,p_branch_id uuid,p_invoice_number text,p_items jsonb,p_payment_method text,p_payment_status text,p_idempotency_key uuid,p_patient_id uuid default null,p_prescription_reference text default null)
returns uuid language plpgsql set search_path=pg_catalog,public,private as $$
declare v_user uuid:=auth.uid(); v_sale uuid; v_item jsonb; v_med uuid; v_qty numeric; v_remaining numeric; v_take numeric; v_batch record; v_price numeric; v_tax numeric; v_sub numeric:=0; v_tax_total numeric:=0; v_line numeric; v_line_tax numeric; v_held numeric;
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
  if v_qty<=0 then raise exception 'Quantity must be positive'; end if; v_remaining:=v_qty;
  for v_batch in
   select b.id,b.quantity_on_hand,b.selling_rate,m.gst_rate
   from public.medicine_batches b join public.medicine_catalogue m on m.id=b.medicine_id and m.tenant_id=b.tenant_id
   where b.tenant_id=p_tenant_id and b.branch_id=p_branch_id and b.medicine_id=v_med and b.quantity_on_hand>0 and b.expiry_date>=current_date
   order by b.expiry_date,b.received_at,b.id for update of b
  loop
   select coalesce(sum(h.held_quantity),0) into v_held from public.pharmacy_stock_holds h where h.tenant_id=p_tenant_id and h.branch_id=p_branch_id and h.batch_id=v_batch.id and h.hold_status='active';
   v_take:=least(v_remaining,greatest(v_batch.quantity_on_hand-v_held,0));
   if v_take<=0 then continue; end if;
   v_price:=coalesce(nullif(v_item->>'unit_price','')::numeric,v_batch.selling_rate); v_tax:=v_batch.gst_rate;
   v_line:=round(v_take*v_price,2); v_line_tax:=round(v_line*v_tax/100,2);
   update public.medicine_batches set quantity_on_hand=quantity_on_hand-v_take where id=v_batch.id;
   insert into public.pharmacy_sale_items(tenant_id,sale_id,medicine_id,batch_id,quantity,unit_price,tax_rate,line_total) values(p_tenant_id,v_sale,v_med,v_batch.id,v_take,v_price,v_tax,v_line+v_line_tax);
   insert into public.pharmacy_stock_movements(tenant_id,branch_id,medicine_id,batch_id,movement_type,quantity_delta,reference_type,reference_id,actor_user_id) values(p_tenant_id,p_branch_id,v_med,v_batch.id,'sale',-v_take,'pharmacy_sale',v_sale,v_user);
   v_sub:=v_sub+v_line; v_tax_total:=v_tax_total+v_line_tax; v_remaining:=v_remaining-v_take; exit when v_remaining<=0;
  end loop;
  if v_remaining>0 then raise exception 'Insufficient available unexpired stock (excluding quarantined/held stock) for medicine %',v_med; end if;
 end loop;
 update public.pharmacy_sales set subtotal=v_sub,tax_total=v_tax_total,grand_total=v_sub+v_tax_total,sale_status='completed',payment_status=p_payment_status where id=v_sale;
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id,metadata) values(p_tenant_id,p_branch_id,v_user,'pharmacy.checkout','pharmacy_sale',v_sale::text,jsonb_build_object('invoice',p_invoice_number,'payment_status',p_payment_status,'fefo',true,'held_stock_excluded',true));
 return v_sale;
end $$;
grant execute on function public.pharmacy_checkout_v2(uuid,uuid,text,jsonb,text,text,uuid,uuid,text) to authenticated;

-- Controlled-drug register is immutable; use separately recorded corrections/reversals.
create or replace function private.prevent_controlled_register_mutation()
returns trigger language plpgsql set search_path=pg_catalog
as $$ begin raise exception 'Controlled-drug register is immutable; record a reasoned correction entry'; end $$;
drop trigger if exists pharmacy_controlled_register_immutable on public.pharmacy_controlled_drug_register;
create trigger pharmacy_controlled_register_immutable before update or delete on public.pharmacy_controlled_drug_register for each row execute function private.prevent_controlled_register_mutation();

-- Capture customer-visible order status changes without storing prescription contents in the timeline.
create or replace function private.pharmacy_order_status_timeline()
returns trigger language plpgsql security definer set search_path=pg_catalog,public
as $$
begin
 if tg_op='INSERT' then
  insert into public.pharmacy_customer_order_events(tenant_id,branch_id,order_id,event_type,event_status,actor_user_id)
  values(new.tenant_id,new.branch_id,new.id,'order_created',new.order_status,auth.uid());
 elsif new.order_status is distinct from old.order_status then
  insert into public.pharmacy_customer_order_events(tenant_id,branch_id,order_id,event_type,event_status,actor_user_id)
  values(new.tenant_id,new.branch_id,new.id,'status_changed',new.order_status,auth.uid());
 end if;
 return new;
end $$;
drop trigger if exists pharmacy_order_status_timeline on public.pharmacy_customer_orders;
create trigger pharmacy_order_status_timeline after insert or update of order_status on public.pharmacy_customer_orders for each row execute function private.pharmacy_order_status_timeline();
