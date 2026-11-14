
create or replace function public.pharmacy_checkout(
 p_tenant_id uuid,p_branch_id uuid,p_invoice_number text,p_items jsonb,
 p_payment_method text default 'cash',p_patient_id uuid default null,p_prescription_reference text default null
) returns uuid
language plpgsql security invoker set search_path=pg_catalog,public,private
as $$
declare
 v_user uuid:=auth.uid(); v_sale uuid; v_item jsonb; v_med uuid; v_qty numeric;
 v_remaining numeric; v_take numeric; v_batch record; v_price numeric; v_tax numeric;
 v_subtotal numeric:=0; v_tax_total numeric:=0; v_line numeric; v_line_tax numeric;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if not private.has_module_access(p_tenant_id,'pharmacy_suite',p_branch_id,true) then raise exception 'No pharmacy permission for this tenant/branch'; end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'At least one sale item is required'; end if;
 insert into public.pharmacy_sales(tenant_id,branch_id,patient_id,invoice_number,sale_status,payment_status,payment_method,prescription_reference,sold_by)
 values(p_tenant_id,p_branch_id,p_patient_id,p_invoice_number,'draft','pending',p_payment_method,p_prescription_reference,v_user)
 returning id into v_sale;
 for v_item in select value from jsonb_array_elements(p_items) loop
  v_med:=(v_item->>'medicine_id')::uuid; v_qty:=(v_item->>'quantity')::numeric;
  if v_qty<=0 then raise exception 'Quantity must be positive'; end if;
  v_remaining:=v_qty;
  for v_batch in
   select b.id,b.quantity_on_hand,b.selling_rate,m.gst_rate
   from public.medicine_batches b join public.medicine_catalogue m on m.id=b.medicine_id and m.tenant_id=b.tenant_id
   where b.tenant_id=p_tenant_id and b.branch_id=p_branch_id and b.medicine_id=v_med
     and b.quantity_on_hand>0 and b.expiry_date>=current_date
   order by b.expiry_date,b.received_at,b.id for update of b
  loop
   exit when v_remaining<=0;
   v_take:=least(v_remaining,v_batch.quantity_on_hand);
   v_price:=coalesce(nullif(v_item->>'unit_price','')::numeric,v_batch.selling_rate);
   v_tax:=v_batch.gst_rate;
   v_line:=round(v_take*v_price,2);
   v_line_tax:=round(v_line*v_tax/100,2);
   update public.medicine_batches set quantity_on_hand=quantity_on_hand-v_take where id=v_batch.id;
   insert into public.pharmacy_sale_items(tenant_id,sale_id,medicine_id,batch_id,quantity,unit_price,tax_rate,line_total)
   values(p_tenant_id,v_sale,v_med,v_batch.id,v_take,v_price,v_tax,v_line+v_line_tax);
   insert into public.pharmacy_stock_movements(tenant_id,branch_id,medicine_id,batch_id,movement_type,quantity_delta,reference_type,reference_id,actor_user_id)
   values(p_tenant_id,p_branch_id,v_med,v_batch.id,'sale',-v_take,'pharmacy_sale',v_sale,v_user);
   v_subtotal:=v_subtotal+v_line; v_tax_total:=v_tax_total+v_line_tax; v_remaining:=v_remaining-v_take;
  end loop;
  if v_remaining>0 then raise exception 'Insufficient unexpired stock for medicine %; shortage %',v_med,v_remaining; end if;
 end loop;
 update public.pharmacy_sales set subtotal=v_subtotal,tax_total=v_tax_total,grand_total=v_subtotal+v_tax_total,
  sale_status='completed',payment_status='paid' where id=v_sale;
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id,metadata)
 values(p_tenant_id,p_branch_id,v_user,'pharmacy.checkout','pharmacy_sale',v_sale::text,jsonb_build_object('invoice',p_invoice_number,'total',v_subtotal+v_tax_total));
 return v_sale;
end $$;
grant execute on function public.pharmacy_checkout(uuid,uuid,text,jsonb,text,uuid,text) to authenticated;

create or replace function public.lab_verify_result(p_result_id uuid,p_release boolean default false)
returns void language plpgsql security invoker set search_path=pg_catalog,public,private
as $$
declare r public.lab_results%rowtype;
begin
 select * into r from public.lab_results where id=p_result_id for update;
 if not found then raise exception 'Result not found'; end if;
 if not private.has_module_access(r.tenant_id,'laboratory_suite',null,true) then raise exception 'No laboratory permission'; end if;
 if r.result_status not in ('entered','verified') then raise exception 'Only entered or verified results may be verified/released'; end if;
 if p_release then
  if r.result_status<>'verified' then raise exception 'Result must be verified before release'; end if;
  update public.lab_results set result_status='released',released_at=now(),updated_at=now() where id=p_result_id;
 else
  if r.entered_by=auth.uid() then raise exception 'Result author cannot verify their own result'; end if;
  update public.lab_results set result_status='verified',verified_by=auth.uid(),verified_at=now(),updated_at=now() where id=p_result_id;
 end if;
 insert into public.audit_events(tenant_id,actor_user_id,action,entity_type,entity_id)
 values(r.tenant_id,auth.uid(),case when p_release then 'lab.result_released' else 'lab.result_verified' end,'lab_result',p_result_id::text);
