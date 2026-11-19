-- RECONSTRUCTED CORE SCHEMA SNAPSHOT
-- Generated from read-only structural introspection of the live HealthSuite schema.
-- No production rows, auth users, credentials, storage objects or secrets are copied.
-- This is a reconstruction, not recovery of the missing historical baseline migration.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;


create table public."audit_events" (
  "id" uuid default gen_random_uuid() not null,
  "tenant_id" uuid not null,
  "branch_id" uuid,
  "actor_user_id" uuid,
  "action" text not null,
  "entity_type" text not null,
  "entity_id" text,
  "occurred_at" timestamp with time zone default now() not null,
  "metadata" jsonb default '{}'::jsonb not null,
  "request_id" text
);

create table public."billing_invoices" (
  "id" uuid default gen_random_uuid() not null,
  "tenant_id" uuid not null,
  "subscription_id" uuid,
  "invoice_number" text not null,
  "status" text default 'draft'::text not null,
  "currency" character(3) default 'INR'::bpchar not null,
  "subtotal" numeric(14,2) default 0 not null,
  "tax_total" numeric(14,2) default 0 not null,
  "total" numeric(14,2) default 0 not null,
  "due_at" timestamp with time zone,
  "issued_at" timestamp with time zone,
  "paid_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null
);

create table public."billing_payments" (
  "id" uuid default gen_random_uuid() not null,
  "tenant_id" uuid not null,
  "invoice_id" uuid not null,
  "amount" numeric(14,2) not null,
  "currency" character(3) default 'INR'::bpchar not null,
  "payment_method" text,
  "payment_status" text default 'pending'::text not null,
  "provider" text,
  "provider_reference" text,
  "paid_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null
);

