-- PharmaSuite P0: customer/distributor ledgers, allocations, cash control, settings and permission foundation.
-- Append-only financial entries; balances are derived from debit/credit rows, never edited directly.

create table if not exists public.pharmacy_customer_ledger (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id),
 branch_id uuid not null references public.branches(id),
 patient_id uuid not null references public.patients(id),
 entry_type text not null check(entry_type in ('opening','invoice','receipt','credit_note','refund','adjustment','write_off')),
 entry_date date not null default current_date,
 due_date date,
 reference_type text,
 reference_id uuid,
 reference_number text,
 description text,
 debit numeric(14,2) not null default 0 check(debit>=0),
 credit numeric(14,2) not null default 0 check(credit>=0),
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 check ((debit>0 and credit=0) or (credit>0 and debit=0))
);
create index if not exists pharmacy_customer_ledger_party_date_idx on public.pharmacy_customer_ledger(tenant_id,branch_id,patient_id,entry_date,id);

create table if not exists public.pharmacy_distributor_ledger (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id),
 branch_id uuid not null references public.branches(id),
 supplier_id uuid not null references public.pharmacy_suppliers(id),
 entry_type text not null check(entry_type in ('opening','purchase_invoice','payment','debit_note','credit_note','advance','adjustment','refund')),
 entry_date date not null default current_date,
 due_date date,
 reference_type text,
 reference_id uuid,
 reference_number text,
 description text,
 debit numeric(14,2) not null default 0 check(debit>=0),
 credit numeric(14,2) not null default 0 check(credit>=0),
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 check ((debit>0 and credit=0) or (credit>0 and debit=0))
);
create index if not exists pharmacy_distributor_ledger_party_date_idx on public.pharmacy_distributor_ledger(tenant_id,branch_id,supplier_id,entry_date,id);

create table if not exists public.pharmacy_ledger_allocations (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id),
 branch_id uuid not null references public.branches(id),
 ledger_type text not null check(ledger_type in ('customer','distributor')),
 payment_entry_id uuid not null,
 invoice_entry_id uuid not null,
 amount numeric(14,2) not null check(amount>0),
 allocated_by uuid references auth.users(id),
 allocated_at timestamptz not null default now(),
 unique(tenant_id,ledger_type,payment_entry_id,invoice_entry_id)
);
create index if not exists pharmacy_ledger_allocations_invoice_idx on public.pharmacy_ledger_allocations(tenant_id,ledger_type,invoice_entry_id);

create table if not exists public.pharmacy_cash_sessions (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id),
 branch_id uuid not null references public.branches(id),
 opened_by uuid not null references auth.users(id),
 opened_at timestamptz not null default now(),
 opening_cash numeric(14,2) not null default 0 check(opening_cash>=0),
 expected_cash numeric(14,2),
 counted_cash numeric(14,2),
 variance numeric(14,2),
 closed_by uuid references auth.users(id),
 closed_at timestamptz,
 status text not null default 'open' check(status in ('open','closed','reopened')),
 close_notes text,
 unique(tenant_id,branch_id,id)
);
create unique index if not exists pharmacy_one_open_cash_session_per_branch on public.pharmacy_cash_sessions(tenant_id,branch_id) where status='open';

create table if not exists public.pharmacy_cashbook_entries (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id),
 branch_id uuid not null references public.branches(id),
 session_id uuid references public.pharmacy_cash_sessions(id),
 entry_type text not null check(entry_type in ('sale_collection','customer_receipt','supplier_payment','expense','refund','cash_to_bank','bank_to_cash','opening','adjustment')),
 direction text not null check(direction in ('in','out')),
 amount numeric(14,2) not null check(amount>0),
 payment_method text not null default 'cash',
 reference_number text,
 description text,
 source_type text,
 source_id uuid,
 occurred_at timestamptz not null default now(),
 recorded_by uuid references auth.users(id),
 reversed_entry_id uuid references public.pharmacy_cashbook_entries(id)
);
create index if not exists pharmacy_cashbook_branch_date_idx on public.pharmacy_cashbook_entries(tenant_id,branch_id,occurred_at desc);

create table if not exists public.pharmacy_settings (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id),
 branch_id uuid references public.branches(id),
 setting_key text not null,
 setting_value jsonb not null default '{}'::jsonb,
 updated_by uuid references auth.users(id),
 updated_at timestamptz not null default now(),
 unique(tenant_id,branch_id,setting_key)
);

create table if not exists public.pharmacy_role_permissions (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id),
 role_key text not null,
 permission_key text not null,
 allowed boolean not null default false,
 branch_id uuid references public.branches(id),
 updated_by uuid references auth.users(id),
 updated_at timestamptz not null default now(),
 unique(tenant_id,role_key,permission_key,branch_id)
);

