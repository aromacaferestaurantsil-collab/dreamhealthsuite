create or replace function private.pharmacy_supplier_ledger_purchase()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if new.status='received' and (tg_op='INSERT' or old.status is distinct from new.status) then
  if not exists(select 1 from public.pharmacy_distributor_ledger where tenant_id=new.tenant_id and branch_id=new.branch_id and reference_type='purchase_order' and reference_id=new.id) then
   insert into public.pharmacy_distributor_ledger(tenant_id,branch_id,supplier_id,entry_type,entry_date,reference_type,reference_id,reference_number,description,credit,created_by)
   values(new.tenant_id,new.branch_id,new.supplier_id,'purchase_invoice',coalesce(new.order_date,current_date),'purchase_order',new.id,new.order_number,'Received purchase order',new.total,new.created_by);
  end if;
 end if;
 return new;
end $$;
drop trigger if exists pharmacy_supplier_ledger_purchase on public.pharmacy_purchase_orders;
create trigger pharmacy_supplier_ledger_purchase after insert or update of status on public.pharmacy_purchase_orders for each row execute function private.pharmacy_supplier_ledger_purchase();
create or replace function private.pharmacy_supplier_ledger_payment()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_payment_ledger uuid; v_invoice_ledger uuid; v_due numeric; v_session uuid;
begin
 insert into public.pharmacy_distributor_ledger(tenant_id,branch_id,supplier_id,entry_type,entry_date,reference_type,reference_id,reference_number,description,debit,created_by)
 values(new.tenant_id,new.branch_id,new.supplier_id,'payment',coalesce(new.paid_at::date,current_date),'supplier_payment',new.id,new.reference_number,'Supplier payment',new.amount,new.recorded_by)
 returning id into v_payment_ledger;
 if new.purchase_order_id is not null then
  select d.id,d.credit-coalesce((select sum(a.amount) from public.pharmacy_ledger_allocations a where a.tenant_id=new.tenant_id and a.ledger_type='distributor' and a.invoice_entry_id=d.id),0)
   into v_invoice_ledger,v_due from public.pharmacy_distributor_ledger d where d.tenant_id=new.tenant_id and d.branch_id=new.branch_id and d.supplier_id=new.supplier_id and d.reference_type='purchase_order' and d.reference_id=new.purchase_order_id and d.credit>0 order by d.created_at limit 1 for update;
  if v_invoice_ledger is not null and v_due>0 then
   insert into public.pharmacy_ledger_allocations(tenant_id,branch_id,ledger_type,payment_entry_id,invoice_entry_id,amount,allocated_by)
   values(new.tenant_id,new.branch_id,'distributor',v_payment_ledger,v_invoice_ledger,least(new.amount,v_due),new.recorded_by)
   on conflict(tenant_id,ledger_type,payment_entry_id,invoice_entry_id) do nothing;
  end if;
 end if;
 if new.payment_method='cash' then
  select id into v_session from public.pharmacy_cash_sessions where tenant_id=new.tenant_id and branch_id=new.branch_id and status='open' order by opened_at desc limit 1 for update;
  if v_session is null then raise exception 'Open a cashier shift before posting a cash supplier payment'; end if;
  insert into public.pharmacy_cashbook_entries(tenant_id,branch_id,session_id,entry_type,direction,amount,payment_method,reference_number,description,source_type,source_id,recorded_by)
  values(new.tenant_id,new.branch_id,v_session,'supplier_payment','out',new.amount,'cash',new.reference_number,'Supplier payment','supplier_payment',new.id,new.recorded_by);
 end if;
 return new;
end $$;
drop trigger if exists pharmacy_supplier_ledger_payment on public.pharmacy_supplier_payments;
create trigger pharmacy_supplier_ledger_payment after insert on public.pharmacy_supplier_payments for each row execute function private.pharmacy_supplier_ledger_payment();