create table public."branches" (
  "id" uuid default gen_random_uuid() not null,
  "tenant_id" uuid not null,
  "branch_code" text not null,
  "name" text not null,
  "phone" text,
  "email" text,
  "address" jsonb default '{}'::jsonb not null,
  "gstin" text,
  "status" text default 'active'::text not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table public."care_job_events" (
  "id" uuid default gen_random_uuid() not null,
  "tenant_id" uuid not null,
  "job_id" uuid not null,
  "event_type" text not null,
  "notes" text,
  "location" jsonb,
  "actor_user_id" uuid,
  "occurred_at" timestamp with time zone default now() not null
);

create table public."care_jobs" (
  "id" uuid default gen_random_uuid() not null,
  "tenant_id" uuid not null,
  "branch_id" uuid not null,
  "patient_id" uuid not null,
  "service_id" uuid not null,
  "job_number" text not null,
  "assigned_to" uuid,
  "scheduled_start" timestamp with time zone,
  "scheduled_end" timestamp with time zone,
  "job_status" text default 'requested'::text not null,
  "address" jsonb default '{}'::jsonb not null,
  "instructions" text,
  "price" numeric(14,2) default 0 not null,
  "created_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "completed_at" timestamp with time zone
);

create table public."care_service_catalogue" (
  "id" uuid default gen_random_uuid() not null,
  "tenant_id" uuid not null,
  "service_code" text,
  "name" text not null,
  "description" text,
  "base_price" numeric(14,2) default 0 not null,
  "duration_minutes" integer,
  "status" text default 'active'::text not null
);

create table public."doctor_appointments" (
  "id" uuid default gen_random_uuid() not null,
  "tenant_id" uuid not null,
  "branch_id" uuid not null,
  "patient_id" uuid not null,
  "doctor_id" uuid not null,
  "appointment_number" text not null,
  "starts_at" timestamp with time zone not null,
  "ends_at" timestamp with time zone,
  "appointment_status" text default 'scheduled'::text not null,
  "reason" text,
  "notes" text,
  "created_by" uuid,
  "created_at" timestamp with time zone default now() not null
);

create table public."doctor_consultations" (
  "id" uuid default gen_random_uuid() not null,
  "tenant_id" uuid not null,
  "appointment_id" uuid not null,
  "chief_complaint" text,
  "clinical_notes" text,
  "diagnosis" text,
  "treatment_plan" text,
  "follow_up_at" timestamp with time zone,
  "created_by" uuid,
  "signed_by" uuid,
  "signed_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null
);

create table public."doctor_profiles" (
  "id" uuid default gen_random_uuid() not null,
  "tenant_id" uuid not null,
  "user_id" uuid,
  "doctor_code" text,
  "full_name" text not null,
  "specialty" text,
  "qualifications" text,
  "registration_number" text,
  "phone" text,
  "email" text,
  "consultation_fee" numeric(14,2) default 0 not null,
  "status" text default 'active'::text not null,
  "created_at" timestamp with time zone default now() not null
);

create table public."lab_booking_items" (
  "id" uuid default gen_random_uuid() not null,
  "tenant_id" uuid not null,
  "booking_id" uuid not null,
  "test_id" uuid not null,
  "price" numeric(14,2) default 0 not null,
  "item_status" text default 'pending'::text not null
);

create table public."lab_bookings" (
  "id" uuid default gen_random_uuid() not null,
  "tenant_id" uuid not null,
  "branch_id" uuid not null,
  "patient_id" uuid not null,
  "booking_number" text not null,
  "booking_status" text default 'booked'::text not null,
  "booked_at" timestamp with time zone default now() not null,
  "scheduled_at" timestamp with time zone,
  "referring_doctor" text,
  "total_amount" numeric(14,2) default 0 not null,
  "payment_status" text default 'pending'::text not null,
  "created_by" uuid,
  "created_at" timestamp with time zone default now() not null
);

create table public."lab_results" (
  "id" uuid default gen_random_uuid() not null,
  "tenant_id" uuid not null,
  "booking_item_id" uuid not null,
  "result_data" jsonb default '{}'::jsonb not null,
  "result_text" text,
  "abnormal_flag" boolean default false not null,
  "result_status" text default 'draft'::text not null,
  "entered_by" uuid,
  "verified_by" uuid,
  "verified_at" timestamp with time zone,
  "released_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table public."lab_samples" (
  "id" uuid default gen_random_uuid() not null,
  "tenant_id" uuid not null,
  "booking_item_id" uuid not null,
  "sample_code" text not null,
  "specimen_type" text,
  "collected_at" timestamp with time zone,
  "received_at" timestamp with time zone,
  "collected_by" uuid,
  "sample_status" text default 'pending'::text not null,
  "rejection_reason" text,
  "created_at" timestamp with time zone default now() not null
);

create table public."lab_test_catalogue" (
  "id" uuid default gen_random_uuid() not null,
  "tenant_id" uuid not null,
  "test_code" text,
  "name" text not null,
  "department" text,
  "specimen_type" text,
  "instructions" text,
  "price" numeric(14,2) default 0 not null,
  "turnaround_hours" integer,
  "status" text default 'active'::text not null,
  "created_at" timestamp with time zone default now() not null
);

create table public."medicine_batches" (
  "id" uuid default gen_random_uuid() not null,
  "tenant_id" uuid not null,
  "branch_id" uuid not null,
  "medicine_id" uuid not null,
  "supplier_id" uuid,
  "batch_number" text not null,
  "expiry_date" date not null,
  "quantity_on_hand" numeric(14,3) default 0 not null,
  "purchase_rate" numeric(14,2) default 0 not null,
  "mrp" numeric(14,2) default 0 not null,
  "selling_rate" numeric(14,2) default 0 not null,
  "received_at" timestamp with time zone default now() not null,
  "created_at" timestamp with time zone default now() not null
);

create table public."medicine_catalogue" (
  "id" uuid default gen_random_uuid() not null,
  "tenant_id" uuid not null,
  "sku" text,
  "name" text not null,
  "generic_name" text,
  "brand" text,
  "strength" text,
  "dosage_form" text,
  "unit" text default 'unit'::text not null,
  "hsn_code" text,
  "gst_rate" numeric(5,2) default 0 not null,
  "reorder_level" numeric(14,3) default 0 not null,
  "prescription_required" boolean default false not null,
  "status" text default 'active'::text not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table public."patient_consents" (
  "id" uuid default gen_random_uuid() not null,
  "tenant_id" uuid not null,
  "patient_id" uuid not null,
  "consent_type" text not null,
  "granted" boolean not null,
  "captured_at" timestamp with time zone default now() not null,
  "captured_by" uuid,
  "source" text default 'application'::text not null,
  "withdrawn_at" timestamp with time zone,
  "notes" text
);

create table public."patients" (
  "id" uuid default gen_random_uuid() not null,
  "tenant_id" uuid not null,
  "branch_id" uuid,
  "patient_code" text not null,
  "full_name" text not null,
  "phone" text,
  "email" text,
  "date_of_birth" date,
  "gender" text,
  "blood_group" text,
  "address" jsonb default '{}'::jsonb not null,
  "allergy_notes" text,
  "status" text default 'active'::text not null,
  "created_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table public."pharmacy_purchase_items" (
  "id" uuid default gen_random_uuid() not null,
  "tenant_id" uuid not null,
  "purchase_order_id" uuid not null,
  "medicine_id" uuid not null,
  "quantity_ordered" numeric(14,3) not null,
  "quantity_received" numeric(14,3) default 0 not null,
  "unit_cost" numeric(14,2) default 0 not null,
  "tax_rate" numeric(5,2) default 0 not null,
  "created_at" timestamp with time zone default now() not null
);

create table public."pharmacy_purchase_orders" (
  "id" uuid default gen_random_uuid() not null,
  "tenant_id" uuid not null,
  "branch_id" uuid not null,
  "supplier_id" uuid not null,
  "order_number" text not null,
  "status" text default 'draft'::text not null,
  "order_date" date default CURRENT_DATE not null,
  "expected_date" date,
  "subtotal" numeric(14,2) default 0 not null,
  "tax_total" numeric(14,2) default 0 not null,
  "total" numeric(14,2) default 0 not null,
  "created_by" uuid,
  "created_at" timestamp with time zone default now() not null
);

create table public."pharmacy_sale_items" (
  "id" uuid default gen_random_uuid() not null,
  "tenant_id" uuid not null,
  "sale_id" uuid not null,
  "medicine_id" uuid not null,
  "batch_id" uuid not null,
  "quantity" numeric(14,3) not null,
  "unit_price" numeric(14,2) not null,
  "discount" numeric(14,2) default 0 not null,
  "tax_rate" numeric(5,2) default 0 not null,
  "line_total" numeric(14,2) not null
);

create table public."pharmacy_sales" (
  "id" uuid default gen_random_uuid() not null,
  "tenant_id" uuid not null,
  "branch_id" uuid not null,
  "patient_id" uuid,
  "invoice_number" text not null,
  "sale_status" text default 'completed'::text not null,
  "payment_status" text default 'pending'::text not null,
  "payment_method" text,
  "subtotal" numeric(14,2) default 0 not null,
  "discount" numeric(14,2) default 0 not null,
  "tax_total" numeric(14,2) default 0 not null,
  "grand_total" numeric(14,2) default 0 not null,
  "prescription_reference" text,
  "sold_by" uuid,
  "sold_at" timestamp with time zone default now() not null
);

create table public."pharmacy_stock_movements" (
  "id" uuid default gen_random_uuid() not null,
  "tenant_id" uuid not null,
  "branch_id" uuid not null,
  "medicine_id" uuid not null,
  "batch_id" uuid,
  "movement_type" text not null,
  "quantity_delta" numeric(14,3) not null,
  "reference_type" text,
  "reference_id" uuid,
  "notes" text,
  "actor_user_id" uuid,
  "occurred_at" timestamp with time zone default now() not null
);

create table public."pharmacy_suppliers" (
  "id" uuid default gen_random_uuid() not null,
  "tenant_id" uuid not null,
  "name" text not null,
  "contact_person" text,
  "phone" text,
  "email" text,
  "gstin" text,
  "address" jsonb default '{}'::jsonb not null,
  "status" text default 'active'::text not null,
  "created_at" timestamp with time zone default now() not null
);

create table public."subscription_plans" (
  "id" uuid default gen_random_uuid() not null,
  "plan_code" text not null,
  "name" text not null,
  "billing_interval" text default 'monthly'::text not null,
  "price" numeric(14,2) default 0 not null,
  "currency" character(3) default 'INR'::bpchar not null,
  "module_entitlements" jsonb default '{}'::jsonb not null,
  "limits" jsonb default '{}'::jsonb not null,
  "is_public" boolean default false not null,
  "is_active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null
);

create table public."tenant_memberships" (
  "id" uuid default gen_random_uuid() not null,
  "tenant_id" uuid not null,
  "user_id" uuid not null,
  "branch_id" uuid,
  "role" text not null,
  "status" text default 'invited'::text not null,
  "invited_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table public."tenant_module_entitlements" (
  "id" uuid default gen_random_uuid() not null,
  "tenant_id" uuid not null,
  "module_key" text not null,
  "enabled" boolean default false not null,
  "settings" jsonb default '{}'::jsonb not null,
  "updated_at" timestamp with time zone default now() not null
);

create table public."tenant_subscriptions" (
  "id" uuid default gen_random_uuid() not null,
  "tenant_id" uuid not null,
  "plan_id" uuid,
  "status" text default 'trial'::text not null,
  "starts_at" timestamp with time zone default now() not null,
  "trial_ends_at" timestamp with time zone,
  "current_period_start" timestamp with time zone,
  "current_period_end" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "external_reference" text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table public."tenants" (
  "id" uuid default gen_random_uuid() not null,
  "legal_name" text not null,
  "display_name" text not null,
  "slug" text not null,
  "status" text default 'trial'::text not null,
  "country_code" text default 'IN'::text not null,
  "timezone" text default 'Asia/Kolkata'::text not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table public."user_profiles" (
  "user_id" uuid not null,
  "full_name" text,
  "phone" text,
  "avatar_url" text,
  "preferred_locale" text default 'en-IN'::text not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

alter table public."audit_events" add constraint "audit_events_actor_user_id_fkey" FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table public."audit_events" add constraint "audit_events_pkey" PRIMARY KEY (id);

alter table public."audit_events" add constraint "audit_events_tenant_id_branch_id_fkey" FOREIGN KEY (tenant_id, branch_id) REFERENCES branches(tenant_id, id);

alter table public."audit_events" add constraint "audit_events_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

alter table public."billing_invoices" add constraint "billing_invoices_pkey" PRIMARY KEY (id);

alter table public."billing_invoices" add constraint "billing_invoices_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'issued'::text, 'paid'::text, 'part_paid'::text, 'void'::text, 'overdue'::text])));

alter table public."billing_invoices" add constraint "billing_invoices_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

alter table public."billing_invoices" add constraint "billing_invoices_tenant_id_id_key" UNIQUE (tenant_id, id);

alter table public."billing_invoices" add constraint "billing_invoices_tenant_id_invoice_number_key" UNIQUE (tenant_id, invoice_number);

alter table public."billing_invoices" add constraint "billing_invoices_tenant_id_subscription_id_fkey" FOREIGN KEY (tenant_id, subscription_id) REFERENCES tenant_subscriptions(tenant_id, id);

alter table public."billing_payments" add constraint "billing_payments_amount_check" CHECK ((amount > (0)::numeric));

alter table public."billing_payments" add constraint "billing_payments_payment_status_check" CHECK ((payment_status = ANY (ARRAY['pending'::text, 'succeeded'::text, 'failed'::text, 'refunded'::text])));

alter table public."billing_payments" add constraint "billing_payments_pkey" PRIMARY KEY (id);

alter table public."billing_payments" add constraint "billing_payments_tenant_id_invoice_id_fkey" FOREIGN KEY (tenant_id, invoice_id) REFERENCES billing_invoices(tenant_id, id);

alter table public."branches" add constraint "branches_pkey" PRIMARY KEY (id);

alter table public."branches" add constraint "branches_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])));

alter table public."branches" add constraint "branches_tenant_id_branch_code_key" UNIQUE (tenant_id, branch_code);

alter table public."branches" add constraint "branches_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

alter table public."branches" add constraint "branches_tenant_id_id_key" UNIQUE (tenant_id, id);

alter table public."care_job_events" add constraint "care_job_events_actor_user_id_fkey" FOREIGN KEY (actor_user_id) REFERENCES auth.users(id);

alter table public."care_job_events" add constraint "care_job_events_pkey" PRIMARY KEY (id);

alter table public."care_job_events" add constraint "care_job_events_tenant_id_job_id_fkey" FOREIGN KEY (tenant_id, job_id) REFERENCES care_jobs(tenant_id, id) ON DELETE CASCADE;

alter table public."care_jobs" add constraint "care_jobs_assigned_to_fkey" FOREIGN KEY (assigned_to) REFERENCES auth.users(id);

alter table public."care_jobs" add constraint "care_jobs_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);

alter table public."care_jobs" add constraint "care_jobs_job_status_check" CHECK ((job_status = ANY (ARRAY['requested'::text, 'approved'::text, 'assigned'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])));

alter table public."care_jobs" add constraint "care_jobs_pkey" PRIMARY KEY (id);

alter table public."care_jobs" add constraint "care_jobs_tenant_id_branch_id_fkey" FOREIGN KEY (tenant_id, branch_id) REFERENCES branches(tenant_id, id);

alter table public."care_jobs" add constraint "care_jobs_tenant_id_id_key" UNIQUE (tenant_id, id);

alter table public."care_jobs" add constraint "care_jobs_tenant_id_job_number_key" UNIQUE (tenant_id, job_number);

alter table public."care_jobs" add constraint "care_jobs_tenant_id_patient_id_fkey" FOREIGN KEY (tenant_id, patient_id) REFERENCES patients(tenant_id, id);

alter table public."care_jobs" add constraint "care_jobs_tenant_id_service_id_fkey" FOREIGN KEY (tenant_id, service_id) REFERENCES care_service_catalogue(tenant_id, id);

alter table public."care_service_catalogue" add constraint "care_service_catalogue_pkey" PRIMARY KEY (id);

alter table public."care_service_catalogue" add constraint "care_service_catalogue_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])));

alter table public."care_service_catalogue" add constraint "care_service_catalogue_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

alter table public."care_service_catalogue" add constraint "care_service_catalogue_tenant_id_id_key" UNIQUE (tenant_id, id);

alter table public."care_service_catalogue" add constraint "care_service_catalogue_tenant_id_service_code_key" UNIQUE (tenant_id, service_code);

alter table public."doctor_appointments" add constraint "doctor_appointments_appointment_status_check" CHECK ((appointment_status = ANY (ARRAY['scheduled'::text, 'checked_in'::text, 'in_consultation'::text, 'completed'::text, 'cancelled'::text, 'no_show'::text])));

alter table public."doctor_appointments" add constraint "doctor_appointments_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);

alter table public."doctor_appointments" add constraint "doctor_appointments_pkey" PRIMARY KEY (id);

alter table public."doctor_appointments" add constraint "doctor_appointments_tenant_id_appointment_number_key" UNIQUE (tenant_id, appointment_number);

alter table public."doctor_appointments" add constraint "doctor_appointments_tenant_id_branch_id_fkey" FOREIGN KEY (tenant_id, branch_id) REFERENCES branches(tenant_id, id);

alter table public."doctor_appointments" add constraint "doctor_appointments_tenant_id_doctor_id_fkey" FOREIGN KEY (tenant_id, doctor_id) REFERENCES doctor_profiles(tenant_id, id);

alter table public."doctor_appointments" add constraint "doctor_appointments_tenant_id_id_key" UNIQUE (tenant_id, id);

alter table public."doctor_appointments" add constraint "doctor_appointments_tenant_id_patient_id_fkey" FOREIGN KEY (tenant_id, patient_id) REFERENCES patients(tenant_id, id);

alter table public."doctor_consultations" add constraint "doctor_consultations_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);

alter table public."doctor_consultations" add constraint "doctor_consultations_pkey" PRIMARY KEY (id);

alter table public."doctor_consultations" add constraint "doctor_consultations_signed_by_fkey" FOREIGN KEY (signed_by) REFERENCES auth.users(id);

alter table public."doctor_consultations" add constraint "doctor_consultations_tenant_id_appointment_id_fkey" FOREIGN KEY (tenant_id, appointment_id) REFERENCES doctor_appointments(tenant_id, id);

alter table public."doctor_consultations" add constraint "doctor_consultations_tenant_id_id_key" UNIQUE (tenant_id, id);

alter table public."doctor_profiles" add constraint "doctor_profiles_pkey" PRIMARY KEY (id);

alter table public."doctor_profiles" add constraint "doctor_profiles_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])));

alter table public."doctor_profiles" add constraint "doctor_profiles_tenant_id_doctor_code_key" UNIQUE (tenant_id, doctor_code);

alter table public."doctor_profiles" add constraint "doctor_profiles_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

alter table public."doctor_profiles" add constraint "doctor_profiles_tenant_id_id_key" UNIQUE (tenant_id, id);

alter table public."doctor_profiles" add constraint "doctor_profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);

alter table public."lab_booking_items" add constraint "lab_booking_items_item_status_check" CHECK ((item_status = ANY (ARRAY['pending'::text, 'collected'::text, 'processing'::text, 'completed'::text, 'cancelled'::text])));

alter table public."lab_booking_items" add constraint "lab_booking_items_pkey" PRIMARY KEY (id);

alter table public."lab_booking_items" add constraint "lab_booking_items_price_check" CHECK ((price >= (0)::numeric));

alter table public."lab_booking_items" add constraint "lab_booking_items_tenant_id_booking_id_fkey" FOREIGN KEY (tenant_id, booking_id) REFERENCES lab_bookings(tenant_id, id) ON DELETE CASCADE;

alter table public."lab_booking_items" add constraint "lab_booking_items_tenant_id_id_key" UNIQUE (tenant_id, id);

alter table public."lab_booking_items" add constraint "lab_booking_items_tenant_id_test_id_fkey" FOREIGN KEY (tenant_id, test_id) REFERENCES lab_test_catalogue(tenant_id, id);

alter table public."lab_bookings" add constraint "lab_bookings_booking_status_check" CHECK ((booking_status = ANY (ARRAY['booked'::text, 'collected'::text, 'processing'::text, 'completed'::text, 'cancelled'::text])));

alter table public."lab_bookings" add constraint "lab_bookings_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);

alter table public."lab_bookings" add constraint "lab_bookings_payment_status_check" CHECK ((payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'partial'::text, 'refunded'::text])));

alter table public."lab_bookings" add constraint "lab_bookings_pkey" PRIMARY KEY (id);

alter table public."lab_bookings" add constraint "lab_bookings_tenant_id_booking_number_key" UNIQUE (tenant_id, booking_number);

alter table public."lab_bookings" add constraint "lab_bookings_tenant_id_branch_id_fkey" FOREIGN KEY (tenant_id, branch_id) REFERENCES branches(tenant_id, id);

alter table public."lab_bookings" add constraint "lab_bookings_tenant_id_id_key" UNIQUE (tenant_id, id);

alter table public."lab_bookings" add constraint "lab_bookings_tenant_id_patient_id_fkey" FOREIGN KEY (tenant_id, patient_id) REFERENCES patients(tenant_id, id);

alter table public."lab_results" add constraint "lab_results_entered_by_fkey" FOREIGN KEY (entered_by) REFERENCES auth.users(id);

alter table public."lab_results" add constraint "lab_results_pkey" PRIMARY KEY (id);

alter table public."lab_results" add constraint "lab_results_result_status_check" CHECK ((result_status = ANY (ARRAY['draft'::text, 'entered'::text, 'verified'::text, 'released'::text, 'amended'::text])));

alter table public."lab_results" add constraint "lab_results_tenant_id_booking_item_id_fkey" FOREIGN KEY (tenant_id, booking_item_id) REFERENCES lab_booking_items(tenant_id, id);

alter table public."lab_results" add constraint "lab_results_tenant_id_id_key" UNIQUE (tenant_id, id);

alter table public."lab_results" add constraint "lab_results_verified_by_fkey" FOREIGN KEY (verified_by) REFERENCES auth.users(id);

alter table public."lab_samples" add constraint "lab_samples_collected_by_fkey" FOREIGN KEY (collected_by) REFERENCES auth.users(id);

alter table public."lab_samples" add constraint "lab_samples_pkey" PRIMARY KEY (id);

alter table public."lab_samples" add constraint "lab_samples_sample_status_check" CHECK ((sample_status = ANY (ARRAY['pending'::text, 'collected'::text, 'received'::text, 'rejected'::text, 'processed'::text])));

alter table public."lab_samples" add constraint "lab_samples_tenant_id_booking_item_id_fkey" FOREIGN KEY (tenant_id, booking_item_id) REFERENCES lab_booking_items(tenant_id, id) ON DELETE CASCADE;

alter table public."lab_samples" add constraint "lab_samples_tenant_id_id_key" UNIQUE (tenant_id, id);

alter table public."lab_samples" add constraint "lab_samples_tenant_id_sample_code_key" UNIQUE (tenant_id, sample_code);

alter table public."lab_test_catalogue" add constraint "lab_test_catalogue_pkey" PRIMARY KEY (id);

alter table public."lab_test_catalogue" add constraint "lab_test_catalogue_price_check" CHECK ((price >= (0)::numeric));

alter table public."lab_test_catalogue" add constraint "lab_test_catalogue_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])));

alter table public."lab_test_catalogue" add constraint "lab_test_catalogue_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

alter table public."lab_test_catalogue" add constraint "lab_test_catalogue_tenant_id_id_key" UNIQUE (tenant_id, id);

alter table public."lab_test_catalogue" add constraint "lab_test_catalogue_tenant_id_test_code_key" UNIQUE (tenant_id, test_code);

alter table public."lab_test_catalogue" add constraint "lab_test_catalogue_turnaround_hours_check" CHECK ((turnaround_hours >= 0));

alter table public."medicine_batches" add constraint "medicine_batches_mrp_check" CHECK ((mrp >= (0)::numeric));

alter table public."medicine_batches" add constraint "medicine_batches_pkey" PRIMARY KEY (id);

alter table public."medicine_batches" add constraint "medicine_batches_purchase_rate_check" CHECK ((purchase_rate >= (0)::numeric));

alter table public."medicine_batches" add constraint "medicine_batches_quantity_on_hand_check" CHECK ((quantity_on_hand >= (0)::numeric));

alter table public."medicine_batches" add constraint "medicine_batches_selling_rate_check" CHECK ((selling_rate >= (0)::numeric));

alter table public."medicine_batches" add constraint "medicine_batches_tenant_id_branch_id_fkey" FOREIGN KEY (tenant_id, branch_id) REFERENCES branches(tenant_id, id);

alter table public."medicine_batches" add constraint "medicine_batches_tenant_id_branch_id_medicine_id_batch_numb_key" UNIQUE (tenant_id, branch_id, medicine_id, batch_number);

alter table public."medicine_batches" add constraint "medicine_batches_tenant_id_id_key" UNIQUE (tenant_id, id);

alter table public."medicine_batches" add constraint "medicine_batches_tenant_id_medicine_id_fkey" FOREIGN KEY (tenant_id, medicine_id) REFERENCES medicine_catalogue(tenant_id, id);

alter table public."medicine_batches" add constraint "medicine_batches_tenant_id_supplier_id_fkey" FOREIGN KEY (tenant_id, supplier_id) REFERENCES pharmacy_suppliers(tenant_id, id);

alter table public."medicine_catalogue" add constraint "medicine_catalogue_gst_rate_check" CHECK (((gst_rate >= (0)::numeric) AND (gst_rate <= (100)::numeric)));

alter table public."medicine_catalogue" add constraint "medicine_catalogue_pkey" PRIMARY KEY (id);

alter table public."medicine_catalogue" add constraint "medicine_catalogue_reorder_level_check" CHECK ((reorder_level >= (0)::numeric));

alter table public."medicine_catalogue" add constraint "medicine_catalogue_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])));

alter table public."medicine_catalogue" add constraint "medicine_catalogue_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

alter table public."medicine_catalogue" add constraint "medicine_catalogue_tenant_id_id_key" UNIQUE (tenant_id, id);

alter table public."medicine_catalogue" add constraint "medicine_catalogue_tenant_id_sku_key" UNIQUE (tenant_id, sku);

alter table public."patient_consents" add constraint "patient_consents_captured_by_fkey" FOREIGN KEY (captured_by) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table public."patient_consents" add constraint "patient_consents_pkey" PRIMARY KEY (id);

alter table public."patient_consents" add constraint "patient_consents_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

alter table public."patient_consents" add constraint "patient_consents_tenant_id_patient_id_fkey" FOREIGN KEY (tenant_id, patient_id) REFERENCES patients(tenant_id, id);

alter table public."patients" add constraint "patients_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table public."patients" add constraint "patients_gender_check" CHECK ((gender = ANY (ARRAY['female'::text, 'male'::text, 'other'::text, 'unknown'::text])));

alter table public."patients" add constraint "patients_pkey" PRIMARY KEY (id);

alter table public."patients" add constraint "patients_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'merged'::text])));

alter table public."patients" add constraint "patients_tenant_id_branch_id_fkey" FOREIGN KEY (tenant_id, branch_id) REFERENCES branches(tenant_id, id);

alter table public."patients" add constraint "patients_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

alter table public."patients" add constraint "patients_tenant_id_id_key" UNIQUE (tenant_id, id);

alter table public."patients" add constraint "patients_tenant_id_patient_code_key" UNIQUE (tenant_id, patient_code);

alter table public."pharmacy_purchase_items" add constraint "pharmacy_purchase_items_pkey" PRIMARY KEY (id);

alter table public."pharmacy_purchase_items" add constraint "pharmacy_purchase_items_quantity_ordered_check" CHECK ((quantity_ordered > (0)::numeric));

alter table public."pharmacy_purchase_items" add constraint "pharmacy_purchase_items_quantity_received_check" CHECK ((quantity_received >= (0)::numeric));

alter table public."pharmacy_purchase_items" add constraint "pharmacy_purchase_items_tax_rate_check" CHECK (((tax_rate >= (0)::numeric) AND (tax_rate <= (100)::numeric)));

alter table public."pharmacy_purchase_items" add constraint "pharmacy_purchase_items_tenant_id_id_key" UNIQUE (tenant_id, id);

alter table public."pharmacy_purchase_items" add constraint "pharmacy_purchase_items_tenant_id_medicine_id_fkey" FOREIGN KEY (tenant_id, medicine_id) REFERENCES medicine_catalogue(tenant_id, id);

alter table public."pharmacy_purchase_items" add constraint "pharmacy_purchase_items_tenant_id_purchase_order_id_fkey" FOREIGN KEY (tenant_id, purchase_order_id) REFERENCES pharmacy_purchase_orders(tenant_id, id) ON DELETE CASCADE;

alter table public."pharmacy_purchase_items" add constraint "pharmacy_purchase_items_unit_cost_check" CHECK ((unit_cost >= (0)::numeric));

alter table public."pharmacy_purchase_orders" add constraint "pharmacy_purchase_orders_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);

alter table public."pharmacy_purchase_orders" add constraint "pharmacy_purchase_orders_pkey" PRIMARY KEY (id);

alter table public."pharmacy_purchase_orders" add constraint "pharmacy_purchase_orders_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'ordered'::text, 'part_received'::text, 'received'::text, 'cancelled'::text])));

alter table public."pharmacy_purchase_orders" add constraint "pharmacy_purchase_orders_tenant_id_branch_id_fkey" FOREIGN KEY (tenant_id, branch_id) REFERENCES branches(tenant_id, id);

alter table public."pharmacy_purchase_orders" add constraint "pharmacy_purchase_orders_tenant_id_id_key" UNIQUE (tenant_id, id);

alter table public."pharmacy_purchase_orders" add constraint "pharmacy_purchase_orders_tenant_id_order_number_key" UNIQUE (tenant_id, order_number);

alter table public."pharmacy_purchase_orders" add constraint "pharmacy_purchase_orders_tenant_id_supplier_id_fkey" FOREIGN KEY (tenant_id, supplier_id) REFERENCES pharmacy_suppliers(tenant_id, id);

alter table public."pharmacy_sale_items" add constraint "pharmacy_sale_items_pkey" PRIMARY KEY (id);

alter table public."pharmacy_sale_items" add constraint "pharmacy_sale_items_quantity_check" CHECK ((quantity > (0)::numeric));

alter table public."pharmacy_sale_items" add constraint "pharmacy_sale_items_tax_rate_check" CHECK (((tax_rate >= (0)::numeric) AND (tax_rate <= (100)::numeric)));

alter table public."pharmacy_sale_items" add constraint "pharmacy_sale_items_tenant_id_batch_id_fkey" FOREIGN KEY (tenant_id, batch_id) REFERENCES medicine_batches(tenant_id, id);

alter table public."pharmacy_sale_items" add constraint "pharmacy_sale_items_tenant_id_id_key" UNIQUE (tenant_id, id);

alter table public."pharmacy_sale_items" add constraint "pharmacy_sale_items_tenant_id_medicine_id_fkey" FOREIGN KEY (tenant_id, medicine_id) REFERENCES medicine_catalogue(tenant_id, id);

alter table public."pharmacy_sale_items" add constraint "pharmacy_sale_items_tenant_id_sale_id_fkey" FOREIGN KEY (tenant_id, sale_id) REFERENCES pharmacy_sales(tenant_id, id) ON DELETE CASCADE;

alter table public."pharmacy_sale_items" add constraint "pharmacy_sale_items_unit_price_check" CHECK ((unit_price >= (0)::numeric));

alter table public."pharmacy_sales" add constraint "pharmacy_sales_payment_method_check" CHECK ((payment_method = ANY (ARRAY['cash'::text, 'card'::text, 'upi'::text, 'bank_transfer'::text, 'credit'::text, 'other'::text])));

alter table public."pharmacy_sales" add constraint "pharmacy_sales_payment_status_check" CHECK ((payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'partial'::text, 'refunded'::text])));

alter table public."pharmacy_sales" add constraint "pharmacy_sales_pkey" PRIMARY KEY (id);

alter table public."pharmacy_sales" add constraint "pharmacy_sales_sale_status_check" CHECK ((sale_status = ANY (ARRAY['draft'::text, 'completed'::text, 'void'::text, 'refunded'::text])));

alter table public."pharmacy_sales" add constraint "pharmacy_sales_sold_by_fkey" FOREIGN KEY (sold_by) REFERENCES auth.users(id);

alter table public."pharmacy_sales" add constraint "pharmacy_sales_tenant_id_branch_id_fkey" FOREIGN KEY (tenant_id, branch_id) REFERENCES branches(tenant_id, id);

alter table public."pharmacy_sales" add constraint "pharmacy_sales_tenant_id_id_key" UNIQUE (tenant_id, id);

alter table public."pharmacy_sales" add constraint "pharmacy_sales_tenant_id_invoice_number_key" UNIQUE (tenant_id, invoice_number);

alter table public."pharmacy_sales" add constraint "pharmacy_sales_tenant_id_patient_id_fkey" FOREIGN KEY (tenant_id, patient_id) REFERENCES patients(tenant_id, id);

alter table public."pharmacy_stock_movements" add constraint "pharmacy_stock_movements_actor_user_id_fkey" FOREIGN KEY (actor_user_id) REFERENCES auth.users(id);

alter table public."pharmacy_stock_movements" add constraint "pharmacy_stock_movements_movement_type_check" CHECK ((movement_type = ANY (ARRAY['opening'::text, 'purchase'::text, 'sale'::text, 'sale_return'::text, 'purchase_return'::text, 'adjustment'::text, 'transfer_in'::text, 'transfer_out'::text, 'expiry'::text, 'damage'::text])));

alter table public."pharmacy_stock_movements" add constraint "pharmacy_stock_movements_pkey" PRIMARY KEY (id);

alter table public."pharmacy_stock_movements" add constraint "pharmacy_stock_movements_quantity_delta_check" CHECK ((quantity_delta <> (0)::numeric));

alter table public."pharmacy_stock_movements" add constraint "pharmacy_stock_movements_tenant_id_batch_id_fkey" FOREIGN KEY (tenant_id, batch_id) REFERENCES medicine_batches(tenant_id, id);

alter table public."pharmacy_stock_movements" add constraint "pharmacy_stock_movements_tenant_id_branch_id_fkey" FOREIGN KEY (tenant_id, branch_id) REFERENCES branches(tenant_id, id);

alter table public."pharmacy_stock_movements" add constraint "pharmacy_stock_movements_tenant_id_medicine_id_fkey" FOREIGN KEY (tenant_id, medicine_id) REFERENCES medicine_catalogue(tenant_id, id);

alter table public."pharmacy_suppliers" add constraint "pharmacy_suppliers_pkey" PRIMARY KEY (id);

alter table public."pharmacy_suppliers" add constraint "pharmacy_suppliers_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])));

alter table public."pharmacy_suppliers" add constraint "pharmacy_suppliers_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

alter table public."pharmacy_suppliers" add constraint "pharmacy_suppliers_tenant_id_id_key" UNIQUE (tenant_id, id);

alter table public."subscription_plans" add constraint "subscription_plans_billing_interval_check" CHECK ((billing_interval = ANY (ARRAY['monthly'::text, 'annual'::text])));

alter table public."subscription_plans" add constraint "subscription_plans_pkey" PRIMARY KEY (id);

alter table public."subscription_plans" add constraint "subscription_plans_plan_code_key" UNIQUE (plan_code);

alter table public."subscription_plans" add constraint "subscription_plans_price_check" CHECK ((price >= (0)::numeric));

alter table public."tenant_memberships" add constraint "tenant_memberships_invited_by_fkey" FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table public."tenant_memberships" add constraint "tenant_memberships_pkey" PRIMARY KEY (id);

alter table public."tenant_memberships" add constraint "tenant_memberships_role_check" CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text, 'doctor'::text, 'pharmacist'::text, 'lab_technician'::text, 'pathologist'::text, 'care_worker'::text, 'receptionist'::text, 'analyst'::text, 'staff'::text])));

