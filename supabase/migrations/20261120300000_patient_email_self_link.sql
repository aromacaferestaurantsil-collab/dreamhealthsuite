-- Verified-email self-linking for patient portal accounts.
create or replace function private.link_patient_profile_by_verified_email()
returns uuid language plpgsql security definer set search_path=pg_catalog,public
as $$
declare v_user uuid:=auth.uid(); v_email text; v_patient uuid; v_matches integer;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 select lower(email) into v_email from auth.users where id=v_user and email_confirmed_at is not null;
 if v_email is null or v_email='' then raise exception 'Confirm your account email before linking a patient profile'; end if;
 select count(*) into v_matches from public.patients where lower(email)=v_email and status='active' and (created_by is null or created_by=v_user);
 if v_matches=0 then raise exception 'No unlinked patient profile matches your verified email'; end if;
 if v_matches>1 then raise exception 'More than one patient profile matches this email; ask the clinic to resolve the duplicate records'; end if;
 select id into v_patient from public.patients where lower(email)=v_email and status='active' and (created_by is null or created_by=v_user) for update;
 update public.patients set created_by=v_user,updated_at=now() where id=v_patient;
 insert into public.audit_events(tenant_id,actor_user_id,action,entity_type,entity_id)
 select tenant_id,v_user,'patient.portal_linked','patient',v_patient::text from public.patients where id=v_patient;
 return v_patient;
end $$;
create or replace function public.link_patient_profile_by_verified_email()
returns uuid language sql security invoker set search_path=pg_catalog,public,private
as $$ select private.link_patient_profile_by_verified_email() $$;
revoke execute on function private.link_patient_profile_by_verified_email() from public,anon;
grant execute on function private.link_patient_profile_by_verified_email() to authenticated;
revoke execute on function public.link_patient_profile_by_verified_email() from public,anon;
grant execute on function public.link_patient_profile_by_verified_email() to authenticated;
