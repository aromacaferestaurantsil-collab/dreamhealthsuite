-- Permit a linked patient to append only the audit event for their own order submission.
create policy patient_customer_order_audit_insert on public.audit_events for insert to authenticated
 with check(actor_user_id=(select auth.uid())
  and action='pharmacy.customer_order_submitted'
  and entity_type='pharmacy_customer_order'
  and exists(select 1 from public.patients p where p.tenant_id=audit_events.tenant_id
   and p.branch_id=audit_events.branch_id and p.created_by=(select auth.uid())));
