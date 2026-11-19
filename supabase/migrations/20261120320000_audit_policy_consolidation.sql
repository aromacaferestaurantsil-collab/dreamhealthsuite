-- Merge authenticated audit insert policies so one policy evaluation covers both staff and patient order events.
drop policy if exists audit_actor_insert on public.audit_events;
drop policy if exists patient_customer_order_audit_insert on public.audit_events;
create policy audit_actor_insert on public.audit_events for insert to authenticated
 with check(actor_user_id=(select auth.uid()) and (
  exists(select 1 from public.tenant_memberships m where m.tenant_id=audit_events.tenant_id
   and m.user_id=(select auth.uid()) and m.status='active')
  or (action='pharmacy.customer_order_submitted' and entity_type='pharmacy_customer_order'
   and exists(select 1 from public.patients p where p.tenant_id=audit_events.tenant_id
    and p.branch_id=audit_events.branch_id and p.created_by=(select auth.uid())))
 ));
