-- pg_get_functiondef omits the default SECURITY INVOKER clause, so explicitly elevate
-- only these private implementations. Public API wrappers remain SECURITY INVOKER.
alter function private.pharmacy_record_expense_payment_impl(uuid,uuid,numeric,text,text) security definer;
alter function private.pharmacy_record_supplier_payment_impl(uuid,uuid,numeric,text,text) security definer;
alter function private.pharmacy_place_stock_hold_impl(uuid,uuid,uuid,numeric,text,text,text) security definer;
alter function private.pharmacy_release_stock_hold_impl(uuid,uuid,text) security definer;
alter function private.pharmacy_record_controlled_drug_impl(uuid,uuid,uuid,uuid,text,numeric,numeric,uuid,text,text) security definer;
alter function private.pharmacy_review_catalogue_photo_impl(uuid,uuid,text,uuid,text) security definer;
alter function private.pharmacy_review_customer_order_impl(uuid,uuid,text,text,jsonb) security definer;
