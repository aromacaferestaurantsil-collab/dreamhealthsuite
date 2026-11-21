create or replace function public.lab_review_booking_request(p_booking_id uuid,p_decision text,p_notes text default null)
returns void language plpgsql security definer set search_path=pg_catalog,public,private
as $$
declare b public.lab_bookings%rowtype; v_role text;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 select * into b from public.lab_bookings where id=p_booking_id for update;if not found then raise exception 'Lab booking not found';end if;
 if b.booking_status<>'requested' then raise exception 'Only patient-requested bookings can be reviewed';end if;
 if not private.has_module_access(b.tenant_id,'laboratory_suite',b.branch_id,true) then raise exception 'LabSuite access is not enabled';end if;
 select role into v_role from public.tenant_memberships where tenant_id=b.tenant_id and user_id=auth.uid() and status='active' and (branch_id is null or branch_id=b.branch_id);
 if coalesce(v_role,'') not in ('owner','admin','manager','receptionist','lab_technician','pathologist') then raise exception 'Your role cannot review lab booking requests';end if;
 if p_decision not in ('confirmed','rejected') then raise exception 'Invalid booking decision';end if;
 update public.lab_bookings set booking_status=p_decision where id=b.id;
 update public.lab_booking_items set item_status=case when p_decision='confirmed' then 'booked' else 'rejected' end where booking_id=b.id and tenant_id=b.tenant_id;
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id,metadata) values(b.tenant_id,b.branch_id,auth.uid(),'lab.booking_'||p_decision,'lab_booking',b.id::text,jsonb_build_object('notes',p_notes));
end $$;
revoke all on function public.lab_review_booking_request(uuid,text,text) from public,anon;
grant execute on function public.lab_review_booking_request(uuid,text,text) to authenticated;