create table if not exists public.pharmacy_backup_jobs (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id),
 requested_by uuid not null references auth.users(id),
 backup_type text not null default 'export' check(backup_type in ('export','restore_drill','restore')),
 status text not null default 'requested' check(status in ('requested','running','completed','failed','verified')),
 storage_path text,
 checksum text,
 record_manifest jsonb not null default '{}'::jsonb,
 notes text,
 requested_at timestamptz not null default now(),
 completed_at timestamptz
);

do $$
declare t text;
begin
 foreach t in array array['pharmacy_customer_ledger','pharmacy_distributor_ledger','pharmacy_ledger_allocations','pharmacy_cash_sessions','pharmacy_cashbook_entries','pharmacy_settings','pharmacy_role_permissions','pharmacy_backup_jobs'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon',t);
  execute format('grant select,insert,update on public.%I to authenticated',t);
 end loop;
end $$;

create policy pharmacy_customer_ledger_read on public.pharmacy_customer_ledger for select to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,false));
create policy pharmacy_customer_ledger_write on public.pharmacy_customer_ledger for insert to authenticated
 with check(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true));
create policy pharmacy_distributor_ledger_read on public.pharmacy_distributor_ledger for select to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,false));
create policy pharmacy_distributor_ledger_write on public.pharmacy_distributor_ledger for insert to authenticated
 with check(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true));
create policy pharmacy_ledger_allocations_read on public.pharmacy_ledger_allocations for select to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,false));
create policy pharmacy_ledger_allocations_write on public.pharmacy_ledger_allocations for insert to authenticated
 with check(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true));
create policy pharmacy_cash_sessions_read on public.pharmacy_cash_sessions for select to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,false));
create policy pharmacy_cash_sessions_write on public.pharmacy_cash_sessions for all to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true))
 with check(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true));
create policy pharmacy_cashbook_read on public.pharmacy_cashbook_entries for select to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,false));
create policy pharmacy_cashbook_write on public.pharmacy_cashbook_entries for insert to authenticated
 with check(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true));
create policy pharmacy_settings_read on public.pharmacy_settings for select to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,false));
create policy pharmacy_settings_write on public.pharmacy_settings for all to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true))
 with check(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true));
create policy pharmacy_role_permissions_read on public.pharmacy_role_permissions for select to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,false));
create policy pharmacy_role_permissions_write on public.pharmacy_role_permissions for all to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true))
 with check(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true));
create policy pharmacy_backup_jobs_read on public.pharmacy_backup_jobs for select to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',null,false));
create policy pharmacy_backup_jobs_write on public.pharmacy_backup_jobs for insert to authenticated
 with check(private.has_module_access(tenant_id,'pharmacy_suite',null,true));

-- Financial source rows are append-only. Corrections use compensating entries.
create or replace function private.prevent_pharmacy_ledger_mutation()
returns trigger language plpgsql set search_path=pg_catalog
as $$ begin raise exception 'Financial ledger entries are immutable; post a reversal/correction entry'; end $$;
drop trigger if exists pharmacy_customer_ledger_immutable on public.pharmacy_customer_ledger;
create trigger pharmacy_customer_ledger_immutable before update or delete on public.pharmacy_customer_ledger for each row execute function private.prevent_pharmacy_ledger_mutation();
drop trigger if exists pharmacy_distributor_ledger_immutable on public.pharmacy_distributor_ledger;
create trigger pharmacy_distributor_ledger_immutable before update or delete on public.pharmacy_distributor_ledger for each row execute function private.prevent_pharmacy_ledger_mutation();
drop trigger if exists pharmacy_cashbook_immutable on public.pharmacy_cashbook_entries;
create trigger pharmacy_cashbook_immutable before update or delete on public.pharmacy_cashbook_entries for each row execute function private.prevent_pharmacy_ledger_mutation();

-- Record metadata-only audit events for all P0 financial/configuration writes.
create or replace function private.audit_pharmacy_p0_insert()
returns trigger language plpgsql security definer set search_path=pg_catalog,public
as $$
declare v_tenant uuid; v_branch uuid; v_id text;
begin
 v_tenant:=new.tenant_id;
 if to_jsonb(new) ? 'branch_id' then v_branch:=nullif(to_jsonb(new)->>'branch_id','')::uuid; end if;
 v_id:=to_jsonb(new)->>'id';
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id,metadata)
 values(v_tenant,v_branch,auth.uid(),tg_table_name||'.insert',tg_table_name,v_id,jsonb_build_object('entry_type',to_jsonb(new)->>'entry_type','setting_key',to_jsonb(new)->>'setting_key'));
 return new;
end $$;
do $$
declare t text;
begin
 foreach t in array array['pharmacy_customer_ledger','pharmacy_distributor_ledger','pharmacy_ledger_allocations','pharmacy_cash_sessions','pharmacy_cashbook_entries','pharmacy_settings','pharmacy_role_permissions','pharmacy_backup_jobs'] loop
  execute format('drop trigger if exists audit_pharmacy_p0_insert on public.%I',t);
  execute format('create trigger audit_pharmacy_p0_insert after insert on public.%I for each row execute function private.audit_pharmacy_p0_insert()',t);
 end loop;
end $$;
