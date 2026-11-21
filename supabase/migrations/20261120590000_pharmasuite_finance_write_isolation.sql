-- Finance integrity: prevent direct ledger/cash mutations and keep writes behind audited RPCs.
drop policy if exists pharmacy_customer_ledger_write on public.pharmacy_customer_ledger;
drop policy if exists pharmacy_distributor_ledger_write on public.pharmacy_distributor_ledger;
drop policy if exists pharmacy_ledger_allocations_write on public.pharmacy_ledger_allocations;
drop policy if exists supplier_payments_insert on public.pharmacy_supplier_payments;
drop policy if exists pharmacy_expense_payments_insert on public.pharmacy_expense_payments;
drop policy if exists pharmacy_cash_sessions_write on public.pharmacy_cash_sessions;
drop policy if exists pharmacy_cashbook_write on public.pharmacy_cashbook_entries;

revoke insert,update,delete on public.pharmacy_customer_ledger from authenticated;
revoke insert,update,delete on public.pharmacy_distributor_ledger from authenticated;
revoke insert,update,delete on public.pharmacy_ledger_allocations from authenticated;
revoke insert,update,delete on public.pharmacy_supplier_payments from authenticated;
revoke insert,update,delete on public.pharmacy_expense_payments from authenticated;
revoke insert,update,delete on public.pharmacy_cash_sessions from authenticated;
revoke insert,update,delete on public.pharmacy_cashbook_entries from authenticated;
grant select on public.pharmacy_customer_ledger,public.pharmacy_distributor_ledger,
 public.pharmacy_ledger_allocations,public.pharmacy_supplier_payments,
 public.pharmacy_expense_payments,public.pharmacy_cash_sessions,public.pharmacy_cashbook_entries to authenticated;

create unique index if not exists pharmacy_cash_one_open_session_per_branch_uidx
 on public.pharmacy_cash_sessions(tenant_id,branch_id) where status='open';
create unique index if not exists pharmacy_customer_receipt_number_uidx
 on public.pharmacy_customer_ledger(tenant_id,branch_id,reference_number)
 where entry_type='receipt' and reference_number is not null;

create or replace function private.pharmacy_open_cash_session_impl(
 p_tenant_id uuid,p_branch_id uuid,p_opening_cash numeric
) returns uuid
language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare v_id uuid; v_user uuid:=auth.uid();
begin
 if v_user is null or not private.has_module_access(p_tenant_id,'pharmacy_suite',p_branch_id,true) then
  raise exception 'No pharmacy permission';
 end if;
 if p_opening_cash is null or p_opening_cash<0 then raise exception 'Opening cash cannot be negative'; end if;
 if not exists(select 1 from public.branches where id=p_branch_id and tenant_id=p_tenant_id and status='active') then
  raise exception 'Active branch not found';
 end if;
 insert into public.pharmacy_cash_sessions(tenant_id,branch_id,opened_by,opening_cash,status)
 values(p_tenant_id,p_branch_id,v_user,p_opening_cash,'open') returning id into v_id;
 if p_opening_cash>0 then
  insert into public.pharmacy_cashbook_entries(
   tenant_id,branch_id,session_id,entry_type,direction,amount,payment_method,description,recorded_by
  ) values(p_tenant_id,p_branch_id,v_id,'opening','in',p_opening_cash,'cash','Opening cash balance',v_user);
 end if;
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id,metadata)
 values(p_tenant_id,p_branch_id,v_user,'pharmacy.cash_session_opened','cash_session',v_id::text,
  jsonb_build_object('opening_cash',p_opening_cash));
 return v_id;
end;
$$;

create or replace function private.pharmacy_close_cash_session_impl(
 p_session_id uuid,p_counted_cash numeric,p_notes text default null
) returns void
language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare s public.pharmacy_cash_sessions%rowtype; v_expected numeric; v_user uuid:=auth.uid();
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 select * into s from public.pharmacy_cash_sessions where id=p_session_id for update;
 if not found or not private.has_module_access(s.tenant_id,'pharmacy_suite',s.branch_id,true) then
  raise exception 'Cash session unavailable';
 end if;
 if s.status<>'open' then raise exception 'Cash session is not open'; end if;
 if p_counted_cash is null or p_counted_cash<0 then raise exception 'Counted cash cannot be negative'; end if;
 if length(coalesce(p_notes,''))>1000 then raise exception 'Closing notes are too long'; end if;
 select s.opening_cash+coalesce(sum(case when direction='in' then amount else -amount end),0)
  into v_expected from public.pharmacy_cashbook_entries
  where session_id=s.id and entry_type<>'opening';
 update public.pharmacy_cash_sessions set expected_cash=v_expected,counted_cash=p_counted_cash,
  variance=p_counted_cash-v_expected,closed_by=v_user,closed_at=now(),status='closed',close_notes=p_notes
 where id=s.id;
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id,metadata)
 values(s.tenant_id,s.branch_id,v_user,'pharmacy.cash_session_closed','cash_session',s.id::text,
  jsonb_build_object('expected',v_expected,'counted',p_counted_cash,'variance',p_counted_cash-v_expected));
