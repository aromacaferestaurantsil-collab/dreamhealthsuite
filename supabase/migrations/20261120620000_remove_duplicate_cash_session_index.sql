-- The earlier finance baseline already created this partial unique index.
-- Remove the duplicate name introduced during the hardening pass.
drop index if exists public.pharmacy_cash_one_open_session_per_branch_uidx;
