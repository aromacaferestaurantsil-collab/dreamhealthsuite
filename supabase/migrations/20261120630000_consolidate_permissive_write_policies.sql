-- Split write-only ALL policies so their USING clauses do not also run for SELECT.
-- Only transform policies that already have a separate SELECT policy for the same role.
do $$
declare r record; v_roles text; v_mode text;
begin
 for r in
  select p.* from pg_policies p
  where p.schemaname='public' and p.cmd='ALL'
   and p.policyname like '%write%'
   and p.qual is not null and p.with_check is not null
   and exists(
    select 1 from pg_policies s
    where s.schemaname=p.schemaname and s.tablename=p.tablename
     and s.cmd='SELECT' and s.roles=p.roles
   )
 loop
  select string_agg(quote_ident(x),', ') into v_roles from unnest(r.roles) x;
  v_mode:=case when r.permissive='RESTRICTIVE' then ' AS RESTRICTIVE' else ' AS PERMISSIVE' end;
  execute format('drop policy %I on %I.%I',r.policyname,r.schemaname,r.tablename);
  execute format('create policy %I on %I.%I%s for insert to %s with check (%s)',
   r.policyname||'_insert',r.schemaname,r.tablename,v_mode,v_roles,r.with_check);
  execute format('create policy %I on %I.%I%s for update to %s using (%s) with check (%s)',
   r.policyname||'_update',r.schemaname,r.tablename,v_mode,v_roles,r.qual,r.with_check);
  execute format('create policy %I on %I.%I%s for delete to %s using (%s)',
   r.policyname||'_delete',r.schemaname,r.tablename,v_mode,v_roles,r.qual);
 end loop;
end;
$$;

-- Combine the patient-self and pharmacy-staff timeline reads into one policy.
drop policy if exists p1_order_events_patient_read on public.pharmacy_customer_order_events;
drop policy if exists p1_order_events_read on public.pharmacy_customer_order_events;
create policy p1_order_events_read on public.pharmacy_customer_order_events for select to authenticated
 using(
  private.has_module_access(tenant_id,'pharmacy_suite',branch_id,false)
  or (
   visible_to_customer=true and exists(
    select 1 from public.pharmacy_customer_orders o
    join public.patients p on p.id=o.patient_id and p.tenant_id=o.tenant_id
    where o.id=pharmacy_customer_order_events.order_id
     and o.tenant_id=pharmacy_customer_order_events.tenant_id
     and p.created_by=(select auth.uid())
   )
  )
 );
