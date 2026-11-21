-- Cash payments against operating expenses must flow into the open cashier session.
-- Non-cash payments remain in the expense-payment ledger but do not change physical cash.
do $$
declare
 v_def text;
 v_new text;
 v_cashbook_block text := $block$
 if p_payment_method='cash' then
  select id into v_session from public.pharmacy_cash_sessions
   where tenant_id=p_tenant_id and branch_id=e.branch_id and status='open'
   order by opened_at desc limit 1 for update;
  if v_session is null then
   raise exception 'Open a cashier shift before posting a cash expense payment';
  end if;
  insert into public.pharmacy_cashbook_entries(
   tenant_id,branch_id,session_id,entry_type,direction,amount,payment_method,
   reference_number,description,source_type,source_id,recorded_by
  ) values(
   p_tenant_id,e.branch_id,v_session,'expense','out',p_amount,'cash',
   p_reference,'Expense payment: '||e.description,'pharmacy_expense_payment',v_id,auth.uid()
  );
 end if;
$block$;
begin
 v_def:=pg_get_functiondef('private.pharmacy_record_expense_payment_impl(uuid,uuid,numeric,text,text)'::regprocedure);
 v_new:=replace(v_def,'v_paid numeric; v_id uuid;','v_paid numeric; v_id uuid; v_session uuid;');
 if v_new=v_def then raise exception 'Could not add cash-session variable to expense payment RPC'; end if;
 v_def:=v_new;
 v_new:=replace(v_def,'insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id,metadata)',
  v_cashbook_block||E'\n insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id,metadata)');
 if v_new=v_def then raise exception 'Could not add cashbook posting to expense payment RPC'; end if;
 execute v_new;
end;
$$;