end;
$$;

create or replace function private.pharmacy_post_customer_receipt_impl(
 p_tenant_id uuid,p_branch_id uuid,p_patient_id uuid,p_receipt_number text,p_amount numeric,
 p_payment_method text,p_reference text default null,p_allocations jsonb default '[]'::jsonb
) returns uuid
language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare
 v_user uuid:=auth.uid(); v_receipt uuid; v_invoice uuid; v_amount numeric;
 v_allocated numeric:=0; v_invoice_due numeric; v_session uuid;
begin
 if v_user is null or not private.has_module_access(p_tenant_id,'pharmacy_suite',p_branch_id,true) then
  raise exception 'No pharmacy permission';
 end if;
 if not exists(select 1 from public.patients where id=p_patient_id and tenant_id=p_tenant_id and status='active') then
  raise exception 'Active customer profile not found in this tenant';
 end if;
 if p_amount is null or p_amount<=0 or nullif(btrim(p_receipt_number),'') is null then
  raise exception 'Receipt number and positive amount required';
 end if;
 if p_payment_method not in ('cash','upi','card','bank_transfer','cheque','other') then
  raise exception 'Invalid payment method';
 end if;
 if jsonb_typeof(coalesce(p_allocations,'[]'::jsonb))<>'array' then raise exception 'Allocations must be an array'; end if;
 if length(coalesce(p_reference,''))>120 or length(btrim(p_receipt_number))>80 then
  raise exception 'Receipt reference is too long';
 end if;
 if exists(select 1 from public.pharmacy_customer_ledger
  where tenant_id=p_tenant_id and branch_id=p_branch_id and reference_number=btrim(p_receipt_number) and entry_type='receipt') then
  raise exception 'Receipt number already exists';
 end if;
 if p_payment_method='cash' then
  select id into v_session from public.pharmacy_cash_sessions
   where tenant_id=p_tenant_id and branch_id=p_branch_id and status='open'
   order by opened_at desc limit 1 for update;
  if v_session is null then raise exception 'Open a cashier shift before posting a cash receipt'; end if;
 end if;
 insert into public.pharmacy_customer_ledger(
  tenant_id,branch_id,patient_id,entry_type,reference_type,reference_number,description,credit,created_by
 ) values(p_tenant_id,p_branch_id,p_patient_id,'receipt','customer_receipt',btrim(p_receipt_number),'Customer receipt',p_amount,v_user)
 returning id into v_receipt;
 for v_invoice,v_amount in
  select (x->>'invoice_entry_id')::uuid,(x->>'amount')::numeric
  from jsonb_array_elements(coalesce(p_allocations,'[]'::jsonb)) x
 loop
  if v_amount is null or v_amount<=0 then raise exception 'Allocation amount must be positive'; end if;
  perform 1 from public.pharmacy_customer_ledger
   where id=v_invoice and tenant_id=p_tenant_id and branch_id=p_branch_id
    and patient_id=p_patient_id and entry_type in ('invoice','opening') and debit>0 for update;
  if not found then raise exception 'Invoice not found for this customer'; end if;
  select debit-coalesce((select sum(a.amount) from public.pharmacy_ledger_allocations a
   where a.tenant_id=p_tenant_id and a.ledger_type='customer' and a.invoice_entry_id=v_invoice),0)
   into v_invoice_due from public.pharmacy_customer_ledger where id=v_invoice;
  if v_amount>v_invoice_due then raise exception 'Allocation exceeds invoice outstanding'; end if;
  insert into public.pharmacy_ledger_allocations(
   tenant_id,branch_id,ledger_type,payment_entry_id,invoice_entry_id,amount,allocated_by
  ) values(p_tenant_id,p_branch_id,'customer',v_receipt,v_invoice,v_amount,v_user);
  v_allocated:=v_allocated+v_amount;
 end loop;
 if v_allocated>p_amount then raise exception 'Allocated amount exceeds receipt amount'; end if;
 if p_payment_method='cash' then
  insert into public.pharmacy_cashbook_entries(
   tenant_id,branch_id,session_id,entry_type,direction,amount,payment_method,
   reference_number,description,source_type,source_id,recorded_by
  ) values(p_tenant_id,p_branch_id,v_session,'customer_receipt','in',p_amount,'cash',
   p_reference,'Customer receipt','customer_ledger',v_receipt,v_user);
 end if;
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id,metadata)
 values(p_tenant_id,p_branch_id,v_user,'pharmacy.customer_receipt_posted','customer_receipt',v_receipt::text,
  jsonb_build_object('receipt_number',p_receipt_number,'amount',p_amount,'allocated',v_allocated,'payment_method',p_payment_method));
 return v_receipt;
