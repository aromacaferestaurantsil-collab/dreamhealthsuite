-- Restrict staff access to prescription files by the patient's assigned branch.
create or replace function private.can_read_pharmacy_prescription(p_tenant_id uuid,p_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path=pg_catalog,public,private
as $$
 select exists(
  select 1 from public.patients p
  where p.tenant_id=p_tenant_id and p.id=p_patient_id
   and private.has_module_access(p.tenant_id,'pharmacy_suite',p.branch_id,false)
 )
$$;
revoke all on function private.can_read_pharmacy_prescription(uuid,uuid) from public,anon;
grant execute on function private.can_read_pharmacy_prescription(uuid,uuid) to authenticated;

drop policy if exists pharmacy_prescription_staff_read on storage.objects;
create policy pharmacy_prescription_staff_read on storage.objects for select to authenticated
 using(bucket_id='pharmacy-prescriptions'
  and private.can_read_pharmacy_prescription(
   (storage.foldername(name))[1]::uuid,(storage.foldername(name))[2]::uuid
  ));

drop policy if exists pharmacy_prescription_patient_read on storage.objects;
create policy pharmacy_prescription_patient_read on storage.objects for select to authenticated
 using(bucket_id='pharmacy-prescriptions'
  and exists(
   select 1 from public.patients p
   where p.tenant_id=(storage.foldername(name))[1]::uuid
    and p.id=(storage.foldername(name))[2]::uuid
    and p.created_by=(select auth.uid())
  ));
