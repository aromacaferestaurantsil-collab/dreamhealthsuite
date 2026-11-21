-- Validate pricing invariants for every newly received batch and purchase-bill line.
-- Existing historical rows are not rewritten or blocked by this trigger.
create or replace function private.validate_pharmacy_batch_pricing()
returns trigger
language plpgsql
set search_path=pg_catalog
as $$
begin
 if new.mrp is null or new.mrp<=0 or new.selling_rate is null
  or new.selling_rate<=0 or new.selling_rate>new.mrp then
  raise exception 'Batch MRP and selling rate must be positive; selling rate cannot exceed MRP';
 end if;
 return new;
end;
$$;
drop trigger if exists pharmacy_batch_pricing_guard on public.medicine_batches;
create trigger pharmacy_batch_pricing_guard
 before insert or update of mrp,selling_rate on public.medicine_batches
 for each row execute function private.validate_pharmacy_batch_pricing();

create or replace function private.validate_pharmacy_purchase_item_pricing()
returns trigger
language plpgsql
set search_path=pg_catalog
as $$
begin
 if new.mrp is not null or new.selling_rate is not null then
  if new.mrp is null or new.mrp<=0 or new.selling_rate is null
   or new.selling_rate<=0 or new.selling_rate>new.mrp then
   raise exception 'Purchase item MRP and selling rate must be positive; selling rate cannot exceed MRP';
  end if;
 end if;
 return new;
end;
$$;
drop trigger if exists pharmacy_purchase_item_pricing_guard on public.pharmacy_purchase_items;
create trigger pharmacy_purchase_item_pricing_guard
 before insert or update of mrp,selling_rate on public.pharmacy_purchase_items
 for each row execute function private.validate_pharmacy_purchase_item_pricing();
