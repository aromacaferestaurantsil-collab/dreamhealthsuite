-- Synthetic-only review tenant. No production rows or identities are copied.
create or replace function private.claim_demo_workspace()
returns uuid language plpgsql security definer set search_path=pg_catalog,public
as $$
declare v_tenant uuid; v_user uuid:=auth.uid(); v_existing uuid;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 select id into v_tenant from public.tenants where slug='healthbuddy-demo' for update;
 if v_tenant is null then raise exception 'Demo workspace is not seeded'; end if;
 select tenant_id into v_existing from public.tenant_memberships
  where tenant_id=v_tenant and user_id=v_user and status='active';
 if v_existing is not null then return v_tenant; end if;
 if exists(select 1 from public.tenant_memberships where tenant_id=v_tenant and status='active' and role='owner') then
  raise exception 'Demo workspace has already been claimed by another tester';
 end if;
 insert into public.tenant_memberships(tenant_id,user_id,role,status,branch_id)
 values(v_tenant,v_user,'owner','active',null);
 insert into public.audit_events(tenant_id,actor_user_id,action,entity_type,entity_id)
 values(v_tenant,v_user,'demo.workspace_claimed','tenant',v_tenant::text);
 return v_tenant;
end $$;
create or replace function public.claim_demo_workspace()
returns uuid language plpgsql security invoker set search_path=pg_catalog,public,private
as $$ begin return private.claim_demo_workspace(); end $$;
revoke execute on function private.claim_demo_workspace() from public,anon;
grant execute on function private.claim_demo_workspace() to authenticated;
revoke execute on function public.claim_demo_workspace() from public,anon;
grant execute on function public.claim_demo_workspace() to authenticated;

do $$
declare
 v_tenant uuid; v_branch uuid; v_supplier uuid;
 v_para uuid; v_amox uuid; v_met uuid; v_cet uuid; v_batch_para uuid; v_batch_amox uuid; v_batch_met uuid;
 v_patient uuid; v_po uuid; v_item uuid; v_sale uuid; v_order uuid;
 i integer; v_date date;
