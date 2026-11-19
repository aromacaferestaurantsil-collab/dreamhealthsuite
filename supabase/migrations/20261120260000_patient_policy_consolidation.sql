-- Collapse overlapping permissive policies while retaining patient-owned access.
drop policy if exists tenant_member_read_branches on public.branches;
drop policy if exists branches_patient_portal_read on public.branches;
create policy tenant_member_read_branches on public.branches for select to authenticated
 using(
  exists(select 1 from public.tenant_memberships m where m.tenant_id=branches.tenant_id
   and m.user_id=(select auth.uid()) and m.status='active' and (m.branch_id is null or m.branch_id=branches.id))
  or exists(select 1 from public.patients p where p.tenant_id=branches.tenant_id
   and p.branch_id=branches.id and p.created_by=(select auth.uid()))
 );

drop policy if exists module_read on public.medicine_catalogue;
drop policy if exists medicine_catalogue_patient_catalog_read on public.medicine_catalogue;
create policy module_read on public.medicine_catalogue for select to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',null,false)
  or (status='active' and exists(select 1 from public.patients p
   where p.tenant_id=medicine_catalogue.tenant_id and p.created_by=(select auth.uid()))));

drop policy if exists patient_member_access on public.patients;
drop policy if exists patients_self_portal_read on public.patients;
create policy patient_member_access on public.patients for select to authenticated
 using(
  exists(select 1 from public.tenant_memberships m join public.tenant_module_entitlements e
   on e.tenant_id=m.tenant_id and e.module_key='patient_suite' and e.enabled
   where m.tenant_id=patients.tenant_id and m.user_id=(select auth.uid()) and m.status='active'
    and (m.branch_id is null or m.branch_id=patients.branch_id))
  or created_by=(select auth.uid())
 );

drop policy if exists customer_orders_read on public.pharmacy_customer_orders;
drop policy if exists customer_orders_patient_read on public.pharmacy_customer_orders;
create policy customer_orders_read on public.pharmacy_customer_orders for select to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,false)
  or exists(select 1 from public.patients p where p.tenant_id=pharmacy_customer_orders.tenant_id
   and p.id=pharmacy_customer_orders.patient_id and p.created_by=(select auth.uid())));

drop policy if exists customer_orders_insert on public.pharmacy_customer_orders;
drop policy if exists customer_orders_patient_insert on public.pharmacy_customer_orders;
create policy customer_orders_insert on public.pharmacy_customer_orders for insert to authenticated
 with check(private.has_module_access(tenant_id,'pharmacy_suite',branch_id,true)
  or (order_status in ('submitted','review_required') and reviewed_by is null and reviewed_at is null
   and exists(select 1 from public.patients p where p.tenant_id=pharmacy_customer_orders.tenant_id
    and p.id=pharmacy_customer_orders.patient_id and p.created_by=(select auth.uid()))));

drop policy if exists customer_order_items_read on public.pharmacy_customer_order_items;
drop policy if exists customer_order_items_patient_read on public.pharmacy_customer_order_items;
create policy customer_order_items_read on public.pharmacy_customer_order_items for select to authenticated
 using(private.has_module_access(tenant_id,'pharmacy_suite',null,false)
  or exists(select 1 from public.pharmacy_customer_orders o join public.patients p
   on p.tenant_id=o.tenant_id and p.id=o.patient_id
   where o.tenant_id=pharmacy_customer_order_items.tenant_id and o.id=pharmacy_customer_order_items.order_id
    and p.created_by=(select auth.uid())));

drop policy if exists customer_order_items_insert on public.pharmacy_customer_order_items;
drop policy if exists customer_order_items_patient_insert on public.pharmacy_customer_order_items;
create policy customer_order_items_insert on public.pharmacy_customer_order_items for insert to authenticated
 with check(private.has_module_access(tenant_id,'pharmacy_suite',null,true)
  or exists(select 1 from public.pharmacy_customer_orders o join public.patients p
   on p.tenant_id=o.tenant_id and p.id=o.patient_id
   where o.tenant_id=pharmacy_customer_order_items.tenant_id and o.id=pharmacy_customer_order_items.order_id
    and o.order_status in ('submitted','review_required') and p.created_by=(select auth.uid())));

drop policy if exists pharmacy_expense_payments_write on public.pharmacy_expense_payments;
drop policy if exists pharmacy_expense_payments_insert on public.pharmacy_expense_payments;
create policy pharmacy_expense_payments_insert on public.pharmacy_expense_payments for insert to authenticated
 with check(private.has_module_access(tenant_id,'pharmacy_suite',null,true));
revoke update,delete on public.pharmacy_expense_payments from authenticated;
grant select,insert on public.pharmacy_expense_payments to authenticated;
