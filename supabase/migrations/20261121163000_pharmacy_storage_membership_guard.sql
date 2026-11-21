create or replace function private.can_read_pharmacy_prescription(p_tenant_id uuid,p_patient_id uuid)
returns boolean
language sql stable security definer
set search_path=pg_catalog,public,private
as $$
 select auth.uid() is not null and exists(
  select 1 from public.patients p
  where p.tenant_id=p_tenant_id and p.id=p_patient_id
   and private.has_module_access(p.tenant_id,'pharmacy_suite',p.branch_id,true)
   and private.has_tenant_role(p.tenant_id,array['owner','admin','manager','pharmacist']::text[],p.branch_id)
 );
$$;
revoke all on function private.can_read_pharmacy_prescription(uuid,uuid) from public,anon;
grant execute on function private.can_read_pharmacy_prescription(uuid,uuid) to authenticated;

alter policy pharmacy_photo_staff_read on storage.objects
using (
 bucket_id='pharmacy-catalogue-photos'
 and private.has_module_access((storage.foldername(name))[1]::uuid,'pharmacy_suite',null,true)
);

alter policy pharmacy_prescription_customer_upload on storage.objects
with check (
 bucket_id='pharmacy-prescriptions'
 and exists(
  select 1 from public.patients p
  join public.tenant_module_entitlements e on e.tenant_id=p.tenant_id
   and e.module_key='pharmacy_suite' and e.enabled=true
  where p.tenant_id=((storage.foldername(objects.name))[1])::uuid
   and p.id=((storage.foldername(objects.name))[2])::uuid
   and p.created_by=auth.uid()
 )
);