alter table public."tenant_memberships" add constraint "tenant_memberships_status_check" CHECK ((status = ANY (ARRAY['invited'::text, 'active'::text, 'suspended'::text, 'removed'::text])));

alter table public."tenant_memberships" add constraint "tenant_memberships_tenant_id_branch_id_fkey" FOREIGN KEY (tenant_id, branch_id) REFERENCES branches(tenant_id, id);

alter table public."tenant_memberships" add constraint "tenant_memberships_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

alter table public."tenant_memberships" add constraint "tenant_memberships_tenant_id_user_id_key" UNIQUE (tenant_id, user_id);

alter table public."tenant_memberships" add constraint "tenant_memberships_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public."tenant_module_entitlements" add constraint "tenant_module_entitlements_module_key_check" CHECK ((module_key = ANY (ARRAY['patient_suite'::text, 'pharmacy_suite'::text, 'laboratory_suite'::text, 'doctor_suite'::text, 'care_connect'::text, 'analytics'::text])));

alter table public."tenant_module_entitlements" add constraint "tenant_module_entitlements_pkey" PRIMARY KEY (id);

alter table public."tenant_module_entitlements" add constraint "tenant_module_entitlements_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

alter table public."tenant_module_entitlements" add constraint "tenant_module_entitlements_tenant_id_module_key_key" UNIQUE (tenant_id, module_key);

