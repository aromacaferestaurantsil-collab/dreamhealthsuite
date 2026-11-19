-- Restrict sensitive state changes to audited RPCs; the private implementations are
-- SECURITY DEFINER with explicit auth.uid(), tenant and role checks.
do $$
declare r record; v_def text;
begin
 for r in select * from (values
  ('pharmacy_record_expense_payment','uuid,uuid,numeric,text,text'),
  ('pharmacy_record_supplier_payment','uuid,uuid,numeric,text,text'),
  ('pharmacy_place_stock_hold','uuid,uuid,uuid,numeric,text,text,text'),
  ('pharmacy_release_stock_hold','uuid,uuid,text'),
  ('pharmacy_record_controlled_drug','uuid,uuid,uuid,uuid,text,numeric,numeric,uuid,text,text'),
  ('pharmacy_review_catalogue_photo','uuid,uuid,text,uuid,text'),
  ('pharmacy_review_customer_order','uuid,uuid,text,text,jsonb')
 ) as x(fn,args)
 loop
  v_def:=pg_get_functiondef((('public.'||r.fn||'('||r.args||')')::regprocedure));
  v_def:=replace(v_def,'FUNCTION public.'||r.fn||'(','FUNCTION private.'||r.fn||'_impl(');
  v_def:=replace(v_def,'SECURITY INVOKER','SECURITY DEFINER');
  if r.fn='pharmacy_record_controlled_drug' then
   v_def:=replace(v_def,
    'if not exists(select 1 from public.medicine_catalogue where id=p_medicine_id and tenant_id=p_tenant_id) then raise exception ''Medicine not found''; end if;',
    'if not exists(select 1 from public.medicine_catalogue where id=p_medicine_id and tenant_id=p_tenant_id and schedule_code is not null) then raise exception ''Scheduled medicine not found''; end if; if p_batch_id is not null and not exists(select 1 from public.medicine_batches where id=p_batch_id and tenant_id=p_tenant_id and branch_id=p_branch_id and medicine_id=p_medicine_id) then raise exception ''Batch does not match this scheduled medicine and branch''; end if;');
  end if;
  execute v_def;
  execute format('alter function private.%I_impl(%s) security definer',r.fn,r.args);
 end loop;
end $$;

create or replace function public.pharmacy_record_expense_payment(p_tenant_id uuid,p_expense_id uuid,p_amount numeric,p_payment_method text,p_reference text default null)
returns uuid language sql security invoker set search_path=pg_catalog,public,private
as $$ select private.pharmacy_record_expense_payment_impl(p_tenant_id,p_expense_id,p_amount,p_payment_method,p_reference) $$;

create or replace function public.pharmacy_record_supplier_payment(p_tenant_id uuid,p_order_id uuid,p_amount numeric,p_payment_method text,p_reference text default null)
returns uuid language sql security invoker set search_path=pg_catalog,public,private
as $$ select private.pharmacy_record_supplier_payment_impl(p_tenant_id,p_order_id,p_amount,p_payment_method,p_reference) $$;

create or replace function public.pharmacy_place_stock_hold(p_tenant_id uuid,p_branch_id uuid,p_batch_id uuid,p_quantity numeric,p_hold_type text,p_reason text,p_reference text default null)
returns uuid language sql security invoker set search_path=pg_catalog,public,private
as $$ select private.pharmacy_place_stock_hold_impl(p_tenant_id,p_branch_id,p_batch_id,p_quantity,p_hold_type,p_reason,p_reference) $$;

create or replace function public.pharmacy_release_stock_hold(p_tenant_id uuid,p_hold_id uuid,p_disposition text default 'released')
returns void language plpgsql security invoker set search_path=pg_catalog,public,private
as $$ begin perform private.pharmacy_release_stock_hold_impl(p_tenant_id,p_hold_id,p_disposition); end $$;

create or replace function public.pharmacy_record_controlled_drug(p_tenant_id uuid,p_branch_id uuid,p_medicine_id uuid,p_batch_id uuid,p_transaction_type text,p_quantity_in numeric,p_quantity_out numeric,p_patient_id uuid default null,p_prescription_reference text default null,p_notes text default null)
returns uuid language sql security invoker set search_path=pg_catalog,public,private
as $$ select private.pharmacy_record_controlled_drug_impl(p_tenant_id,p_branch_id,p_medicine_id,p_batch_id,p_transaction_type,p_quantity_in,p_quantity_out,p_patient_id,p_prescription_reference,p_notes) $$;

create or replace function public.pharmacy_review_catalogue_photo(p_tenant_id uuid,p_suggestion_id uuid,p_decision text,p_medicine_id uuid default null,p_notes text default null)
returns void language plpgsql security invoker set search_path=pg_catalog,public,private
as $$ begin perform private.pharmacy_review_catalogue_photo_impl(p_tenant_id,p_suggestion_id,p_decision,p_medicine_id,p_notes); end $$;

