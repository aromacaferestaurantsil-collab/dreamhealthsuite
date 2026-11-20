create or replace function public.pharmacy_post_customer_receipt(
 p_tenant_id uuid,p_branch_id uuid,p_patient_id uuid,p_receipt_number text,
 p_amount numeric,p_payment_method text,p_reference text default null,
 p_allocations jsonb default '[]'::jsonb
) returns uuid
language plpgsql security invoker set search_path=pg_catalog,public,private
as $$
declare v_user uuid:=auth.uid(); v_receipt uuid; v_invoice uuid; v_amount numeric; v_allocated numeric:=0; v_invoice_due numeric; v_session uuid;
begin
 if v_user is null or not private.has_module_access(p_tenant_id,'pharmacy_suite',p_branch_id,true) then raise exception 'No pharmacy permission'; end if;
 if p_amount<=0 or p_receipt_number is null or btrim(p_receipt_number)='' then raise exception 'Receipt number and positive amount required'; end if;
 if p_payment_method not in ('cash','upi','card','bank_transfer','cheque','other') then raise exception 'Invalid payment method'; end if;
 if jsonb_typeof(p_allocations)<>'array' then raise exception 'Allocations must be an array'; end if;
 if exists(select 1 from public.pharmacy_customer_ledger where tenant_id=p_tenant_id and branch_id=p_branch_id and reference_number=p_receipt_number and entry_type='receipt') then raise exception 'Receipt number already exists'; end if;
 insert into public.pharmacy_customer_ledger(tenant_id,branch_id,patient_id,entry_type,reference_type,reference_number,description,credit,created_by)
 values(p_tenant_id,p_branch_id,p_patient_id,'receipt','customer_receipt',p_receipt_number,'Customer receipt',p_amount,v_user) returning id into v_receipt;
 for v_invoice,v_amount in select (x->>'invoice_entry_id')::uuid,(x->>'amount')::numeric from jsonb_array_elements(p_allocations) x loop
  if v_amount<=0 then raise exception 'Allocation amount must be positive'; end if;
  perform 1 from public.pharmacy_customer_ledger where id=v_invoice and tenant_id=p_tenant_id and branch_id=p_branch_id and patient_id=p_patient_id and entry_type in ('invoice','opening') and debit>0 for update;
  if not found then raise exception 'Invoice not found for this customer'; end if;
  select debit-coalesce((select sum(a.amount) from public.pharmacy_ledger_allocations a where a.tenant_id=p_tenant_id and a.ledger_type='customer' and a.invoice_entry_id=v_invoice),0) into v_invoice_due from public.pharmacy_customer_ledger where id=v_invoice;
  if v_amount>v_invoice_due then raise exception 'Allocation exceeds invoice outstanding'; end if;
  insert into public.pharmacy_ledger_allocations(tenant_id,branch_id,ledger_type,payment_entry_id,invoice_entry_id,amount,allocated_by) values(p_tenant_id,p_branch_id,'customer',v_receipt,v_invoice,v_amount,v_user);
  v_allocated:=v_allocated+v_amount;
 end loop;
 if v_allocated>p_amount then raise exception 'Allocated amount exceeds receipt amount'; end if;
 if p_payment_method='cash' then
  select id into v_session from public.pharmacy_cash_sessions where tenant_id=p_tenant_id and branch_id=p_branch_id and status='open' order by opened_at desc limit 1 for update;
  if v_session is not null then insert into public.pharmacy_cashbook_entries(tenant_id,branch_id,session_id,entry_type,direction,amount,payment_method,reference_number,description,source_type,source_id,recorded_by)
   values(p_tenant_id,p_branch_id,v_session,'customer_receipt','in',p_amount,'cash',p_reference,'Customer receipt','customer_ledger',v_receipt,v_user); end if;
 end if;
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id,metadata) values(p_tenant_id,p_branch_id,v_user,'pharmacy.customer_receipt_posted','customer_receipt',v_receipt::text,jsonb_build_object('receipt_number',p_receipt_number,'amount',p_amount,'allocated',v_allocated,'payment_method',p_payment_method));
 return v_receipt;
end $$;
grant execute on function public.pharmacy_post_customer_receipt(uuid,uuid,uuid,text,numeric,text,text,jsonb) to authenticated;
create or replace function public.pharmacy_open_cash_session(p_tenant_id uuid,p_branch_id uuid,p_opening_cash numeric)
returns uuid language plpgsql security invoker set search_path=pg_catalog,public,private as $$
declare v_id uuid;
begin
 if auth.uid() is null or not private.has_module_access(p_tenant_id,'pharmacy_suite',p_branch_id,true) then raise exception 'No pharmacy permission'; end if;
 if p_opening_cash<0 then raise exception 'Opening cash cannot be negative'; end if;
 insert into public.pharmacy_cash_sessions(tenant_id,branch_id,opened_by,opening_cash,status) values(p_tenant_id,p_branch_id,auth.uid(),p_opening_cash,'open') returning id into v_id;
 if p_opening_cash>0 then insert into public.pharmacy_cashbook_entries(tenant_id,branch_id,session_id,entry_type,direction,amount,payment_method,description,recorded_by) values(p_tenant_id,p_branch_id,v_id,'opening','in',p_opening_cash,'cash','Opening cash balance',auth.uid()); end if;
 return v_id;
end $$;
grant execute on function public.pharmacy_open_cash_session(uuid,uuid,numeric) to authenticated;
create or replace function public.pharmacy_close_cash_session(p_session_id uuid,p_counted_cash numeric,p_notes text default null)
returns void language plpgsql security invoker set search_path=pg_catalog,public,private as $$
declare s public.pharmacy_cash_sessions%rowtype; v_expected numeric;
begin
 select * into s from public.pharmacy_cash_sessions where id=p_session_id for update;
 if not found or not private.has_module_access(s.tenant_id,'pharmacy_suite',s.branch_id,true) then raise exception 'Cash session unavailable'; end if;
 if s.status<>'open' then raise exception 'Cash session is not open'; end if;
 if p_counted_cash<0 then raise exception 'Counted cash cannot be negative'; end if;
 select s.opening_cash+coalesce(sum(case when direction='in' then amount else -amount end),0) into v_expected from public.pharmacy_cashbook_entries where session_id=s.id and entry_type<>'opening';
 update public.pharmacy_cash_sessions set expected_cash=v_expected,counted_cash=p_counted_cash,variance=p_counted_cash-v_expected,closed_by=auth.uid(),closed_at=now(),status='closed',close_notes=p_notes where id=s.id;
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id,metadata) values(s.tenant_id,s.branch_id,auth.uid(),'pharmacy.cash_session_closed','cash_session',s.id::text,jsonb_build_object('expected',v_expected,'counted',p_counted_cash,'variance',p_counted_cash-v_expected));
end $$;
grant execute on function public.pharmacy_close_cash_session(uuid,numeric,text) to authenticated;
