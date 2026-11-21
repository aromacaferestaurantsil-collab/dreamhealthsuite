-- Cover foreign-key lookups used by return posting and history queries.
create index if not exists pharmacy_returns_sale_id_idx on public.pharmacy_returns(sale_id);
create index if not exists pharmacy_returns_supplier_id_idx on public.pharmacy_returns(supplier_id);
create index if not exists pharmacy_return_items_return_id_idx on public.pharmacy_return_items(return_id);
create index if not exists pharmacy_return_items_batch_id_idx on public.pharmacy_return_items(batch_id);
create index if not exists pharmacy_return_items_medicine_id_idx on public.pharmacy_return_items(medicine_id);