end;
$$;

create or replace function public.pharmacy_open_cash_session(p_tenant_id uuid,p_branch_id uuid,p_opening_cash numeric)
returns uuid language sql security invoker set search_path=pg_catalog,public,private
as $$ select private.pharmacy_open_cash_session_impl(p_tenant_id,p_branch_id,p_opening_cash) $$;
create or replace function public.pharmacy_close_cash_session(p_session_id uuid,p_counted_cash numeric,p_notes text default null)
returns void language sql security invoker set search_path=pg_catalog,public,private
as $$ select private.pharmacy_close_cash_session_impl(p_session_id,p_counted_cash,p_notes) $$;
create or replace function public.pharmacy_post_customer_receipt(
 p_tenant_id uuid,p_branch_id uuid,p_patient_id uuid,p_receipt_number text,p_amount numeric,
 p_payment_method text,p_reference text default null,p_allocations jsonb default '[]'::jsonb
) returns uuid language sql security invoker set search_path=pg_catalog,public,private
as $$ select private.pharmacy_post_customer_receipt_impl(
 p_tenant_id,p_branch_id,p_patient_id,p_receipt_number,p_amount,p_payment_method,p_reference,p_allocations
) $$;

revoke all on function private.pharmacy_open_cash_session_impl(uuid,uuid,numeric) from public,anon;
revoke all on function private.pharmacy_close_cash_session_impl(uuid,numeric,text) from public,anon;
revoke all on function private.pharmacy_post_customer_receipt_impl(uuid,uuid,uuid,text,numeric,text,text,jsonb) from public,anon;
grant execute on function private.pharmacy_open_cash_session_impl(uuid,uuid,numeric) to authenticated;
grant execute on function private.pharmacy_close_cash_session_impl(uuid,numeric,text) to authenticated;
grant execute on function private.pharmacy_post_customer_receipt_impl(uuid,uuid,uuid,text,numeric,text,text,jsonb) to authenticated;

revoke all on function public.pharmacy_open_cash_session(uuid,uuid,numeric) from public,anon;
revoke all on function public.pharmacy_close_cash_session(uuid,numeric,text) from public,anon;
revoke all on function public.pharmacy_post_customer_receipt(uuid,uuid,uuid,text,numeric,text,text,jsonb) from public,anon;
grant execute on function public.pharmacy_open_cash_session(uuid,uuid,numeric) to authenticated;
grant execute on function public.pharmacy_close_cash_session(uuid,numeric,text) to authenticated;
grant execute on function public.pharmacy_post_customer_receipt(uuid,uuid,uuid,text,numeric,text,text,jsonb) to authenticated;

-- Expense-payment reads must follow the parent expense branch.
drop policy if exists pharmacy_expense_payments_read on public.pharmacy_expense_payments;
create policy pharmacy_expense_payments_read on public.pharmacy_expense_payments for select to authenticated
 using(exists(select 1 from public.pharmacy_expenses e
  where e.id=pharmacy_expense_payments.expense_id and e.tenant_id=pharmacy_expense_payments.tenant_id
   and private.has_module_access(e.tenant_id,'pharmacy_suite',e.branch_id,false)));

-- GST reconciliation lines inherit the parent reconciliation's branch scope.
drop policy if exists p1_gst_lines_read on public.pharmacy_gst_reconciliation_lines;
drop policy if exists p1_gst_lines_write on public.pharmacy_gst_reconciliation_lines;
create policy p1_gst_lines_read on public.pharmacy_gst_reconciliation_lines for select to authenticated
 using(exists(select 1 from public.pharmacy_gst_reconciliations r
  where r.id=pharmacy_gst_reconciliation_lines.reconciliation_id
   and r.tenant_id=pharmacy_gst_reconciliation_lines.tenant_id
   and private.has_module_access(r.tenant_id,'pharmacy_suite',r.branch_id,false)));
create policy p1_gst_lines_write on public.pharmacy_gst_reconciliation_lines for all to authenticated
 using(exists(select 1 from public.pharmacy_gst_reconciliations r
  where r.id=pharmacy_gst_reconciliation_lines.reconciliation_id
   and r.tenant_id=pharmacy_gst_reconciliation_lines.tenant_id
   and private.has_module_access(r.tenant_id,'pharmacy_suite',r.branch_id,true)))
 with check(exists(select 1 from public.pharmacy_gst_reconciliations r
  where r.id=pharmacy_gst_reconciliation_lines.reconciliation_id
   and r.tenant_id=pharmacy_gst_reconciliation_lines.tenant_id
   and private.has_module_access(r.tenant_id,'pharmacy_suite',r.branch_id,true)));
