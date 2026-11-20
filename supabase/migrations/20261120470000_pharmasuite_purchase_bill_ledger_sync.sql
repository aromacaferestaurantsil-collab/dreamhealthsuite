create or replace function private.pharmacy_supplier_ledger_purchase()
returns trigger language plpgsql security definer set search_path=pg_catalog,public
as $function$
begin
 if new.status='received' then
  if exists(select 1 from public.pharmacy_distributor_ledger where tenant_id=new.tenant_id and branch_id=new.branch_id and reference_type='purchase_order' and reference_id=new.id) then
   update public.pharmacy_distributor_ledger set credit=new.total,entry_date=coalesce(new.received_date,new.order_date,current_date),reference_number=coalesce(new.supplier_invoice_number,new.order_number),description='Purchase bill · supplier invoice '||coalesce(new.supplier_invoice_number,new.order_number)
   where tenant_id=new.tenant_id and branch_id=new.branch_id and reference_type='purchase_order' and reference_id=new.id;
  else
   insert into public.pharmacy_distributor_ledger(tenant_id,branch_id,supplier_id,entry_type,entry_date,reference_type,reference_id,reference_number,description,credit,created_by)
   values(new.tenant_id,new.branch_id,new.supplier_id,'purchase_invoice',coalesce(new.received_date,new.order_date,current_date),'purchase_order',new.id,coalesce(new.supplier_invoice_number,new.order_number),'Purchase bill · supplier invoice '||coalesce(new.supplier_invoice_number,new.order_number),new.total,new.created_by);
  end if;
 end if;
 return new;
end
$function$;
drop trigger if exists pharmacy_supplier_ledger_purchase_trg on public.pharmacy_purchase_orders;
create trigger pharmacy_supplier_ledger_purchase_trg after insert or update of status,total on public.pharmacy_purchase_orders for each row execute function private.pharmacy_supplier_ledger_purchase();
