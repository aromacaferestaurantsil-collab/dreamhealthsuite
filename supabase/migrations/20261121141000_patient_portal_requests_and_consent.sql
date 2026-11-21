-- Patient-owned appointment, lab booking and consent actions.
create or replace function public.patient_request_doctor_appointment(p_patient_id uuid,p_branch_id uuid,p_doctor_id uuid,p_starts_at timestamptz,p_reason text default null)
returns uuid language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare p public.patients%rowtype;d public.doctor_profiles%rowtype;v_id uuid;v_number text;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 select * into p from public.patients where id=p_patient_id and status='active' and (created_by=auth.uid() or exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null and lower(u.email)=lower(public.patients.email))) for update;
 if not found then raise exception 'Patient profile is not linked to this account';end if;
 if p_branch_id is null or not exists(select 1 from public.branches where id=p_branch_id and tenant_id=p.tenant_id and status='active') then raise exception 'Choose an active branch';end if;
 if p.branch_id is not null and p.branch_id<>p_branch_id then raise exception 'Patient is not registered at this branch';end if;
 if not exists(select 1 from public.tenant_module_entitlements where tenant_id=p.tenant_id and module_key='doctor_suite' and enabled) then raise exception 'DoctorSuite is not enabled';end if;
 select * into d from public.doctor_profiles where id=p_doctor_id and tenant_id=p.tenant_id and status='active';
 if not found then raise exception 'Doctor is not available';end if;
 if p_starts_at is null or p_starts_at<=now() then raise exception 'Choose a future preferred appointment time';end if;
 if exists(select 1 from public.doctor_appointments a where a.tenant_id=p.tenant_id and a.doctor_id=p_doctor_id and a.appointment_status not in ('cancelled','no_show') and tstzrange(a.starts_at,coalesce(a.ends_at,a.starts_at+interval '30 minutes'),'[)') && tstzrange(p_starts_at,p_starts_at+interval '30 minutes','[)')) then raise exception 'The preferred time may be unavailable';end if;
 v_number:='REQ-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
 insert into public.doctor_appointments(tenant_id,branch_id,patient_id,doctor_id,appointment_number,starts_at,ends_at,appointment_status,reason,created_by)
 values(p.tenant_id,p_branch_id,p.id,d.id,v_number,p_starts_at,p_starts_at+interval '30 minutes','requested',p_reason,auth.uid()) returning id into v_id;
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id,metadata) values(p.tenant_id,p_branch_id,auth.uid(),'patient.appointment_requested','doctor_appointment',v_id::text,jsonb_build_object('doctor_id',d.id,'preferred_at',p_starts_at));
 return v_id;
end $$;
revoke all on function public.patient_request_doctor_appointment(uuid,uuid,uuid,timestamptz,text) from public,anon;
grant execute on function public.patient_request_doctor_appointment(uuid,uuid,uuid,timestamptz,text) to authenticated;

create or replace function public.patient_request_lab_booking(p_patient_id uuid,p_branch_id uuid,p_test_ids uuid[],p_scheduled_at timestamptz default null)
returns uuid language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare p public.patients%rowtype;v_id uuid;v_total numeric(14,2);v_count integer;v_number text;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 select * into p from public.patients where id=p_patient_id and status='active' and (created_by=auth.uid() or exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null and lower(u.email)=lower(public.patients.email))) for update;
 if not found then raise exception 'Patient profile is not linked to this account';end if;
 if p_branch_id is null or not exists(select 1 from public.branches where id=p_branch_id and tenant_id=p.tenant_id and status='active') then raise exception 'Choose an active branch';end if;
 if p.branch_id is not null and p.branch_id<>p_branch_id then raise exception 'Patient is not registered at this branch';end if;
 if not exists(select 1 from public.tenant_module_entitlements where tenant_id=p.tenant_id and module_key in ('laboratory_suite','lab_suite') and enabled) then raise exception 'LabSuite is not enabled';end if;
 if coalesce(array_length(p_test_ids,1),0)=0 then raise exception 'Select at least one test';end if;
 select count(*),coalesce(sum(price),0) into v_count,v_total from public.lab_test_catalogue where tenant_id=p.tenant_id and id=any(p_test_ids) and status='active';
 if v_count<>array_length(p_test_ids,1) then raise exception 'One or more selected tests are unavailable';end if;
 v_number:='REQ-LAB-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
 insert into public.lab_bookings(tenant_id,branch_id,patient_id,booking_number,booking_status,booked_at,scheduled_at,total_amount,payment_status,created_by) values(p.tenant_id,p_branch_id,p.id,v_number,'requested',now(),p_scheduled_at,v_total,'unpaid',auth.uid()) returning id into v_id;
 insert into public.lab_booking_items(tenant_id,booking_id,test_id,price,item_status) select p.tenant_id,v_id,t.id,t.price,'requested' from public.lab_test_catalogue t where t.tenant_id=p.tenant_id and t.id=any(p_test_ids) and t.status='active';
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id,metadata) values(p.tenant_id,p_branch_id,auth.uid(),'patient.lab_booking_requested','lab_booking',v_id::text,jsonb_build_object('test_ids',p_test_ids,'total_amount',v_total));
 return v_id;
end $$;
revoke all on function public.patient_request_lab_booking(uuid,uuid,uuid[],timestamptz) from public,anon;
grant execute on function public.patient_request_lab_booking(uuid,uuid,uuid[],timestamptz) to authenticated;

create or replace function public.patient_update_own_consent(p_consent_id uuid,p_granted boolean)
returns void language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare c public.patient_consents%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 select pc.* into c from public.patient_consents pc join public.patients p on p.id=pc.patient_id and p.tenant_id=pc.tenant_id
 where pc.id=p_consent_id and (p.created_by=auth.uid() or exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null and lower(u.email)=lower(p.email))) for update;
 if not found then raise exception 'Consent record does not belong to your patient profile';end if;
 update public.patient_consents set granted=p_granted,withdrawn_at=case when p_granted then null else now() end where id=p_consent_id;
 insert into public.audit_events(tenant_id,actor_user_id,action,entity_type,entity_id,metadata) values(c.tenant_id,auth.uid(),case when p_granted then 'patient.consent_enabled' else 'patient.consent_withdrawn' end,'patient_consent',c.id::text,jsonb_build_object('consent_type',c.consent_type));
end $$;
revoke all on function public.patient_update_own_consent(uuid,boolean) from public,anon;
grant execute on function public.patient_update_own_consent(uuid,boolean) to authenticated;