alter table public."tenant_subscriptions" add constraint "tenant_subscriptions_pkey" PRIMARY KEY (id);

alter table public."tenant_subscriptions" add constraint "tenant_subscriptions_plan_id_fkey" FOREIGN KEY (plan_id) REFERENCES subscription_plans(id);

alter table public."tenant_subscriptions" add constraint "tenant_subscriptions_status_check" CHECK ((status = ANY (ARRAY['trial'::text, 'active'::text, 'past_due'::text, 'cancelled'::text, 'expired'::text, 'suspended'::text])));

alter table public."tenant_subscriptions" add constraint "tenant_subscriptions_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

alter table public."tenant_subscriptions" add constraint "tenant_subscriptions_tenant_id_id_key" UNIQUE (tenant_id, id);

alter table public."tenants" add constraint "tenants_pkey" PRIMARY KEY (id);

alter table public."tenants" add constraint "tenants_slug_key" UNIQUE (slug);

alter table public."tenants" add constraint "tenants_status_check" CHECK ((status = ANY (ARRAY['trial'::text, 'active'::text, 'suspended'::text, 'closed'::text])));

alter table public."user_profiles" add constraint "user_profiles_pkey" PRIMARY KEY (user_id);

alter table public."user_profiles" add constraint "user_profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION private.audit_row_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare v_tenant uuid; v_branch uuid; v_id text; v_action text;
begin
 if tg_op='DELETE' then
  v_tenant:=(to_jsonb(old)->>'tenant_id')::uuid; v_branch:=nullif(to_jsonb(old)->>'branch_id','')::uuid; v_id:=to_jsonb(old)->>'id';
 else
  v_tenant:=(to_jsonb(new)->>'tenant_id')::uuid; v_branch:=nullif(to_jsonb(new)->>'branch_id','')::uuid; v_id:=to_jsonb(new)->>'id';
 end if;
 v_action:=lower(tg_table_name)||'.'||lower(tg_op);
 if v_tenant is not null then
  insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id)
  values(v_tenant,v_branch,auth.uid(),v_action,tg_table_name,v_id);
 end if;
 return case when tg_op='DELETE' then old else new end;
end $function$;

