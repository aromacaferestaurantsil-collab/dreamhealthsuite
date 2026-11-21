-- The existing status timeline trigger already emits order_created/status_changed.
-- Remove duplicate manual event inserts from the private RPC implementations.
do $$
declare
 v_def text;
 v_new text;
 v_submit_old text := $old$
 insert into public.pharmacy_customer_order_events(
  tenant_id,branch_id,order_id,event_type,event_status,note,visible_to_customer,actor_user_id
 ) values(p_tenant_id,p_branch_id,v_id,'order_submitted',v_status,null,true,auth.uid());
$old$;
 v_review_old text := $old$
 insert into public.pharmacy_customer_order_events(
  tenant_id,branch_id,order_id,event_type,event_status,note,visible_to_customer,actor_user_id
 ) values(p_tenant_id,o.branch_id,o.id,'order_reviewed',p_decision,p_notes,true,auth.uid());
$old$;
begin
 v_def:=pg_get_functiondef('private.pharmacy_submit_customer_order_impl(uuid,uuid,text,jsonb,text,text)'::regprocedure);
 v_new:=replace(v_def,v_submit_old,'');
 if v_new=v_def then raise exception 'Could not locate duplicate submit timeline insert'; end if;
 execute v_new;

 v_def:=pg_get_functiondef('private.pharmacy_review_customer_order_impl(uuid,uuid,text,text,jsonb)'::regprocedure);
 v_new:=replace(v_def,v_review_old,'');
 if v_new=v_def then raise exception 'Could not locate duplicate review timeline insert'; end if;
 execute v_new;
end;
$$;
