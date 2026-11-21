create or replace function private.require_prescription_reference_for_sale_item()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,private
as $$
declare v_required boolean; v_patient_id uuid; v_prescription_reference text;
begin
 select coalesce(m.prescription_required,false) into v_required
 from public.medicine_catalogue m where m.id=new.medicine_id and m.tenant_id=new.tenant_id;
 if not found then raise exception 'Medicine not found in this tenant'; end if;
 if v_required then
  select s.patient_id,s.prescription_reference into v_patient_id,v_prescription_reference
  from public.pharmacy_sales s where s.id=new.sale_id and s.tenant_id=new.tenant_id;
  if not found or v_patient_id is null or nullif(btrim(v_prescription_reference),'') is null then
   raise exception 'Prescription-required medicine sales must include a patient and prescription reference';
  end if;
 end if;
 return new;
end $$;
revoke all on function private.require_prescription_reference_for_sale_item() from public,anon,authenticated;
drop trigger if exists require_prescription_reference_for_sale_item on public.pharmacy_sale_items;
create trigger require_prescription_reference_for_sale_item before insert on public.pharmacy_sale_items
for each row execute function private.require_prescription_reference_for_sale_item();
