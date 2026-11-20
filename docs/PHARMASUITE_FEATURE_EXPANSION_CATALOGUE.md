# PharmaSuite feature expansion catalogue

**Status:** Product scope and implementation checklist. Items marked "existing foundation" are present in the current development branch in some form; items marked "add / complete" are not represented as production-complete. This document does not claim the listed features are implemented.

## Product boundary

All items in this document belong to **PharmaSuite**. Its Settings page is a single navigation destination at `/pharmacy-settings`, displayed as **PharmaSuite → Settings**. Settings subsections must not become top-level sidebar items. Other HealthSuite modules retain their own dashboards, roles, permissions and business logic.

## Existing foundation identified in the development branch

- Medicine catalogue, batch-level inventory, expiry views, supplier/distributor records.
- POS sales, purchase orders, goods receipt, stock adjustments, returns and stock holds/quarantine.
- Smart purchase suggestions using trailing sales, seasonality, CRM demand and available stock.
- Supplier scheme/free-goods costing.
- Expenses, supplier payments, attendance records, customer order requests and pharmacist review.
- Controlled-drug register, catalogue-photo review, referral capture, CSV/Tally/PDF-oriented exports.
- A basic authenticated customer medicine-request portal with prescription upload.
- Separate PharmaSuite navigation grouping.

These are foundations only; verify each workflow, permissions, migration and end-to-end browser behaviour before calling it production-ready.

## Feature additions and completion checklist

### 1. Customer Khata / patient credit book

- Customer-wise running ledger with opening balance, invoices, credit notes, receipts, refunds and adjustments.
- Credit limit, credit days, overdue ageing buckets, due date and blocked/hold status.
- Part payments, split tender (cash, UPI, card, bank, credit), advance receipts and on-account receipts.
- Allocate receipts to oldest invoices (FIFO) or allow authorised manual allocation.
- Customer statement with opening, debit, credit, closing balance; print, PDF, Excel and WhatsApp share.
- Payment reminders with consent, reminder schedule, delivery log and opt-out.
- Credit approval/override permissions, reason capture and audit trail.
- Customer ledger must reconcile to sales, returns and receipts; no editable free-form balance as the source of truth.

### 2. Distributor / supplier khata

- Distributor master: GSTIN, drug licence number and expiry, contacts, address, territory, payment terms, credit limit, bank/payment details and documents.
- Supplier ledger: opening balance, purchase invoices, debit/credit notes, payments, advances, discounts, scheme credits and closing balance.
- Bill-wise due dates, ageing, payment allocation, statement import and statement reconciliation.
- Distributor-wise purchase history, rate comparison, scheme history, returns window and outstanding.
- Purchase return workflow for expiry, damage, shortage and recall, with supplier credit-note tracking.
- Distributor invoice attachment and OCR-assisted bill entry with human verification.
- Drug licence expiry alerts and configurable purchase/sale restrictions where legally appropriate.
- Distributor statement and ledger export for accountant.

### 3. Credit, collections and cashbook

- Separate customer receivables and supplier payables.
- Collection register, payment voucher, receipt voucher, contra/cash-to-bank, bank book and cash book.
- Cash drawer open/close, denomination count, shift handover and cash variance approval.
- UPI/card settlement matching against bank deposits; unmatched/short/duplicate settlement queue.
- Credit exposure dashboard by customer, distributor and branch.
- Collection targets, follow-up tasks and promise-to-pay notes.
- Refund approval, payment reversal and immutable transaction audit.

### 4. Pharmacy billing and counter speed

- Park/hold and resume bills; multiple open bills; quotation/estimate and convert-to-sale.
- Keyboard shortcuts, configurable quick-sale favourites and typo/sound-alike medicine search.
- Search by brand, generic/salt, manufacturer, barcode, SKU and rack.
- Strip/pack/loose-unit conversion with pack-size validation and fractional stock protection.
- FEFO batch suggestion with authorised override and reason.
- Split payments, part payment, credit sale, advance adjustment and UPI QR.
- Multiple invoice templates, thermal 58/80 mm and A4, duplicate copy, barcode/label print and WhatsApp invoice.
- Sales return, exchange, refund, credit note and batch-level stock reversal.
- Customer/doctor prescription attachment, repeat medicine and refill reminder.

