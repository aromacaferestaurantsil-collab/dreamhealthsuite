
alter table public.tenant_memberships drop constraint if exists tenant_memberships_role_check;
alter table public.tenant_memberships add constraint tenant_memberships_role_check
 check(role in ('owner','admin','manager','doctor','pharmacist','lab_technician','pathologist','care_worker','receptionist','analyst','staff'));

create or replace function public.manage_tenant_member(
 p_tenant_id uuid,p_user_id uuid,p_role text,p_branch_id uuid default null,p_activate boolean default false
) returns uuid language plpgsql security invoker set search_path=pg_catalog,public,private
as $$
declare v_id uuid; v_actor_role text;
begin
 select role into v_actor_role from public.tenant_memberships
 where tenant_id=p_tenant_id and user_id=auth.uid() and status='active';
 if v_actor_role not in ('owner','admin') then raise exception 'Only tenant owner/admin can manage memberships'; end if;
 if p_role not in ('admin','manager','doctor','pharmacist','lab_technician','pathologist','care_worker','receptionist','analyst','staff') then
  raise exception 'Invalid or privileged role; owner role cannot be assigned through this function';
 end if;
 if v_actor_role='admin' and p_role='admin' then raise exception 'Only the tenant owner can appoint another admin'; end if;
 if p_branch_id is not null and not exists(select 1 from public.branches b where b.id=p_branch_id and b.tenant_id=p_tenant_id) then raise exception 'Branch does not belong to tenant'; end if;
 insert into public.tenant_memberships(tenant_id,user_id,branch_id,role,status,invited_by)
 values(p_tenant_id,p_user_id,p_branch_id,p_role,case when p_activate then 'active' else 'invited' end,auth.uid())
 on conflict(tenant_id,user_id) do update set branch_id=excluded.branch_id,role=excluded.role,status=excluded.status,invited_by=auth.uid(),updated_at=now()
 returning id into v_id;
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id,metadata)
 values(p_tenant_id,p_branch_id,auth.uid(),'tenant.member_managed','tenant_membership',v_id::text,jsonb_build_object('role',p_role,'status',case when p_activate then 'active' else 'invited' end));
 return v_id;
end $$;
grant execute on function public.manage_tenant_member(uuid,uuid,text,uuid,boolean) to authenticated;

create or replace function public.set_module_entitlement(p_tenant_id uuid,p_module_key text,p_enabled boolean)
returns void language plpgsql security invoker set search_path=pg_catalog,public
as $$
begin
 if not exists(select 1 from public.tenant_memberships m where m.tenant_id=p_tenant_id and m.user_id=auth.uid() and m.status='active' and m.role='owner') then
  raise exception 'Only tenant owner can change module entitlements';
 end if;
 update public.tenant_module_entitlements set enabled=p_enabled,updated_at=now()
 where tenant_id=p_tenant_id and module_key=p_module_key;
 if not found then raise exception 'Module entitlement not found'; end if;
 insert into public.audit_events(tenant_id,actor_user_id,action,entity_type,entity_id,metadata)
 values(p_tenant_id,auth.uid(),'tenant.module_entitlement_changed','tenant_module_entitlement',p_module_key,jsonb_build_object('enabled',p_enabled));
end $$;
grant execute on function public.set_module_entitlement(uuid,text,boolean) to authenticated;

create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path=pg_catalog
as $$ begin new.updated_at=now(); return new; end $$;

do $$
declare t text;
begin
 foreach t in array array['tenants','branches','user_profiles','tenant_memberships','tenant_module_entitlements','patients','medicine_catalogue','lab_results','tenant_subscriptions'] loop
  execute format('drop trigger if exists touch_updated_at on public.%I',t);
  execute format('create trigger touch_updated_at before update on public.%I for each row execute function private.touch_updated_at()',t);
 end loop;
end $$;

-- Audit trail for important patient and clinical record changes. The trigger only writes metadata, not clinical content.
create or replace function private.audit_row_change()
returns trigger language plpgsql security definer set search_path=pg_catalog,public
as $$
declare v_tenant uuid; v_branch uuid; v_id text; v_action text;
begin
 if tg_op='DELETE' then
  v_tenant:=(to_jsonb(old)->>'tenant_id')::uuid; v_branch:=nullif(to_jsonb(old)->>'branch_id','')::uuid; v_id:=to_jsonb(old)->>'id';
 else
  v_tenant:=(to_jsonb(new)->>'tenant_id')::uuid; v_branch:=nullif(to_jsonb(new)->>'branch_id','')::uuid; v_id:=to_jsonb(new)->>'id';
 end if;
 v_action:=lower(tg_table_name)||'.'||lower(tg_op);
 if v_tenant is not null then
  insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id)
  values(v_tenant,v_branch,auth.uid(),v_action,tg_table_name,v_id);
 end if;
 return case when tg_op='DELETE' then old else new end;
end $$;

do $$
declare t text;
begin
 foreach t in array array['patients','patient_consents','pharmacy_sales','lab_results','doctor_appointments','doctor_consultations','care_jobs'] loop
  execute format('drop trigger if exists audit_row_change on public.%I',t);
  execute format('create trigger audit_row_change after insert or update or delete on public.%I for each row execute function private.audit_row_change()',t);
 end loop;
end $$;

-- Make result release require independent verification and protect released records from direct modification.
create or replace function private.protect_released_lab_result()
returns trigger language plpgsql set search_path=pg_catalog
as $$
begin
 if old.result_status='released' and (new.result_data is distinct from old.result_data or new.result_text is distinct from old.result_text or new.result_status<>'amended') then
  raise exception 'Released results are immutable; use a formal amendment workflow';
 end if;
 if new.result_status='released' and (new.verified_by is null or new.verified_at is null or new.entered_by=new.verified_by) then
  raise exception 'A released result requires independent verification';
 end if;
 return new;
end $$;
drop trigger if exists protect_released_lab_result on public.lab_results;
create trigger protect_released_lab_result before update on public.lab_results for each row execute function private.protect_released_lab_result();

-- Extra covering indexes for composite foreign keys missed by the advisor.
create index if not exists idx_purchase_items_tenant_order on public.pharmacy_purchase_items(tenant_id,purchase_order_id);
create index if not exists idx_purchase_orders_tenant_supplier on public.pharmacy_purchase_orders(tenant_id,supplier_id);
create index if not exists idx_stock_movements_tenant_medicine on public.pharmacy_stock_movements(tenant_id,medicine_id);