CREATE OR REPLACE FUNCTION private.create_tenant_with_owner(p_legal_name text, p_display_name text, p_slug text, p_branch_name text, p_branch_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare v_user uuid := auth.uid(); v_tenant uuid;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if length(trim(coalesce(p_legal_name,'')))<2 or length(trim(coalesce(p_display_name,'')))<2 then raise exception 'Valid organisation names are required'; end if;
 if p_slug !~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$' then raise exception 'Slug must be 3-50 lowercase letters, numbers or hyphens'; end if;
 if exists(select 1 from public.tenant_memberships where user_id=v_user and status='active' and role='owner') then raise exception 'This user already owns a tenant'; end if;
 insert into public.tenants(legal_name,display_name,slug) values(trim(p_legal_name),trim(p_display_name),p_slug) returning id into v_tenant;
 insert into public.branches(tenant_id,branch_code,name) values(v_tenant,coalesce(nullif(trim(p_branch_code),''),'MAIN'),coalesce(nullif(trim(p_branch_name),''),'Main Branch'));
 insert into public.tenant_memberships(tenant_id,user_id,role,status) values(v_tenant,v_user,'owner','active');
 insert into public.tenant_module_entitlements(tenant_id,module_key,enabled)
 select v_tenant,k,true from (values('patient_suite'),('pharmacy_suite'),('laboratory_suite'),('doctor_suite'),('care_connect'),('analytics')) x(k);
 insert into public.tenant_subscriptions(tenant_id,status,trial_ends_at,current_period_start,current_period_end)
 values(v_tenant,'trial',now()+interval '14 days',now(),now()+interval '14 days');
 return v_tenant;
end $function$;

CREATE OR REPLACE FUNCTION private.has_module_access(p_tenant uuid, p_module text, p_branch uuid DEFAULT NULL::uuid, p_write boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
 select exists(
  select 1 from public.tenant_memberships m
  join public.tenant_module_entitlements e on e.tenant_id=m.tenant_id and e.module_key=p_module and e.enabled
  where m.tenant_id=p_tenant and m.user_id=(select auth.uid()) and m.status='active'
  and (p_branch is null or m.branch_id is null or m.branch_id=p_branch)
  and (not p_write or
    m.role in ('owner','admin','manager') or
    (p_module='patient_suite' and m.role in ('doctor','receptionist')) or
    (p_module='pharmacy_suite' and m.role='pharmacist') or
    (p_module='laboratory_suite' and m.role in ('lab_technician','pathologist')) or
    (p_module='doctor_suite' and m.role='doctor') or
    (p_module='care_connect' and m.role='care_worker') or
    (p_module='analytics' and m.role='analyst')
  )
 )
$function$;

CREATE OR REPLACE FUNCTION private.protect_released_lab_result()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
begin
 if old.result_status='released' and (new.result_data is distinct from old.result_data or new.result_text is distinct from old.result_text or new.result_status<>'amended') then
  raise exception 'Released results are immutable; use a formal amendment workflow';
 end if;
 if new.result_status='released' and (new.verified_by is null or new.verified_at is null or new.entered_by=new.verified_by) then
  raise exception 'A released result requires independent verification';
 end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION private.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$ begin new.updated_at=now(); return new; end $function$;

CREATE OR REPLACE FUNCTION public.create_doctor_appointment(p_tenant_id uuid, p_branch_id uuid, p_patient_id uuid, p_doctor_id uuid, p_appointment_number text, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_reason text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare v_id uuid;
begin
 if not private.has_module_access(p_tenant_id,'doctor_suite',p_branch_id,true) then raise exception 'No doctor module permission'; end if;
 if p_ends_at is not null and p_ends_at<=p_starts_at then raise exception 'Appointment end must be after start'; end if;
 perform 1 from public.doctor_profiles where id=p_doctor_id and tenant_id=p_tenant_id for update;
 if not found then raise exception 'Doctor not found in this tenant'; end if;
 if exists(select 1 from public.doctor_appointments a where a.tenant_id=p_tenant_id and a.doctor_id=p_doctor_id
   and a.appointment_status not in ('cancelled','no_show')
   and tstzrange(a.starts_at,coalesce(a.ends_at,a.starts_at+interval '30 minutes'),'[)') &&
       tstzrange(p_starts_at,coalesce(p_ends_at,p_starts_at+interval '30 minutes'),'[)')) then
   raise exception 'Doctor already has an overlapping appointment';
 end if;
 insert into public.doctor_appointments(tenant_id,branch_id,patient_id,doctor_id,appointment_number,starts_at,ends_at,reason,created_by)
 values(p_tenant_id,p_branch_id,p_patient_id,p_doctor_id,p_appointment_number,p_starts_at,p_ends_at,p_reason,auth.uid())
 returning id into v_id;
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id)
 values(p_tenant_id,p_branch_id,auth.uid(),'doctor.appointment_created','doctor_appointment',v_id::text);
 return v_id;
end $function$;

CREATE OR REPLACE FUNCTION public.create_tenant_with_owner(p_legal_name text, p_display_name text, p_slug text, p_branch_name text, p_branch_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 return private.create_tenant_with_owner(p_legal_name,p_display_name,p_slug,p_branch_name,p_branch_code);
end $function$;

CREATE OR REPLACE FUNCTION public.lab_verify_result(p_result_id uuid, p_release boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare r public.lab_results%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into r from public.lab_results where id=p_result_id for update;
 if not found then raise exception 'Result not found'; end if;
 if not private.has_module_access(r.tenant_id,'laboratory_suite',null,true) then raise exception 'No laboratory permission'; end if;
 if r.result_status not in ('entered','verified') then raise exception 'Only entered or verified results may be verified/released'; end if;
 if p_release then
  if r.result_status<>'verified' then raise exception 'Result must be verified before release'; end if;
  if r.entered_by=r.verified_by or r.verified_by is null then raise exception 'Independent verification is required before release'; end if;
  update public.lab_results set result_status='released',released_at=now(),updated_at=now() where id=p_result_id;
 else
  if r.entered_by=auth.uid() then raise exception 'Result author cannot verify their own result'; end if;
  update public.lab_results set result_status='verified',verified_by=auth.uid(),verified_at=now(),updated_at=now() where id=p_result_id;
 end if;
 insert into public.audit_events(tenant_id,actor_user_id,action,entity_type,entity_id)
 values(r.tenant_id,auth.uid(),case when p_release then 'lab.result_released' else 'lab.result_verified' end,'lab_result',p_result_id::text);
end $function$;

CREATE OR REPLACE FUNCTION public.manage_tenant_member(p_tenant_id uuid, p_user_id uuid, p_role text, p_branch_id uuid DEFAULT NULL::uuid, p_activate boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare v_id uuid; v_actor_role text; v_target_role text;
begin
 select role into v_actor_role from public.tenant_memberships
 where tenant_id=p_tenant_id and user_id=auth.uid() and status='active';
 if v_actor_role not in ('owner','admin') then raise exception 'Only tenant owner/admin can manage memberships'; end if;
 if p_role not in ('admin','manager','doctor','pharmacist','lab_technician','pathologist','care_worker','receptionist','analyst','staff') then raise exception 'Invalid or privileged role'; end if;
 if v_actor_role='admin' and p_role='admin' then raise exception 'Only the tenant owner can appoint another admin'; end if;
 select role into v_target_role from public.tenant_memberships where tenant_id=p_tenant_id and user_id=p_user_id for update;
 if v_target_role='owner' then raise exception 'The tenant owner membership cannot be changed here'; end if;
 if p_branch_id is not null and not exists(select 1 from public.branches b where b.id=p_branch_id and b.tenant_id=p_tenant_id) then raise exception 'Branch does not belong to tenant'; end if;
 insert into public.tenant_memberships(tenant_id,user_id,branch_id,role,status,invited_by)
 values(p_tenant_id,p_user_id,p_branch_id,p_role,case when p_activate then 'active' else 'invited' end,auth.uid())
 on conflict(tenant_id,user_id) do update set branch_id=excluded.branch_id,role=excluded.role,status=excluded.status,invited_by=auth.uid(),updated_at=now()
 returning id into v_id;
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id,metadata)
 values(p_tenant_id,p_branch_id,auth.uid(),'tenant.member_managed','tenant_membership',v_id::text,jsonb_build_object('role',p_role,'status',case when p_activate then 'active' else 'invited' end));
 return v_id;
end $function$;

CREATE OR REPLACE FUNCTION public.pharmacy_checkout(p_tenant_id uuid, p_branch_id uuid, p_invoice_number text, p_items jsonb, p_payment_method text DEFAULT 'cash'::text, p_patient_id uuid DEFAULT NULL::uuid, p_prescription_reference text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
 v_user uuid:=auth.uid(); v_sale uuid; v_item jsonb; v_med uuid; v_qty numeric;
 v_remaining numeric; v_take numeric; v_batch record; v_price numeric; v_tax numeric;
 v_subtotal numeric:=0; v_tax_total numeric:=0; v_line numeric; v_line_tax numeric;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if not private.has_module_access(p_tenant_id,'pharmacy_suite',p_branch_id,true) then raise exception 'No pharmacy permission for this tenant/branch'; end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'At least one sale item is required'; end if;
 insert into public.pharmacy_sales(tenant_id,branch_id,patient_id,invoice_number,sale_status,payment_status,payment_method,prescription_reference,sold_by)
 values(p_tenant_id,p_branch_id,p_patient_id,p_invoice_number,'draft','pending',p_payment_method,p_prescription_reference,v_user)
 returning id into v_sale;
 for v_item in select value from jsonb_array_elements(p_items) loop
  v_med:=(v_item->>'medicine_id')::uuid; v_qty:=(v_item->>'quantity')::numeric;
  if v_qty<=0 then raise exception 'Quantity must be positive'; end if;
  v_remaining:=v_qty;
  for v_batch in
   select b.id,b.quantity_on_hand,b.selling_rate,m.gst_rate
   from public.medicine_batches b join public.medicine_catalogue m on m.id=b.medicine_id and m.tenant_id=b.tenant_id
   where b.tenant_id=p_tenant_id and b.branch_id=p_branch_id and b.medicine_id=v_med
     and b.quantity_on_hand>0 and b.expiry_date>=current_date
   order by b.expiry_date,b.received_at,b.id for update of b
  loop
   exit when v_remaining<=0;
   v_take:=least(v_remaining,v_batch.quantity_on_hand);
   v_price:=coalesce(nullif(v_item->>'unit_price','')::numeric,v_batch.selling_rate);
   v_tax:=v_batch.gst_rate;
   v_line:=round(v_take*v_price,2);
   v_line_tax:=round(v_line*v_tax/100,2);
   update public.medicine_batches set quantity_on_hand=quantity_on_hand-v_take where id=v_batch.id;
   insert into public.pharmacy_sale_items(tenant_id,sale_id,medicine_id,batch_id,quantity,unit_price,tax_rate,line_total)
   values(p_tenant_id,v_sale,v_med,v_batch.id,v_take,v_price,v_tax,v_line+v_line_tax);
   insert into public.pharmacy_stock_movements(tenant_id,branch_id,medicine_id,batch_id,movement_type,quantity_delta,reference_type,reference_id,actor_user_id)
   values(p_tenant_id,p_branch_id,v_med,v_batch.id,'sale',-v_take,'pharmacy_sale',v_sale,v_user);
   v_subtotal:=v_subtotal+v_line; v_tax_total:=v_tax_total+v_line_tax; v_remaining:=v_remaining-v_take;
  end loop;
  if v_remaining>0 then raise exception 'Insufficient unexpired stock for medicine %; shortage %',v_med,v_remaining; end if;
 end loop;
 update public.pharmacy_sales set subtotal=v_subtotal,tax_total=v_tax_total,grand_total=v_subtotal+v_tax_total,
  sale_status='completed',payment_status='paid' where id=v_sale;
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id,metadata)
 values(p_tenant_id,p_branch_id,v_user,'pharmacy.checkout','pharmacy_sale',v_sale::text,jsonb_build_object('invoice',p_invoice_number,'total',v_subtotal+v_tax_total));
 return v_sale;
end $function$;

CREATE OR REPLACE FUNCTION public.set_module_entitlement(p_tenant_id uuid, p_module_key text, p_enabled boolean)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
 if not exists(select 1 from public.tenant_memberships m where m.tenant_id=p_tenant_id and m.user_id=auth.uid() and m.status='active' and m.role='owner') then
  raise exception 'Only tenant owner can change module entitlements';
 end if;
 update public.tenant_module_entitlements set enabled=p_enabled,updated_at=now()
 where tenant_id=p_tenant_id and module_key=p_module_key;
 if not found then raise exception 'Module entitlement not found'; end if;
 insert into public.audit_events(tenant_id,actor_user_id,action,entity_type,entity_id,metadata)
 values(p_tenant_id,auth.uid(),'tenant.module_entitlement_changed','tenant_module_entitlement',p_module_key,jsonb_build_object('enabled',p_enabled));
end $function$;

CREATE OR REPLACE FUNCTION public.transition_care_job(p_job_id uuid, p_new_status text, p_notes text DEFAULT NULL::text, p_location jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare j public.care_jobs%rowtype; v_user uuid:=auth.uid();
begin
 select * into j from public.care_jobs where id=p_job_id for update;
 if not found then raise exception 'Care job not found'; end if;
 if not private.has_module_access(j.tenant_id,'care_connect',j.branch_id,true) then raise exception 'No care module permission'; end if;
 if p_new_status not in ('approved','assigned','in_progress','completed','cancelled') then raise exception 'Invalid target status'; end if;
 if not (
  (j.job_status='requested' and p_new_status in ('approved','cancelled')) or
  (j.job_status='approved' and p_new_status in ('assigned','cancelled')) or
  (j.job_status='assigned' and p_new_status in ('in_progress','cancelled')) or
  (j.job_status='in_progress' and p_new_status in ('completed','cancelled'))
 ) then raise exception 'Invalid care job state transition'; end if;
 if j.assigned_to is not null and j.assigned_to<>v_user and p_new_status in ('in_progress','completed') and not exists(
  select 1 from public.tenant_memberships m where m.tenant_id=j.tenant_id and m.user_id=v_user and m.status='active' and m.role in ('owner','admin','manager')
 ) then raise exception 'Only the assigned worker or tenant manager may progress this job'; end if;
 update public.care_jobs set job_status=p_new_status,completed_at=case when p_new_status='completed' then now() else completed_at end,
 assigned_to=case when p_new_status='assigned' and assigned_to is null then v_user else assigned_to end
 where id=p_job_id;
 insert into public.care_job_events(tenant_id,job_id,event_type,notes,location,actor_user_id)
 values(j.tenant_id,j.id,p_new_status,p_notes,p_location,v_user);
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id)
 values(j.tenant_id,j.branch_id,v_user,'care.job_'||p_new_status,'care_job',j.id::text);
end $function$;

CREATE INDEX idx_audit_actor ON public.audit_events USING btree (actor_user_id);

CREATE INDEX idx_audit_tenant_branch ON public.audit_events USING btree (tenant_id, branch_id);

CREATE INDEX idx_audit_tenant_time ON public.audit_events USING btree (tenant_id, occurred_at DESC);

CREATE INDEX idx_fk_billing_invoices_billing_invoices_tenant_id_subscript ON public.billing_invoices USING btree (tenant_id, subscription_id);

CREATE INDEX idx_fk_billing_payments_billing_payments_tenant_id_invoice_i ON public.billing_payments USING btree (tenant_id, invoice_id);

CREATE INDEX idx_branches_tenant ON public.branches USING btree (tenant_id);

CREATE INDEX idx_fk_care_job_events_care_job_events_actor_user_id_fkey ON public.care_job_events USING btree (actor_user_id);

CREATE INDEX idx_fk_care_job_events_care_job_events_tenant_id_job_id_fkey ON public.care_job_events USING btree (tenant_id, job_id);

CREATE INDEX idx_care_jobs_assignee_time ON public.care_jobs USING btree (tenant_id, assigned_to, scheduled_start);

CREATE INDEX idx_fk_care_jobs_care_jobs_assigned_to_fkey ON public.care_jobs USING btree (assigned_to);

CREATE INDEX idx_fk_care_jobs_care_jobs_created_by_fkey ON public.care_jobs USING btree (created_by);

CREATE INDEX idx_fk_care_jobs_care_jobs_tenant_id_branch_id_fkey ON public.care_jobs USING btree (tenant_id, branch_id);

CREATE INDEX idx_fk_care_jobs_care_jobs_tenant_id_patient_id_fkey ON public.care_jobs USING btree (tenant_id, patient_id);

CREATE INDEX idx_fk_care_jobs_care_jobs_tenant_id_service_id_fkey ON public.care_jobs USING btree (tenant_id, service_id);

CREATE INDEX idx_appointments_doctor_time ON public.doctor_appointments USING btree (tenant_id, doctor_id, starts_at);

CREATE INDEX idx_fk_doctor_appointments_doctor_appointments_created_by_fk ON public.doctor_appointments USING btree (created_by);

CREATE INDEX idx_fk_doctor_appointments_doctor_appointments_tenant_id_bra ON public.doctor_appointments USING btree (tenant_id, branch_id);

CREATE INDEX idx_fk_doctor_appointments_doctor_appointments_tenant_id_pat ON public.doctor_appointments USING btree (tenant_id, patient_id);

CREATE INDEX idx_fk_doctor_consultations_doctor_consultations_created_by_ ON public.doctor_consultations USING btree (created_by);

CREATE INDEX idx_fk_doctor_consultations_doctor_consultations_signed_by_f ON public.doctor_consultations USING btree (signed_by);

CREATE INDEX idx_fk_doctor_consultations_doctor_consultations_tenant_id_a ON public.doctor_consultations USING btree (tenant_id, appointment_id);

CREATE INDEX idx_fk_doctor_profiles_doctor_profiles_user_id_fkey ON public.doctor_profiles USING btree (user_id);

CREATE INDEX idx_fk_lab_booking_items_lab_booking_items_tenant_id_booking ON public.lab_booking_items USING btree (tenant_id, booking_id);

CREATE INDEX idx_fk_lab_booking_items_lab_booking_items_tenant_id_test_id ON public.lab_booking_items USING btree (tenant_id, test_id);

CREATE INDEX idx_fk_lab_bookings_lab_bookings_created_by_fkey ON public.lab_bookings USING btree (created_by);

CREATE INDEX idx_fk_lab_bookings_lab_bookings_tenant_id_branch_id_fkey ON public.lab_bookings USING btree (tenant_id, branch_id);

CREATE INDEX idx_lab_bookings_patient_time ON public.lab_bookings USING btree (tenant_id, patient_id, booked_at DESC);

CREATE INDEX idx_fk_lab_results_lab_results_entered_by_fkey ON public.lab_results USING btree (entered_by);

CREATE INDEX idx_fk_lab_results_lab_results_tenant_id_booking_item_id_fke ON public.lab_results USING btree (tenant_id, booking_item_id);

CREATE INDEX idx_fk_lab_results_lab_results_verified_by_fkey ON public.lab_results USING btree (verified_by);

CREATE INDEX idx_fk_lab_samples_lab_samples_collected_by_fkey ON public.lab_samples USING btree (collected_by);

CREATE INDEX idx_fk_lab_samples_lab_samples_tenant_id_booking_item_id_fke ON public.lab_samples USING btree (tenant_id, booking_item_id);

CREATE INDEX idx_batches_fefo ON public.medicine_batches USING btree (tenant_id, branch_id, medicine_id, expiry_date);

CREATE INDEX idx_fk_medicine_batches_medicine_batches_tenant_id_medicine_ ON public.medicine_batches USING btree (tenant_id, medicine_id);

CREATE INDEX idx_fk_medicine_batches_medicine_batches_tenant_id_supplier_ ON public.medicine_batches USING btree (tenant_id, supplier_id);

CREATE INDEX idx_consents_captured_by ON public.patient_consents USING btree (captured_by);

CREATE INDEX idx_consents_tenant_patient ON public.patient_consents USING btree (tenant_id, patient_id);

CREATE INDEX idx_fk_patients_patients_tenant_id_branch_id_fkey ON public.patients USING btree (tenant_id, branch_id);

CREATE INDEX idx_patients_created_by ON public.patients USING btree (created_by);

CREATE INDEX idx_patients_tenant_name ON public.patients USING btree (tenant_id, full_name);

CREATE INDEX idx_patients_tenant_phone ON public.patients USING btree (tenant_id, phone);

CREATE INDEX idx_fk_pharmacy_purchase_items_pharmacy_purchase_items_tenan ON public.pharmacy_purchase_items USING btree (tenant_id, medicine_id);

CREATE INDEX idx_purchase_items_tenant_order ON public.pharmacy_purchase_items USING btree (tenant_id, purchase_order_id);

CREATE INDEX idx_fk_pharmacy_purchase_orders_pharmacy_purchase_orders_cre ON public.pharmacy_purchase_orders USING btree (created_by);

CREATE INDEX idx_fk_pharmacy_purchase_orders_pharmacy_purchase_orders_ten ON public.pharmacy_purchase_orders USING btree (tenant_id, branch_id);

CREATE INDEX idx_purchase_orders_tenant_supplier ON public.pharmacy_purchase_orders USING btree (tenant_id, supplier_id);

CREATE INDEX idx_fk_pharmacy_sale_items_pharmacy_sale_items_tenant_id_bat ON public.pharmacy_sale_items USING btree (tenant_id, batch_id);

CREATE INDEX idx_fk_pharmacy_sale_items_pharmacy_sale_items_tenant_id_med ON public.pharmacy_sale_items USING btree (tenant_id, medicine_id);

CREATE INDEX idx_fk_pharmacy_sale_items_pharmacy_sale_items_tenant_id_sal ON public.pharmacy_sale_items USING btree (tenant_id, sale_id);

CREATE INDEX idx_fk_pharmacy_sales_pharmacy_sales_sold_by_fkey ON public.pharmacy_sales USING btree (sold_by);

CREATE INDEX idx_fk_pharmacy_sales_pharmacy_sales_tenant_id_branch_id_fke ON public.pharmacy_sales USING btree (tenant_id, branch_id);

CREATE INDEX idx_fk_pharmacy_sales_pharmacy_sales_tenant_id_patient_id_fk ON public.pharmacy_sales USING btree (tenant_id, patient_id);

CREATE INDEX idx_fk_pharmacy_stock_movements_pharmacy_stock_movements_act ON public.pharmacy_stock_movements USING btree (actor_user_id);

CREATE INDEX idx_fk_pharmacy_stock_movements_pharmacy_stock_movements_ten ON public.pharmacy_stock_movements USING btree (tenant_id, batch_id);

CREATE INDEX idx_stock_movements_tenant_medicine ON public.pharmacy_stock_movements USING btree (tenant_id, medicine_id);

CREATE INDEX idx_stock_movements_tenant_time ON public.pharmacy_stock_movements USING btree (tenant_id, branch_id, occurred_at DESC);

CREATE INDEX idx_memberships_invited_by ON public.tenant_memberships USING btree (invited_by);

CREATE INDEX idx_memberships_tenant_branch ON public.tenant_memberships USING btree (tenant_id, branch_id);

CREATE INDEX idx_memberships_user_tenant ON public.tenant_memberships USING btree (user_id, tenant_id) WHERE (status = 'active'::text);

CREATE INDEX idx_fk_tenant_subscriptions_tenant_subscriptions_plan_id_fke ON public.tenant_subscriptions USING btree (plan_id);

CREATE INDEX idx_subscriptions_tenant_status ON public.tenant_subscriptions USING btree (tenant_id, status);

alter table public."audit_events" enable row level security;

alter table public."billing_invoices" enable row level security;

alter table public."billing_payments" enable row level security;

alter table public."branches" enable row level security;

alter table public."care_job_events" enable row level security;

alter table public."care_jobs" enable row level security;

alter table public."care_service_catalogue" enable row level security;

alter table public."doctor_appointments" enable row level security;

alter table public."doctor_consultations" enable row level security;

alter table public."doctor_profiles" enable row level security;

alter table public."lab_booking_items" enable row level security;

alter table public."lab_bookings" enable row level security;

alter table public."lab_results" enable row level security;

alter table public."lab_samples" enable row level security;

alter table public."lab_test_catalogue" enable row level security;

alter table public."medicine_batches" enable row level security;

alter table public."medicine_catalogue" enable row level security;

alter table public."patient_consents" enable row level security;

alter table public."patients" enable row level security;

alter table public."pharmacy_purchase_items" enable row level security;

alter table public."pharmacy_purchase_orders" enable row level security;

alter table public."pharmacy_sale_items" enable row level security;

alter table public."pharmacy_sales" enable row level security;

alter table public."pharmacy_stock_movements" enable row level security;

alter table public."pharmacy_suppliers" enable row level security;

alter table public."subscription_plans" enable row level security;

alter table public."tenant_memberships" enable row level security;

alter table public."tenant_module_entitlements" enable row level security;

alter table public."tenant_subscriptions" enable row level security;

alter table public."tenants" enable row level security;

alter table public."user_profiles" enable row level security;

create policy "audit_actor_insert" on public."audit_events" as permissive for insert to "authenticated" with check (((actor_user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM tenant_memberships m
  WHERE ((m.tenant_id = audit_events.tenant_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.status = 'active'::text))))));

create policy "audit_member_read" on public."audit_events" as permissive for select to "authenticated" using ((EXISTS ( SELECT 1
   FROM tenant_memberships m
  WHERE ((m.tenant_id = audit_events.tenant_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.status = 'active'::text) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))))));

create policy "tenant_read_invoices" on public."billing_invoices" as permissive for select to "authenticated" using ((EXISTS ( SELECT 1
   FROM tenant_memberships m
  WHERE ((m.tenant_id = billing_invoices.tenant_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.status = 'active'::text) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));

create policy "tenant_read_payments" on public."billing_payments" as permissive for select to "authenticated" using ((EXISTS ( SELECT 1
   FROM tenant_memberships m
  WHERE ((m.tenant_id = billing_payments.tenant_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.status = 'active'::text) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));

create policy "tenant_admin_insert_branches" on public."branches" as permissive for insert to "authenticated" with check ((EXISTS ( SELECT 1
   FROM tenant_memberships m
  WHERE ((m.tenant_id = branches.tenant_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.status = 'active'::text) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));

create policy "tenant_admin_update_branches" on public."branches" as permissive for update to "authenticated" using ((EXISTS ( SELECT 1
   FROM tenant_memberships m
  WHERE ((m.tenant_id = branches.tenant_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.status = 'active'::text) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text])))))) with check ((EXISTS ( SELECT 1
   FROM tenant_memberships m
  WHERE ((m.tenant_id = branches.tenant_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.status = 'active'::text) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));

create policy "tenant_member_read_branches" on public."branches" as permissive for select to "authenticated" using ((EXISTS ( SELECT 1
   FROM tenant_memberships m
  WHERE ((m.tenant_id = branches.tenant_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.status = 'active'::text) AND ((m.branch_id IS NULL) OR (m.branch_id = branches.id))))));

create policy "module_delete" on public."care_job_events" as permissive for delete to "authenticated" using (private.has_module_access(tenant_id, 'care_connect'::text, NULL::uuid, true));

create policy "module_insert" on public."care_job_events" as permissive for insert to "authenticated" with check (private.has_module_access(tenant_id, 'care_connect'::text, NULL::uuid, true));

create policy "module_read" on public."care_job_events" as permissive for select to "authenticated" using (private.has_module_access(tenant_id, 'care_connect'::text, NULL::uuid, false));

create policy "module_update" on public."care_job_events" as permissive for update to "authenticated" using (private.has_module_access(tenant_id, 'care_connect'::text, NULL::uuid, true)) with check (private.has_module_access(tenant_id, 'care_connect'::text, NULL::uuid, true));

create policy "module_delete" on public."care_jobs" as permissive for delete to "authenticated" using (private.has_module_access(tenant_id, 'care_connect'::text, branch_id, true));

create policy "module_insert" on public."care_jobs" as permissive for insert to "authenticated" with check (private.has_module_access(tenant_id, 'care_connect'::text, branch_id, true));

create policy "module_read" on public."care_jobs" as permissive for select to "authenticated" using (private.has_module_access(tenant_id, 'care_connect'::text, branch_id, false));

create policy "module_update" on public."care_jobs" as permissive for update to "authenticated" using (private.has_module_access(tenant_id, 'care_connect'::text, branch_id, true)) with check (private.has_module_access(tenant_id, 'care_connect'::text, branch_id, true));

create policy "module_delete" on public."care_service_catalogue" as permissive for delete to "authenticated" using (private.has_module_access(tenant_id, 'care_connect'::text, NULL::uuid, true));

create policy "module_insert" on public."care_service_catalogue" as permissive for insert to "authenticated" with check (private.has_module_access(tenant_id, 'care_connect'::text, NULL::uuid, true));

create policy "module_read" on public."care_service_catalogue" as permissive for select to "authenticated" using (private.has_module_access(tenant_id, 'care_connect'::text, NULL::uuid, false));

create policy "module_update" on public."care_service_catalogue" as permissive for update to "authenticated" using (private.has_module_access(tenant_id, 'care_connect'::text, NULL::uuid, true)) with check (private.has_module_access(tenant_id, 'care_connect'::text, NULL::uuid, true));

create policy "module_delete" on public."doctor_appointments" as permissive for delete to "authenticated" using (private.has_module_access(tenant_id, 'doctor_suite'::text, branch_id, true));

create policy "module_insert" on public."doctor_appointments" as permissive for insert to "authenticated" with check (private.has_module_access(tenant_id, 'doctor_suite'::text, branch_id, true));

create policy "module_read" on public."doctor_appointments" as permissive for select to "authenticated" using (private.has_module_access(tenant_id, 'doctor_suite'::text, branch_id, false));

create policy "module_update" on public."doctor_appointments" as permissive for update to "authenticated" using (private.has_module_access(tenant_id, 'doctor_suite'::text, branch_id, true)) with check (private.has_module_access(tenant_id, 'doctor_suite'::text, branch_id, true));

create policy "module_delete" on public."doctor_consultations" as permissive for delete to "authenticated" using (private.has_module_access(tenant_id, 'doctor_suite'::text, NULL::uuid, true));

create policy "module_insert" on public."doctor_consultations" as permissive for insert to "authenticated" with check (private.has_module_access(tenant_id, 'doctor_suite'::text, NULL::uuid, true));

create policy "module_read" on public."doctor_consultations" as permissive for select to "authenticated" using (private.has_module_access(tenant_id, 'doctor_suite'::text, NULL::uuid, false));

create policy "module_update" on public."doctor_consultations" as permissive for update to "authenticated" using (private.has_module_access(tenant_id, 'doctor_suite'::text, NULL::uuid, true)) with check (private.has_module_access(tenant_id, 'doctor_suite'::text, NULL::uuid, true));

create policy "module_delete" on public."doctor_profiles" as permissive for delete to "authenticated" using (private.has_module_access(tenant_id, 'doctor_suite'::text, NULL::uuid, true));

create policy "module_insert" on public."doctor_profiles" as permissive for insert to "authenticated" with check (private.has_module_access(tenant_id, 'doctor_suite'::text, NULL::uuid, true));

create policy "module_read" on public."doctor_profiles" as permissive for select to "authenticated" using (private.has_module_access(tenant_id, 'doctor_suite'::text, NULL::uuid, false));

create policy "module_update" on public."doctor_profiles" as permissive for update to "authenticated" using (private.has_module_access(tenant_id, 'doctor_suite'::text, NULL::uuid, true)) with check (private.has_module_access(tenant_id, 'doctor_suite'::text, NULL::uuid, true));

create policy "module_delete" on public."lab_booking_items" as permissive for delete to "authenticated" using (private.has_module_access(tenant_id, 'laboratory_suite'::text, NULL::uuid, true));

create policy "module_insert" on public."lab_booking_items" as permissive for insert to "authenticated" with check (private.has_module_access(tenant_id, 'laboratory_suite'::text, NULL::uuid, true));

create policy "module_read" on public."lab_booking_items" as permissive for select to "authenticated" using (private.has_module_access(tenant_id, 'laboratory_suite'::text, NULL::uuid, false));

create policy "module_update" on public."lab_booking_items" as permissive for update to "authenticated" using (private.has_module_access(tenant_id, 'laboratory_suite'::text, NULL::uuid, true)) with check (private.has_module_access(tenant_id, 'laboratory_suite'::text, NULL::uuid, true));

create policy "module_delete" on public."lab_bookings" as permissive for delete to "authenticated" using (private.has_module_access(tenant_id, 'laboratory_suite'::text, branch_id, true));

create policy "module_insert" on public."lab_bookings" as permissive for insert to "authenticated" with check (private.has_module_access(tenant_id, 'laboratory_suite'::text, branch_id, true));

create policy "module_read" on public."lab_bookings" as permissive for select to "authenticated" using (private.has_module_access(tenant_id, 'laboratory_suite'::text, branch_id, false));

create policy "module_update" on public."lab_bookings" as permissive for update to "authenticated" using (private.has_module_access(tenant_id, 'laboratory_suite'::text, branch_id, true)) with check (private.has_module_access(tenant_id, 'laboratory_suite'::text, branch_id, true));

create policy "module_insert" on public."lab_results" as permissive for insert to "authenticated" with check (private.has_module_access(tenant_id, 'laboratory_suite'::text, NULL::uuid, true));

create policy "module_read" on public."lab_results" as permissive for select to "authenticated" using (private.has_module_access(tenant_id, 'laboratory_suite'::text, NULL::uuid, false));

create policy "module_delete" on public."lab_samples" as permissive for delete to "authenticated" using (private.has_module_access(tenant_id, 'laboratory_suite'::text, NULL::uuid, true));

create policy "module_insert" on public."lab_samples" as permissive for insert to "authenticated" with check (private.has_module_access(tenant_id, 'laboratory_suite'::text, NULL::uuid, true));

create policy "module_read" on public."lab_samples" as permissive for select to "authenticated" using (private.has_module_access(tenant_id, 'laboratory_suite'::text, NULL::uuid, false));

create policy "module_update" on public."lab_samples" as permissive for update to "authenticated" using (private.has_module_access(tenant_id, 'laboratory_suite'::text, NULL::uuid, true)) with check (private.has_module_access(tenant_id, 'laboratory_suite'::text, NULL::uuid, true));

create policy "module_delete" on public."lab_test_catalogue" as permissive for delete to "authenticated" using (private.has_module_access(tenant_id, 'laboratory_suite'::text, NULL::uuid, true));

create policy "module_insert" on public."lab_test_catalogue" as permissive for insert to "authenticated" with check (private.has_module_access(tenant_id, 'laboratory_suite'::text, NULL::uuid, true));

create policy "module_read" on public."lab_test_catalogue" as permissive for select to "authenticated" using (private.has_module_access(tenant_id, 'laboratory_suite'::text, NULL::uuid, false));

create policy "module_update" on public."lab_test_catalogue" as permissive for update to "authenticated" using (private.has_module_access(tenant_id, 'laboratory_suite'::text, NULL::uuid, true)) with check (private.has_module_access(tenant_id, 'laboratory_suite'::text, NULL::uuid, true));

create policy "module_delete" on public."medicine_batches" as permissive for delete to "authenticated" using (private.has_module_access(tenant_id, 'pharmacy_suite'::text, branch_id, true));

create policy "module_insert" on public."medicine_batches" as permissive for insert to "authenticated" with check (private.has_module_access(tenant_id, 'pharmacy_suite'::text, branch_id, true));

create policy "module_read" on public."medicine_batches" as permissive for select to "authenticated" using (private.has_module_access(tenant_id, 'pharmacy_suite'::text, branch_id, false));

create policy "module_update" on public."medicine_batches" as permissive for update to "authenticated" using (private.has_module_access(tenant_id, 'pharmacy_suite'::text, branch_id, true)) with check (private.has_module_access(tenant_id, 'pharmacy_suite'::text, branch_id, true));

create policy "module_delete" on public."medicine_catalogue" as permissive for delete to "authenticated" using (private.has_module_access(tenant_id, 'pharmacy_suite'::text, NULL::uuid, true));

create policy "module_insert" on public."medicine_catalogue" as permissive for insert to "authenticated" with check (private.has_module_access(tenant_id, 'pharmacy_suite'::text, NULL::uuid, true));

create policy "module_read" on public."medicine_catalogue" as permissive for select to "authenticated" using (private.has_module_access(tenant_id, 'pharmacy_suite'::text, NULL::uuid, false));

create policy "module_update" on public."medicine_catalogue" as permissive for update to "authenticated" using (private.has_module_access(tenant_id, 'pharmacy_suite'::text, NULL::uuid, true)) with check (private.has_module_access(tenant_id, 'pharmacy_suite'::text, NULL::uuid, true));

create policy "consent_member_access" on public."patient_consents" as permissive for select to "authenticated" using ((EXISTS ( SELECT 1
   FROM (tenant_memberships m
     JOIN tenant_module_entitlements e ON (((e.tenant_id = m.tenant_id) AND (e.module_key = 'patient_suite'::text) AND e.enabled)))
  WHERE ((m.tenant_id = patient_consents.tenant_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.status = 'active'::text) AND ((m.branch_id IS NULL) OR (EXISTS ( SELECT 1
           FROM patients p
          WHERE ((p.id = patient_consents.patient_id) AND (p.tenant_id = patient_consents.tenant_id) AND (p.branch_id = m.branch_id)))))))));

create policy "consent_staff_insert" on public."patient_consents" as permissive for insert to "authenticated" with check (((captured_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM ((tenant_memberships m
     JOIN tenant_module_entitlements e ON (((e.tenant_id = m.tenant_id) AND (e.module_key = 'patient_suite'::text) AND e.enabled)))
     JOIN patients p ON (((p.id = patient_consents.patient_id) AND (p.tenant_id = patient_consents.tenant_id))))
  WHERE ((m.tenant_id = patient_consents.tenant_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.status = 'active'::text) AND ((m.branch_id IS NULL) OR (p.branch_id = m.branch_id)))))));

create policy "patient_member_access" on public."patients" as permissive for select to "authenticated" using ((EXISTS ( SELECT 1
   FROM (tenant_memberships m
     JOIN tenant_module_entitlements e ON (((e.tenant_id = m.tenant_id) AND (e.module_key = 'patient_suite'::text) AND e.enabled)))
  WHERE ((m.tenant_id = patients.tenant_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.status = 'active'::text) AND ((m.branch_id IS NULL) OR (m.branch_id = patients.branch_id))))));

create policy "patient_staff_insert" on public."patients" as permissive for insert to "authenticated" with check (((created_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM (tenant_memberships m
     JOIN tenant_module_entitlements e ON (((e.tenant_id = m.tenant_id) AND (e.module_key = 'patient_suite'::text) AND e.enabled)))
  WHERE ((m.tenant_id = patients.tenant_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.status = 'active'::text) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text, 'doctor'::text, 'receptionist'::text])) AND ((m.branch_id IS NULL) OR (m.branch_id = patients.branch_id)))))));

create policy "patient_staff_update" on public."patients" as permissive for update to "authenticated" using ((EXISTS ( SELECT 1
   FROM (tenant_memberships m
     JOIN tenant_module_entitlements e ON (((e.tenant_id = m.tenant_id) AND (e.module_key = 'patient_suite'::text) AND e.enabled)))
  WHERE ((m.tenant_id = patients.tenant_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.status = 'active'::text) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text, 'doctor'::text, 'receptionist'::text])) AND ((m.branch_id IS NULL) OR (m.branch_id = patients.branch_id)))))) with check ((EXISTS ( SELECT 1
   FROM (tenant_memberships m
     JOIN tenant_module_entitlements e ON (((e.tenant_id = m.tenant_id) AND (e.module_key = 'patient_suite'::text) AND e.enabled)))
  WHERE ((m.tenant_id = patients.tenant_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.status = 'active'::text) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text, 'doctor'::text, 'receptionist'::text])) AND ((m.branch_id IS NULL) OR (m.branch_id = patients.branch_id))))));

