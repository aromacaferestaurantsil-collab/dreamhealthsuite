-- Platform licensing and release control plane. Apply only to an isolated development database first.
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  granted_by uuid references auth.users(id),
  granted_at timestamptz not null default now(),
  notes text
);
alter table public.platform_admins enable row level security;
-- No client policies: platform-admin membership is resolved only by trusted Edge Functions.

create table if not exists public.license_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  requested_by uuid not null references auth.users(id),
  product_key text not null,
  requested_seats integer not null default 1 check (requested_seats between 1 and 10000),
  request_notes text,
  request_status text not null default 'pending' check (request_status in ('pending','approved','rejected','cancelled')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now()
);
create index if not exists license_requests_tenant_created_idx on public.license_requests(tenant_id,created_at desc);
alter table public.license_requests enable row level security;

create table if not exists public.license_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  request_id uuid references public.license_requests(id),
  product_key text not null,
  key_hash text not null unique,
  key_prefix text not null,
  status text not null default 'active' check (status in ('active','suspended','revoked','expired')),
  max_devices integer not null default 1 check (max_devices between 1 and 10000),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  issued_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists license_keys_tenant_idx on public.license_keys(tenant_id,product_key);
alter table public.license_keys enable row level security;

create table if not exists public.license_device_activations (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.license_keys(id) on delete cascade,
  device_fingerprint_hash text not null,
  device_label text,
  platform text,
  activated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  deactivated_at timestamptz,
  unique(license_id,device_fingerprint_hash)
);
create index if not exists license_device_active_idx on public.license_device_activations(license_id) where deactivated_at is null;
alter table public.license_device_activations enable row level security;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('release-packages','release-packages',false,1073741824,array['application/zip','application/vnd.android.package-archive','application/octet-stream','application/x-apple-diskimage','application/x-msdownload'])
on conflict (id) do nothing;

-- Private bucket and all licensing tables are service-role-only. No anon/authenticated
-- policies are added; Edge Functions authenticate the caller and enforce tenant/admin roles.