begin
 insert into public.tenants(legal_name,display_name,slug,status,country_code,timezone)
 values('HealthBuddy Demo Healthcare Pvt Ltd','HealthBuddy Demo Workspace','healthbuddy-demo','active','IN','Asia/Kolkata')
 on conflict(slug) do update set display_name=excluded.display_name,status='active'
 returning id into v_tenant;

 insert into public.branches(tenant_id,branch_code,name,status)
 values(v_tenant,'DEMO','Demo Main Branch','active')
 on conflict(tenant_id,branch_code) do update set name=excluded.name,status='active'
 returning id into v_branch;

 insert into public.tenant_module_entitlements(tenant_id,module_key,enabled)
 values(v_tenant,'patient_suite',true),(v_tenant,'pharmacy_suite',true),(v_tenant,'laboratory_suite',true),
       (v_tenant,'doctor_suite',true),(v_tenant,'care_connect',true),(v_tenant,'analytics',true)
 on conflict(tenant_id,module_key) do update set enabled=true;

 select id into v_supplier from public.pharmacy_suppliers where tenant_id=v_tenant and name='Demo Medical Distributors' limit 1;
 if v_supplier is null then
  insert into public.pharmacy_suppliers(tenant_id,name,contact_person,phone,status)
  values(v_tenant,'Demo Medical Distributors','Demo Account Manager','9000000001','active') returning id into v_supplier;
 end if;

 insert into public.medicine_catalogue(tenant_id,sku,barcode,name,generic_name,brand,strength,dosage_form,unit,gst_rate,reorder_level,prescription_required,schedule_code,status)
 values
 (v_tenant,'DEMO-PARA-500','8900000000011','Paracetamol 500 mg','Paracetamol','DemoCare','500 mg','Tablet','strip',5,20,false,null,'active'),
 (v_tenant,'DEMO-AMOX-500','8900000000012','Amoxicillin 500 mg','Amoxicillin','DemoCare','500 mg','Capsule','strip',5,15,true,'H','active'),
 (v_tenant,'DEMO-METF-500','8900000000013','Metformin 500 mg','Metformin','DemoCare','500 mg','Tablet','strip',5,25,true,null,'active'),
 (v_tenant,'DEMO-CET-10','8900000000014','Cetirizine 10 mg','Cetirizine','DemoCare','10 mg','Tablet','strip',5,10,false,null,'active')
 on conflict(tenant_id,sku) do update set barcode=excluded.barcode,name=excluded.name,gst_rate=excluded.gst_rate,reorder_level=excluded.reorder_level,status='active';

 select id into v_para from public.medicine_catalogue where tenant_id=v_tenant and sku='DEMO-PARA-500';
 select id into v_amox from public.medicine_catalogue where tenant_id=v_tenant and sku='DEMO-AMOX-500';
 select id into v_met from public.medicine_catalogue where tenant_id=v_tenant and sku='DEMO-METF-500';
 select id into v_cet from public.medicine_catalogue where tenant_id=v_tenant and sku='DEMO-CET-10';

 insert into public.medicine_batches(tenant_id,branch_id,medicine_id,supplier_id,batch_number,expiry_date,quantity_on_hand,purchase_rate,mrp,selling_rate)
 values
 (v_tenant,v_branch,v_para,v_supplier,'DEMO-PARA-26A',current_date+interval '18 months',140,12,25,20),
 (v_tenant,v_branch,v_amox,v_supplier,'DEMO-AMOX-26A',current_date+interval '12 months',80,42,85,70),
 (v_tenant,v_branch,v_met,v_supplier,'DEMO-METF-26A',current_date+interval '15 months',110,18,40,32),
 (v_tenant,v_branch,v_cet,v_supplier,'DEMO-CET-26A',current_date+interval '2 months',8,9,20,15),
 (v_tenant,v_branch,v_para,v_supplier,'DEMO-PARA-EXPIRED',current_date-interval '2 days',6,12,25,20)
 on conflict(tenant_id,branch_id,medicine_id,batch_number) do update set expiry_date=excluded.expiry_date;

 select id into v_batch_para from public.medicine_batches where tenant_id=v_tenant and branch_id=v_branch and medicine_id=v_para and batch_number='DEMO-PARA-26A';
 select id into v_batch_amox from public.medicine_batches where tenant_id=v_tenant and branch_id=v_branch and medicine_id=v_amox and batch_number='DEMO-AMOX-26A';
 select id into v_batch_met from public.medicine_batches where tenant_id=v_tenant and branch_id=v_branch and medicine_id=v_met and batch_number='DEMO-METF-26A';

 insert into public.pharmacy_purchase_orders(tenant_id,branch_id,supplier_id,order_number,status,order_date,subtotal,tax_total,total)
 values(v_tenant,v_branch,v_supplier,'DEMO-PO-0001','received',current_date-30,5000,250,5250)
 on conflict(tenant_id,order_number) do update set status='received'
 returning id into v_po;
 if not exists(select 1 from public.pharmacy_purchase_items where tenant_id=v_tenant and purchase_order_id=v_po) then
  insert into public.pharmacy_purchase_items(tenant_id,purchase_order_id,medicine_id,quantity_ordered,quantity_received,unit_cost,tax_rate)
  values(v_tenant,v_po,v_para,100,100,12,5),(v_tenant,v_po,v_amox,50,50,42,5);
 end if;

 insert into public.pharmacy_supplier_offers(tenant_id,supplier_id,medicine_id,valid_from,valid_until,list_rate,discount_percent,rebate_per_unit,scheme_buy_qty,scheme_free_qty,notes)
 select v_tenant,v_supplier,v_para,current_date-10,current_date+30,12,8,0.25,10,1,'Demo scheme: 10+1 free'
 where not exists(select 1 from public.pharmacy_supplier_offers where tenant_id=v_tenant and supplier_id=v_supplier and medicine_id=v_para and notes='Demo scheme: 10+1 free');

 insert into public.patients(tenant_id,branch_id,patient_code,full_name,phone,gender,status)
 values(v_tenant,v_branch,'DEMO-PAT-001','Aarav Demo','9000000010','male','active')
 on conflict(tenant_id,patient_code) do update set full_name=excluded.full_name
 returning id into v_patient;

 for i in 1..12 loop
  v_date:=(date_trunc('month',current_date)::date - make_interval(months=>i))::date + 5;
  insert into public.pharmacy_sales(tenant_id,branch_id,patient_id,invoice_number,sale_status,payment_status,payment_method,subtotal,tax_total,grand_total,sold_at)
  values(v_tenant,v_branch,v_patient,'DEMO-SALE-'||lpad(i::text,3,'0'),'completed','paid','upi',400+i*15,20+i,420+i*16,v_date::timestamptz)
  on conflict(tenant_id,invoice_number) do update set grand_total=excluded.grand_total
  returning id into v_sale;
  if not exists(select 1 from public.pharmacy_sale_items where tenant_id=v_tenant and sale_id=v_sale) then
   insert into public.pharmacy_sale_items(tenant_id,sale_id,medicine_id,batch_id,quantity,unit_price,tax_rate,line_total)
   values(v_tenant,v_sale,case when i%3=0 then v_met else v_para end,
          case when i%3=0 then v_batch_met else v_batch_para end,2+i%4,20,5,42+(i%4)*21);
  end if;
 end loop;

 if not exists(select 1 from public.pharmacy_expenses where tenant_id=v_tenant and description='Demo monthly rent') then
  insert into public.pharmacy_expenses(tenant_id,branch_id,category,description,amount,expense_date,payment_status)
  values(v_tenant,v_branch,'Rent','Demo monthly rent',25000,current_date-5,'unpaid');
 end if;
 if not exists(select 1 from public.pharmacy_expenses where tenant_id=v_tenant and description='Demo electricity') then
  insert into public.pharmacy_expenses(tenant_id,branch_id,category,description,amount,expense_date,payment_status)
  values(v_tenant,v_branch,'Electricity','Demo electricity',4200,current_date-3,'unpaid');
 end if;
 insert into public.employee_attendance(tenant_id,branch_id,employee_name,attendance_date,attendance_status)
 values(v_tenant,v_branch,'Demo Pharmacist',current_date,'present'),
       (v_tenant,v_branch,'Demo Assistant',current_date,'half_day')
 on conflict(tenant_id,branch_id,employee_key,attendance_date) do update set attendance_status=excluded.attendance_status;

 insert into public.pharmacy_customer_orders(tenant_id,branch_id,patient_id,order_number,order_status,customer_notes)
 values(v_tenant,v_branch,v_patient,'DEMO-RX-0001','review_required','Synthetic order for pharmacist workflow testing')
 on conflict(tenant_id,order_number) do update set order_status='review_required'
 returning id into v_order;
 if not exists(select 1 from public.pharmacy_customer_order_items where tenant_id=v_tenant and order_id=v_order) then
  insert into public.pharmacy_customer_order_items(tenant_id,order_id,medicine_id,requested_name,quantity)
  values(v_tenant,v_order,v_amox,'Amoxicillin 500 mg',10),(v_tenant,v_order,v_para,'Paracetamol 500 mg',5);
 end if;

 if not exists(select 1 from public.pharmacy_referrals where tenant_id=v_tenant and referral_code='DEMO-REFER-01') then
  insert into public.pharmacy_referrals(tenant_id,branch_id,referrer_patient_id,referral_code,referral_status,reward_points)
  values(v_tenant,v_branch,v_patient,'DEMO-REFER-01','qualified',50);
 end if;
 if not exists(select 1 from public.pharmacy_stock_holds where tenant_id=v_tenant and batch_id=v_batch_cet and hold_status='active') then
  insert into public.pharmacy_stock_holds(tenant_id,branch_id,batch_id,hold_type,reason,reference_number,hold_status,held_quantity)
  values(v_tenant,v_branch,(select id from public.medicine_batches where tenant_id=v_tenant and branch_id=v_branch and medicine_id=v_cet and batch_number='DEMO-CET-26A'),'quarantine','Synthetic quality hold for testing','DEMO-QA-01','active',2);
 end if;
end $$;