### 5. Distributor ordering and procurement

- Distributor-specific catalogue/rate contracts, PTR/PTS/MRP and customer/party price lists.
- Order by low-stock list, forecast, demand book, sales history, rack count and manual list.
- Compare supplier landed cost after trade discount, cash discount, free goods, rebate, freight and tax.
- Send purchase orders by shareable link/email/WhatsApp; track accepted, partially supplied, backordered and cancelled quantities.
- Distributor order portal/integration adapter (provider-dependent); import order acknowledgements and invoices.
- Short-book / unavailable item tracking and alternate distributor suggestions.
- Purchase invoice import by Excel/PDF/image/OCR, with batch, expiry, GST and quantity verification.
- Multi-stage goods receipt, shortage/damage claims and purchase return/debit note.
- Distributor sales representative, route/territory and contact history.

### 6. Compliance and medicine safety

- Schedule H, H1, X and NDPS/controlled-drug registers as applicable, with configurable legal rules and mandatory fields.
- Prescription validation and pharmacist approval before fulfilment of prescription-required items.
- Record prescriber, patient, prescription reference/date and dispensing details as required.
- Non-editable audit history for regulated register entries; corrections via reasoned reversal/correction records.
- Drug licence, pharmacist registration and expiry document register with reminders.
- Batch recall, quarantine, affected-sale lookup and customer notification workflow.
- FEFO warnings, expired-batch sale prevention, cold-chain/storage notes and temperature log where applicable.
- Allergy and duplicate-ingredient warnings using verified patient/medicine data; pharmacist confirmation required.
- Regulatory reports and printable register formats reviewed against current applicable Indian/state rules before production use.

### 7. Stock intelligence and store operations

- Rack/bin/godown location, shelf labels and barcode/QR label generation.
- Blind stock count, cycle count, rack-wise count, variance approval and stock valuation.
- Inter-branch stock transfer, dispatch/receipt confirmation and in-transit stock.
- Dead, slow, non-moving, fast-moving and ABC/FSN analysis.
- Expiry 30/60/90/180-day risk by batch, supplier, value and return window.
- Substitute/alternate medicine lookup by salt/composition with pharmacist approval.
- Duplicate catalogue detection, pack-size/master-data cleanup and bulk Excel import/export.
- Offline-safe counter queue and controlled sync/reconciliation for temporary connectivity loss (only if conflict-safe).

### 8. GST, accounting and financial year

- HSN/GST master, CGST/SGST/IGST, tax invoice/bill of supply and tax treatment checks.
- GSTR-1, GSTR-3B summaries, purchase register, input tax credit and GSTR-2B reconciliation support.
- E-invoice/e-way bill integration only where eligibility, credentials and provider integration are configured.
- Day book, general ledger, trial balance, P&L, balance sheet and cash-flow views.
- Tally/Excel/PDF exports with mapping validation and duplicate-import protection.
- Financial year setup, period close, year-end reconciliation, opening balance carry-forward and period lock.
- Closed periods require privileged, audited reopen with reason; never rewrite historical source transactions silently.

### 9. Customer app / PWA and delivery

- Customer sign-in/profile, branch selection, catalogue and stock-availability request.
- Search by brand/salt, upload prescription, request unavailable medicine, repeat previous order.
- Delivery, pickup and in-store collection options; delivery zones, fees, minimum order and time slots.
- Order status timeline, cancellation rules, payment choices, invoice and support contact.
- Own delivery partner app: assigned jobs, accept/reject, navigation handoff, pickup, delivery OTP/proof and cash collection reconciliation.
- Third-party delivery adapter with provider booking ID, quote, tracking URL/status and failure fallback.
- Staff order board and configurable new-order sound/visual alerts.
- Customer notifications at accepted/reviewed, ready, dispatched, delivered, cancelled and refund milestones.
- Push notification consent, quiet hours and notification delivery log.

### 10. CRM, loyalty, discount and referral engine

