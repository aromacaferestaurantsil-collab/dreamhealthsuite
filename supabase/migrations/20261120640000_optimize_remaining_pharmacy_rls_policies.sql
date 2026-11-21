-- Cache auth.uid() once per statement in the remaining pharmacy write policies.
do $$
declare r record; v_roles text; v_mode text; v_qual text; v_check text; v_sql text;
begin
 for r in
  select * from pg_policies
  where schemaname='public'
   and policyname in (
    'pharmacy_settings_write_insert','pharmacy_settings_write_update','pharmacy_settings_write_delete',
    'pharmacy_role_permissions_write_insert','pharmacy_role_permissions_write_update','pharmacy_role_permissions_write_delete',
    'pharmacy_backup_jobs_write'
   )
 loop
  select string_agg(quote_ident(x),', ') into v_roles from unnest(r.roles) x;
  v_mode:=case when r.permissive='RESTRICTIVE' then ' AS RESTRICTIVE' else ' AS PERMISSIVE' end;
  v_qual:=replace(r.qual,'auth.uid()','(select auth.uid())');
  v_check:=replace(r.with_check,'auth.uid()','(select auth.uid())');
  execute format('drop policy %I on %I.%I',r.policyname,r.schemaname,r.tablename);
  if r.cmd='INSERT' then
   v_sql:=format('create policy %I on %I.%I%s for insert to %s with check (%s)',
    r.policyname,r.schemaname,r.tablename,v_mode,v_roles,v_check);
  elsif r.cmd='UPDATE' then
   v_sql:=format('create policy %I on %I.%I%s for update to %s using (%s) with check (%s)',
    r.policyname,r.schemaname,r.tablename,v_mode,v_roles,v_qual,v_check);
  elsif r.cmd='DELETE' then
   v_sql:=format('create policy %I on %I.%I%s for delete to %s using (%s)',
    r.policyname,r.schemaname,r.tablename,v_mode,v_roles,v_qual);
  else
   raise exception 'Unexpected policy command % for %',r.cmd,r.policyname;
  end if;
  execute v_sql;
 end loop;
end;
$$;
