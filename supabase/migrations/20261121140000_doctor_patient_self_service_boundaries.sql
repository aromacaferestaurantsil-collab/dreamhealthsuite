-- Doctor and patient self-service boundaries.
drop policy if exists module_read on public.doctor_profiles;
create policy doctor_profile_read on public.doctor_profiles for select to authenticated using(private.has_module_access(tenant_id,'doctor_suite',null,false) or user_id=auth.uid());

drop policy if exists module_read on public.doctor_appointments;
create policy doctor_appointment_read on public.doctor_appointments for select to authenticated using(
 private.has_module_access(tenant_id,'doctor_suite',branch_id,false) and exists(
  select 1 from public.doctor_profiles dp where dp.id=doctor_appointments.doctor_id and dp.tenant_id=doctor_appointments.tenant_id
  and (dp.user_id=auth.uid() or exists(select 1 from public.tenant_memberships m where m.tenant_id=doctor_appointments.tenant_id and m.user_id=auth.uid() and m.status='active' and m.role in ('owner','admin','manager','receptionist')))
 ));
drop policy if exists module_read on public.doctor_consultations;
create policy doctor_consultation_read on public.doctor_consultations for select to authenticated using(
 private.has_module_access(tenant_id,'doctor_suite',null,false) and exists(
  select 1 from public.doctor_appointments a join public.doctor_profiles dp on dp.id=a.doctor_id and dp.tenant_id=a.tenant_id
  where a.id=doctor_consultations.appointment_id and a.tenant_id=doctor_consultations.tenant_id
  and (dp.user_id=auth.uid() or exists(select 1 from public.tenant_memberships m where m.tenant_id=a.tenant_id and m.user_id=auth.uid() and m.status='active' and m.role in ('owner','admin','manager')))
 ));

drop policy if exists patient_member_access on public.patients;
drop policy if exists patient_self_access on public.patients;
create policy patient_self_access on public.patients for select to authenticated using(
 created_by=auth.uid()
 or exists(select 1 from auth.users au where au.id=auth.uid() and lower(au.email)=lower(patients.email) and au.email_confirmed_at is not null)
 or exists(select 1 from public.tenant_memberships m join public.tenant_module_entitlements e on e.tenant_id=m.tenant_id and e.module_key='patient_suite' and e.enabled
  where m.tenant_id=patients.tenant_id and m.user_id=auth.uid() and m.status='active' and m.role in ('owner','admin','manager','doctor','receptionist') and (m.branch_id is null or m.branch_id=patients.branch_id))
 );
drop policy if exists consent_member_access on public.patient_consents;
create policy consent_patient_self_read on public.patient_consents for select to authenticated using(
 exists(select 1 from public.patients p where p.id=patient_consents.patient_id and p.tenant_id=patient_consents.tenant_id
  and (p.created_by=auth.uid() or exists(select 1 from auth.users au where au.id=auth.uid() and lower(au.email)=lower(p.email) and au.email_confirmed_at is not null)))
 or exists(select 1 from public.tenant_memberships m join public.tenant_module_entitlements e on e.tenant_id=m.tenant_id and e.module_key='patient_suite' and e.enabled join public.patients p on p.id=patient_consents.patient_id and p.tenant_id=patient_consents.tenant_id
  where m.tenant_id=patient_consents.tenant_id and m.user_id=auth.uid() and m.status='active' and m.role in ('owner','admin','manager','doctor','receptionist') and (m.branch_id is null or m.branch_id=p.branch_id))
 );

create or replace function private.link_patient_profile_by_verified_email() returns uuid language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_user uuid:=auth.uid();v_email text;v_confirmed timestamptz;v_patient uuid;v_matches integer;
begin
 if v_user is null then raise exception 'Authentication required';end if;
 if exists(select 1 from public.tenant_memberships m where m.user_id=v_user and m.status='active') then raise exception 'Vendor or employee accounts cannot claim patient portal identity';end if;
 if exists(select 1 from public.doctor_profiles d where d.user_id=v_user and d.status='active') then raise exception 'Doctor accounts cannot claim patient portal identity';end if;
 select lower(email),email_confirmed_at into v_email,v_confirmed from auth.users where id=v_user;
 if v_confirmed is null or v_email is null then raise exception 'A verified email address is required';end if;
 select count(*) into v_matches from public.patients p where lower(p.email)=v_email and p.status='active';
 if v_matches=0 then raise exception 'No active patient record matches this verified email';end if;
 if v_matches>1 then raise exception 'Multiple patient records match this email. Contact the healthcare provider to reconcile identity before linking';end if;
 select p.id into v_patient from public.patients p where lower(p.email)=v_email and p.status='active' for update;
 update public.patients set created_by=v_user,updated_at=now() where id=v_patient and (created_by is null or created_by=v_user);
 if not found then raise exception 'Patient record is already linked to another account';end if;
 return v_patient;
end $$;
revoke all on function private.link_patient_profile_by_verified_email() from public,anon,authenticated;
grant execute on function private.link_patient_profile_by_verified_email() to authenticated;
create or replace function public.link_patient_profile_by_verified_email() returns uuid language sql security definer set search_path=pg_catalog,public,private as $$select private.link_patient_profile_by_verified_email()$$;
revoke all on function public.link_patient_profile_by_verified_email() from public,anon;
grant execute on function public.link_patient_profile_by_verified_email() to authenticated;
