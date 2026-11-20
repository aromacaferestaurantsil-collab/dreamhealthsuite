drop trigger if exists pharmacy_supplier_ledger_purchase on public.pharmacy_purchase_orders;
-- Keep the single trigger that also refreshes totals after purchase bill posting.