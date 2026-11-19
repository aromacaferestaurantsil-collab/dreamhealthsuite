-- Authenticated patient portal access. Patients only see their own profile and order data.
create policy patients_self_portal_read on public.patients for select to authenticated
 using(created_by=(select auth.uid()));

create policy medicine_catalogue_patient_catalog_read on public.medicine_catalogue for select to authenticated
 using(status='active' and exists(select 1 from public.patients p
  where p.tenant_id=medicine_catalogue.tenant_id and p.created_by=(select auth.uid())));

-- The customer-order RPC validates patient ownership and branch membership context.
-- No direct patient update/delete policy is granted.
