create policy branches_patient_portal_read on public.branches for select to authenticated
 using(exists(select 1 from public.patients p where p.tenant_id=branches.tenant_id
  and p.branch_id=branches.id and p.created_by=(select auth.uid())));