create policy "module_delete" on public."pharmacy_purchase_items" as permissive for delete to "authenticated" using (private.has_module_access(tenant_id, 'pharmacy_suite'::text, NULL::uuid, true));

create policy "module_insert" on public."pharmacy_purchase_items" as permissive for insert to "authenticated" with check (private.has_module_access(tenant_id, 'pharmacy_suite'::text, NULL::uuid, true));

create policy "module_read" on public."pharmacy_purchase_items" as permissive for select to "authenticated" using (private.has_module_access(tenant_id, 'pharmacy_suite'::text, NULL::uuid, false));

create policy "module_update" on public."pharmacy_purchase_items" as permissive for update to "authenticated" using (private.has_module_access(tenant_id, 'pharmacy_suite'::text, NULL::uuid, true)) with check (private.has_module_access(tenant_id, 'pharmacy_suite'::text, NULL::uuid, true));

create policy "module_delete" on public."pharmacy_purchase_orders" as permissive for delete to "authenticated" using (private.has_module_access(tenant_id, 'pharmacy_suite'::text, branch_id, true));

create policy "module_insert" on public."pharmacy_purchase_orders" as permissive for insert to "authenticated" with check (private.has_module_access(tenant_id, 'pharmacy_suite'::text, branch_id, true));

create policy "module_read" on public."pharmacy_purchase_orders" as permissive for select to "authenticated" using (private.has_module_access(tenant_id, 'pharmacy_suite'::text, branch_id, false));