- Customer segmentation by recency/frequency/value, medicine category, chronic refill cadence and branch.
- Follow-up tasks, customer notes, communication consent and opt-out.
- Loyalty points earn/redeem rules, expiry, liability report and reversal on returns.
- Coupons, campaign offers, bill-level and item-level discounts, slabs, buy-X-get-Y and customer-group pricing.
- Discount floor/ceiling, margin guard, category/medicine exclusions, validity, usage limits and approval thresholds.
- Referral code, referrer/referee eligibility, reward type, release after paid/fulfilled order, caps, expiry, fraud checks and reversal.
- Campaign performance and redemption reports. No promotional recommendation may override prescription, controlled-drug or legal restrictions.

### 11. Settings — PharmaSuite → Settings

- General: pharmacy identity, branch defaults, timezone, currency, invoice numbering and tax configuration.
- Printer: receipt/label/report printer, 58/80 mm/A4, templates, copies and test print.
- Attendance: shifts, weekly off, grace time, half-day, overtime and correction approvals.
- Employees & access: roles, page/action permissions, branch scope, approval limits and session/device policy.
- Customer app: branding, catalogue visibility, ordering rules, terms and support contacts.
- Notifications & sounds: event rules, per-user sound/volume, push/email/WhatsApp/SMS provider configuration and quiet hours.
- Financial year: start/end, close checklist, opening balances, carry-forward and locked periods.
- CRM: customer groups, consent, follow-up and loyalty rules.
- Storage: private bucket usage, upload limits, retention, backup/restore status and document access.
- Discounts: allowed types, caps, eligible products, manager approval and campaign schedule.
- Referrals: code format, reward, eligibility, caps, expiry and fraud controls.
- Khata/credit: customer credit limit, days, ageing, reminders and override rules.
- Distributor: default terms, due dates, credit limits, licence expiry alerts and statement reconciliation rules.
- Delivery: own/third-party/pickup methods, zones, fees, slots and assignment rules.
- Every setting is workspace-level with branch overrides where appropriate; sensitive changes are role-protected and audited.

### 12. Reporting, security and integrations

- Sales by item, batch, category, customer, doctor, cashier, hour, branch and payment mode.
- Gross margin using actual batch landed cost, discount leakage, returns and scheme impact.
- Customer credit ageing, distributor payable ageing, cash/UPI/card reconciliation and daily close.
- Audit trail for sales edits, discounts, credit overrides, stock adjustments, refunds, role changes and settings.
- Backup/export schedule, restore drill, retention controls and data portability.
- Reports-only accountant access and branch-scoped roles.
- API/webhook integration layer for payment gateway, WhatsApp/SMS, accounting, distributor ordering, delivery and e-invoice providers.
- Integration health, retry queue, idempotency keys and failed-event dashboard.

## Implementation priority

**P0 — core shop controls:** Customer Khata, distributor ledger, credit/part-payment, cashbook/day close, payment allocation, distributor statement reconciliation, Settings foundation, role/action permissions, backup/restore and audit trail.

**P1 — pharmacy-specific operations:** FEFO and loose-unit safeguards, H1/controlled-drug workflow hardening, rack/bin and stock count, expiry return claims, GST reconciliation, refill reminders, invoice/label printing and customer order tracking.

**P2 — growth and automation:** Loyalty, campaigns, referral engine, OCR invoice capture, distributor ordering integration, own delivery partner PWA, third-party delivery adapter, offline-safe counter mode and advanced forecasting.

## Research references

The checklist was expanded after reviewing publicly described features from:
- SmartChemist pharmacy software: https://www.smartchemist.in/features
- Vigaas PharmaOS: https://www.vigaas.in/pharmaos
- Kite Pharmacy retail and wholesale: https://pharmacy.kite.company/pharmacy/
- PharmaZip brochure: https://www.microproindia.com/wp-content/uploads/2025/05/MicroPro-Pharmacy.pdf
- Fyond pharmacy software: https://www.fyond.com/pharmacy-management-software
- Entyti pharmacy operating system: https://entyti.in/features
- SmartHospital pharmacy module: https://smarthospitalindia.com/pharmacy-brochure

These are vendor-published feature descriptions, not independent product audits or legal advice. Regulatory workflows must be checked against current applicable law and local licensing requirements before release.
