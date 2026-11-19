-- Reconstructed PharmaSuite capabilities. Branch-only proposal; never apply to production.
-- Source: verified public schema inventory + requested workflow requirements.
create table if not exists public.pharmacy_supplier_offers (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id),
 supplier_id uuid not null references public.pharmacy_suppliers(id), medicine_id uuid not null references public.medicine_catalogue(id),
 valid_from date not null default current_date, valid_until date, list_rate numeric(14,4) not null check(list_rate>=0),
 discount_percent numeric(7,3) not null default 0 check(discount_percent between 0 and 100),
 rebate_per_unit numeric(14,4) not null default 0 check(rebate_per_unit>=0),
 scheme_buy_qty numeric(14,3) not null default 0 check(scheme_buy_qty>=0),
 scheme_free_qty numeric(14,3) not null default 0 check(scheme_free_qty>=0),
 notes text, created_at timestamptz not null default now(),
 check(valid_until is null or valid_until>=valid_from)
);
create index if not exists pharmacy_supplier_offers_lookup_idx on public.pharmacy_supplier_offers(tenant_id,medicine_id,valid_from,valid_until);

create table if not exists public.pharmacy_expenses (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id),
 branch_id uuid not null references public.branches(id), category text not null, description text not null,
 amount numeric(14,2) not null check(amount>0), expense_date date not null default current_date,
 payment_status text not null default 'unpaid' check(payment_status in ('unpaid','part_paid','paid')),
 payment_method text, reference_number text, supplier_id uuid references public.pharmacy_suppliers(id),
 created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create index if not exists pharmacy_expenses_tenant_date_idx on public.pharmacy_expenses(tenant_id,branch_id,expense_date desc);
create table if not exists public.pharmacy_expense_payments (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id),
 expense_id uuid not null references public.pharmacy_expenses(id), amount numeric(14,2) not null check(amount>0),
 payment_method text not null, reference_number text, paid_at timestamptz not null default now(),
 recorded_by uuid references auth.users(id)
);

create table if not exists public.employee_attendance (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id),
 branch_id uuid not null references public.branches(id), employee_user_id uuid references auth.users(id),
 employee_name text not null, attendance_date date not null default current_date,
 attendance_status text not null check(attendance_status in ('present','absent','half_day')),
 notes text, recorded_by uuid references auth.users(id), created_at timestamptz not null default now(),
 unique(tenant_id,branch_id,employee_user_id,attendance_date)
);
create index if not exists employee_attendance_date_idx on public.employee_attendance(tenant_id,branch_id,attendance_date desc);

create table if not exists public.pharmacy_customer_orders (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id),
 branch_id uuid not null references public.branches(id), patient_id uuid references public.patients(id),
 order_number text not null, order_status text not null default 'submitted'
  check(order_status in ('submitted','review_required','approved','rejected','ready','completed','cancelled')),
 prescription_path text, customer_notes text, reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz, created_at timestamptz not null default now(),
 unique(tenant_id,order_number)
);
create table if not exists public.pharmacy_customer_order_items (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id),
 order_id uuid not null references public.pharmacy_customer_orders(id) on delete cascade,
 medicine_id uuid references public.medicine_catalogue(id), requested_name text,
 quantity numeric(14,3) not null check(quantity>0), suggested_medicine_id uuid references public.medicine_catalogue(id),
 pharmacist_note text, item_status text not null default 'pending'
  check(item_status in ('pending','approved','substituted','unavailable','rejected'))
);
create table if not exists public.pharmacy_prescription_reviews (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id),
 order_id uuid not null references public.pharmacy_customer_orders(id), reviewer_id uuid not null references auth.users(id),
 decision text not null check(decision in ('approved','rejected','clarification_required')),
 notes text, created_at timestamptz not null default now()
);

create table if not exists public.pharmacy_referrals (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id),
 branch_id uuid references public.branches(id), referrer_patient_id uuid references public.patients(id),
 referred_patient_id uuid references public.patients(id), referral_code text not null,
 referral_status text not null default 'pending' check(referral_status in ('pending','qualified','rewarded','expired')),
 reward_points integer not null default 0 check(reward_points>=0), created_at timestamptz not null default now(),
 unique(tenant_id,referral_code)
);

create table if not exists public.pharmacy_stock_holds (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id),
 branch_id uuid not null references public.branches(id), batch_id uuid not null references public.medicine_batches(id),
 hold_type text not null check(hold_type in ('quarantine','recall')),
 reason text not null, reference_number text, hold_status text not null default 'active'
  check(hold_status in ('active','released','destroyed')), held_quantity numeric(14,3) not null check(held_quantity>0),
 created_by uuid references auth.users(id), released_by uuid references auth.users(id), created_at timestamptz not null default now(),
 released_at timestamptz
);
create index if not exists pharmacy_stock_holds_active_idx on public.pharmacy_stock_holds(tenant_id,branch_id,batch_id) where hold_status='active';

-- RLS: authenticated tenant members only; all operations are module- and branch-scoped.
do $$
declare t text;
begin
 foreach t in array array['pharmacy_supplier_offers','pharmacy_expenses','pharmacy_expense_payments',
 'employee_attendance','pharmacy_customer_orders','pharmacy_customer_order_items',
 'pharmacy_prescription_reviews','pharmacy_referrals','pharmacy_stock_holds'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 end loop;
end $$;

create policy supplier_offers_read on public.pharmacy_supplier_offers for select to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',null,false));
create policy supplier_offers_write on public.pharmacy_supplier_offers for all to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',null,true))
 with check(private.has_module_access(tenant_id,'pharmacy_suite',null,true));

create policy pharmacy_expenses_read on public.pharmacy_expenses for select to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,false));
create policy pharmacy_expenses_write on public.pharmacy_expenses for all to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true))
 with check(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true));
create policy pharmacy_expense_payments_read on public.pharmacy_expense_payments for select to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',null,false));
create policy pharmacy_expense_payments_write on public.pharmacy_expense_payments for all to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',null,true))
 with check(private.has_module_access(tenant_id,'pharmacy_suite',null,true));

create policy employee_attendance_read on public.employee_attendance for select to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,false));
create policy employee_attendance_write on public.employee_attendance for all to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true))
 with check(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true));

create policy customer_orders_read on public.pharmacy_customer_orders for select to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,false));
create policy customer_orders_write on public.pharmacy_customer_orders for all to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true))
 with check(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true));
create policy customer_order_items_read on public.pharmacy_customer_order_items for select to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',null,false));
create policy customer_order_items_write on public.pharmacy_customer_order_items for all to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',null,true))
 with check(private.has_module_access(tenant_id,'pharmacy_suite',null,true));
create policy prescription_reviews_read on public.pharmacy_prescription_reviews for select to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',null,false));
create policy prescription_reviews_write on public.pharmacy_prescription_reviews for all to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',null,true))
 with check(private.has_module_access(tenant_id,'pharmacy_suite',null,true));

create policy pharmacy_referrals_read on public.pharmacy_referrals for select to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,false));
create policy pharmacy_referrals_write on public.pharmacy_referrals for all to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true))
 with check(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true));

create policy pharmacy_stock_holds_read on public.pharmacy_stock_holds for select to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,false));
create policy pharmacy_stock_holds_write on public.pharmacy_stock_holds for all to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true))
 with check(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true));

-- All mutations above remain gated by RLS. Production payment settlement, customer checkout,
-- prescription approval and stock hold/release must be promoted to audited RPCs before production.