create policy "module_update" on public."pharmacy_purchase_orders" as permissive for update to "authenticated" using (private.has_module_access(tenant_id, 'pharmacy_suite'::text, branch_id, true)) with check (private.has_module_access(tenant_id, 'pharmacy_suite'::text, branch_id, true));

create policy "module_delete" on public."pharmacy_sale_items" as permissive for delete to "authenticated" using (private.has_module_access(tenant_id, 'pharmacy_suite'::text, NULL::uuid, true));

create policy "module_insert" on public."pharmacy_sale_items" as permissive for insert to "authenticated" with check (private.has_module_access(tenant_id, 'pharmacy_suite'::text, NULL::uuid, true));

create policy "module_read" on public."pharmacy_sale_items" as permissive for select to "authenticated" using (private.has_module_access(tenant_id, 'pharmacy_suite'::text, NULL::uuid, false));

create policy "module_update" on public."pharmacy_sale_items" as permissive for update to "authenticated" using (private.has_module_access(tenant_id, 'pharmacy_suite'::text, NULL::uuid, true)) with check (private.has_module_access(tenant_id, 'pharmacy_suite'::text, NULL::uuid, true));

create policy "module_delete" on public."pharmacy_sales" as permissive for delete to "authenticated" using (private.has_module_access(tenant_id, 'pharmacy_suite'::text, branch_id, true));

