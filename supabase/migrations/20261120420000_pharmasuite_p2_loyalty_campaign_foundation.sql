-- PharmaSuite P2 foundation: loyalty ledger and discount campaign definitions.
-- Referral attribution is already represented by pharmacy_referrals; this migration extends it safely.
create table if not exists public.pharmacy_loyalty_programs (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 branch_id uuid references public.branches(id) on delete cascade,
 is_enabled boolean not null default false,
 earn_points_per_currency numeric(10,4) not null default 0.01 check(earn_points_per_currency>=0),
 redemption_value_per_point numeric(10,4) not null default 1 check(redemption_value_per_point>=0),
 minimum_redemption_points integer not null default 100 check(minimum_redemption_points>=0),
 points_expiry_days integer check(points_expiry_days is null or points_expiry_days>0),
 max_redemption_percent numeric(5,2) not null default 10 check(max_redemption_percent between 0 and 100),
 created_by uuid references auth.users(id),
 updated_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique nulls not distinct (tenant_id,branch_id)
);
create table if not exists public.pharmacy_loyalty_transactions (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 branch_id uuid not null references public.branches(id),
 patient_id uuid not null references public.patients(id),
 sale_id uuid references public.pharmacy_sales(id),
 transaction_type text not null check(transaction_type in ('earned','redeemed','expired','reversed','adjusted')),
 points numeric(14,3) not null check(points>0),
 source_key text not null,
 description text,
 reverses_transaction_id uuid references public.pharmacy_loyalty_transactions(id),
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 unique(tenant_id,source_key)
);
create index if not exists pharmacy_loyalty_patient_idx on public.pharmacy_loyalty_transactions(tenant_id,patient_id,created_at desc);
create table if not exists public.pharmacy_campaigns (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 branch_id uuid references public.branches(id) on delete cascade,
 campaign_name text not null,
 campaign_code text,
 discount_type text not null check(discount_type in ('percentage','fixed','buy_x_get_y')),
 discount_value numeric(14,2) not null default 0 check(discount_value>=0),
 minimum_bill_value numeric(14,2) not null default 0 check(minimum_bill_value>=0),
 maximum_discount numeric(14,2) check(maximum_discount is null or maximum_discount>=0),
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 usage_limit integer check(usage_limit is null or usage_limit>0),
 per_customer_limit integer check(per_customer_limit is null or per_customer_limit>0),
 eligible_customer_group text,
 eligible_medicine_ids uuid[] not null default '{}',
 excluded_medicine_ids uuid[] not null default '{}',
 prescription_items_excluded boolean not null default true,
 controlled_items_excluded boolean not null default true,
 requires_manager_approval boolean not null default false,
 status text not null default 'draft' check(status in ('draft','scheduled','active','paused','ended','archived')),
 created_by uuid references auth.users(id),
 updated_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(ends_at>starts_at),
 check(discount_type<>'percentage' or discount_value<=100),
 check(campaign_code is null or length(trim(campaign_code)) between 3 and 40)
);
create unique index if not exists pharmacy_campaign_code_scope_uidx
 on public.pharmacy_campaigns(tenant_id,coalesce(branch_id,'00000000-0000-0000-0000-000000000000'::uuid),lower(campaign_code))
 where campaign_code is not null;
create index if not exists pharmacy_campaign_active_idx on public.pharmacy_campaigns(tenant_id,branch_id,status,starts_at,ends_at);
create table if not exists public.pharmacy_campaign_redemptions (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 branch_id uuid not null references public.branches(id),
 campaign_id uuid not null references public.pharmacy_campaigns(id),
 sale_id uuid not null references public.pharmacy_sales(id),
 patient_id uuid references public.patients(id),
 discount_amount numeric(14,2) not null check(discount_amount>=0),
 redemption_status text not null default 'applied' check(redemption_status in ('applied','reversed')),
 reversed_at timestamptz,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 unique(tenant_id,campaign_id,sale_id)
);
alter table public.pharmacy_referrals
 add column if not exists reward_type text not null default 'points' check(reward_type in ('points','fixed_discount','coupon')),
 add column if not exists reward_amount numeric(14,2) not null default 0 check(reward_amount>=0),
 add column if not exists released_at timestamptz,
 add column if not exists reversed_at timestamptz,
 add column if not exists referred_sale_id uuid references public.pharmacy_sales(id),
 add column if not exists max_reward_cap numeric(14,2) check(max_reward_cap is null or max_reward_cap>=0);
do $$
declare t text;
begin
 foreach t in array array['pharmacy_loyalty_programs','pharmacy_loyalty_transactions','pharmacy_campaigns','pharmacy_campaign_redemptions'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon',t);
  execute format('grant select,insert,update on public.%I to authenticated',t);
 end loop;
end $$;
create policy p2_loyalty_program_read on public.pharmacy_loyalty_programs for select to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,false));
create policy p2_loyalty_program_write on public.pharmacy_loyalty_programs for all to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true))
 with check(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true));
create policy p2_loyalty_tx_read on public.pharmacy_loyalty_transactions for select to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,false));
create policy p2_loyalty_tx_insert on public.pharmacy_loyalty_transactions for insert to authenticated
 with check(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true));
create policy p2_campaign_read on public.pharmacy_campaigns for select to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,false));
create policy p2_campaign_write on public.pharmacy_campaigns for all to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true))
 with check(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true));
create policy p2_campaign_redemption_read on public.pharmacy_campaign_redemptions for select to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,false));
create policy p2_campaign_redemption_insert on public.pharmacy_campaign_redemptions for insert to authenticated
 with check(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true));
