do $$
declare v_def text; v_new text;
begin
 v_def:=pg_get_functiondef('private.pharmacy_open_cash_session_impl(uuid,uuid,numeric)'::regprocedure);
 v_new:=replace(v_def,
  $old$if v_user is null or not private.has_module_access(p_tenant_id,'pharmacy_suite',p_branch_id,true) then
  raise exception 'No pharmacy permission';
 end if;$old$,
  $new$if v_user is null or not private.has_module_access(p_tenant_id,'pharmacy_suite',p_branch_id,true) then
  raise exception 'No pharmacy permission';
 end if;
 if not private.has_tenant_role(p_tenant_id,array['owner','admin','manager','pharmacist'],p_branch_id) then
  raise exception 'Cash session role required';
 end if;$new$);
 if v_new=v_def then raise exception 'Open cash session guard insertion failed'; end if; execute v_new;

 v_def:=pg_get_functiondef('private.pharmacy_close_cash_session_impl(uuid,numeric,text)'::regprocedure);
 v_new:=replace(v_def,
  $old$if not found or not private.has_module_access(s.tenant_id,'pharmacy_suite',s.branch_id,true) then
  raise exception 'Cash session unavailable';
 end if;$old$,
  $new$if not found or not private.has_module_access(s.tenant_id,'pharmacy_suite',s.branch_id,true) then
  raise exception 'Cash session unavailable';
 end if;
 if not private.has_tenant_role(s.tenant_id,array['owner','admin','manager','pharmacist'],s.branch_id) then
  raise exception 'Cash session role required';
 end if;$new$);
 if v_new=v_def then raise exception 'Close cash session guard insertion failed'; end if; execute v_new;

 v_def:=pg_get_functiondef('private.pharmacy_place_stock_hold_impl(uuid,uuid,uuid,numeric,text,text,text)'::regprocedure);
 v_new:=replace(v_def,
  $old$if not private.has_module_access(p_tenant_id,'pharmacy_suite',p_branch_id,true) then raise exception 'No pharmacy permission'; end if;$old$,
  $new$if not private.has_module_access(p_tenant_id,'pharmacy_suite',p_branch_id,true) then raise exception 'No pharmacy permission'; end if;
 if not private.has_tenant_role(p_tenant_id,array['owner','admin','manager','pharmacist'],p_branch_id) then raise exception 'Stock hold role required'; end if;$new$);
 if v_new=v_def then raise exception 'Place stock hold guard insertion failed'; end if; execute v_new;

 v_def:=pg_get_functiondef('private.pharmacy_post_customer_receipt_impl(uuid,uuid,uuid,text,numeric,text,text,jsonb)'::regprocedure);
 v_new:=replace(v_def,
  $old$if v_user is null or not private.has_module_access(p_tenant_id,'pharmacy_suite',p_branch_id,true) then
  raise exception 'No pharmacy permission';
 end if;$old$,
  $new$if v_user is null or not private.has_module_access(p_tenant_id,'pharmacy_suite',p_branch_id,true) then
  raise exception 'No pharmacy permission';
 end if;
 if not private.has_tenant_role(p_tenant_id,array['owner','admin','manager','pharmacist'],p_branch_id) then
  raise exception 'Customer receipt role required';
 end if;$new$);
 if v_new=v_def then raise exception 'Customer receipt guard insertion failed'; end if; execute v_new;

 v_def:=pg_get_functiondef('private.pharmacy_process_return_impl(uuid,uuid,text,text,text,uuid,uuid,jsonb)'::regprocedure);
 v_new:=replace(v_def,
  $old$if auth.uid() is null or not private.has_module_access(p_tenant_id,'pharmacy_suite',p_branch_id,true) then
  raise exception 'No pharmacy permission';
 end if;$old$,
  $new$if auth.uid() is null or not private.has_module_access(p_tenant_id,'pharmacy_suite',p_branch_id,true) then
  raise exception 'No pharmacy permission';
 end if;
 if not private.has_tenant_role(p_tenant_id,array['owner','admin','manager','pharmacist'],p_branch_id) then
  raise exception 'Return processing role required';
 end if;$new$);
 if v_new=v_def then raise exception 'Return processing guard insertion failed'; end if; execute v_new;

 v_def:=pg_get_functiondef('private.pharmacy_record_expense_payment_impl(uuid,uuid,numeric,text,text)'::regprocedure);
 v_new:=replace(v_def,
  $old$if not found or not private.has_module_access(p_tenant_id,'pharmacy_suite',e.branch_id,true) then raise exception 'Expense not found or access denied'; end if;$old$,
  $new$if not found or not private.has_module_access(p_tenant_id,'pharmacy_suite',e.branch_id,true) then raise exception 'Expense not found or access denied'; end if;
 if not private.has_tenant_role(p_tenant_id,array['owner','admin','manager'],e.branch_id) then raise exception 'Expense payment role required'; end if;$new$);
 if v_new=v_def then raise exception 'Expense payment guard insertion failed'; end if; execute v_new;

 v_def:=pg_get_functiondef('private.pharmacy_record_supplier_payment_impl(uuid,uuid,numeric,text,text)'::regprocedure);
 v_new:=replace(v_def,
  $old$if not found or not private.has_module_access(p_tenant_id,'pharmacy_suite',o.branch_id,true) then raise exception 'Purchase order not found or access denied'; end if;$old$,
  $new$if not found or not private.has_module_access(p_tenant_id,'pharmacy_suite',o.branch_id,true) then raise exception 'Purchase order not found or access denied'; end if;
 if not private.has_tenant_role(p_tenant_id,array['owner','admin','manager'],o.branch_id) then raise exception 'Supplier payment role required'; end if;$new$);
 if v_new=v_def then raise exception 'Supplier payment guard insertion failed'; end if; execute v_new;

 v_def:=pg_get_functiondef('private.pharmacy_release_stock_hold_impl(uuid,uuid,text)'::regprocedure);
 v_new:=replace(v_def,
  $old$if not found or not private.has_module_access(p_tenant_id,'pharmacy_suite',h.branch_id,true) then raise exception 'Stock hold not found or access denied'; end if;$old$,
  $new$if not found or not private.has_module_access(p_tenant_id,'pharmacy_suite',h.branch_id,true) then raise exception 'Stock hold not found or access denied'; end if;
 if not private.has_tenant_role(p_tenant_id,array['owner','admin','manager','pharmacist'],h.branch_id) then raise exception 'Stock hold role required'; end if;$new$);
 if v_new=v_def then raise exception 'Release stock hold guard insertion failed'; end if; execute v_new;
end $$;