create policy "module_insert" on public."pharmacy_sales" as permissive for insert to "authenticated" with check (private.has_module_access(tenant_id, 'pharmacy_suite'::text, branch_id, true));

create policy "module_read" on public."pharmacy_sales" as permissive for select to "authenticated" using (private.has_module_access(tenant_id, 'pharmacy_suite'::text, branch_id, false));

create policy "module_update" on public."pharmacy_sales" as permissive for update to "authenticated" using (private.has_module_access(tenant_id, 'pharmacy_suite'::text, branch_id, true)) with check (private.has_module_access(tenant_id, 'pharmacy_suite'::text, branch_id, true));

create policy "module_delete" on public."pharmacy_stock_movements" as permissive for delete to "authenticated" using (private.has_module_access(tenant_id, 'pharmacy_suite'::text, branch_id, true));

create policy "module_insert" on public."pharmacy_stock_movements" as permissive for insert to "authenticated" with check (private.has_module_access(tenant_id, 'pharmacy_suite'::text, branch_id, true));

create policy "module_read" on public."pharmacy_stock_movements" as permissive for select to "authenticated" using (private.has_module_access(tenant_id, 'pharmacy_suite'::text, branch_id, false));

create policy "module_update" on public."pharmacy_stock_movements" as permissive for update to "authenticated" using (private.has_module_access(tenant_id, 'pharmacy_suite'::text, branch_id, true)) with check (private.has_module_access(tenant_id, 'pharmacy_suite'::text, branch_id, true));

create policy "module_delete" on public."pharmacy_suppliers" as permissive for delete to "authenticated" using (private.has_module_access(tenant_id, 'pharmacy_suite'::text, NULL::uuid, true));

create policy "module_insert" on public."pharmacy_suppliers" as permissive for insert to "authenticated" with check (private.has_module_access(tenant_id, 'pharmacy_suite'::text, NULL::uuid, true));

create policy "module_read" on public."pharmacy_suppliers" as permissive for select to "authenticated" using (private.has_module_access(tenant_id, 'pharmacy_suite'::text, NULL::uuid, false));

create policy "module_update" on public."pharmacy_suppliers" as permissive for update to "authenticated" using (private.has_module_access(tenant_id, 'pharmacy_suite'::text, NULL::uuid, true)) with check (private.has_module_access(tenant_id, 'pharmacy_suite'::text, NULL::uuid, true));

create policy "public_read_active_plans" on public."subscription_plans" as permissive for select to "anon", "authenticated" using ((is_public AND is_active));

create policy "membership_self_read" on public."tenant_memberships" as permissive for select to "authenticated" using ((user_id = ( SELECT auth.uid() AS uid)));

create policy "module_entitlement_member_read" on public."tenant_module_entitlements" as permissive for select to "authenticated" using ((EXISTS ( SELECT 1
   FROM tenant_memberships m
  WHERE ((m.tenant_id = tenant_module_entitlements.tenant_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.status = 'active'::text)))));

create policy "tenant_read_subscriptions" on public."tenant_subscriptions" as permissive for select to "authenticated" using ((EXISTS ( SELECT 1
   FROM tenant_memberships m
  WHERE ((m.tenant_id = tenant_subscriptions.tenant_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.status = 'active'::text) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));

create policy "tenant_member_read_tenant" on public."tenants" as permissive for select to "authenticated" using ((EXISTS ( SELECT 1
   FROM tenant_memberships m
  WHERE ((m.tenant_id = tenants.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.status = 'active'::text)))));

create policy "profile_self_manage" on public."user_profiles" as permissive for all to "authenticated" using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();

CREATE TRIGGER audit_row_change AFTER INSERT OR DELETE OR UPDATE ON public.care_jobs FOR EACH ROW EXECUTE FUNCTION private.audit_row_change();

CREATE TRIGGER audit_row_change AFTER INSERT OR DELETE OR UPDATE ON public.doctor_appointments FOR EACH ROW EXECUTE FUNCTION private.audit_row_change();

CREATE TRIGGER audit_row_change AFTER INSERT OR DELETE OR UPDATE ON public.doctor_consultations FOR EACH ROW EXECUTE FUNCTION private.audit_row_change();

CREATE TRIGGER audit_row_change AFTER INSERT OR DELETE OR UPDATE ON public.lab_results FOR EACH ROW EXECUTE FUNCTION private.audit_row_change();

CREATE TRIGGER protect_released_lab_result BEFORE UPDATE ON public.lab_results FOR EACH ROW EXECUTE FUNCTION private.protect_released_lab_result();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.lab_results FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.medicine_catalogue FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();

CREATE TRIGGER audit_row_change AFTER INSERT OR DELETE OR UPDATE ON public.patient_consents FOR EACH ROW EXECUTE FUNCTION private.audit_row_change();

CREATE TRIGGER audit_row_change AFTER INSERT OR DELETE OR UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION private.audit_row_change();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();

CREATE TRIGGER audit_row_change AFTER INSERT OR DELETE OR UPDATE ON public.pharmacy_sales FOR EACH ROW EXECUTE FUNCTION private.audit_row_change();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.tenant_memberships FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.tenant_module_entitlements FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.tenant_subscriptions FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();

-- Least-privilege API grants. RLS policies remain the row-level authorization boundary.
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;
grant execute on function private.has_module_access(uuid,text,uuid,boolean) to authenticated;
grant execute on function public.create_tenant_with_owner(text,text,text,text,text) to authenticated;
grant execute on function public.lab_verify_result(uuid,boolean) to authenticated;
grant execute on function public.manage_tenant_member(uuid,uuid,text,uuid,boolean) to authenticated;
grant execute on function public.pharmacy_checkout(uuid,uuid,text,jsonb,text,uuid,text) to authenticated;
grant execute on function public.create_doctor_appointment(uuid,uuid,uuid,uuid,text,timestamptz,timestamptz,text) to authenticated;
grant execute on function public.transition_care_job(uuid,text,text,jsonb) to authenticated;
grant execute on function public.set_module_entitlement(uuid,text,boolean) to authenticated;
