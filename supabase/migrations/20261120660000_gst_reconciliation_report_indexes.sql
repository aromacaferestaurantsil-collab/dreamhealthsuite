-- Support GST reconciliation detail lookups and branch-period report queries.
create index if not exists pharmacy_gst_reconciliation_lines_reconciliation_idx
 on public.pharmacy_gst_reconciliation_lines(reconciliation_id);

create index if not exists pharmacy_gst_reconciliations_tenant_branch_period_idx
 on public.pharmacy_gst_reconciliations(tenant_id,branch_id,period_start,period_end);