create or replace function public.pharmacy_review_customer_order(p_tenant_id uuid,p_order_id uuid,p_decision text,p_notes text default null,p_item_decisions jsonb default '[]'::jsonb)
returns void language plpgsql security invoker set search_path=pg_catalog,public,private
as $$ begin perform private.pharmacy_review_customer_order_impl(p_tenant_id,p_order_id,p_decision,p_notes,p_item_decisions); end $$;

-- Revoke direct table writes that could bypass balances, review decisions or hold checks.
revoke insert,update,delete on public.pharmacy_supplier_payments from authenticated;
revoke insert,update,delete on public.pharmacy_expense_payments from authenticated;
revoke insert,update,delete on public.pharmacy_stock_holds from authenticated;
revoke insert,update,delete on public.pharmacy_controlled_drug_register from authenticated;
revoke update,delete on public.pharmacy_catalogue_photo_suggestions from authenticated;
revoke update,delete on public.pharmacy_customer_orders from authenticated;
revoke update,delete on public.pharmacy_customer_order_items from authenticated;
revoke insert,update,delete on public.pharmacy_prescription_reviews from authenticated;
grant select on public.pharmacy_supplier_payments,public.pharmacy_expense_payments,public.pharmacy_stock_holds,
 public.pharmacy_controlled_drug_register,public.pharmacy_prescription_reviews to authenticated;
grant select,insert on public.pharmacy_catalogue_photo_suggestions,public.pharmacy_customer_orders,
 public.pharmacy_customer_order_items to authenticated;

-- Private RPC implementations are callable by authenticated clients only through SQL wrappers.
revoke execute on function private.pharmacy_record_expense_payment_impl(uuid,uuid,numeric,text,text) from public,anon;
revoke execute on function private.pharmacy_record_supplier_payment_impl(uuid,uuid,numeric,text,text) from public,anon;
revoke execute on function private.pharmacy_place_stock_hold_impl(uuid,uuid,uuid,numeric,text,text,text) from public,anon;
revoke execute on function private.pharmacy_release_stock_hold_impl(uuid,uuid,text) from public,anon;
revoke execute on function private.pharmacy_record_controlled_drug_impl(uuid,uuid,uuid,uuid,text,numeric,numeric,uuid,text,text) from public,anon;
revoke execute on function private.pharmacy_review_catalogue_photo_impl(uuid,uuid,text,uuid,text) from public,anon;
revoke execute on function private.pharmacy_review_customer_order_impl(uuid,uuid,text,text,jsonb) from public,anon;
grant execute on function private.pharmacy_record_expense_payment_impl(uuid,uuid,numeric,text,text) to authenticated;
grant execute on function private.pharmacy_record_supplier_payment_impl(uuid,uuid,numeric,text,text) to authenticated;
grant execute on function private.pharmacy_place_stock_hold_impl(uuid,uuid,uuid,numeric,text,text,text) to authenticated;
grant execute on function private.pharmacy_release_stock_hold_impl(uuid,uuid,text) to authenticated;
grant execute on function private.pharmacy_record_controlled_drug_impl(uuid,uuid,uuid,uuid,text,numeric,numeric,uuid,text,text) to authenticated;
grant execute on function private.pharmacy_review_catalogue_photo_impl(uuid,uuid,text,uuid,text) to authenticated;
grant execute on function private.pharmacy_review_customer_order_impl(uuid,uuid,text,text,jsonb) to authenticated;

revoke execute on function public.pharmacy_record_expense_payment(uuid,uuid,numeric,text,text) from public,anon;
revoke execute on function public.pharmacy_record_supplier_payment(uuid,uuid,numeric,text,text) from public,anon;
revoke execute on function public.pharmacy_place_stock_hold(uuid,uuid,uuid,numeric,text,text,text) from public,anon;
revoke execute on function public.pharmacy_release_stock_hold(uuid,uuid,text) from public,anon;
revoke execute on function public.pharmacy_record_controlled_drug(uuid,uuid,uuid,uuid,text,numeric,numeric,uuid,text,text) from public,anon;
revoke execute on function public.pharmacy_review_catalogue_photo(uuid,uuid,text,uuid,text) from public,anon;
revoke execute on function public.pharmacy_review_customer_order(uuid,uuid,text,text,jsonb) from public,anon;
grant execute on function public.pharmacy_record_expense_payment(uuid,uuid,numeric,text,text) to authenticated;
grant execute on function public.pharmacy_record_supplier_payment(uuid,uuid,numeric,text,text) to authenticated;
grant execute on function public.pharmacy_place_stock_hold(uuid,uuid,uuid,numeric,text,text,text) to authenticated;
grant execute on function public.pharmacy_release_stock_hold(uuid,uuid,text) to authenticated;
grant execute on function public.pharmacy_record_controlled_drug(uuid,uuid,uuid,uuid,text,numeric,numeric,uuid,text,text) to authenticated;
grant execute on function public.pharmacy_review_catalogue_photo(uuid,uuid,text,uuid,text) to authenticated;
grant execute on function public.pharmacy_review_customer_order(uuid,uuid,text,text,jsonb) to authenticated;