end $$;
grant execute on function public.lab_verify_result(uuid,boolean) to authenticated;

create or replace function public.create_doctor_appointment(
 p_tenant_id uuid,p_branch_id uuid,p_patient_id uuid,p_doctor_id uuid,p_appointment_number text,
 p_starts_at timestamptz,p_ends_at timestamptz,p_reason text default null
) returns uuid language plpgsql security invoker set search_path=pg_catalog,public,private
as $$
declare v_id uuid;
begin
 if not private.has_module_access(p_tenant_id,'doctor_suite',p_branch_id,true) then raise exception 'No doctor module permission'; end if;
 if p_ends_at is not null and p_ends_at<=p_starts_at then raise exception 'Appointment end must be after start'; end if;
 perform 1 from public.doctor_profiles where id=p_doctor_id and tenant_id=p_tenant_id for update;
 if not found then raise exception 'Doctor not found in this tenant'; end if;
 if exists(select 1 from public.doctor_appointments a where a.tenant_id=p_tenant_id and a.doctor_id=p_doctor_id
   and a.appointment_status not in ('cancelled','no_show')
   and tstzrange(a.starts_at,coalesce(a.ends_at,a.starts_at+interval '30 minutes'),'[)') &&
       tstzrange(p_starts_at,coalesce(p_ends_at,p_starts_at+interval '30 minutes'),'[)')) then
   raise exception 'Doctor already has an overlapping appointment';
 end if;
 insert into public.doctor_appointments(tenant_id,branch_id,patient_id,doctor_id,appointment_number,starts_at,ends_at,reason,created_by)
 values(p_tenant_id,p_branch_id,p_patient_id,p_doctor_id,p_appointment_number,p_starts_at,p_ends_at,p_reason,auth.uid())
 returning id into v_id;
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id)
 values(p_tenant_id,p_branch_id,auth.uid(),'doctor.appointment_created','doctor_appointment',v_id::text);
 return v_id;
end $$;
grant execute on function public.create_doctor_appointment(uuid,uuid,uuid,uuid,text,timestamptz,timestamptz,text) to authenticated;

create or replace function public.transition_care_job(p_job_id uuid,p_new_status text,p_notes text default null,p_location jsonb default null)
returns void language plpgsql security invoker set search_path=pg_catalog,public,private
as $$
declare j public.care_jobs%rowtype; v_user uuid:=auth.uid();
begin
 select * into j from public.care_jobs where id=p_job_id for update;
 if not found then raise exception 'Care job not found'; end if;
 if not private.has_module_access(j.tenant_id,'care_connect',j.branch_id,true) then raise exception 'No care module permission'; end if;
 if p_new_status not in ('approved','assigned','in_progress','completed','cancelled') then raise exception 'Invalid target status'; end if;
 if not (
  (j.job_status='requested' and p_new_status in ('approved','cancelled')) or
  (j.job_status='approved' and p_new_status in ('assigned','cancelled')) or
  (j.job_status='assigned' and p_new_status in ('in_progress','cancelled')) or
  (j.job_status='in_progress' and p_new_status in ('completed','cancelled'))
 ) then raise exception 'Invalid care job state transition'; end if;
 if j.assigned_to is not null and j.assigned_to<>v_user and p_new_status in ('in_progress','completed') and not exists(
  select 1 from public.tenant_memberships m where m.tenant_id=j.tenant_id and m.user_id=v_user and m.status='active' and m.role in ('owner','admin','manager')
 ) then raise exception 'Only the assigned worker or tenant manager may progress this job'; end if;
 update public.care_jobs set job_status=p_new_status,completed_at=case when p_new_status='completed' then now() else completed_at end,
 assigned_to=case when p_new_status='assigned' and assigned_to is null then v_user else assigned_to end
 where id=p_job_id;
 insert into public.care_job_events(tenant_id,job_id,event_type,notes,location,actor_user_id)
 values(j.tenant_id,j.id,p_new_status,p_notes,p_location,v_user);
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id)
 values(j.tenant_id,j.branch_id,v_user,'care.job_'||p_new_status,'care_job',j.id::text);
end $$;
grant execute on function public.transition_care_job(uuid,text,text,jsonb) to authenticated;
