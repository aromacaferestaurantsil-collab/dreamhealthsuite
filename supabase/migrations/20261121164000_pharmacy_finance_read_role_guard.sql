do $$
declare p record; v_branch_expr text;
begin
 for p in select schemaname,tablename,policyname,qual
  from pg_policies
  where schemaname='public'
   and tablename in ('pharmacy_expenses','pharmacy_expense_payments','pharmacy_supplier_payments','pharmacy_distributor_ledger')
   and cmd='SELECT'
 loop
  if exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name=p.tablename and c.column_name='branch_id') then
   v_branch_expr:='branch_id';
  else v_branch_expr:='null::uuid'; end if;
  execute format('alter policy %I on %I.%I using ((%s) and private.has_tenant_role(tenant_id,array[''owner'',''admin'',''manager'']::text[],%s))',
   p.policyname,p.schemaname,p.tablename,p.qual,v_branch_expr);
 end loop;
end $$;
