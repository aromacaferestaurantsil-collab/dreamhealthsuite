-- Keep privileged implementation code in the non-exposed schema.
-- Public PostgREST RPCs remain SECURITY INVOKER wrappers.
do $$
declare v_def text;
begin
 v_def:=pg_get_functiondef('public.pharmacy_process_return(uuid,uuid,text,text,text,uuid,uuid,jsonb)'::regprocedure);
 v_def:=replace(v_def,'FUNCTION public.pharmacy_process_return(','FUNCTION private.pharmacy_process_return_impl(');
 execute v_def;

 v_def:=pg_get_functiondef('public.lab_verify_result(uuid,boolean)'::regprocedure);
 v_def:=replace(v_def,'FUNCTION public.lab_verify_result(','FUNCTION private.lab_verify_result_impl(');
 execute v_def;
end;
$$;

create or replace function public.pharmacy_process_return(
 p_tenant_id uuid,p_branch_id uuid,p_return_number text,p_return_type text,p_reason text,
 p_sale_id uuid,p_supplier_id uuid,p_items jsonb
) returns uuid
language sql
security invoker
set search_path=pg_catalog,public,private
as $$
 select private.pharmacy_process_return_impl(
  p_tenant_id,p_branch_id,p_return_number,p_return_type,p_reason,p_sale_id,p_supplier_id,p_items
 )
$$;

create or replace function public.lab_verify_result(p_result_id uuid,p_release boolean default false)
returns void
language sql
security invoker
set search_path=pg_catalog,public,private
as $$
 select private.lab_verify_result_impl(p_result_id,p_release)
$$;

revoke all on function private.pharmacy_process_return_impl(uuid,uuid,text,text,text,uuid,uuid,jsonb) from public,anon;
revoke all on function private.lab_verify_result_impl(uuid,boolean) from public,anon;
grant execute on function private.pharmacy_process_return_impl(uuid,uuid,text,text,text,uuid,uuid,jsonb) to authenticated;
grant execute on function private.lab_verify_result_impl(uuid,boolean) to authenticated;

revoke all on function public.pharmacy_process_return(uuid,uuid,text,text,text,uuid,uuid,jsonb) from public,anon;
revoke all on function public.lab_verify_result(uuid,boolean) from public,anon;
grant execute on function public.pharmacy_process_return(uuid,uuid,text,text,text,uuid,uuid,jsonb) to authenticated;
grant execute on function public.lab_verify_result(uuid,boolean) to authenticated;

create or replace function private.can_read_pharmacy_prescription(p_tenant_id uuid,p_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path=pg_catalog,public,private
as $$
 select auth.uid() is not null and exists(
  select 1 from public.patients p
  where p.tenant_id=p_tenant_id and p.id=p_patient_id
   and private.has_module_access(p.tenant_id,'pharmacy_suite',p.branch_id,false)
 )
$$;
revoke all on function private.can_read_pharmacy_prescription(uuid,uuid) from public,anon;
grant execute on function private.can_read_pharmacy_prescription(uuid,uuid) to authenticated;
