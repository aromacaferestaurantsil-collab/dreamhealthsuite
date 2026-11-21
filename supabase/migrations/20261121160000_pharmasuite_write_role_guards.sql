create or replace function private.has_tenant_role(
 p_tenant_id uuid,p_roles text[],p_branch_id uuid default null
) returns boolean
language sql stable security definer
set search_path=pg_catalog,public,private
as $$
 select auth.uid() is not null and exists(
  select 1 from public.tenant_memberships m
  where m.tenant_id=p_tenant_id and m.user_id=auth.uid()
   and m.status='active' and m.role=any(p_roles)
   and (p_branch_id is null or m.branch_id is null or m.branch_id=p_branch_id)
 );
$$;
revoke all on function private.has_tenant_role(uuid,text[],uuid) from public,anon;
grant execute on function private.has_tenant_role(uuid,text[],uuid) to authenticated;

do $$
declare p record; v_roles text[]; v_roles_sql text; v_branch_expr text; v_qual text; v_check text; v_stmt text;
begin
 for p in
  select schemaname,tablename,policyname,cmd,qual,with_check
  from pg_policies
  where schemaname='public'
   and (tablename like 'pharmacy_%' or tablename in ('medicine_catalogue','medicine_batches'))
   and tablename not in ('pharmacy_settings','pharmacy_role_permissions','pharmacy_backup_jobs')
   and cmd in ('INSERT','UPDATE','DELETE')
   and (coalesce(qual,'') ilike '%has_module_access%' or coalesce(with_check,'') ilike '%has_module_access%')
 loop
  v_roles:=case
   when p.tablename in ('pharmacy_sales','pharmacy_sale_items') then array['owner','admin','pharmacist']::text[]
   when p.tablename in ('pharmacy_expenses','pharmacy_expense_payments','pharmacy_supplier_payments','pharmacy_supplier_offers','pharmacy_distributor_ledger','pharmacy_gst_reconciliations','pharmacy_gst_reconciliation_lines') then array['owner','admin','manager']::text[]
   when p.tablename in ('pharmacy_controlled_drug_register','pharmacy_prescription_reviews') then array['owner','admin','pharmacist']::text[]
   else array['owner','admin','manager','pharmacist']::text[]
  end;
  v_roles_sql:=format('array[%s]::text[]',array_to_string(array(select quote_literal(x) from unnest(v_roles) x),','));
  if exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name=p.tablename and c.column_name='branch_id') then
   v_branch_expr:='branch_id';
  else
   v_branch_expr:='null::uuid';
  end if;
  v_qual:=case when p.qual is null then null else '('||p.qual||') and private.has_tenant_role(tenant_id,'||v_roles_sql||','||v_branch_expr||')' end;
  v_check:=case when p.with_check is null then null else '('||p.with_check||') and private.has_tenant_role(tenant_id,'||v_roles_sql||','||v_branch_expr||')' end;
  v_stmt:=format('alter policy %I on %I.%I',p.policyname,p.schemaname,p.tablename);
  if v_qual is not null then v_stmt:=v_stmt||' using ('||v_qual||')'; end if;
  if v_check is not null then v_stmt:=v_stmt||' with check ('||v_check||')'; end if;
  execute v_stmt;
 end loop;
end $$;
