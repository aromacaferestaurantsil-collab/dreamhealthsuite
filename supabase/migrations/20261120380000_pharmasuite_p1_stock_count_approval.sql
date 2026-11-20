create or replace function public.pharmacy_approve_stock_count(p_tenant_id uuid,p_count_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_count record; v_item record; v_user uuid:=auth.uid(); v_delta numeric;
begin
 select * into v_count from public.pharmacy_stock_counts where id=p_count_id and tenant_id=p_tenant_id for update;
 if not found then raise exception 'Stock count not found'; end if;
 if not private.has_module_access(p_tenant_id,'pharmacy_suite',v_count.branch_id,true) then raise exception 'No pharmacy permission'; end if;
 if v_count.status<>'submitted' then raise exception 'Only submitted counts can be approved'; end if;
 if not exists(select 1 from public.tenant_memberships m where m.tenant_id=p_tenant_id and m.user_id=v_user and m.status='active' and m.role in ('owner','admin','manager')) then raise exception 'Manager approval required'; end if;
 for v_item in select i.*,b.quantity_on_hand,b.medicine_id,b.branch_id from public.pharmacy_stock_count_items i join public.medicine_batches b on b.id=i.batch_id and b.tenant_id=i.tenant_id where i.tenant_id=p_tenant_id and i.count_id=p_count_id for update of b loop
  if v_item.counted_quantity is null then raise exception 'Every count line must have a counted quantity'; end if;
  if v_item.branch_id<>v_count.branch_id then raise exception 'Count contains a batch from another branch'; end if;
  v_delta:=v_item.counted_quantity-v_item.quantity_on_hand;
  if v_delta<>0 then
   update public.medicine_batches set quantity_on_hand=v_item.counted_quantity where id=v_item.batch_id;
   insert into public.pharmacy_stock_movements(tenant_id,branch_id,medicine_id,batch_id,movement_type,quantity_delta,reference_type,reference_id,notes,actor_user_id)
   values(p_tenant_id,v_count.branch_id,v_item.medicine_id,v_item.batch_id,'stock_count',v_delta,'pharmacy_stock_count',p_count_id,'Approved physical stock count variance',v_user);
  end if;
 end loop;
 update public.pharmacy_stock_counts set status='approved',approved_by=v_user,approved_at=now() where id=p_count_id;
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id) values(p_tenant_id,v_count.branch_id,v_user,'pharmacy.stock_count_approved','pharmacy_stock_count',p_count_id::text);
end $$;
grant execute on function public.pharmacy_approve_stock_count(uuid,uuid) to authenticated;
