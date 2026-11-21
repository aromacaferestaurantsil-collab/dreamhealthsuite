-- Doctor self-service identity and consultation workflows.
create or replace function public.doctor_get_my_profile()
returns table(id uuid,tenant_id uuid,doctor_code text,full_name text,specialty text,qualifications text,registration_number text,consultation_fee numeric,status text)
language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 return query select dp.id,dp.tenant_id,dp.doctor_code,dp.full_name,dp.specialty,dp.qualifications,dp.registration_number,dp.consultation_fee,dp.status from public.doctor_profiles dp
 where dp.user_id=auth.uid() and dp.status='active' and exists(select 1 from public.tenant_module_entitlements e where e.tenant_id=dp.tenant_id and e.module_key='doctor_suite' and e.enabled);
end $$;
revoke all on function public.doctor_get_my_profile() from public,anon;
grant execute on function public.doctor_get_my_profile() to authenticated;

create or replace function public.doctor_list_own_appointment_patients(p_doctor_profile_id uuid)
returns table(id uuid,full_name text,patient_code text,phone text)
language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if not exists(select 1 from public.doctor_profiles dp where dp.id=p_doctor_profile_id and dp.user_id=auth.uid() and dp.status='active') then raise exception 'Doctor profile does not belong to the signed-in account';end if;
 return query select distinct p.id,p.full_name,p.patient_code,p.phone from public.doctor_appointments a join public.patients p on p.id=a.patient_id and p.tenant_id=a.tenant_id
 where a.doctor_id=p_doctor_profile_id and a.tenant_id=(select tenant_id from public.doctor_profiles where id=p_doctor_profile_id) order by p.full_name;
end $$;
revoke all on function public.doctor_list_own_appointment_patients(uuid) from public,anon;
grant execute on function public.doctor_list_own_appointment_patients(uuid) to authenticated;

create or replace function public.doctor_save_consultation(p_appointment_id uuid,p_chief_complaint text default null,p_clinical_notes text default null,p_diagnosis text default null,p_treatment_plan text default null,p_follow_up_at timestamptz default null)
returns uuid language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare a public.doctor_appointments%rowtype;d public.doctor_profiles%rowtype;v_id uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 select * into a from public.doctor_appointments where id=p_appointment_id for update;if not found then raise exception 'Appointment not found';end if;
 select * into d from public.doctor_profiles where id=a.doctor_id and tenant_id=a.tenant_id and user_id=auth.uid() and status='active';if not found then raise exception 'Appointment is not assigned to your doctor profile';end if;
 if not private.has_module_access(a.tenant_id,'doctor_suite',a.branch_id,true) then raise exception 'DoctorSuite access is not enabled';end if;
 if a.appointment_status in ('cancelled','no_show') then raise exception 'Cannot create a consultation for a cancelled or no-show appointment';end if;
 if nullif(btrim(coalesce(p_clinical_notes,'')),'') is null and nullif(btrim(coalesce(p_diagnosis,'')),'') is null then raise exception 'Clinical notes or diagnosis is required';end if;
 select id into v_id from public.doctor_consultations where appointment_id=a.id and tenant_id=a.tenant_id for update;
 if v_id is null then
  insert into public.doctor_consultations(tenant_id,appointment_id,chief_complaint,clinical_notes,diagnosis,treatment_plan,follow_up_at,created_by)
  values(a.tenant_id,a.id,p_chief_complaint,p_clinical_notes,p_diagnosis,p_treatment_plan,p_follow_up_at,auth.uid()) returning id into v_id;
 else
  update public.doctor_consultations set chief_complaint=p_chief_complaint,clinical_notes=p_clinical_notes,diagnosis=p_diagnosis,treatment_plan=p_treatment_plan,follow_up_at=p_follow_up_at
  where id=v_id and tenant_id=a.tenant_id and created_by=auth.uid() and signed_at is null;
  if not found then raise exception 'Consultation is already signed or was authored by another doctor';end if;
 end if;
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id) values(a.tenant_id,a.branch_id,auth.uid(),'doctor.consultation_saved','doctor_consultation',v_id::text);
 return v_id;
end $$;
revoke all on function public.doctor_save_consultation(uuid,text,text,text,text,timestamptz) from public,anon;
grant execute on function public.doctor_save_consultation(uuid,text,text,text,text,timestamptz) to authenticated;
